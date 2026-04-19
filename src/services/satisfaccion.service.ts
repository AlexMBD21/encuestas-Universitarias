import { getRawSupabaseClient } from './supabaseClient'

export interface SatisfaccionPayload {
  satisfaccion_estrellas: number;
  nps: number;
  aspecto_destacado: string;
  comentario: string | null;
  respondida_en: string;
}

export async function getSatisfaccionByToken(token: string): Promise<any | null> {
  const supabase = getRawSupabaseClient();
  if (!supabase) return null;
  try {
    // First try individual token in encuestas_satisfaccion
    const res: any = await (supabase as any).from('encuestas_satisfaccion')
      .select('*')
      .eq('token', token)
      .limit(1)
      .maybeSingle();

    if (res && !res.error && res.data) {
      const dbData = res.data;
      
      // Fetch related survey manually to avoid schema join 400 errors
      if (dbData.encuesta_id) {
        const pSurv: any = await (supabase as any).from('surveys')
          .select('title, type')
          .eq('id', dbData.encuesta_id)
          .maybeSingle();
          
        dbData.surveys = (pSurv && !pSurv.error && pSurv.data) ? pSurv.data : { title: 'Encuesta', type: 'simple' };
      }
      return dbData;
    }

    // Fallback: check if token matches a survey's satisfaccion_token (shared public link)
    const surveyRes: any = await (supabase as any).from('surveys')
      .select('id, title, satisfaccion_token, satisfaccion_expires_at')
      .eq('satisfaccion_token', token)
      .limit(1)
      .maybeSingle();

    if (surveyRes && !surveyRes.error && surveyRes.data) {
      const s = surveyRes.data;
      // Check expiry
      if (s.satisfaccion_expires_at && new Date(s.satisfaccion_expires_at) < new Date()) {
        return { __expired: true };
      }
      // Return a synthetic object so the form can render
      return {
        __publicMode: true,
        survey_id: s.id,
        token,
        surveys: { title: s.title }
      };
    }

    return null;
  } catch (e) {
    console.error('getSatisfaccionByToken Error:', e);
    return null;
  }
}

