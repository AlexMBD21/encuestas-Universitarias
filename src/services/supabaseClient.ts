import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env.SUPABASE_URL) || ''
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || ''

let supabase: SupabaseClient | null = null
let enabled = false
let _connected = true
let currentUserCache: any = null

function ensureClient() {
  if (!supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    console.debug('[supabaseClient] ensureClient: initializing; SUPABASE_URL set=', !!SUPABASE_URL, 'ANON_KEY set=', !!SUPABASE_ANON_KEY)
    try {
      // Ensure session persistence across browser restarts by explicitly
      // enabling persistSession and using window.localStorage as storage.
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, storage: (typeof window !== 'undefined' ? window.localStorage : undefined), detectSessionInUrl: false }
      })
      enabled = true
      // populate current user cache
      try { (async () => {
        try {
          const s = await supabase!.auth.getSession()
          const sessionUser = s && (s as any).data && (s as any).data.session ? (s as any).data.session.user : null
          const prevId = currentUserCache ? String((currentUserCache as any).id || '') : ''
          currentUserCache = sessionUser
          // Only notify if user changed (avoids duplicate events during init + onAuthStateChange)
          const newId = currentUserCache ? String((currentUserCache as any).id || '') : ''
          if (newId !== prevId) {
            try { window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: currentUserCache ? { uid: currentUserCache.id, email: currentUserCache.email } : null } })) } catch (e) { /* ignore */ }
          }
        } catch (e) { console.debug('[supabaseClient] getSession failed', e) }
      })() } catch (e) { console.debug('[supabaseClient] async session init failed', e) }

      try {
        // notify app that a realtime provider is available
        try { window.dispatchEvent(new CustomEvent('realtime:connected', { detail: { connected: true } })) } catch (e) { console.debug('[supabaseClient] realtime event dispatch failed', e) }
      } catch (e) { console.debug('[supabaseClient] realtime notify error', e) }

      try {
        const res: any = (supabase as any).auth.onAuthStateChange((event: any, session: any) => {
          try {
            const prevId = currentUserCache ? String((currentUserCache as any).id || '') : ''
            const newUser = session && session.user ? session.user : null
            currentUserCache = newUser
            const newId = currentUserCache ? String((currentUserCache as any).id || '') : ''
            if (newId !== prevId) {
              try { window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: currentUserCache ? { uid: currentUserCache.id, email: currentUserCache.email } : null } })) } catch (err) { console.debug('[supabaseClient] auth:changed dispatch failed', err) }
            }
          } catch (err) { console.debug('[supabaseClient] onAuthStateChange handler error', err) }
        })
        // keep subscription reference in case we need it
        if (res && res.data && res.data.subscription) {
          // nothing to store globally for now
        }
      } catch (e) { console.debug('[supabaseClient] auth.onAuthStateChange error', e) }
    } catch (e) {
      console.error('[supabaseClient] failed to initialize Supabase client', e)
      enabled = false
      supabase = null
    }
  }
}

export function initFirebase() {
  ensureClient()
  return { enabled }
}

export function isEnabled() { ensureClient(); return !!enabled }

export function debugInfo() {
  try { ensureClient() } catch (e) {}
  return {
    enabled: !!enabled,
    urlSet: !!SUPABASE_URL,
    anonKeySet: !!SUPABASE_ANON_KEY,
    currentUser: currentUserCache ? { id: currentUserCache.id, email: currentUserCache.email } : null
  }
}

// Development-only debug helper: expose a snapshot of relevant storage keys
function mask(s: string, keepStart = 6, keepEnd = 4) {
  if (!s) return s
  if (s.length <= keepStart + keepEnd) return s.slice(0, 4) + '...'
  return s.slice(0, keepStart) + '...' + s.slice(s.length - keepEnd)
}

