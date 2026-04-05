import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import surveyHelpers from '../../services/surveyHelpers'
import supabaseClient from '../../services/supabaseClient'
import AuthAdapter from '../../services/AuthAdapter'

type Props = {
  open: boolean
  onClose?: () => void
  notifications?: any[]
  onVisibleCountChange?: (count: number) => void
}

export default function NotificationsPanel({ open, onClose, notifications: notificationsProp, onVisibleCountChange }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [rendered, setRendered] = useState<boolean>(open)
  const [animState, setAnimState] = useState<'entering' | 'open' | 'closing'>(() => (open ? 'open' : 'closing'))
  const [topPx, setTopPx] = useState<number | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [surveysFromDB, setSurveysFromDB] = useState<any[] | null>(null)
  const [userRespondedMap, setUserRespondedMap] = useState<Record<string, boolean>>({})
  const [currentUser, setCurrentUser] = useState<any | null>(() => AuthAdapter.getUser())
  const [hiddenMap, setHiddenMap] = useState<Record<string, any>>({})
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [itemHeight, setItemHeight] = useState<number | null>(null)
  const [panelLoaded, setPanelLoaded] = useState(false)
  const navigate = useNavigate()

  const sortNotifications = (arr: any[] | null | undefined) => {
    try {
      const copy = Array.isArray(arr) ? [...arr] : []
      // Prioritize 'survey_published' notifications at the top, then sort by createdAt desc
      copy.sort((a: any, b: any) => {
        try {
          const aType = (a && a.type) ? String(a.type).toLowerCase() : ''
          const bType = (b && b.type) ? String(b.type).toLowerCase() : ''
          const aIsPub = aType === 'survey_published' ? 1 : 0
          const bIsPub = bType === 'survey_published' ? 1 : 0
          if (aIsPub !== bIsPub) return bIsPub - aIsPub // pub (1) first

          const ta = (typeof a?.createdAt === 'number') ? a.createdAt : Date.parse(a?.createdAt || '') || 0
          const tb = (typeof b?.createdAt === 'number') ? b.createdAt : Date.parse(b?.createdAt || '') || 0
          return tb - ta
        } catch (e) {
          return 0
        }
      })
      return copy
    } catch (e) {
      return Array.isArray(arr) ? arr : []
    }
  }

  // per-notification transient toasts
  const [toastMap, setToastMap] = useState<Record<string, string>>({})
  const toastTimers = useRef<Record<string, number>>({})

  useEffect(() => {
    const onAuth = () => { try { setCurrentUser(AuthAdapter.getUser()) } catch (e) {} }
    try { window.addEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
    const cleanupAuth = () => { try { window.removeEventListener('auth:changed', onAuth as EventListener) } catch (e) {} }
    const updateTop = () => {
      try {
        const topBar = document.getElementById('top-bar')
        if (topBar) {
          const rect = topBar.getBoundingClientRect()
          const style = window.getComputedStyle(topBar)
          const isFixed = style && style.position === 'fixed'
          const y = rect.bottom + (isFixed ? 0 : window.scrollY)
          setTopPx(Math.max(8, Math.round(y)))
          return
        }
      } catch (e) {}
      setTopPx(76)
    }

    updateTop()
    // load notifications only from a configured backend (Supabase required)
    const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
    if (!supabaseEnabled) {
      // enforce DB-only mode
      setNotifications([])
      setToastMap(prev => ({ ...prev, __sys: 'No hay servicio de notificaciones configurado. Configura VITE_SUPABASE_*.' }))
    }

    window.addEventListener('resize', updateTop)
    window.addEventListener('scroll', updateTop, { passive: true })

    let timeout: ReturnType<typeof setTimeout>
    if (open) {
      setRendered(true)
      setAnimState('entering')
      timeout = setTimeout(() => setAnimState('open'), 20)
    } else {
      setAnimState('closing')
      timeout = setTimeout(() => { setRendered(false) }, 360)
      // clear transient toasts when closing
      try {
        setToastMap({})
        Object.values(toastTimers.current || {}).forEach((id) => window.clearTimeout(id))
        toastTimers.current = {}
      } catch (e) {}
    }

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', updateTop)
      window.removeEventListener('scroll', updateTop)
      try { window.removeEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
    }
  }, [open])

  // Sync notifications from the shared prop (managed by ProfesorLayout).
  // This replaces the old internal listenNotifications subscription, eliminating
  // duplicate Supabase channels and ensuring the panel always shows the latest data
  // even when it was closed/unmounted during previous updates.
  useEffect(() => {
      let unsubSurv: (() => void) | null = null

      // Seed local state from the prop if provided; otherwise fetch once as fallback.
      if (Array.isArray(notificationsProp) && notificationsProp.length > 0) {
        setNotifications(sortNotifications(notificationsProp))
        setPanelLoaded(true)
      } else {
        const dataClient: any = supabaseClient
        if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.getNotificationsOnce) {
          dataClient.getNotificationsOnce().then((arr: any[]) => {
            setNotifications(sortNotifications(Array.isArray(arr) ? arr : []))
            setPanelLoaded(true)
          }).catch(() => { setPanelLoaded(true) })
        }
      }

      // Keep a live copy of surveys for status/navigation resolution
      const dataClient: any = supabaseClient
      if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.listenSurveys) {
        try {
          unsubSurv = dataClient.listenSurveys((arr: any[]) => {
            setSurveysFromDB(Array.isArray(arr) ? arr : [])
          })
        } catch (e) {}
      }

      return () => {
        if (unsubSurv) try { unsubSurv() } catch (e) {}
      }
  }, [])

  // Re-fetch surveys whenever auth is restored (currentUser changes after page reload).
  // Without this, the initial getSurveysOnce() runs before the Supabase session is
  // restored, so RLS returns no rows and all survey-linked notifications get hidden.
  useEffect(() => {
    try {
      const dataClient: any = supabaseClient
      if (!dataClient || !dataClient.isEnabled || !dataClient.isEnabled()) return
      if (!dataClient.getSurveysOnce) return
      dataClient.getSurveysOnce().then((arr: any[]) => {
        setSurveysFromDB(Array.isArray(arr) ? arr : [])
      }).catch(() => {})
    } catch (e) {}
  }, [currentUser])

  

  useEffect(() => {
    if (!rendered) {
      // Reset so the next open always remeasures from scratch
      setItemHeight(null)
      return
    }
    // measure first item height to compute maxHeight for 5 items
    const measure = () => {
      try {
        const el = innerRef.current
        if (!el) return
        const first = el.querySelector('[data-notif-item]') as HTMLElement | null
        if (!first) return
        const h = Math.ceil(first.getBoundingClientRect().height)
        if (h && h > 0) setItemHeight(h)
      } catch (e) {}
    }
    // Use rAF + small timeout so the DOM is fully painted before measuring
    const raf = requestAnimationFrame(() => { setTimeout(measure, 50) })
    window.addEventListener('resize', measure)
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current && !rootRef.current.contains(target)) {
        onClose && onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose && onClose()
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
      try { window.removeEventListener('resize', measure) } catch (e) {}
      try {
        Object.values(toastTimers.current || {}).forEach((id) => window.clearTimeout(id))
      } catch (e) {}
    }
  }, [rendered, onClose])

  // Keep local notifications in sync with the shared prop from ProfesorLayout.
  // This is the key fix: when a survey is published the parent updates notificationsProp,
  // and this effect immediately reflects it — no need for the panel to be open/mounted.
  useEffect(() => {
    if (Array.isArray(notificationsProp)) {
      setNotifications(prev => {
        const next = sortNotifications(notificationsProp)
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev
        return next
      })
      setPanelLoaded(true)
    }
  }, [notificationsProp])

  // Emit the visible count (same filter the panel renders) so the parent can drive the badge.
  // This is the single source of truth: panel and badge always agree.
  // We wait until surveysFromDB is loaded (not null) before emitting — otherwise on first
  // render surveysFromDB===null makes every notification pass the filter and we'd flash 8
  // before dropping to 3 once the surveys list arrives.
  useEffect(() => {
    if (!onVisibleCountChange) return
    if (surveysFromDB === null) return  // wait for surveys to load before counting
    const count = (notifications || []).filter((n: any) => {
      if (!n) return false
      if (n.id && hiddenMap && hiddenMap[String(n.id)]) return false
      if (!n.surveyId) return true
      return !!(surveysFromDB || []).find((s: any) => String(s.id) === String(n.surveyId))
    }).length
    onVisibleCountChange(count)
  }, [notifications, hiddenMap, surveysFromDB, onVisibleCountChange])

  // Re-populate userRespondedMap whenever notifications, surveysFromDB or currentUser change
  useEffect(() => {
    let cancelled = false
    const populate = async () => {
      try {
        const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
        const dataClient: any = supabaseClient
        if (!(dataClient && dataClient.isEnabled && dataClient.isEnabled())) {
          if (!cancelled) setUserRespondedMap({})
          return
        }
        const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
        const uid = authUser ? ((authUser as any).uid || (authUser as any).id) : null
        if (!uid) {
          if (!cancelled) setUserRespondedMap({})
          return
        }
        const ids = Array.from(new Set((notifications || []).map(n => n && n.surveyId).filter(Boolean))) as string[]
        const map: Record<string, boolean> = {}
        await Promise.all(ids.map(async (sid) => {
          try {
            const arr = await (dataClient.getUserResponsesOnce ? dataClient.getUserResponsesOnce(uid, String(sid)) : [])
            map[String(sid)] = Array.isArray(arr) && arr.length > 0
          } catch (e) { map[String(sid)] = false }
        }))
        if (!cancelled) setUserRespondedMap(map)
      } catch (e) {
        if (!cancelled) setUserRespondedMap({})
      }
    }
    populate()
    return () => { cancelled = true }
  }, [notifications, surveysFromDB, currentUser])

  // listen to per-user hidden notifications (hiddenNotifications/{uid})
  useEffect(() => {
    let unsub: (() => void) | null = null
    try {
      const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClient: any = supabaseClient
      const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
      const uid = authUser ? ((authUser as any).uid || (authUser as any).id) : (currentUser && (currentUser.uid || currentUser.id)) || null
      if (!uid) { setHiddenMap({}); return () => {} }
      if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.listenHiddenNotifications) {
        unsub = dataClient.listenHiddenNotifications(String(uid), (map: Record<string, any>) => {
          try { setHiddenMap(map || {}) } catch (e) { setHiddenMap({}) }
        })
      } else if (dataClient && dataClient.getHiddenNotificationsOnce) {
        try {
          dataClient.getHiddenNotificationsOnce(String(uid))
            .then((m: any) => { setHiddenMap(m || {}) })
            .catch(() => { setHiddenMap({}) })
        } catch (e) { setHiddenMap({}) }
      }
    } catch (e) { setHiddenMap({}) }
    // also load any locally saved hidden entries for this uid
    try {
      const supabaseEnabled2 = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClient2: any = supabaseClient
      const authUser2 = (dataClient2 && dataClient2.getAuthCurrentUser && dataClient2.getAuthCurrentUser()) || null
      const uid2 = authUser2 ? ((authUser2 as any).uid || (authUser2 as any).id) : (currentUser && (currentUser.uid || currentUser.id)) || null
      if (uid2) {
        const localKey = `hiddenNotificationsLocal:${uid2}`
        const raw = window.localStorage.getItem(localKey)
        if (raw) {
          try {
            const parsed = JSON.parse(raw || '{}')
            setHiddenMap(prev => ({ ...(prev || {}), ...(parsed || {}) }))
          } catch (e) {}
        }
      }
    } catch (e) {}

    return () => { if (unsub) try { unsub() } catch (e) {} }
  }, [currentUser])

  if (!rendered) return null

  const cls = animState === 'open' ? 'open' : animState === 'closing' ? 'closing' : ''

  const handleMouseEnterToast = (n: any, status: string) => {
    try {
      if (status === 'responded') {
        if (toastTimers.current && toastTimers.current[n.id]) {
          window.clearTimeout(toastTimers.current[n.id])
        }
        setToastMap((prev) => ({ ...prev, [n.id]: 'Ya se respondió esta encuesta.' }))
        toastTimers.current[n.id] = window.setTimeout(() => {
          setToastMap((prev) => {
            const copy = { ...prev }
            delete copy[n.id]
            return copy
          })
          try {
            delete toastTimers.current[n.id]
          } catch (e) {}
        }, 2200)
      }
    } catch (e) {}
  }

  const handleMouseLeaveToast = (n: any) => {
    try {
      if (toastTimers.current && toastTimers.current[n.id]) {
        window.clearTimeout(toastTimers.current[n.id])
        delete toastTimers.current[n.id]
      }
      setToastMap((prev) => {
        const copy = { ...prev }
        delete copy[n.id]
        return copy
      })
    } catch (e) {}
  }

  const markNotificationRead = (id: string) => {
    try {
      const supabaseEnabledX = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClient: any = supabaseClient
      if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.setNotificationRead) {
        try {
          const p = dataClient.setNotificationRead(id, true)
          if (p && p.catch) p.catch(() => {})
          setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
          try { window.dispatchEvent(new Event('notifications:updated')) } catch (e) {}
          return
        } catch (e) {}
      }

      // No DB backend available: show a transient message.
      setToastMap(prev => ({ ...prev, __sys: 'No hay servicio habilitado. No se puede marcar notificaciones como leídas.' }))
    } catch (e) {}
  }

  const isNotificationResponded = (n: any) => {
    try {
      if (!n || !n.surveyId) return false
      return !!userRespondedMap[String(n.surveyId)]
    } catch (e) {
      return false
    }
  }

  const handleLimpiar = async () => {
    try {
      const toRemove = (notifications || []).filter(n => isNotificationResponded(n))
      if (!Array.isArray(toRemove) || toRemove.length === 0) return

      const supabaseEnabledX = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClient: any = supabaseClient
      const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
      const uid = authUser ? ((authUser as any).uid || (authUser as any).id) : (currentUser && (currentUser.uid || currentUser.id)) || null

      if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.setHiddenNotification) {
        if (!uid) {
          setToastMap(prev => ({ ...prev, __sys: 'No autenticado: no se pudo limpiar en DB.' }))
          return
        }
        // hide for this user only (do not delete globally)
        try {
          await Promise.all(toRemove.map(async (n) => {
            try { if (n && n.id) await dataClient.setHiddenNotification(uid, String(n.id), true) } catch (e) { throw e }
          }))
        } catch (err) {
          // permission error or other write error: fallback to localStorage per-user hidden map
          try {
            const localKey = `hiddenNotificationsLocal:${uid}`
            const raw = window.localStorage.getItem(localKey)
            let parsed: Record<string, any> = {}
            try { parsed = raw ? JSON.parse(raw) : {} } catch (e) { parsed = {} }
            for (const n of toRemove) {
              if (n && n.id) parsed[String(n.id)] = true
            }
            try { window.localStorage.setItem(localKey, JSON.stringify(parsed)) } catch (e) {}
            // merge into in-memory hidden map
            setHiddenMap(prev => ({ ...(prev || {}), ...(parsed || {}) }))
            setToastMap(prev => ({ ...prev, __sys: 'No hay permisos DB: ocultado guardado localmente.' }))
            // optimistic UI update
            setNotifications(prev => (Array.isArray(prev) ? prev.filter(n => !isNotificationResponded(n)) : prev))
            return
          } catch (e) {}
        }
        // optimistic UI update
        setNotifications(prev => (Array.isArray(prev) ? prev.filter(n => !isNotificationResponded(n)) : prev))
        try { window.dispatchEvent(new Event('notifications:updated')) } catch (e) {}
        return
      }

      // No DB backend available: fallback to local-only filter and notify user
      setToastMap(prev => ({ ...prev, __sys: 'No hay servicio habilitado. Limpiar solo afectó el panel actual.' }))
      setNotifications(prev => (Array.isArray(prev) ? prev.filter(n => !isNotificationResponded(n)) : prev))
    } catch (e) {}
  }

  return (
    <div
      id="notifications-panel"
      ref={rootRef}
      className={`fixed right-0 z-20 w-full max-w-md dark:bg-gray-900 shadow-2xl border-l border-blue-100 dark:border-gray-700 rounded-b-2xl flex flex-col ${cls}`}
      style={{ top: topPx != null ? `${topPx}px` : '76px', maxHeight: topPx != null ? `calc(100vh - ${topPx}px)` : 'calc(100vh - 76px)', minHeight: 0, backgroundColor: '#f0f7ff' }}
    >
      <div className="flex flex-col h-full">
        <div ref={innerRef} className="p-6 space-y-4 custom-scrollbar" style={{ overflowY: 'auto', maxHeight: itemHeight ? `${itemHeight * 5 + 16}px` : (topPx != null ? `calc(100vh - ${topPx}px - 48px)` : 'calc(100vh - 124px)') }}>
          { /* Notices for surveys only (system notices moved to dedicated page) */ }

          {!panelLoaded ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 0',gap:10}}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{animation:'spin 0.9s linear infinite'}}>
                <circle cx="18" cy="18" r="14" stroke="#e2e8f0" strokeWidth="4"/>
                <path d="M18 4a14 14 0 0 1 14 14" stroke="#00628d" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{fontSize:'0.8rem', color:'#94a3b8', fontWeight:500}}>Cargando...</div>
            </div>
          ) : (<>
          {notifications.length === 0 && <div className="text-slate-500">No hay notificaciones</div>}

          {/* Filter out notifications that reference surveys that no longer exist or that the user hid */}
          {(() => {
            const visible = (notifications || []).filter((n: any) => {
              try {
                if (!n) return false
                // skip if user hid this notification
                if (n.id && hiddenMap && hiddenMap[String(n.id)]) return false
                if (!n.surveyId) return true
                // surveysFromDB === null means not yet loaded: show optimistically
                // surveysFromDB is a loaded array: only show if the survey still exists
                if (surveysFromDB === null) return true
                const found = (surveysFromDB || []).find((s: any) => String(s.id) === String(n.surveyId))
                return !!found
              } catch (e) {
                return false
              }
            })
            if (!visible || visible.length === 0) return (<div className="text-slate-500">No hay notificaciones</div>)
            return visible.map((n: any, i: number) => {
              let status: 'pending' | 'responded' | 'warning' = 'pending'
              let found: any = null
              try {
                if (n.surveyId) {
                  found = surveysFromDB != null
                    ? ((surveysFromDB || []).find((s: any) => String(s.id) === String(n.surveyId)) || null)
                    : null
                  const sourceFound = found
                  // Prefer user response map (populated from RTDB) to determine if this user already responded
                  const responded = !!userRespondedMap[String(n.surveyId)]
                  if (sourceFound) {
                    if (responded) {
                      status = 'responded'
                    } else {
                      status = 'pending'
                    }
                  } else {
                    status = responded ? 'responded' : 'pending'
                  }
                  if (status === 'pending' && n.expiresAt) {
                    try {
                      const when = Date.parse(n.expiresAt)
                      const now = Date.now()
                      const ms48 = 48 * 3600 * 1000
                      if (when > now && when - now <= ms48) status = 'warning'
                    } catch (e) {}
                  }
                }
              } catch (e) {}

              // Border color is based on survey type: purple for project, green for simple
              const isProjectType = !!(found && (found.type === 'project' || (found.projects && found.projects.length > 0)))
              let borderClass = isProjectType ? 'border-indigo-600' : 'border-green-600'

              // Compute an optional final label (Respondido / Calificado / Próximo)
              let finalLabelText: string | null = null
              let finalLabelCls = 'bg-slate-100 text-slate-700'
              try {
                if (status === 'responded') {
                  if (isProjectType) {
                    // project survey: indigo to match "Crear calificación proyecto" button
                    finalLabelText = 'Calificado'
                    finalLabelCls = 'bg-indigo-100 text-indigo-700'
                  } else {
                    // simple survey: green to match "Nueva Encuesta" button
                    finalLabelText = 'Respondido'
                    finalLabelCls = 'bg-green-100 text-green-700'
                  }
                } else if (status === 'warning') {
                  finalLabelText = 'Próximo'
                  finalLabelCls = 'bg-yellow-100 text-yellow-700'
                }
              } catch (e) {}

              return (
                <div
                  data-notif-item
                  key={`${n.id || 'notif'}-${i}`}
                  onClick={() => {
                    try {
                      if (n.type === 'survey_published' && n.surveyId) {
                        if (status === 'responded') return
                        markNotificationRead(n.id)
                        try {
                          const found = surveysFromDB != null
                    ? ((surveysFromDB || []).find((s: any) => String(s.id) === String(n.surveyId)) || null)
                    : null
                          const kind = found && (found.type === 'project' || (found.projects && found.projects.length > 0)) ? 'projects' : 'view'
                          navigate('/profesor/encuestas', { state: { openSurveyId: String(n.surveyId), openSurveyKind: kind } })
                          // also dispatch a global event so if we are already on Surveys page it triggers immediately
                          try {
                            window.dispatchEvent(new CustomEvent('surveys:open', { detail: { surveyId: String(n.surveyId), kind } }))
                          } catch (e) {}
                        } catch (e) {
                          navigate('/profesor/encuestas', { state: { openSurveyId: String(n.surveyId), openSurveyKind: 'view' } })
                        }
                        onClose && onClose()
                        return
                      }
                    } catch (e) {}
                  }}
                  onMouseEnter={() => handleMouseEnterToast(n, status)}
                  onMouseLeave={() => handleMouseLeaveToast(n)}
                  className={`flex gap-3 p-2 rounded-lg border-l-4 ${borderClass} ${n.read ? 'bg-white/70' : 'bg-white dark:bg-gray-800'} shadow-md ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-lg transition-shadow duration-300 text-sm min-h-[64px]`}
                >
                  <div className="relative flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold">
                        {n.type === 'survey_published' && n.title?.startsWith('Nueva encuesta:') ? (
                          <>
                            <span>Nueva encuesta: </span>
                            <span className="font-normal text-slate-600 dark:text-slate-300">{n.title.slice('Nueva encuesta:'.length).trim()}</span>
                          </>
                        ) : n.title}
                      </div>
                    </div>
                    {n.message && n.type !== 'survey_published' && <div className="text-slate-500 text-sm">{n.message}</div>}
                    {toastMap[n.id] && (
                      <div className="absolute top-2 right-3 z-40">
                        <div className="bg-black text-white px-3 py-1 rounded shadow text-xs">{toastMap[n.id]}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-slate-400 text-xs whitespace-nowrap">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                    {finalLabelText ? (
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${finalLabelCls}`}>{finalLabelText}</div>
                    ) : null}
                  </div>
                </div>
              )
            })
          })()}
          </>)}
        </div>
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-right">
          <button
            type="button"
            onClick={handleLimpiar}
            className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}

