const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Configuración CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*') // O un origen específico en prod
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  // Manejar OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { token, projectData } = req.body;

  if (!token || !projectData) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
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
      .select('*')
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

    // 2. Insertar el proyecto
    const currentProjects = Array.isArray(survey.projects) ? survey.projects : [];
    const newProject = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name: projectData.name,
      category: projectData.category,
      members: projectData.members,
      advisor: projectData.advisor || ''
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