export function debugStorageSnapshot() {
  const out: any = { localStorage: {}, cookies: '' }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i) || ''
        if (/supabase|sb|auth|token|session|edusurvey|hiddenNotifications/i.test(k)) {
          try { out.localStorage[k] = mask(window.localStorage.getItem(k) || '') } catch (e) { out.localStorage[k] = '[unreadable]' }
        }
      }
    }
  } catch (e) {}
  try { if (typeof document !== 'undefined') out.cookies = ('; ' + document.cookie).split('; ').slice(-5).join('; ') } catch (e) {}
  return out
}

// Expose debug helpers on window in dev mode for convenience
try {
  if (typeof window !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV) {
    try { (window as any).__EDUSURVEY_SUPABASE__ = { debugInfo, debugStorageSnapshot, getClient: () => supabase } } catch (e) {}
  }
} catch (e) {}

export async function firebaseSignIn(email: string, password: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password } as any)
    if (error) {
      console.error('[supabaseClient] signInWithPassword error', error)
      throw error
    }
    currentUserCache = data && (data as any).user ? (data as any).user : null
    try { window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: currentUserCache ? { uid: currentUserCache.id, email: currentUserCache.email } : null } })) } catch (e) { console.debug('[supabaseClient] auth:changed dispatch failed after signIn', e) }
    return currentUserCache
  } catch (err) {
    console.error('[supabaseClient] firebaseSignIn unexpected error', err)
    throw err
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  // Supabase requires session to update password; try to update directly
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  try {
    const { data, error } = await supabase.auth.updateUser({ password: String(newPassword) } as any)
    if (error) throw error
    return true
  } catch (e) { throw e }
}

export async function firebaseSignOut() {
  ensureClient()
  if (!supabase) return
  try { await supabase.auth.signOut() } catch (e) {}
}

export function onAuthChanged(cb: (user: any | null) => void) {
  ensureClient()
  if (!supabase) return () => {}
  try {
    const sub: any = (supabase as any).auth.onAuthStateChange((event: any, session: any) => {
      try { cb(session && session.user ? session.user : null) } catch (e) {}
    })
    const subscription = sub && sub.data && sub.data.subscription ? sub.data.subscription : null
    return () => { try { subscription && subscription.unsubscribe && subscription.unsubscribe() } catch (e) {} }
  } catch (e) { return () => {} }
}

export function getAuthCurrentUser() {
  try { return currentUserCache || null } catch (e) { return null }
}

/**
 * Validates the current session against the Supabase server.
 * Unlike getAuthCurrentUser() which reads the local cache, this makes
 * an actual network request so it detects accounts deleted from Supabase Auth.
 * Returns the user object if valid, or null if the session is invalid/missing.
 */
export async function getServerUser(): Promise<any | null> {
  ensureClient()
  if (!supabase) return null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) return null
    return data.user
  } catch (e) {
    return null
  }
}

export async function getCurrentUserClaims(forceRefresh: boolean = false) {
  try {
    ensureClient()
    if (!supabase) return {}
    try {
      const r: any = await supabase.auth.getUser()
      const u = r && r.data ? r.data.user : null
      // app_metadata is server-only (not editable by users); prefer it for role claims.
      // Fall back to user_metadata for non-security fields like display names.
      if (!u) return {}
      return { ...(u.user_metadata || {}), ...(u.app_metadata || {}) }
    } catch (e) { return {} }
  } catch (e) { return {} }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    ensureClient()
    if (!supabase) return null
    try {
      const r: any = await supabase.auth.getSession()
      const token = r && r.data && r.data.session ? (r.data.session.access_token || null) : null
      return token
    } catch (e) { return null }
  } catch (e) { return null }
}

export function isConnected() { return !!_connected }

export function onConnectionChanged(cb: (connected: boolean) => void) { try { cb(true); return () => {} } catch (e) { return () => {} } }

