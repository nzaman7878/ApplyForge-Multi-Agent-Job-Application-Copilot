import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Route guard for public/guest routes (e.g., /login, /register).
 * If the user is already authenticated, redirects to /dashboard.
 */
export const PublicRoute = ({ children, redirectTo = '/dashboard', restricted = true }) => {
  const { accessToken, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const token =
    accessToken ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('accessToken')
      : null);

  if (token && restricted) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ? children : <Outlet />;
};

export default PublicRoute;
