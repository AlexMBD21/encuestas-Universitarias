

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
import Inscripcion from './public/pages/Inscripcion'
import SatisfaccionEncuesta from './public/pages/SatisfaccionEncuesta'
import SatisfaccionSuccess from './public/pages/SatisfaccionSuccess'
import { ToastProvider, ToastImperativeMount } from './components/ui/Toast'

function ScrollToTop(): null {
  const { pathname } = useLocation()
  React.useEffect(() => {
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any })
      if (document.documentElement) document.documentElement.scrollTop = 0
      if (document.body) document.body.scrollTop = 0
      
      const anchor = document.getElementById('layout-top-anchor')
      if (anchor) try { anchor.scrollIntoView({ block: 'start', inline: 'nearest' }) } catch (e) {}

      const targets = ['main-content', 'report-detail-root', 'reports-root', 'surveys-root']
      targets.forEach(id => {
        const el = document.getElementById(id)
        if (el) el.scrollTop = 0
      })

      const layoutContainers = document.querySelectorAll('.layout-container')
      layoutContainers.forEach((el: any) => { el.scrollTop = 0 })
    }

    reset()
    requestAnimationFrame(reset)
    
    const intervals = [50, 200]
    const timers = intervals.map(ms => setTimeout(reset, ms))
    
    return () => timers.forEach(clearTimeout)
  }, [pathname])
  return null
}



export default function App() {
  return (
    <ToastProvider>
      <ToastImperativeMount />
      <div style={{fontFamily: 'Inter, Arial, sans-serif'}} className="flex flex-col min-h-[100dvh] w-full max-w-full overflow-x-hidden relative">
        <ScrollToTop />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/inscripcion/:token" element={<Inscripcion />} />
        <Route path="/satisfaccion/:token" element={<SatisfaccionEncuesta />} />
        <Route path="/satisfaccion/votar/:surveyId" element={<SatisfaccionEncuesta />} />
        <Route path="/satisfaccion/success" element={<SatisfaccionSuccess />} />
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
    </ToastProvider>
  )
}