export async function submitSatisfaccion(token: string, payload: SatisfaccionPayload, publicMode?: { survey_id: string }): Promise<boolean> {
  const supabase = getRawSupabaseClient();
  if (!supabase) return false;
  try {
    // Both public-link and individual-token modes UPDATE the existing row.
    // The row was already created by getOrCreateSatisfaccionToken() during email identification.
    const { error } = await (supabase as any).from('encuestas_satisfaccion')
      .update({
        respondida: true,
        respuestas_json: payload,
        respondida_en: payload.respondida_en
      })
      .eq('token', token);
    
    if (error) {
      console.error('submitSatisfaccion error', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('submitSatisfaccion catch', e);
    return false;
  }
}

export async function getPendingSatisfaccion(userId: string): Promise<any[]> {
  const supabase = getRawSupabaseClient();
  if (!supabase) return [];
  try {
    const res: any = await (supabase as any).from('encuestas_satisfaccion')
      .select('*')
      .eq('participante_id', userId)
      .eq('respondida', false);

    if (res && res.error) return [];
    
    // Fetch attached surveys manually
    const pending = res.data || [];
    for (const item of pending) {
      if (item.encuesta_id) {
        const sRes: any = await (supabase as any).from('surveys')
          .select('title')
          .eq('id', item.encuesta_id)
          .maybeSingle();
        item.surveys = (sRes && !sRes.error && sRes.data) ? sRes.data : { title: 'Encuesta' };
      }
    }
    return pending;
  } catch (e) {
    console.error('getPendingSatisfaccion Error:', e);
    return [];
  }
}

export async function getSatisfaccionTokensBySurveyId(surveyId: string): Promise<any[]> {
  const supabase = getRawSupabaseClient();
  if (!supabase) return [];
  try {
    // Legacy IDs format 's_xxxx' are allowed, so we removed the strict isUuid check.

    const res: any = await (supabase as any).from('encuestas_satisfaccion')
      .select('token, participante_id, respondida, token_expires_at')
      .eq('encuesta_id', surveyId)
      .order('created_at', { ascending: true });

    if (res && res.error) return [];
    return res.data || [];
  } catch (e) {
    console.error('getSatisfaccionTokensBySurveyId Error:', e);
    return [];
  }
}

/**
 * Obtiene todas las respuestas de satisfacción para un survey y calcula métricas agregadas.
 * Usado por el creador para ver resultados y por los reportes.
 */
export async function getSatisfaccionResultsBySurveyId(surveyId: string): Promise<{
  total: number;
  respondidas: number;
  estrellas: { promedio: number; distribucion: number[] };
  nps: { score: number; detractores: number; neutrales: number; promotores: number };
  aspectos: Record<string, number>;
  comentarios: string[];
  respondentes: { email: string; respondida_en: string; estrellas: number; nps: number; aspecto: string; comentario: string | null }[];
} | null> {
  const supabase = getRawSupabaseClient();
  if (!supabase) return null;
  try {
    // Legacy IDs format 's_xxxx' are allowed.

    const res: any = await (supabase as any).from('encuestas_satisfaccion')
      .select('*')
      .eq('encuesta_id', surveyId)
      .order('created_at', { ascending: true });

    if (res && res.error) return null;
    const rows = res.data || [];
    if (rows.length === 0) return null;

    const answered = rows.filter((r: any) => r.respondida === true);
    const total = rows.length;
    const respondidas = answered.length;

    // Estrellas (1-5)
    const starDist = [0, 0, 0, 0, 0]; // índice 0 = 1 estrella, etc.
    let starSum = 0;
    answered.forEach((r: any) => {
      const json = r.respuestas_json || {};
      const stars = Number(json.satisfaccion_estrellas || 0);
      if (stars >= 1 && stars <= 5) {
        starDist[stars - 1]++;
        starSum += stars;
      }
    });
    const starAvg = respondidas > 0 ? +(starSum / respondidas).toFixed(2) : 0;

    // NPS (1-10)
    let detractores = 0, neutrales = 0, promotores = 0;
    answered.forEach((r: any) => {
      const json = r.respuestas_json || {};
      const nps = Number(json.nps || 0);
      if (nps >= 1 && nps <= 6) detractores++;
      else if (nps >= 7 && nps <= 8) neutrales++;
      else if (nps >= 9 && nps <= 10) promotores++;
    });
    const npsScore = respondidas > 0 ? Math.round(((promotores - detractores) / respondidas) * 100) : 0;

    // Aspectos
    const aspectos: Record<string, number> = {};
    answered.forEach((r: any) => {
      const json = r.respuestas_json || {};
      const asp = json.aspecto_destacado;
      if (asp && typeof asp === 'string') {
        aspectos[asp] = (aspectos[asp] || 0) + 1;
      }
    });

    // Comentarios
    const comentarios: string[] = [];
    answered.forEach((r: any) => {
      const json = r.respuestas_json || {};
      if (json.comentario && String(json.comentario).trim()) {
        comentarios.push(String(json.comentario).trim());
      }
    });

    // Lista de respondentes
    const respondentes = answered.map((r: any) => {
      const json = r.respuestas_json || {};
      return {
        email: r.participante_email || 'Anónimo',
        respondida_en: json.respondida_en || r.respondida_en || '',
        estrellas: Number(json.satisfaccion_estrellas || 0),
        nps: Number(json.nps || 0),
        aspecto: json.aspecto_destacado || '',
        comentario: json.comentario || null
      };
    });

    return {
      total,
      respondidas,
      estrellas: { promedio: starAvg, distribucion: starDist },
      nps: { score: npsScore, detractores, neutrales, promotores },
      aspectos,
      comentarios,
      respondentes
    };
  } catch (e) {
    console.error('getSatisfaccionResultsBySurveyId Error:', e);
    return null;
  }
}

/**
 * Automáticamente identifica a un participante por su correo.
 * Si no existe, crea un registro nuevo para él.
 */
export async function getOrCreateSatisfaccionToken(surveyId: string, email: string, publicToken?: string): Promise<string | null> {
  const supabase = getRawSupabaseClient();
  if (!supabase) return null;

  try {
    // 0. Verify Survey is still Open and token matches exactly
    const { data: sData, error: sErr } = await (supabase as any).from('surveys')
      .select('satisfaccion_expires_at, satisfaccion_token')
      .eq('id', surveyId)
      .maybeSingle();

    if (sErr || !sData) return null; // Invalid Survey
    if (sData.satisfaccion_expires_at && new Date(sData.satisfaccion_expires_at) < new Date()) {
       return null; // Survey Closed 
    }
    if (!sData.satisfaccion_token) {
       return null; // Survey Closed (Link removed)
    }
    if (publicToken && sData.satisfaccion_token !== publicToken) {
       return null; // Old token Link mismatch
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Buscar si ya existe
    const { data, error } = await (supabase as any).from('encuestas_satisfaccion')
      .select('token')
      .eq('encuesta_id', surveyId)
      .eq('participante_email', cleanEmail)
      .maybeSingle();

    if (data?.token) return data.token;

    // 2. Si no existe, crearlo (RLS debe permitir INSERT público)
    const { data: newData, error: insertError } = await (supabase as any).from('encuestas_satisfaccion')
      .insert({
        encuesta_id: surveyId,
        participante_email: cleanEmail,
        respondida: false,
        token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días
      })
      .select('token')
      .single();

    if (insertError) {
      console.error('Error creando participación de satisfacción:', insertError);
      return null;
    }

    return newData?.token || null;
  } catch (e) {
    console.error('getOrCreateSatisfaccionToken catch:', e);
    return null;
  }
}
