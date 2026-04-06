import React, { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import NotificationsPanel from './components/NotificationsPanel'
import './styles/dashboard-profesor.css'
import './styles/notifications-panel-anim.css'
import initDashboardLegacy from './legacy/dashboardLegacyWrapper'
import supabaseClient from '../services/supabaseClient'

type Props = {
  onBack?: () => void
}


export default function ProfesorLayout({ onBack }: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [sharedNotifications, setSharedNotifications] = useState<any[]>([])
  const [visibleNotifCount, setVisibleNotifCount] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
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
      <NotificationsPanel open={notificationsOpen} onClose={closeNotifications} notifications={sharedNotifications} onVisibleCountChange={setVisibleNotifCount} />

      <main id="main-content" className="sidebar-main-content min-w-0 flex-1 overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col max-w-full overflow-x-hidden">
          <div style={{padding: 'var(--space-md)', width: '100%', boxSizing: 'border-box', maxWidth: '100%'}} className="overflow-x-hidden">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
