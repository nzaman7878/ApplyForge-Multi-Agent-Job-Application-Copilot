import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import Apply from '../pages/Apply';
import Tracker from '../pages/Tracker';
import ApplicationDetail from '../pages/ApplicationDetail';
import { PublicRoute, PrivateRoute } from './guards';

export const routes = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <Register />
      </PublicRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    ),
  },
  {
    path: '/apply',
    element: (
      <PrivateRoute>
        <Apply />
      </PrivateRoute>
    ),
  },
  {
    path: '/tracker',
    element: (
      <PrivateRoute>
        <Tracker />
      </PrivateRoute>
    ),
  },
  {
    path: '/applications/:id',
    element: (
      <PrivateRoute>
        <ApplicationDetail />
      </PrivateRoute>
    ),
  },
];

export const router = createBrowserRouter(routes);

export default router;
