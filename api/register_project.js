const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Configuración CORS segura
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8787'
  ];
  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    allowedOrigins.push(...envOrigins);
  }

  if (origin && allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { token, projectData } = req.body || {};

  if (!token || typeof token !== 'string' || token.trim().length === 0 || token.length > 200) {
    return res.status(400).json({ error: 'Falta token obligatorio o es inválido' });
  }

  if (!projectData || typeof projectData !== 'object') {
    return res.status(400).json({ error: 'Datos del proyecto no válidos' });
  }

  if (!projectData.name || typeof projectData.name !== 'string' || projectData.name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (projectData.email && !emailRegex.test(String(projectData.email).trim())) {
    return res.status(400).json({ error: 'El correo electrónico no es válido' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Variables de entorno de Supabase faltantes (Service Role Key)' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Encontrar la encuesta por token (ignorando RLS con el Service Role)
    const { data: surveys, error: findError } = await supabaseAdmin
      .from('surveys')
      .select('id, title, link_token, linkToken, link_expires_at, linkExpiresAt, projects')
      // Buscamos primero en el JSON. Al haber estado cambiando entre snake y camelCase...
      // Hacemos un select exhaustivo y filtramos en backend
      .limit(100);

    if (findError) {
      throw findError;
    }

    // Buscamos manualmente para sortear el tema de case mapping
    const survey = surveys.find(s => s.linkToken === token || s.link_token === token);

    if (!survey) {
      return res.status(404).json({ error: 'Enlace de inscripción no válido o no encontrado.' });
    }

    const expiresAt = survey.linkExpiresAt || survey.link_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Este enlace de inscripción ha expirado.' });
    }

    // 2. Validación de duplicados (Nombre y Email)
    const currentProjects = Array.isArray(survey.projects) ? survey.projects : [];
    
    const incomingName = (projectData.name || '').trim().toLowerCase();
    const incomingEmail = (projectData.email || '').trim().toLowerCase();

    // Check for duplicate names
    const isNameDuplicate = currentProjects.some(p => (p.name || '').trim().toLowerCase() === incomingName);
    if (isNameDuplicate) {
      return res.status(400).json({ error: 'Ya existe un proyecto registrado con este nombre. Por favor, elige uno diferente.' });
    }

    // Check for duplicate emails
    if (incomingEmail) {
      const isEmailDuplicate = currentProjects.some(p => (p.contact_email || p.email || '').trim().toLowerCase() === incomingEmail);
      if (isEmailDuplicate) {
        return res.status(400).json({ error: 'Este correo electrónico ya ha registrado un proyecto para esta encuesta.' });
      }
    }

    // Helper function to escape HTML characters (mitigates XSS)
    function escapeHTML(str) {
      if (typeof str !== 'string') return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Escape and limit string lengths for Supabase persistence
    const escapedName = escapeHTML((projectData.name || '').trim()).substring(0, 150);
    const escapedDescription = escapeHTML((projectData.description || '').trim()).substring(0, 1000);
    const escapedAdvisor = escapeHTML((projectData.advisor || '').trim()).substring(0, 150);
    const escapedCategory = escapeHTML((projectData.category || '').trim()).substring(0, 100);
    const escapedEmail = escapeHTML((projectData.email || '').trim().toLowerCase()).substring(0, 150);

    let escapedMembers = '';
    if (typeof projectData.members === 'string') {
      escapedMembers = escapeHTML(projectData.members.trim()).substring(0, 500);
    } else if (Array.isArray(projectData.members)) {
      escapedMembers = projectData.members.map(m => {
        if (typeof m === 'string') return escapeHTML(m.trim()).substring(0, 150);
        if (m && typeof m === 'object') {
          return {
            name: escapeHTML((m.name || '').trim()).substring(0, 150),
            rol: escapeHTML((m.rol || '').trim()).substring(0, 100)
          };
        }
        return '';
      }).filter(Boolean);
    } else {
      escapedMembers = escapeHTML(String(projectData.members || '')).substring(0, 500);
    }

    const newProject = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name: escapedName,
      description: escapedDescription,
      category: escapedCategory,
      members: escapedMembers,
      advisor: escapedAdvisor,
      contact_email: escapedEmail
    };

    const updatedProjects = [...currentProjects, newProject];

    // 3. Actualizar la encuesta
    const { error: updateError } = await supabaseAdmin
      .from('surveys')
      .update({ projects: updatedProjects })
      .eq('id', survey.id);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ success: true, message: 'Proyecto registrado correctamente', project: newProject });
  } catch (error) {
    console.error('Error register_project:', error);
    return res.status(500).json({ error: 'Error interno del servidor al registrar el proyecto.' });
  }
}
