import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../../components/ui/PageLoader';

/**
 * Route guard for protected routes.
 * Redirects unauthenticated users to /login.
 */
export const PrivateRoute = ({ children, redirectTo = '/login' }) => {
  const { accessToken, loading } = useAuth();

  if (loading) {
    return <PageLoader message="Authenticating session..." />;
  }

  const token =
    accessToken ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('accessToken')
      : null);

  if (!token) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ? children : <Outlet />;
};

export default PrivateRoute;
