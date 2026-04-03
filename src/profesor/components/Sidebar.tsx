import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
}

const navItems = [
  { path: '/profesor', icon: 'dashboard', label: 'Inicio' },
  { path: '/profesor/encuestas', icon: 'assignment', label: 'Encuestas' },
  { path: '/profesor/encuestas/reports', icon: 'bar_chart', label: 'Reportes' },
  { path: '/profesor/configuracion', icon: 'settings', label: 'Configuración' },
]

export default function Sidebar({ collapsed, onToggleCollapse }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

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
    <aside id="app-sidebar" className={`app-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Navegación principal">

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
            onClick={() => navigate(item.path)}
            aria-current={activePath === item.path ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
          >
            <span className="material-symbols-outlined sidebar-nav-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  )
}