// Data helpers
async function rowsToArray(tableRes: any) {
  if (!tableRes) return []
  const { data, error } = tableRes
  if (error) { return [] }
  if (!Array.isArray(data)) return []
  // convert snake_case DB columns to camelCase for the app
  const snakeToCamel = (s: string) => String(s).replace(/_([a-z])/g, (_m, p1) => p1.toUpperCase())
  const convert = (row: any) => {
    if (!row || typeof row !== 'object') return row
    const out: any = {}
    for (const k of Object.keys(row)) {
      try { out[snakeToCamel(k)] = row[k] } catch (e) { out[k] = row[k] }
    }
    return out
  }
  return data.map((r: any) => convert(r))
}

// convert camelCase keys to snake_case for DB writes (shallow)
function camelToSnakeObject(obj: any) {
  if (!obj || typeof obj !== 'object') return obj
  const camelToSnake = (s: string) => String(s).replace(/([A-Z])/g, m => '_' + m.toLowerCase())
  const out: any = {}
  for (const k of Object.keys(obj)) {
    out[camelToSnake(k)] = obj[k]
  }
  return out
}

export async function getSurveysOnce(): Promise<any[]> {
  ensureClient()
  if (!supabase) return []
  try {
    const res = await supabase.from('surveys').select('*')
    return rowsToArray(res)
  } catch (e) { console.error('getSurveysOnce', e); return [] }
}

export async function getSurveyById(id: string): Promise<any | null> {
  ensureClient()
  if (!supabase) return null
  try {
    const res: any = await supabase.from('surveys').select('*').eq('id', id).limit(1).maybeSingle()
    if (res && res.error) return null
    const data = res && res.data ? res.data : null
    if (!data) return null
    // convert single row keys to camelCase
    const snakeToCamel = (s: string) => String(s).replace(/_([a-z])/g, (_m, p1) => p1.toUpperCase())
    const out: any = {}
    for (const k of Object.keys(data)) { try { out[snakeToCamel(k)] = data[k] } catch (e) { out[k] = data[k] } }
    return out
  } catch (e) { console.error('getSurveyById', e); return null }
}

