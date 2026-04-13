import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import Loader from './Loader';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader fullScreen text="Cargando sesión..." />;
  }

  if (!user || (user.role !== 'profesor' && user.role !== 'admin')) {
    // Redirige al login si no está autenticado o no es profesor/admin
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}
