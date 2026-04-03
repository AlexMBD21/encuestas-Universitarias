import React, { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import NotificationsPanel from './components/NotificationsPanel'
import BackButton from './components/BackButton'
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
    <div className="profesor-root bg-background-light dark:bg-background-dark font-display min-h-screen">
      <Topbar notificationsOpen={notificationsOpen} onToggleNotifications={toggleNotifications} notifications={sharedNotifications} badgeCount={visibleNotifCount} />
      <NotificationsPanel open={notificationsOpen} onClose={closeNotifications} notifications={sharedNotifications} onVisibleCountChange={setVisibleNotifCount} />
      <BackButton />

      <main id="main-content" className="flex-1 bg-background-light dark:bg-background-dark ml-0 transition-all duration-300 ease-in-out">
        <div className="layout-container flex h-full grow flex-col">
          <div style={{padding: 'var(--space-md)'}}> 
            {/* Aquí comienza el contenido de cada sección */}
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
