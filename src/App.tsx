
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import ProfesorLayout from './profesor/ProfesorLayout'
import Dashboard from './profesor/pages/Dashboard'
import Surveys from './profesor/pages/Surveys'
import CreateSurvey from './profesor/pages/CreateSurvey'
import Reports from './profesor/pages/Reports'
import ReportDetail from './profesor/pages/ReportDetail'
import Configuracion from './profesor/pages/Configuracion'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <div style={{fontFamily: 'Inter, Arial, sans-serif'}}>
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
