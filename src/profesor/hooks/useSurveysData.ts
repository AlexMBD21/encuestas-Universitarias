import { useEffect, useState, useCallback } from 'react'
import AuthAdapter from '../../services/AuthAdapter'
import supabaseClient from '../../services/supabaseClient'
import { useAuth } from '../../services/AuthContext'

export function useSurveysData() {
  const [currentUser, setCurrentUser] = useState<any | null>(() => AuthAdapter.getUser())
  const currentUserId = currentUser ? (currentUser.email || currentUser.id || null) : null
  const { user: authUser, loading: authLoading } = useAuth()

  // Computed once per render so all role checks are consistent
  const isAdmin = !!(authUser && String((authUser as any).role || '').toLowerCase() === 'admin')
  const userAsignatura = ((authUser as any)?.app_metadata?.asignatura || (currentUser as any)?.asignatura || '').trim().toLowerCase()

  const [surveys, setSurveys] = useState<any[]>([])
  const [surveysLoaded, setSurveysLoaded] = useState(false)
  const [surveyReports, setSurveyReports] = useState<any[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [ratedMap, setRatedMap] = useState<Record<string, string[]>>({})
  const [globalRatedMap, setGlobalRatedMap] = useState<Record<string, string[]>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [ownerEmailMap, setOwnerEmailMap] = useState<Record<string, string>>({})
  const [evaluatorUsers, setEvaluatorUsers] = useState<any[]>([])

  useEffect(() => {
    const onAuth = () => {
      try { setCurrentUser(AuthAdapter.getUser()) } catch (e) { }
    }
    try { window.addEventListener('auth:changed', onAuth as EventListener) } catch (e) { }
    return () => { try { window.removeEventListener('auth:changed', onAuth as EventListener) } catch (e) { } }
  }, [])

  // Determines if the current user owns a survey (or is admin).
  const isOwnerOf = useCallback((sOrOwnerId: any) => {
    try {
      if (isAdmin) return true
      const cur = AuthAdapter.getUser() || currentUser
      let ownerIdRaw = sOrOwnerId && typeof sOrOwnerId === 'object' ? sOrOwnerId.ownerId : sOrOwnerId
      if (ownerIdRaw && typeof ownerIdRaw === 'object') {
        ownerIdRaw = ownerIdRaw.ownerId || ownerIdRaw.id || ownerIdRaw.email || ownerIdRaw.userId || null
      }
      if (!ownerIdRaw) return false
      const normalize = (v: any) => (v === null || v === undefined) ? null : String(v).trim().toLowerCase()
      const ownerId = normalize(ownerIdRaw)
      const curCandidates = new Set<string>()
      const add = (v: any) => { const n = normalize(v); if (n) curCandidates.add(n) }
      add(currentUserId)
      if (cur) { add(cur.email); add(cur.id) }
      if (authUser) { add(authUser.email); add(authUser.id) }
      if (ownerId && Array.from(curCandidates).some(x => x === ownerId)) return true
      if (!currentUser && !authUser && ownerId === 'local') return true
      return false
    } catch (e) {
      return false
    }
  }, [isAdmin, currentUser, currentUserId, authUser])

  // Resolve UUID → email for all survey owners
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const client: any = supabaseClient
        if (!client || !client.isEnabled || !client.isEnabled()) return
        if (client.getPublishedSurveyOwners) {
          const map = await client.getPublishedSurveyOwners()
          if (mounted && map && Object.keys(map).length > 0) setOwnerEmailMap(map)
        } else if (client.resolveOwnerEmails) {
          const uids = Array.from(new Set(
            surveys.map((s: any) => String(s.ownerUid || s.ownerId || '')).filter((v: string) => v && !v.includes('@'))
          ))
          if (uids.length > 0) {
            const map = await client.resolveOwnerEmails(uids)
            if (mounted && map) setOwnerEmailMap(map)
          }
        }
        
        if (client.getUsersOnce) {
          const allUsers = await client.getUsersOnce();
          if (mounted && allUsers) {
            const profs = allUsers.filter((u: any) => {
              const role = String(u.role || u.rol || '').toLowerCase();
              return role === 'profesor' || role === 'docente';
            });
            setEvaluatorUsers(profs);
          }
        }
      } catch (e) { }
    }
    load()
    return () => { mounted = false }
  }, [surveys])

  const getOwnerDisplay = useCallback((s: any): string => {
    try {
      if (s.ownerEmail && String(s.ownerEmail).includes('@')) return String(s.ownerEmail)
      if (s.owner_email && String(s.owner_email).includes('@')) return String(s.owner_email)
      const uid = String(s.ownerUid || s.ownerId || '').trim()
      if (ownerEmailMap[uid]) return ownerEmailMap[uid]
      if (uid.includes('@')) return uid
      return uid
    } catch (e) { return '' }
  }, [ownerEmailMap])

  useEffect(() => {
    let unsubSurveys: (() => void) | null = null
    let unsubReports: (() => void) | null = null
    const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
    const dbEnabled = supabaseEnabled
    const dataClient: any = supabaseClient

    const attachFallback = () => {
      setSurveys([])
      setSurveyReports([])
      setReportsLoaded(true)
      setToastMessage('No hay servicio de datos configurado. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
      setTimeout(() => setToastMessage(null), 5000)
    }

    const setupRealtime = () => {
      try {
        unsubSurveys = dataClient.listenSurveys(async (arr: any[]) => {
          try {
            const current = AuthAdapter.getUser()
            const defaultOwner = (current && (current.email || (current.id as any))) || 'local'
            const normalized = arr.map((item: any) => {
              if (!item.ownerId) return { ...item, ownerId: defaultOwner }
              try {
                if (typeof item.ownerId === 'string' && current) {
                  const raw = item.ownerId.trim()
                  const lowerRaw = raw.toLowerCase()
                  if (lowerRaw && !lowerRaw.includes('@') && lowerRaw !== 'local') {
                    const curEmail = (current && (current.email || '')) as string
                    const curPrefix = curEmail ? curEmail.split('@')[0].trim().toLowerCase() : null
                    if (curPrefix && curPrefix === lowerRaw) {
                      return { ...item, ownerId: curEmail || item.ownerId }
                    }
                  }
                }
              } catch (e) { }
              return item
            })
            setSurveys(normalized)
            setSurveysLoaded(true)
            try {
              const authUserObj = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
              const uid = authUserObj ? ((authUserObj as any).uid || (authUserObj as any).id) : null
              if (uid) {
                const all = await (dataClient.getUserResponsesByUser ? dataClient.getUserResponsesByUser(uid) : {})
                const map: Record<string, string[]> = {}
                for (const sid of Object.keys(all || {})) {
                  const arrResponses = all[sid] || []
                  if (arrResponses && arrResponses.length > 0) {
                    const sample = arrResponses[0]
                    if (sample && (sample as any).projectId) {
                      map[sid] = (arrResponses as any[]).map((r: any) => String(r.projectId)).filter(Boolean)
                    } else {
                      map[sid] = ['__simple']
                    }
                  }
                }
                setRatedMap(prev => ({ ...(prev || {}), ...(map || {}) }))
              }
            } catch (e) { console.warn('populate ratedMap failed', e) }
          } catch (e) { console.error(e) }
        })

        unsubReports = dataClient.listenSurveyReports((arr: any[]) => {
          try {
            const filtered = Array.isArray(arr) ? arr.filter((r: any) => {
              if (!r) return false
              if (r.isPublicReport === true) return false
              if (r.reportType && String(r.reportType).toLowerCase() === 'public') return false
              return true
            }) : []
            setSurveyReports(filtered)
          } catch (e) {
            console.error('filtering surveyReports failed', e)
            setSurveyReports(arr || [])
          }
          setReportsLoaded(true)
        })
      } catch (e) {
        console.error('realtime attach error', e)
        attachFallback()
      }
    }

    if (dbEnabled) {
      setupRealtime()
    } else {
      setSurveys([])
      setSurveysLoaded(true)
      setSurveyReports([])
      setReportsLoaded(true)
      setToastMessage('No hay servicio de datos configurado. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
      setTimeout(() => setToastMessage(null), 6000)
    }

    const onConnected = () => {
      try {
        try { if (unsubSurveys) unsubSurveys() } catch (e) { }
        try { if (unsubReports) unsubReports() } catch (e) { }
        const supabaseNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
        if (supabaseNow) {
          setupRealtime()
        } else {
          attachFallback()
        }
      } catch (e) { }
    }
    window.addEventListener('realtime:connected', onConnected as EventListener)

    const onUpdated = (ev: any) => {
      try {
        const detail = ev && ev.detail
        if (detail && detail.survey) {
          const sv = detail.survey
          setSurveys(prev => {
            const copy = Array.isArray(prev) ? [...prev] : []
            const idx = copy.findIndex((s: any) => String(s.id) === String(sv.id))
            return idx >= 0 ? copy.map((s: any) => String(s.id) === String(sv.id) ? sv : s) : [...copy, sv]
          })
        }
      } catch (e) { }
      if (dbEnabled) {
        dataClient.getSurveysOnce().then((arr: any[]) => {
          try { setSurveys(arr) } catch (e) { }
        }).catch(() => { })
        return
      }
      attachFallback()
    }
    const onResponded = (ev: any) => {
      try {
        const d = ev && ev.detail
        if (!d) {
          if (dbEnabled) return
          attachFallback()
          return
        }
        const sid = d.surveyId || d.survey || null
        const pid = d.projectId || null
        if (dbEnabled) {
          try {
            if (!sid) return
            if (pid) {
              setRatedMap(prev => {
                const copy: Record<string, string[]> = { ...(prev || {}) }
                const arr = Array.isArray(copy[String(sid)]) ? copy[String(sid)] : []
                if (!arr.includes(String(pid))) arr.push(String(pid))
                copy[String(sid)] = arr
                return copy
              })
              setGlobalRatedMap(prev => {
                const copy: Record<string, string[]> = { ...(prev || {}) }
                const arr = Array.isArray(copy[String(sid)]) ? copy[String(sid)] : []
                if (!arr.includes(String(pid))) arr.push(String(pid))
                copy[String(sid)] = arr
                return copy
              })
            } else {
              setRatedMap(prev => {
                const copy: Record<string, string[]> = { ...(prev || {}) }
                const arr = Array.isArray(copy[String(sid)]) ? copy[String(sid)] : []
                if (!arr.includes('__simple')) arr.push('__simple')
                copy[String(sid)] = arr
                return copy
              })
            }
          } catch (e) { }
          return
        }
        attachFallback()
      } catch (e) { }
    }
    const onReported = (ev: any) => {
      if (dbEnabled) return
      setSurveyReports([])
      setReportsLoaded(true)
    }

    window.addEventListener('surveys:updated', onUpdated as EventListener)
    window.addEventListener('survey:responded', onResponded as EventListener)
    window.addEventListener('survey:reported', onReported as EventListener)

    return () => {
      try { if (unsubSurveys) unsubSurveys() } catch (e) { }
      try { if (unsubReports) unsubReports() } catch (e) { }
      window.removeEventListener('surveys:updated', onUpdated as EventListener)
      window.removeEventListener('survey:responded', onResponded as EventListener)
      window.removeEventListener('survey:reported', onReported as EventListener)
      try { window.removeEventListener('realtime:connected', onConnected as EventListener) } catch (e) { }
    }
  }, [])

  return {
    surveys, setSurveys,
    surveysLoaded,
    surveyReports, setSurveyReports,
    reportsLoaded,
    ratedMap, setRatedMap,
    globalRatedMap, setGlobalRatedMap,
    toastMessage, setToastMessage,
    ownerEmailMap,
    evaluatorUsers,
    currentUser, currentUserId, authUser, authLoading, isAdmin, userAsignatura,
    isOwnerOf, getOwnerDisplay
  }
}
