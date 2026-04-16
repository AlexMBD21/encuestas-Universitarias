import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
      timeout = setTimeout(() => { setRendered(false) }, 410)
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

  if (!rendered) return null

  return createPortal(
    <div
      id="notifications-panel"
      ref={rootRef}
      className={`fixed right-0 z-[1000] w-full max-w-md shadow-[-20px_0_50px_rgba(0,0,0,0.1)] border-l border-white/30 rounded-b-3xl flex flex-col ${cls}`}
      style={{ 
        top: topPx != null ? `${topPx}px` : '76px', 
        maxHeight: topPx != null ? `calc(100vh - ${topPx}px)` : 'calc(100vh - 76px)', 
        minHeight: 0, 
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)'
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header con estilo premium */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/40 bg-white/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl font-bold">notifications_active</span>
            </div>
            <h3 className="font-black text-slate-800 tracking-tighter uppercase text-xs">Centro de Avisos</h3>
          </div>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleLimpiar}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black text-primary hover:bg-primary/10 transition-all duration-300 active:scale-95 uppercase tracking-widest bg-white/50 border border-white/60 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm font-bold">done_all</span>
              Limpiar
            </button>
          )}
        </div>

        <div ref={innerRef} className="p-4 space-y-3 custom-scrollbar flex-1 overflow-y-auto" style={{ maxHeight: itemHeight ? `${itemHeight * 5 + 32}px` : (topPx != null ? `calc(100vh - ${topPx}px - 100px)` : 'calc(100vh - 176px)') }}>
          {!panelLoaded ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando...</p>
            </div>
          ) : (<>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                  <span className="material-symbols-outlined text-slate-300 text-4xl">notifications_off</span>
                </div>
                <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm mb-1 uppercase tracking-tight">Todo despejado</h4>
                <p className="text-[11px] text-slate-500 max-w-[200px] font-medium">No tienes avisos pendientes por el momento.</p>
              </div>
            ) : (
              (() => {
                const visible = (notifications || []).filter((n: any) => {
                  try {
                    if (!n) return false
                    if (n.id && hiddenMap && hiddenMap[String(n.id)]) return false
                    if (!n.surveyId) return true
                    if (surveysFromDB === null) return true
                    return !!(surveysFromDB || []).find((s: any) => String(s.id) === String(n.surveyId))
                  } catch (e) { return false }
                })

                if (notifications.length > 0 && visible.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <span className="material-symbols-outlined text-slate-200 text-5xl mb-3">done_all</span>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-inter">No hay más avisos</p>
                    </div>
                  )
                }

                return visible.map((n: any, i: number) => {
                  let status: 'pending' | 'responded' | 'warning' = 'pending'
                  let survey: any = null
                  try {
                    if (n.surveyId) {
                      survey = surveysFromDB != null ? (surveysFromDB.find((s: any) => String(s.id) === String(n.surveyId)) || null) : null
                      const responded = !!userRespondedMap[String(n.surveyId)]
                      if (responded) status = 'responded'
                      else if (n.expiresAt && Date.parse(n.expiresAt) - Date.now() <= 48 * 3600 * 1000) status = 'warning'
                    }
                  } catch (e) {}

                  const isProject = !!(survey && (survey.type === 'project' || survey.projects?.length > 0))
                  const colorClass = isProject ? 'bg-indigo-600' : 'bg-green-600'
                  const typeLabel = isProject ? 'PROYECTO' : 'NUEVA ENCUESTA'
                  const isResponded = status === 'responded'
                  const statusLabel = isResponded ? (isProject ? 'CALIFICADO' : 'RESPONDIDO') : (status === 'warning' ? 'CERRANDO' : null)

                  return (
                    <div
                      data-notif-item
                      key={`${n.id || 'notif'}-${i}`}
                      onClick={() => {
                        if (!n.surveyId) return
                        markNotificationRead(n.id)
                        const kind = isProject ? 'projects' : 'view'
                        navigate('/profesor/encuestas', { state: { openSurveyId: String(n.surveyId), openSurveyKind: kind } })
                        window.dispatchEvent(new CustomEvent('surveys:open', { detail: { surveyId: String(n.surveyId), kind } }))
                        onClose && onClose()
                      }}
                      className={`
                        group relative flex items-center gap-4 p-4 rounded-2xl transition-all duration-300
                        ${n.read ? 'bg-slate-100/40 opacity-60' : 'bg-white shadow-xl shadow-slate-200/20'} 
                        border border-white hover:bg-white hover:shadow-2xl hover:shadow-primary/10 hover:scale-[1.02]
                        cursor-pointer active:scale-[0.98] overflow-hidden
                      `}
                    >
                      {/* Indicador lateral sutil con glow */}
                      <div className={`absolute top-0 left-0 w-2 h-full ${colorClass} opacity-100`} />
                      
                      <div className="flex-1 min-w-0 pl-0.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                             <span className={`text-[8.5px] font-black uppercase tracking-[0.06em] ${isProject ? 'text-indigo-600' : 'text-green-600'}`}>
                                {typeLabel}
                             </span>
                             {statusLabel && (
                               <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded ${isResponded ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} border border-current opacity-90`}>
                                 {statusLabel}
                               </span>
                             )}
                          </div>
                          <span className="text-[8px] font-bold text-slate-400">
                             {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-black text-slate-800 dark:text-slate-100 truncate pr-2 tracking-tight group-hover:text-primary transition-colors mb-0">
                           {n.title?.replace('Nueva encuesta:', '').trim() || 'Aviso de sistema'}
                        </h4>
                        <div className="text-[10px] text-slate-500 font-bold dark:text-slate-400 line-clamp-1 opacity-60 italic font-inter leading-tight">
                          {n.message || 'Pulsa para participar.'}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()
            )}
          </>)}
        </div>
        
        {/* Bottom handle: interactive and adds to the folding theme */}
        <div 
          onClick={onClose}
          className="px-6 py-6 bg-slate-50/20 flex justify-center border-t border-slate-200/20 cursor-pointer hover:bg-slate-100/40 transition-all group/pill"
          title="Cerrar panel"
        >
            <div className="w-16 h-1 bg-slate-300 rounded-full opacity-40 group-hover/pill:opacity-100 group-hover/pill:bg-primary transition-all duration-300" />
        </div>
      </div>
    </div>,
    document.body
  )
}

