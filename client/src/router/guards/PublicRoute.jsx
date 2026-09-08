import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * Route guard for public/guest routes (e.g., /login, /register).
 * If the user is already authenticated, redirects to /dashboard.
 */
export const PublicRoute = ({ children, redirectTo = '/dashboard', restricted = true }) => {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || localStorage.getItem('accessToken')
      : null;

  if (token && restricted) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ? children : <Outlet />;
};

export default PublicRoute;
