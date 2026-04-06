
import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Login from './components/Login'
import ProfesorLayout from './profesor/ProfesorLayout'
import Dashboard from './profesor/pages/Dashboard'
import Surveys from './profesor/pages/Surveys'
import CreateSurvey from './profesor/pages/CreateSurvey'
import Reports from './profesor/pages/Reports'
import ReportDetail from './profesor/pages/ReportDetail'
import Configuracion from './profesor/pages/Configuracion'
import RequireAuth from './components/RequireAuth'

function ScrollToTop(): null {
  const { pathname } = useLocation()
  React.useEffect(() => {
    try {
      // 1. Reset standard window scroll
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any })
      
      // 2. Reset potential scroll in the layout container (common pattern in this project)
      const mainContent = document.getElementById('main-content')
      if (mainContent) mainContent.scrollTop = 0
      
      // 3. Fallback for late-rendering content or browser scroll restoration
      const timer = setTimeout(() => {
        window.scrollTo(0, 0)
        if (mainContent) mainContent.scrollTop = 0
      }, 50)
      
      return () => clearTimeout(timer)
    } catch (e) {}
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div style={{fontFamily: 'Inter, Arial, sans-serif'}}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/profesor" element={
          <RequireAuth>
            <ProfesorLayout />
          </RequireAuth>
        }>
          <Route index element={<Dashboard />} />
          <Route path="encuestas" element={<Surveys />} />
          <Route path="encuestas/create" element={<CreateSurvey />} />
          <Route path="encuestas/reports" element={<Reports />} />
          <Route path="encuestas/reports/:surveyId" element={<ReportDetail />} />
          <Route path="configuracion" element={<Configuracion />} />
          {/* Notificaciones route removed */}
        </Route>
      </Routes>
    </div>
  )
}
