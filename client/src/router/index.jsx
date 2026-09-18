import React, { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { PublicRoute, PrivateRoute } from './guards';
import PageLoader from '../components/ui/PageLoader';
import Home from '../pages/Home';

// Route-level code splitting using React.lazy for sub-pages
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Apply = lazy(() => import('../pages/Apply'));
const Tracker = lazy(() => import('../pages/Tracker'));
const ApplicationDetail = lazy(() => import('../pages/ApplicationDetail'));

const withSuspense = (Component, message = 'Loading ApplyForge...') => (
  <Suspense fallback={<PageLoader message={message} />}>
    <Component />
  </Suspense>
);

export const routes = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        {withSuspense(Login, 'Loading Sign In...')}
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        {withSuspense(Register, 'Loading Create Account...')}
      </PublicRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <PrivateRoute>
        {withSuspense(Dashboard, 'Loading Analytics Dashboard...')}
      </PrivateRoute>
    ),
  },
  {
    path: '/apply',
    element: (
      <PrivateRoute>
        {withSuspense(Apply, 'Loading Application Pipeline...')}
      </PrivateRoute>
    ),
  },
  {
    path: '/tracker',
    element: (
      <PrivateRoute>
        {withSuspense(Tracker, 'Loading Application Tracker...')}
      </PrivateRoute>
    ),
  },
  {
    path: '/applications/:id',
    element: (
      <PrivateRoute>
        {withSuspense(ApplicationDetail, 'Loading Application Details...')}
      </PrivateRoute>
    ),
  },
];

export const router = createBrowserRouter(routes);

export default router;
