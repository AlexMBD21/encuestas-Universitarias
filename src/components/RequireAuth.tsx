import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f4f8', gap: '20px' }}>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 0.9s linear infinite' }}>
          <circle cx="26" cy="26" r="22" stroke="#e2e8f0" strokeWidth="5" />
          <path d="M26 4a22 22 0 0 1 22 22" stroke="#00628d" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', letterSpacing: '0.03em' }}>Cargando sesión...</div>
      </div>
    );
  }

  if (!user || (user.role !== 'profesor' && user.role !== 'admin')) {
    // Redirige al login si no está autenticado o no es profesor/admin
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}