export function listenSurveys(cb: (surveys: any[]) => void) {
  ensureClient()
  if (!supabase) return () => {}
  let channel: any = null
  let mounted = true
  let lastJson = ''
  const refetch = async () => {
    if (!mounted) return
    try {
      const arr = await getSurveysOnce()
      if (!mounted) return
      let json = ''
      try { json = JSON.stringify(arr) } catch (e) {}
      if (json !== lastJson) {
        lastJson = json
        try { cb(arr) } catch (e) {}
      }
    } catch (e) {}
  }
  // initial fetch
  getSurveysOnce().then((arr) => {
    if (!mounted) return
    try { lastJson = JSON.stringify(arr) } catch (e) {}
    try { cb(arr) } catch (e) {}
  })
  try {
    const surveysChanName = `surveys-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
    channel = supabase!.channel(surveysChanName).on('postgres_changes', { event: '*', schema: 'public', table: 'surveys' }, async (payload: any) => {
      try {
        const arr = await getSurveysOnce()
        if (!mounted) return
        try { lastJson = JSON.stringify(arr) } catch (e) {}
        try { cb(arr) } catch (e) {}
      } catch (e) {}
    }).subscribe()
  } catch (e) { channel = null }
  // Polling fallback every 8s (handles cases where Realtime doesn't echo back to sender).
  const pollInterval = window.setInterval(refetch, 8000)
  // Re-fetch immediately when the user returns to this tab from background/minimized.
  const onVisibility = () => { if (document.visibilityState === 'visible') refetch() }
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    mounted = false
    window.clearInterval(pollInterval)
    document.removeEventListener('visibilitychange', onVisibility)
    try { channel && channel.unsubscribe && channel.unsubscribe() } catch (e) {}
  }
}

export async function pushSurvey(survey: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const toSave = { ...(survey || {}) }
  // Strip internal/temporary fields not present in the DB schema
  for (const k of Object.keys(toSave)) { if (k.startsWith('_')) delete toSave[k] }
  const uid = currentUserCache ? currentUserCache.id : null
  const email = currentUserCache ? currentUserCache.email : null
  if (uid) { toSave.ownerId = uid; toSave.ownerUid = uid }
  if (email) { toSave.ownerEmail = email }
  if (!toSave.id) toSave.id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`
  if (!toSave.createdAt) toSave.createdAt = new Date().toISOString()
  const snake = camelToSnakeObject(toSave)
  const { data, error } = await supabase.from('surveys').upsert([snake], { onConflict: 'id' })
  if (error) throw error
  return toSave.id
}

export async function setSurvey(id: string, survey: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const toSave = { ...(survey || {}), id: String(id) }
  if (!toSave.createdAt) toSave.createdAt = new Date().toISOString()
  // Always ensure owner_uid is set so RLS policies work (e.g. survey_reports_select)
  const uid = currentUserCache ? currentUserCache.id : null
  const email = currentUserCache ? currentUserCache.email : null
  if (uid && !toSave.ownerUid) toSave.ownerUid = uid
  if (email && !toSave.ownerEmail) toSave.ownerEmail = email
  const snake = camelToSnakeObject(toSave)
  const { data, error } = await supabase.from('surveys').upsert([snake], { onConflict: 'id' })
  if (error) throw error
}

export async function removeSurveyById(id: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.from('surveys').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('No se pudo eliminar: sin permiso o encuesta no encontrada')
}

export async function removeSurveyCascade(surveyId: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  // Clean up related data first (best-effort, errors are non-fatal)
  try { await supabase.from('survey_responses').delete().eq('survey_id', surveyId) } catch (e) {}
  try { await supabase.from('survey_reports').delete().eq('survey_id', surveyId) } catch (e) {}
  try { await supabase.from('notifications').delete().eq('survey_id', surveyId) } catch (e) {}
  // Delete the survey itself — use .select() so we can detect RLS silent blocks (0 rows)
  const { data, error } = await supabase.from('surveys').delete().eq('id', surveyId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('No se pudo eliminar: sin permiso o encuesta no encontrada. Verifica las políticas RLS en Supabase.')
  return true
}

export async function getSurveyReportsOnce(): Promise<any[]> {
  ensureClient()
  if (!supabase) return []
  try { const r = await supabase.from('survey_reports').select('*'); return rowsToArray(r) } catch (e) { return [] }
}

export function listenSurveyReports(cb: (reports: any[]) => void) {
  ensureClient()
  if (!supabase) return () => {}
  let channel: any = null
  getSurveyReportsOnce().then((arr) => { try { cb(arr) } catch (e) {} })
  try {
    channel = supabase!.channel('realtime-survey-reports').on('postgres_changes', { event: '*', schema: 'public', table: 'survey_reports' }, async (payload: any) => {
      try { const arr = await getSurveyReportsOnce(); try { cb(arr) } catch (e) {} } catch (e) {}
    }).subscribe()
  } catch (e) { channel = null }
  return () => { try { channel && channel.unsubscribe && channel.unsubscribe() } catch (e) {} }
}

export async function pushSurveyReport(report: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const uid = currentUserCache ? currentUserCache.id : null
  // Whitelist only known DB columns and strip nulls — PostgREST 400s on explicit null jsonb
  const full: any = {
    id: report.id || `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,
    survey_id: report.surveyId || report.survey_id || undefined,
    reporter_id: uid || report.reporterId || report.reporter_id || undefined,
    reporter_email: report.reporterEmail || report.reporter_email || (currentUserCache ? currentUserCache.email : undefined) || undefined,
    comment: report.comment || undefined,
    payload: (report.payload && Object.keys(report.payload).length > 0) ? report.payload : undefined,
    // created_at omitted — DB DEFAULT now() handles it, avoids PostgREST schema cache errors
  }
  // Remove undefined fields so PostgREST doesn't receive unexpected nulls
  const toSave: any = Object.fromEntries(Object.entries(full).filter(([, v]) => v !== undefined))
  console.debug('[pushSurveyReport] inserting', JSON.stringify(toSave))
  const { error } = await supabase.from('survey_reports').insert([toSave])
  if (error) {
    console.error('[pushSurveyReport] error', error.code, error.message, error.details, error.hint)
    throw error
  }
  return toSave.id
}

export async function removeSurveyReportById(id: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  try {
    await supabase.from('survey_reports').delete().eq('id', id)
  } catch (e) {
    // fallback: try to find by stored id field and delete
    try {
      const r = await supabase.from('survey_reports').select('*')
      const arr = await rowsToArray(r)
      for (const item of arr) {
        if (item && (String(item.id) === String(id))) {
          try { await supabase.from('survey_reports').delete().eq('id', item.id) } catch (err) {}
        }
      }
    } catch (err) {}
  }
}

export async function pushSurveyResponse(resp: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const toSave = { ...(resp || {}) }
  if (!toSave.id) toSave.id = `sr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`
  const snake = camelToSnakeObject(toSave)
  const { data, error } = await supabase.from('survey_responses').insert([snake])
  if (error) throw error
  return toSave.id
}

export async function getUserResponsesOnce(uid: string, surveyId: string): Promise<any[]> {
  ensureClient()
  if (!supabase) return []
  try { const r = await supabase.from('survey_responses').select('*').eq('user_id', uid).eq('survey_id', surveyId); return rowsToArray(r) } catch (e) { return [] }
}

export async function getUserResponsesByUser(uid: string): Promise<Record<string, any[]>> {
  ensureClient()
  if (!supabase) return {}
  try {
    const r = await supabase.from('survey_responses').select('*').eq('user_id', uid)
    const arr = await rowsToArray(r)
    const res: Record<string, any[]> = {}
    for (const row of arr) {
      const sid = String((row as any).surveyId || '')
      if (!res[sid]) res[sid] = []
      res[sid].push(row)
    }
    return res
  } catch (e) { return {} }
}

export async function getUsersOnce(): Promise<any[]> {
  ensureClient()
  if (!supabase) return []
  try { const r = await supabase.from('app_users').select('*'); const arr = await rowsToArray(r); return arr.map((u: any) => ({ ...(u || {}), id: (u.legacyKey || u.id) })) } catch (e) { return [] }
}

export async function setUserById(id: string, user: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const toSave = { ...(user || {}), legacyKey: String(id) }
  if (!toSave.createdAt) toSave.createdAt = new Date().toISOString()
  const snake = camelToSnakeObject(toSave)
  await supabase.from('app_users').upsert([snake], { onConflict: 'legacy_key' })
  return true
}

export async function pushUser(user: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  // avoid creating duplicate rows for the same email
  try {
    const email = user && user.email ? String(user.email).toLowerCase() : null
    if (email) {
      // look for an existing row with this email
      try {
        const existing: any = await supabase.from('app_users').select('legacy_key').eq('email', email).limit(1).maybeSingle()
        if (!existing.error && existing.data) {
          // return the existing legacy_key (db column name)
          return existing.data.legacy_key || existing.data.legacyKey
        }
      } catch (e) {
        // ignore lookup errors and fall back to insertion
      }
    }
  } catch (e) {}

  const key = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`
  const toSave = { ...(user || {}), legacyKey: key, createdAt: new Date().toISOString() }
  const snake = camelToSnakeObject(toSave)
  await supabase.from('app_users').insert([snake])
  return key
}

export async function removeUserById(id: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.from('app_users').delete().eq('legacy_key', id)
}

export async function getSurveyResponsesOnce(surveyId: string): Promise<any[]> {
  ensureClient()
  if (!supabase) return []
  try { const r = await supabase.from('survey_responses').select('*').eq('survey_id', surveyId); return rowsToArray(r) } catch (e) { return [] }
}

export async function pushNotification(note: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const toSave = { ...(note || {}) }
  if (!toSave.id) toSave.id = `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`
  const snake = camelToSnakeObject(toSave)
  const { error } = await supabase.from('notifications').insert([snake])
  if (error) throw error
  return toSave.id
}

export async function removeNotificationById(id: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  try {
    await supabase.from('notifications').delete().eq('id', id)
  } catch (e) {
    // fallback: try to find by stored id field
    try {
      const r = await supabase.from('notifications').select('*')
      const arr = await rowsToArray(r)
      for (const item of arr) {
        if (item && (String(item.id) === String(id))) {
          try { await supabase.from('notifications').delete().eq('id', item.id) } catch (e) {}
        }
      }
    } catch (err) {}
  }
}

export async function removeNotificationsBySurveyId(surveyId: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  try { await supabase.from('notifications').delete().eq('survey_id', surveyId) } catch (e) { console.error(e) }
}

export async function setHiddenNotification(uid: string, notifId: string, value: boolean = true) {
  ensureClient()
  if (!supabase) {
    // fallback to localStorage
    try {
      const localKey = `hiddenNotificationsLocal:${uid}`
      const raw = window.localStorage.getItem(localKey)
      let parsed = raw ? JSON.parse(raw || '{}') : {}
      if (value) parsed[String(notifId)] = true
      else delete parsed[String(notifId)]
      window.localStorage.setItem(localKey, JSON.stringify(parsed))
      return
    } catch (e) { return }
  }
  try {
    if (value) {
      await supabase.from('hidden_notifications').upsert([{ user_id: uid, notif_id: notifId, created_at: new Date().toISOString() }], { onConflict: 'user_id,notif_id' })
    } else {
      await supabase.from('hidden_notifications').delete().eq('user_id', uid).eq('notif_id', notifId)
    }
  } catch (e) {
    // fallback to localStorage on error
    try {
      const localKey = `hiddenNotificationsLocal:${uid}`
      const raw = window.localStorage.getItem(localKey)
      let parsed = raw ? JSON.parse(raw || '{}') : {}
      if (value) parsed[String(notifId)] = true
      else delete parsed[String(notifId)]
      window.localStorage.setItem(localKey, JSON.stringify(parsed))
    } catch (err) {}
  }
}

export async function getHiddenNotificationsOnce(uid: string): Promise<Record<string, any>> {
  ensureClient()
  if (!supabase) {
    try {
      const localKey = `hiddenNotificationsLocal:${uid}`
      const raw = window.localStorage.getItem(localKey)
      return raw ? JSON.parse(raw || '{}') : {}
    } catch (e) { return {} }
  }
  try {
    const r = await supabase.from('hidden_notifications').select('*').eq('user_id', uid)
    const arr = await rowsToArray(r)
    const map: Record<string, any> = {}
    for (const it of arr) { if (it && (it as any).notifId) map[String((it as any).notifId)] = true }
    return map
  } catch (e) { return {} }
}

export function listenHiddenNotifications(uid: string, cb: (map: Record<string, any>) => void) {
  ensureClient()
  if (!supabase) return () => {}
  let channel: any = null
  getHiddenNotificationsOnce(uid).then(m => { try { cb(m || {}) } catch (e) {} })
  try {
    channel = supabase!.channel(`hidden_notifications:${uid}`).on('postgres_changes', { event: '*', schema: 'public', table: 'hidden_notifications', filter: `user_id=eq.${uid}` }, async (payload: any) => {
      try { const m = await getHiddenNotificationsOnce(uid); try { cb(m || {}) } catch (e) {} } catch (e) {}
    }).subscribe()
  } catch (e) { channel = null }
  return () => { try { channel && channel.unsubscribe && channel.unsubscribe() } catch (e) {} }
}

export async function getNotificationsOnce(): Promise<any[]> {
  ensureClient()
  if (!supabase) return []
  try { const r = await supabase.from('notifications').select('*'); return rowsToArray(r) } catch (e) { return [] }
}

export function listenNotifications(cb: (items: any[]) => void) {
  ensureClient()
  if (!supabase) return () => {}
  let channel: any = null
  let mounted = true
  let lastJson = ''
  const refetch = async () => {
    if (!mounted) return
    try {
      const arr = await getNotificationsOnce()
      if (!mounted) return
      let json = ''
      try { json = JSON.stringify(arr) } catch (e) {}
      if (json !== lastJson) {
        lastJson = json
        try { cb(arr || []) } catch (e) {}
      }
    } catch (e) {}
  }
  getNotificationsOnce().then(arr => {
    if (!mounted) return
    try { lastJson = JSON.stringify(arr) } catch (e) {}
    try { cb(arr || []) } catch (e) {}
  })
  try {
    const notifChanName = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
    channel = supabase!.channel(notifChanName).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, async (payload: any) => {
      try {
        const arr = await getNotificationsOnce()
        if (!mounted) return
        try { lastJson = JSON.stringify(arr) } catch (e) {}
        try { cb(arr || []) } catch (e) {}
      } catch (e) {}
    }).subscribe()
  } catch (e) { channel = null }
  // Polling fallback every 8s.
  const pollInterval = window.setInterval(refetch, 8000)
  // Re-fetch immediately when the user returns to this tab from background/minimized.
  const onVisibility = () => { if (document.visibilityState === 'visible') refetch() }
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    mounted = false
    window.clearInterval(pollInterval)
    document.removeEventListener('visibilitychange', onVisibility)
    try { channel && channel.unsubscribe && channel.unsubscribe() } catch (e) {}
  }
}

export async function setNotificationRead(id: string, read: boolean = true) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  try {
    await supabase.from('notifications').update({ read }).eq('id', id)
  } catch (e) {
    // fallback: search by stored id field
    try {
      const r = await supabase.from('notifications').select('*')
      const arr = await rowsToArray(r)
      for (const item of arr) {
        if (item && (String(item.id) === String(id))) {
          try { await supabase.from('notifications').update({ read }).eq('id', item.id) } catch (err) {}
        }
      }
    } catch (err) {}
  }
}

