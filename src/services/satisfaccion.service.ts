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
    if (publicMode) {
      // Shared public link: insert new anonymous row
      const { error } = await (supabase as any).from('encuestas_satisfaccion').insert({
        survey_id: publicMode.survey_id,
        token: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        respondida: true,
        respuestas_json: payload,
        respondida_en: payload.respondida_en,
        token_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // no expiry
      });
      if (error) { console.error('submitSatisfaccion (public) error', error); return false; }
      return true;
    }

    // Individual token mode: update existing row
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
    // Prevent 400 Bad Request if surveyId is not a valid UUID (common for system settings or legacy items)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(surveyId);
    if (!isUuid) return [];

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
    if (publicToken && sData.satisfaccion_token && sData.satisfaccion_token !== publicToken) {
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
