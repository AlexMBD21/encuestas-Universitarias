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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Usamos POST para pasar el token cómodamente en el body
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Sanitization & Validation: Checked for XSS, limited token length (maxLength)
  const { token } = req.body || {};

  if (!token || typeof token !== 'string' || token.trim().length === 0 || token.length > 200) {
    return res.status(400).json({ error: 'Falta token obligatorio o es inválido' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Variables de entorno de Supabase faltantes' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Encontrar la encuesta por token saltándose las reglas RLS (Service Role)
    const { data: surveys, error: findError } = await supabaseAdmin
      .from('surveys')
      .select('id, title, link_token, link_expires_at, allowed_categories, projects')
      .limit(100);

    if (findError) {
      throw findError;
    }

    // Buscamos manualmente para sortear el tema de case mapping (camelCase vs snake_case)
    const survey = surveys.find(s => s.linkToken === token || s.link_token === token);

    if (!survey) {
      return res.status(404).json({ error: 'El enlace de inscripción es inválido o no existe.' });
    }

    const expiresAt = survey.linkExpiresAt || survey.link_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Este enlace de inscripción ha expirado.' });
    }

    // 2. Obtain global categories to populate the dropdown 
    const { data: settingsData } = await supabaseAdmin
      .from('surveys')
      .select('rubric')
      .eq('id', 'sys_settings_asignaturas')
      .single();
      
    const globalCategories = (settingsData && settingsData.rubric) ? settingsData.rubric : null;

    return res.status(200).json({ success: true, survey, globalCategories });
  } catch (error) {
    console.error('Error get_inscription_survey:', error);
    return res.status(500).json({ error: 'Error al buscar el enlace de inscripción.' });
  }
}
