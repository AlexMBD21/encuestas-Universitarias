import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import AuthAdapter from '../../services/AuthAdapter'
import { Modal } from '../../components/ui/Modal'

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const navItems = [
  { path: '/profesor', icon: 'dashboard', label: 'Inicio' },
  { path: '/profesor/encuestas', icon: 'assignment', label: 'Encuestas' },
  { path: '/profesor/encuestas/reports', icon: 'bar_chart', label: 'Reportes' },
  { path: '/profesor/configuracion', icon: 'settings', label: 'Configuración' },
]

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const effectiveCollapsed = isMobile ? false : collapsed

  const showTooltipBriefly = (key: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    setActiveTooltip(key)
    // fallback: auto-dismiss after 4s en caso de que no haya navegación
    tooltipTimerRef.current = setTimeout(() => setActiveTooltip(null), 4000)
  }

  useEffect(() => {
    const dismiss = (e: Event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setActiveTooltip(null)
      }
    }
    document.addEventListener('pointerdown', dismiss, { capture: true })
    document.addEventListener('scroll', () => setActiveTooltip(null), { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', dismiss, { capture: true })
      document.removeEventListener('scroll', () => setActiveTooltip(null), { capture: true })
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    }
  }, [])

  const handleNavClick = (path: string) => {
    navigate(path)
    if (mobileOpen && onMobileClose) {
      setTimeout(() => {
        onMobileClose()
        setActiveTooltip(null)
      }, 300)
    } else {
      setActiveTooltip(null)
    }
  }

  const handleLogout = () => {
    setActiveTooltip(null)
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    setShowLogoutConfirm(false)
    try { AuthAdapter.logout() } catch (e) {}
    try { navigate('/', { replace: true }) } catch (e) { window.location.href = '/' }
  }

  const getActivePath = () => {
    const curPath = location.pathname || ''
    const paths = navItems.map(i => i.path)
    let activePath = ''
    for (const p of paths) {
      if (curPath === p || curPath === p + '/' || curPath.startsWith(p + '/')) {
        if (!activePath || p.length > activePath.length) activePath = p
      }
    }
    return activePath
  }
  const activePath = getActivePath()

  return (
    <>
    <aside id="app-sidebar" ref={sidebarRef} className={`app-sidebar${effectiveCollapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`} aria-label="Navegación principal">

      {/* Collapse toggle — oculto en mobile via CSS */}
      <div className="sidebar-collapse-row">
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <span className="material-symbols-outlined">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Navegación">
        {navItems.map(item => (
          <button
            key={item.path}
            className={`sidebar-nav-item${activePath === item.path ? ' active' : ''}`}
            onClick={() => handleNavClick(item.path)}
            aria-current={activePath === item.path ? 'page' : undefined}
            onMouseEnter={() => effectiveCollapsed && setActiveTooltip(item.path)}
            onMouseLeave={() => setActiveTooltip(null)}
            onTouchStart={() => effectiveCollapsed && showTooltipBriefly(item.path)}
          >
            <span className="material-symbols-outlined sidebar-nav-icon">{item.icon}</span>
            {!effectiveCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
            {effectiveCollapsed && <span className={`sidebar-tooltip${activeTooltip === item.path ? ' visible' : ''}`}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Logout al fondo */}
      <div className="sidebar-footer">
        <button
          className="sidebar-logout-btn"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          onMouseEnter={() => effectiveCollapsed && setActiveTooltip('logout')}
          onMouseLeave={() => setActiveTooltip(null)}
          onTouchStart={() => effectiveCollapsed && showTooltipBriefly('logout')}
        >
          <span className="material-symbols-outlined sidebar-nav-icon">logout</span>
          {!effectiveCollapsed && <span className="sidebar-nav-label">Cerrar sesión</span>}
          {effectiveCollapsed && <span className={`sidebar-tooltip${activeTooltip === 'logout' ? ' visible' : ''}`}>Cerrar sesión</span>}
        </button>
      </div>
    </aside>

    <Modal
      isOpen={showLogoutConfirm}
      onClose={() => setShowLogoutConfirm(false)}
      maxWidth="max-w-sm"
      hideCloseButton={true}
      noHeaderShadow={true}
      scrollableBody={false}
      title={
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[26px]">logout</span>
          </div>
          <span>¿Cerrar sesión?</span>
        </div>
      }
    >
      <div className="p-6">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 font-medium">¿Estás seguro de que deseas cerrar la sesión actual?</p>
        <div className="flex flex-col sm:flex-row-reverse gap-3">
          <button 
            type="button" 
            onClick={confirmLogout} 
            className="btn btn-primary flex-1 !bg-red-600 hover:!bg-red-700 !shadow-red-600/30"
          >
            Cerrar sesión
          </button>
          <button 
            type="button" 
            onClick={() => setShowLogoutConfirm(false)} 
            className="btn btn-ghost flex-1"
          >
            Cancelar y Volver
          </button>
        </div>
      </div>
    </Modal>
  </>
  )
}