export async function setPublishedSurvey(id: string, summary: any) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  const toSave = {
    id,
    title: summary?.title || summary?.name || null,
    created_at: summary?.createdAt || new Date().toISOString(),
    owner_id: summary?.ownerId || null,
    type: summary?.type || null,
    published: true
  }
  await supabase.from('surveys').upsert([toSave], { onConflict: 'id' })
}

export async function removePublishedSurvey(id: string) {
  ensureClient()
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.from('surveys').update({ published: false }).eq('id', id)
}

export async function getPublishedSurveysOnce(): Promise<any[]> {
  ensureClient()
  if (!supabase) return []
  try { const r = await supabase.from('surveys').select('*').eq('published', true); return rowsToArray(r) } catch (e) { return [] }
}

/**
 * Returns a uid→email map for every owner of a published survey.
 * Uses SECURITY DEFINER so it works for any authenticated user.
 */
export async function getPublishedSurveyOwners(): Promise<Record<string, string>> {
  ensureClient()
  if (!supabase) return {}
  try {
    const { data, error } = await (supabase as any).rpc('get_published_survey_owners')
    if (error || !data) return {}
    const map: Record<string, string> = {}
    ;(data as any[]).forEach((row: any) => { try { if (row && row.owner_uid && row.email) map[String(row.owner_uid)] = String(row.email) } catch (e) {} })
    return map
  } catch (e) { return {} }
}

