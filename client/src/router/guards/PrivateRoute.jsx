import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * Route guard for protected routes.
 * Redirects unauthenticated users to /login.
 */
export const PrivateRoute = ({ children, redirectTo = '/login' }) => {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('accessToken')
      : null;

  if (!token) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ? children : <Outlet />;
};

export default PrivateRoute;
