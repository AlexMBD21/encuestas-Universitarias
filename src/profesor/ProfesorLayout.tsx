import React, { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import NotificationsPanel from './components/NotificationsPanel'
import './styles/dashboard-profesor.css'
import './styles/notifications-panel-anim.css'
import initDashboardLegacy from './legacy/dashboardLegacyWrapper'
import supabaseClient from '../services/supabaseClient'
import AuthAdapter from '../services/AuthAdapter'

type Props = {
  onBack?: () => void
}


export default function ProfesorLayout({ onBack }: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [sharedNotifications, setSharedNotifications] = useState<any[]>([])
  const [visibleNotifCount, setVisibleNotifCount] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [surveysForBadge, setSurveysForBadge] = useState<any[] | null>(null)
  const [hiddenMapForBadge, setHiddenMapForBadge] = useState<Record<string, any>>({})
  const [hiddenMapReady, setHiddenMapReady] = useState(false)
  const navigate = useNavigate();
  const location = useLocation()
  const isDashboardRoot = String(location.pathname || '').replace(/\/+$/,'') === '/profesor'

  const toggleNotifications = () => setNotificationsOpen(v => !v)
  const closeNotifications = () => setNotificationsOpen(false)

  // Single global notifications listener — shared source of truth for Topbar badge
  // and NotificationsPanel list. Keeps both always in sync even when the panel is closed.
  useEffect(() => {
    const dc: any = supabaseClient
    if (!dc?.isEnabled?.()) return
    let unsub: (() => void) | null = null
    if (dc.listenNotifications) {
      unsub = dc.listenNotifications((arr: any[]) => {
        setSharedNotifications(Array.isArray(arr) ? arr : [])
      })
    }
    const onNotifUpdated = async (ev?: any) => {
      try {
        const detail = (ev as CustomEvent)?.detail
        if (detail && Array.isArray(detail.notifications)) {
          setSharedNotifications(detail.notifications)
          return
        }
        if (dc.getNotificationsOnce) {
          const arr = await dc.getNotificationsOnce()
          setSharedNotifications(Array.isArray(arr) ? arr : [])
        }
      } catch (e) {}
    }
    window.addEventListener('notifications:updated', onNotifUpdated as EventListener)
    window.addEventListener('realtime:connected', onNotifUpdated as EventListener)
    return () => {
      if (unsub) try { unsub() } catch (e) {}
      window.removeEventListener('notifications:updated', onNotifUpdated as EventListener)
      window.removeEventListener('realtime:connected', onNotifUpdated as EventListener)
    }
  }, [])

  // Load surveys once for badge filtering (check if survey still exists)
  useEffect(() => {
    const dc: any = supabaseClient
    if (!dc?.isEnabled?.()) { setSurveysForBadge([]); return }
    if (dc.listenSurveys) {
      const unsub = dc.listenSurveys((arr: any[]) => {
        setSurveysForBadge(Array.isArray(arr) ? arr : [])
      })
      return () => { try { unsub() } catch (e) {} }
    } else if (dc.getSurveysOnce) {
      dc.getSurveysOnce().then((arr: any[]) => setSurveysForBadge(Array.isArray(arr) ? arr : [])).catch(() => setSurveysForBadge([]))
    } else {
      setSurveysForBadge([])
    }
  }, [])

  // Load hiddenMap for badge — reads localStorage eagerly, then syncs with DB
  useEffect(() => {
    const dc: any = supabaseClient
    const authUser = (dc?.getAuthCurrentUser?.()) || AuthAdapter.getUser() || null
    const uid = authUser ? ((authUser as any).uid || (authUser as any).id) : null

    // Always read localStorage first (synchronous) so badge is correct immediately
    let localMap: Record<string, any> = {}
    if (uid) {
      try {
        const raw = window.localStorage.getItem(`hiddenNotificationsLocal:${uid}`)
        if (raw) localMap = JSON.parse(raw) || {}
      } catch (e) {}
    }
    setHiddenMapForBadge(localMap)
    setHiddenMapReady(true)

    if (!uid || !dc?.isEnabled?.()) return

    // Then sync with DB in the background
    let unsub: (() => void) | null = null
    if (dc.listenHiddenNotifications) {
      unsub = dc.listenHiddenNotifications(String(uid), (map: Record<string, any>) => {
        setHiddenMapForBadge({ ...localMap, ...(map || {}) })
      })
    } else if (dc.getHiddenNotificationsOnce) {
      dc.getHiddenNotificationsOnce(String(uid))
        .then((m: any) => setHiddenMapForBadge({ ...localMap, ...(m || {}) }))
        .catch(() => {})
    }

    // Keep in sync when the panel triggers a clean
    const onNotifUpdated = () => {
      try {
        const raw = window.localStorage.getItem(`hiddenNotificationsLocal:${uid}`)
        const fresh = raw ? JSON.parse(raw) || {} : {}
        // fresh wins: newly hidden notifications must override the previous state
        setHiddenMapForBadge(prev => ({ ...prev, ...fresh }))
      } catch (e) {}
    }
    window.addEventListener('notifications:updated', onNotifUpdated)
    return () => {
      if (unsub) try { unsub() } catch (e) {}
      window.removeEventListener('notifications:updated', onNotifUpdated)
    }
  }, [])

  // Compute badge count here — always runs because ProfesorLayout is always mounted
  useEffect(() => {
    if (!hiddenMapReady) return        // wait for localStorage to be read
    if (surveysForBadge === null) return // wait for surveys list
    const count = sharedNotifications.filter((n: any) => {
      if (!n) return false
      if (n.id && hiddenMapForBadge[String(n.id)]) return false
      if (!n.surveyId) return true
      return !!surveysForBadge.find((s: any) => String(s.id) === String(n.surveyId))
    }).length
    setVisibleNotifCount(count)
  }, [sharedNotifications, hiddenMapForBadge, hiddenMapReady, surveysForBadge])

  useEffect(() => {
    // Try to initialize legacy dashboard code if present (served by Express)
    try {
      initDashboardLegacy()
    } catch (e) {
      console.debug('dashboard legacy init failed or not present', e)
    }
    // Legacy sidebar persistence removed — modern layout uses topbar/menu.
    try {
      // no-op: removed legacy sidebarOpen handling
    } catch (e) { /* noop */ }
  }, [])

  // Legacy: navigation shims removed.
  // Use react-router (`NavLink` / `useNavigate`) instead of setting globals.

  return (
    <div className={`profesor-root layout-with-sidebar${sidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}>
      <div id="layout-top-anchor" style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none', opacity: 0 }} />
      <Topbar notificationsOpen={notificationsOpen} onToggleNotifications={toggleNotifications} notifications={sharedNotifications} badgeCount={visibleNotifCount} onToggleMobileSidebar={() => setMobileSidebarOpen(v => !v)} mobileSidebarOpen={mobileSidebarOpen} />
      {mobileSidebarOpen && (
        <div className="sidebar-mobile-backdrop" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <NotificationsPanel open={notificationsOpen} onClose={closeNotifications} notifications={sharedNotifications} />

      <main id="main-content" className="sidebar-main-content min-w-0 flex-1 overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col max-w-full overflow-x-hidden">
          <div style={{width: '100%', boxSizing: 'border-box', maxWidth: '100%'}} className="overflow-x-hidden flex-1 flex flex-col">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