/**
 * Resolves auth UUIDs to emails via a SECURITY DEFINER function.
 * Works for any authenticated user (admin or not).
 */
export async function resolveOwnerEmails(uids: string[]): Promise<Record<string, string>> {
  ensureClient()
  if (!supabase || !uids || uids.length === 0) return {}
  try {
    const { data, error } = await (supabase as any).rpc('resolve_owner_emails', { uids })
    if (error || !data) return {}
    const map: Record<string, string> = {}
    ;(data as any[]).forEach((row: any) => { try { if (row && row.uid && row.email) map[String(row.uid)] = String(row.email) } catch (e) {} })
    return map
  } catch (e) { return {} }
}

export function listenPublishedSurveys(cb: (items: any[]) => void) {
  ensureClient()
  if (!supabase) return () => {}
  let channel: any = null
  getPublishedSurveysOnce().then(arr => { try { cb(arr || []) } catch (e) {} })
  try {
    channel = supabase!.channel('realtime-published-surveys').on('postgres_changes', { event: '*', schema: 'public', table: 'surveys' }, async (payload: any) => {
      try { const arr = await getPublishedSurveysOnce(); try { cb(arr || []) } catch (e) {} } catch (e) {}
    }).subscribe()
  } catch (e) { channel = null }
  return () => { try { channel && channel.unsubscribe && channel.unsubscribe() } catch (e) {} }
}

