import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AuthAdapter from '../../services/AuthAdapter'

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
    try {
      if ((window as any).logout) return (window as any).logout()
      if ((window as any).showLogoutModal) return (window as any).showLogoutModal()
    } catch (e) {}
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
    <aside id="app-sidebar" ref={sidebarRef} className={`app-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`} aria-label="Navegación principal">

      {/* Collapse toggle */}
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
            onMouseEnter={() => collapsed && setActiveTooltip(item.path)}
            onMouseLeave={() => setActiveTooltip(null)}
            onTouchStart={() => collapsed && showTooltipBriefly(item.path)}
          >
            <span className="material-symbols-outlined sidebar-nav-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
            {collapsed && <span className={`sidebar-tooltip${activeTooltip === item.path ? ' visible' : ''}`}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Logout al fondo */}
      <div className="sidebar-footer">
        <button
          className="sidebar-logout-btn"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          onMouseEnter={() => collapsed && setActiveTooltip('logout')}
          onMouseLeave={() => setActiveTooltip(null)}
          onTouchStart={() => collapsed && showTooltipBriefly('logout')}
        >
          <span className="material-symbols-outlined sidebar-nav-icon">logout</span>
          {!collapsed && <span className="sidebar-nav-label">Cerrar sesión</span>}
          {collapsed && <span className={`sidebar-tooltip${activeTooltip === 'logout' ? ' visible' : ''}`}>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}
