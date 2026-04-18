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
    const res: any = await (supabase as any).from('encuestas_satisfaccion')
      .select('*, surveys(title, name, type)')
      .eq('token', token)
      .limit(1)
      .maybeSingle();

    if (res && res.error) return null;
    return res.data || null;
  } catch (e) {
    console.error('getSatisfaccionByToken Error:', e);
    return null;
  }
}

export async function submitSatisfaccion(token: string, payload: SatisfaccionPayload): Promise<boolean> {
  const supabase = getRawSupabaseClient();
  if (!supabase) return false;
  try {
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
      .select('*, surveys(title, name)')
      .eq('participante_id', userId)
      .eq('respondida', false);

    if (res && res.error) return [];
    return res.data || [];
  } catch (e) {
    console.error('getPendingSatisfaccion Error:', e);
    return [];
  }
}