export default {
  initFirebase,
  isEnabled,
  firebaseSignIn,
  firebaseSignOut,
  onAuthChanged,
  getAuthCurrentUser,
  getSurveysOnce,
  getSurveyById,
  listenSurveys,
  pushSurvey,
  setSurvey,
  removeSurveyById,
  getSurveyReportsOnce,
  listenSurveyReports,
  pushSurveyReport,
  removeSurveyReportById,
  pushNotification,
  pushSurveyResponse,
  getUserResponsesOnce,
  getUserResponsesByUser,
  getSurveyResponsesOnce,
  getNotificationsOnce,
  listenNotifications,
  removeNotificationById,
  setNotificationRead,
  setPublishedSurvey,
  removePublishedSurvey,
  getPublishedSurveysOnce,
  listenPublishedSurveys,
  setHiddenNotification,
  getHiddenNotificationsOnce,
  listenHiddenNotifications,
  changePassword,
  getUsersOnce,
  setUserById,
  pushUser,
  removeUserById,
  getCurrentUserClaims,
  getAccessToken,
  getServerUser,
  resolveOwnerEmails,
  getPublishedSurveyOwners,
  getProfile,
  upsertProfile,
  uploadAvatar,
}

// ============================================================
// PROFILES & AVATAR STORAGE
// ============================================================

