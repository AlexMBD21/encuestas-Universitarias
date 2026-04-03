import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import AuthAdapter from '../../services/AuthAdapter'
import surveyHelpers from '../../services/surveyHelpers'
import supabaseClient from '../../services/supabaseClient'

type Props = {
  notificationsOpen: boolean
  onToggleNotifications: () => void
  notifications?: any[]
  badgeCount?: number
}

export default function Topbar({ notificationsOpen, onToggleNotifications, notifications: notificationsProp, badgeCount }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement | null>(null)
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null)
  const [portalRect, setPortalRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [dropdownMounted, setDropdownMounted] = useState(false)
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const closingTimeoutRef = useRef<number | null>(null)
  const openRafRef = useRef<number | null>(null)
  const [logoutMessage, setLogoutMessage] = useState('')
  const [logoutMsgType, setLogoutMsgType] = useState<'success' | 'error'>('success')
  const logoutTimerRef = useRef<number | null>(null)
  const navTimerRef = useRef<number | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0)
  const [pendingResponses, setPendingResponses] = useState<number>(0)
  const [currentUser, setCurrentUser] = useState<any | null>(() => AuthAdapter.getUser())
  const [hiddenMap, setHiddenMap] = useState<Record<string, any>>({})
  const [hiddenMapLoaded, setHiddenMapLoaded] = useState(false)
  const [surveysList, setSurveysList] = useState<any[] | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (ddRef.current && !ddRef.current.contains(t) && toggleBtnRef.current && !toggleBtnRef.current.contains(t)) {
        closeMenu()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Recompute pendingResponses using the user's responses fetched from Firebase
  useEffect(() => {
    let cancelled = false
    const computePending = async () => {
      try {
        if (!surveysList || !Array.isArray(surveysList)) {
          if (!cancelled) setPendingResponses(0)
          return
        }
        const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
        const dataClient: any = supabaseClient
        const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
        const uid = authUser ? (authUser as any).uid : (currentUser && currentUser.uid) || null
        if (!uid) {
          if (!cancelled) setPendingResponses(0)
          return
        }

        // Fetch all responses by this user indexed by surveyId
        let userResponsesBySurvey: Record<string, any[]> = {}
        try {
          if (dataClient && dataClient.getUserResponsesByUser) {
            userResponsesBySurvey = await dataClient.getUserResponsesByUser(uid)
          }
        } catch (e) { userResponsesBySurvey = {} }

        let pending = 0
        surveysList.forEach((s: any) => {
          try {
            if (!s || !s.published) return
            const surveyId = String(s.id)
            const userRespForSurvey = Array.isArray(userResponsesBySurvey[surveyId]) ? userResponsesBySurvey[surveyId] : []
            if (s.type === 'project' || (s.projects && s.projects.length > 0)) {
              // count unique project responses by this user for this survey
              const projects = s.projects || []
              const uniqueProjectIds = new Set((userRespForSurvey || []).map((r: any) => String(r.projectId || r.project || r.projectId)))
              if (uniqueProjectIds.size < (projects || []).length) pending += 1
            } else {
              // non-project survey -> pending if user has no responses for this survey
              if (!userRespForSurvey || userRespForSurvey.length === 0) pending += 1
            }
          } catch (e) {}
        })

        if (!cancelled) setPendingResponses(pending)
      } catch (e) {
        if (!cancelled) setPendingResponses(0)
      }
    }
    computePending()
    return () => { cancelled = true }
  }, [surveysList, currentUser])

  useEffect(() => {
    if (dropdownVisible) {
      // focus the item that matches current route, otherwise first item
      try {
        const path = location.pathname || ''
        // prefer exact matches, otherwise fallback to prefix match
        const exact = ddRef.current?.querySelector<HTMLElement>(`.item[data-path="${path}"]`)
        if (exact) return exact.focus()
        // try prefix matches like /profesor/encuestas
        const prefixMatch = Array.from(ddRef.current?.querySelectorAll<HTMLElement>('.item[data-path]') || []).find(el => {
          const p = el.getAttribute('data-path') || ''
          return p && path.startsWith(p)
        })
        if (prefixMatch) return prefixMatch.focus()
        const first = ddRef.current?.querySelector<HTMLElement>('.item')
        first?.focus()
      } catch (e) {
        const first = ddRef.current?.querySelector<HTMLElement>('.item')
        first?.focus()
      }
    }
  }, [dropdownVisible])

  // helper to close the menu and move focus back to the toggle (animates hide then unmounts)
  function closeMenu() {
    try { toggleBtnRef.current?.focus() } catch (e) {}
    // start hide animation
    setDropdownVisible(false)
    // clear previous timeout
    if (closingTimeoutRef.current) window.clearTimeout(closingTimeoutRef.current)
    // wait for CSS closing animation then unmount
    closingTimeoutRef.current = window.setTimeout(() => {
      setDropdownMounted(false)
      setPortalRect(null)
      setOpen(false)
      closingTimeoutRef.current = null
    }, 320)
  }

  const onToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (open) { closeMenu(); return }
    // if notifications panel is open, request parent to close it so only one is visible
    try { if ((notificationsOpen as boolean) && onToggleNotifications) onToggleNotifications() } catch (e) {}
    setOpen(true)
  }

  // If notifications panel opens elsewhere, close this user menu so both aren't open
  useEffect(() => {
    try {
      if (notificationsOpen) {
        // animate close
        if (open) closeMenu()
      }
    } catch (e) {}
  }, [notificationsOpen])

  // compute portal rect for dropdown so it can be rendered outside the topbar
  useEffect(() => {
    if (!open) {
      // cleanup any pending open animations
      if (openRafRef.current) { cancelAnimationFrame(openRafRef.current); openRafRef.current = null }
      setPortalRect(null)
      setDropdownMounted(false)
      setDropdownVisible(false)
      return
    }

    const compute = () => {
      try {
        const btn = toggleBtnRef.current
        if (!btn) { setPortalRect(null); return }
        const r = btn.getBoundingClientRect()
        const menuW = Math.min(260, Math.max(200, Math.floor(window.innerWidth * 0.22)))
        const left = Math.min(Math.max(Math.floor(r.right - menuW), 8), Math.max(8, window.innerWidth - menuW - 8))
        const topBarEl = document.getElementById('top-bar')
        const topBarBottom = topBarEl ? topBarEl.getBoundingClientRect().bottom : r.bottom
        // tuck a bit under the topbar so it appears to emerge from behind
        const top = Math.floor(topBarBottom - 8)
        setPortalRect({ top, left, width: menuW })
        setDropdownMounted(true)
        // ensure the element mounts first, then add the 'show' class in next frame
        if (openRafRef.current) cancelAnimationFrame(openRafRef.current)
        openRafRef.current = window.requestAnimationFrame(() => {
          // small timeout to ensure styles apply
          window.setTimeout(() => { setDropdownVisible(true); openRafRef.current = null }, 16)
        })
      } catch (e) { setPortalRect(null) }
    }

    compute()
    window.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute)
    const onScrollClose = () => { if (open) closeMenu() }
    window.addEventListener('scroll', onScrollClose, { passive: true })
    return () => { window.removeEventListener('scroll', compute); window.removeEventListener('resize', compute); window.removeEventListener('scroll', onScrollClose) }
  }, [open])

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (closingTimeoutRef.current) window.clearTimeout(closingTimeoutRef.current)
      if (openRafRef.current) cancelAnimationFrame(openRafRef.current)
    }
  }, [])

  const onLogout = () => {
    // Prefer app-level logout if available, fallback to legacy modal
    try {
      if ((window as any).logout) return (window as any).logout()
      if ((window as any).showLogoutModal) return (window as any).showLogoutModal()
    } catch (e) {}
    try {
      AuthAdapter.logout()
    } catch (e) {}
    closeMenu()

    // show a small logout flow: 'Cerrando sesión...' -> 'Sesión cerrada' (red)
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current)
    if (navTimerRef.current) window.clearTimeout(navTimerRef.current)
    setLogoutMessage('Cerrando sesión...')
    setLogoutMsgType('success')

    logoutTimerRef.current = window.setTimeout(() => {
      setLogoutMessage('Sesión cerrada')
      // make the final message red
      setLogoutMsgType('error')
      navTimerRef.current = window.setTimeout(() => {
        setLogoutMessage('')
        try { navigate('/', { replace: true }) } catch (e) { setTimeout(() => window.location.reload(), 300) }
      }, 700)
    }, 600)
  }

  useEffect(() => {
    const onAuth = () => { try { setCurrentUser(AuthAdapter.getUser()) } catch (e) {} }
    try { window.addEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
    return () => {
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current)
      if (navTimerRef.current) window.clearTimeout(navTimerRef.current)
      try { window.removeEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
    }
  }, [])

  // load unread notifications count and listen for updates
  useEffect(() => {
    let unsubSurv: (() => void) | null = null

    const loadLocal = () => {
      // localStorage fallback removed for surveys; default to zero counts
      setPendingResponses(0)
    }

    try {
      const supabaseEnabledG = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClientG: any = supabaseClient
      if (dataClientG && dataClientG.isEnabled && dataClientG.isEnabled() && dataClientG.listenSurveys) {
        unsubSurv = dataClientG.listenSurveys((arr: any[]) => {
          // keep surveys in state and compute pending in a dedicated effect (below)
          setSurveysList(Array.isArray(arr) ? arr : [])
        })
      } else {
        loadLocal()
      }

      // when connected, explicitly re-fetch once to ensure counters are correct
      const onConnectedGlobal = async () => {
        try {
          if (!(dataClientG && dataClientG.isEnabled && dataClientG.isEnabled())) return
          try {
            // Fetch surveys and compute pendingResponses (no local hidden interaction needed)
            const arr = await (dataClientG.getSurveysOnce ? dataClientG.getSurveysOnce() : [])
            let pending = 0
            if (Array.isArray(arr)) {
              arr.forEach((s: any) => {
                if (!s || !s.published) return
                try {
                  if (s.type === 'project' || (s.projects && s.projects.length > 0)) {
                    const prog = surveyHelpers.getProgressForUser(String(s.id), (s.projects || []).length)
                    if (prog.rated < prog.total) pending += 1
                  } else {
                    if (!surveyHelpers.hasUserResponded(String(s.id))) pending += 1
                  }
                } catch (e) {}
              })
            }
            setPendingResponses(pending)
          } catch (e) {}
        } catch (e) {}
      }

      // call once immediately if client is available
      try { if (dataClientG && dataClientG.isEnabled && dataClientG.isEnabled()) onConnectedGlobal() } catch (e) {}

      window.addEventListener('realtime:connected', onConnectedGlobal as EventListener)
    } catch (e) { loadLocal() }

    return () => {
      if (unsubSurv) try { unsubSurv() } catch (e) {}
      try { window.removeEventListener('realtime:connected', () => {}) } catch (e) {}
    }
  }, [])

  // Listen to per-user hidden notifications and keep hiddenMap (with local fallback)
  useEffect(() => {
    let unsubHidden: (() => void) | null = null
    try {
      const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClient: any = supabaseClient
      const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
      const uid = authUser ? (authUser as any).uid : (currentUser && currentUser.uid) || null
      if (!uid) { setHiddenMap({}); setHiddenMapLoaded(true); return () => {} }
      if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.listenHiddenNotifications) {
        unsubHidden = dataClient.listenHiddenNotifications(String(uid), (map: Record<string, any>) => {
          try { setHiddenMap(map || {}) } catch (e) { setHiddenMap({}) }
          setHiddenMapLoaded(true)
        })
      } else if (dataClient && dataClient.getHiddenNotificationsOnce) {
        try {
          dataClient.getHiddenNotificationsOnce(String(uid))
            .then((m: any) => { setHiddenMap(m || {}); setHiddenMapLoaded(true) })
            .catch(() => { setHiddenMap({}); setHiddenMapLoaded(true) })
        } catch (e) { setHiddenMap({}); setHiddenMapLoaded(true) }
      } else {
        setHiddenMapLoaded(true)
      }
      // also load any local fallback
      try {
        const localKey = `hiddenNotificationsLocal:${uid}`
        const raw = window.localStorage.getItem(localKey)
        if (raw) {
          try {
            const parsed = JSON.parse(raw || '{}')
            setHiddenMap(prev => ({ ...(prev || {}), ...(parsed || {}) }))
          } catch (e) {}
        }
      } catch (e) {}
    } catch (e) { setHiddenMap({}) }
    return () => { if (unsubHidden) try { unsubHidden() } catch (e) {} }
  }, [currentUser])

  // Badge count comes directly from NotificationsPanel via ProfesorLayout (badgeCount prop).
  // It reflects exactly what the panel renders, so badge and panel list are always in sync.
  useEffect(() => {
    if (badgeCount !== undefined) setUnreadNotifications(badgeCount)
  }, [badgeCount])

  return (
    <>
      <div id="top-bar" className="fixed top-0 right-0 left-0 z-30 flex justify-end items-center gap-1 py-2 px-3 shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)'}}>
      <button
        id="btn-notifications"
        className="relative p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        aria-label="Notificaciones"
        aria-expanded={notificationsOpen}
        onClick={(e) => { e.stopPropagation(); onToggleNotifications() }}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadNotifications > 0 ? (
          // show numeric badge for unread notifications (matches what the panel shows)
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-600 rounded-full border-2 border-white dark:border-gray-900">
            {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
          </span>
        ) : pendingResponses > 0 ? (
          // fallback: show pending (unresponded) surveys count when no unread notifications
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-600 rounded-full border-2 border-white dark:border-gray-900">
            {pendingResponses > 99 ? '99+' : String(pendingResponses)}
          </span>
        ) : (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 opacity-0" />
        )}
      </button>

      

      <div className="user-menu relative">
        <button
          id="user-menu-toggle"
          ref={toggleBtnRef}
          className="user-menu-button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls="user-dropdown"
          onClick={onToggle}
        >
          <div id="user-avatar" className="user-avatar placeholder">{(currentUser && (currentUser.name || currentUser.email) ? String((currentUser.name || currentUser.email)).slice(0,2).toUpperCase() : 'PM')}</div>
          <span className="ml-2 mr-2 text-sm hidden sm:inline-block text-slate-700 dark:text-slate-200">{currentUser ? (currentUser.name || currentUser.displayName || currentUser.email) : 'Invitado'}</span>
          <span className="material-symbols-outlined chev" aria-hidden="true">expand_more</span>
        </button>
        {dropdownMounted && portalRect && ReactDOM.createPortal(
          <div
            id="user-dropdown"
            ref={ddRef}
            className={`user-dropdown ${dropdownVisible ? 'show' : ''}`}
            role="menu"
            style={{ position: 'fixed', top: portalRect.top, left: portalRect.left, width: portalRect.width }}
          >
            {
              (() => {
                const curPath = location.pathname || ''
                // define top-level menu paths and pick the most specific match
                const menuPaths = ['/profesor', '/profesor/encuestas', '/profesor/encuestas/reports', '/profesor/configuracion']
                let activePath = ''
                for (const p of menuPaths) {
                  if (!p) continue
                  if (curPath === p || curPath === p + '/' || curPath.startsWith(p + '/')) {
                    if (!activePath || p.length > activePath.length) activePath = p
                  }
                }
                const isActive = (p: string) => activePath === p
                return (
                  <>
                    <div tabIndex={0} className={`item ${isActive('/profesor') ? 'active' : ''}`} data-path="/profesor" onClick={() => { closeMenu(); try { navigate('/profesor') } catch (e) {} }}>Dashboard</div>

                    <div tabIndex={0} className={`item ${isActive('/profesor/encuestas') ? 'active' : ''}`} data-path="/profesor/encuestas" onClick={() => { closeMenu(); try { navigate('/profesor/encuestas') } catch (e) {} }}>Encuestas</div>
                    <div tabIndex={0} className={`item ${isActive('/profesor/encuestas/reports') ? 'active' : ''}`} data-path="/profesor/encuestas/reports" onClick={() => { closeMenu(); try { navigate('/profesor/encuestas/reports') } catch (e) {} }}>Reportes encuestas</div>
                    {/* Notificaciones removed */}
                    <div tabIndex={0} className={`item ${isActive('/profesor/configuracion') ? 'active' : ''}`} data-path="/profesor/configuracion" onClick={() => { closeMenu(); try { navigate('/profesor/configuracion') } catch (e) {} }}>Configuración</div>

                    <div className="divider" />
                    <div tabIndex={0} onClick={onLogout} className="item logout-item">Cerrar sesión</div>
                  </>
                )
              })()
            }
          </div>, document.body
        )}
      </div>
    </div>
      {/* logout toast (uses styles from login.css) */}
      {logoutMessage && (
        <div className={`message ${logoutMsgType} show`} role="status">
          {logoutMessage}
        </div>
      )}
    </>
  )
}