export async function getProfile(userId: string): Promise<{ display_name: string; avatar_url: string } | null> {
  ensureClient()
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) { console.debug('[supabaseClient] getProfile error', error); return null }
    return data || null
  } catch (e) { console.debug('[supabaseClient] getProfile exception', e); return null }
}

export async function upsertProfile(userId: string, displayName: string, avatarUrl: string): Promise<boolean> {
  ensureClient()
  if (!supabase || !userId) return false
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: userId, display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) { console.warn('[supabaseClient] upsertProfile error', error); return false }
    return true
  } catch (e) { console.warn('[supabaseClient] upsertProfile exception', e); return false }
}

/**
 * Uploads an avatar image to Supabase Storage bucket "avatars".
 * Uses upsert (same path = {userId}/avatar) so it automatically replaces any existing photo.
 * Returns the public URL of the uploaded image, or null on failure.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  ensureClient()
  if (!supabase || !userId) return null
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/avatar.${ext}`
    // Remove old avatar files with different extensions before uploading new one
    try {
      const { data: list } = await supabase.storage.from('avatars').list(userId)
      if (list && list.length > 0) {
        const toRemove = list.map((f: any) => `${userId}/${f.name}`)
        await supabase.storage.from('avatars').remove(toRemove)
      }
    } catch (e) { /* non-fatal */ }

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) { console.warn('[supabaseClient] uploadAvatar error', error); return null }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    // Add cache-busting query param so the browser picks up the new image
    const url = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null
    return url
  } catch (e) { console.warn('[supabaseClient] uploadAvatar exception', e); return null }}

