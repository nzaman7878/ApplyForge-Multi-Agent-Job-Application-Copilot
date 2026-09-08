import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/axios';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem('accessToken') || localStorage.getItem('token') || null;
  });

  const [loading, setLoading] = useState(true);

  // Initialize and verify user on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

      if (token) {
        setAccessToken(token);
        try {
          const res = await api.get('/api/auth/me');
          const userData = res.data.user || res.data;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
          console.error('Failed to authenticate stored session:', error);
          if (!localStorage.getItem('accessToken') && !localStorage.getItem('token')) {
            setUser(null);
            setAccessToken(null);
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { token, accessToken: newAccessToken, refreshToken, user: userData } = res.data;
    const resolvedToken = newAccessToken || token;

    if (resolvedToken) {
      localStorage.setItem('accessToken', resolvedToken);
      localStorage.setItem('token', resolvedToken);
      setAccessToken(resolvedToken);
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }

    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/api/auth/register', { name, email, password });
    const { token, accessToken: newAccessToken, refreshToken, user: userData } = res.data;
    const resolvedToken = newAccessToken || token;

    if (resolvedToken) {
      localStorage.setItem('accessToken', resolvedToken);
      localStorage.setItem('token', resolvedToken);
      setAccessToken(resolvedToken);
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }

    return res.data;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/api/auth/logout', { refreshToken });
    } catch (error) {
      console.warn('Logout API call error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      setAccessToken(null);
    }
  };

  const value = {
    user,
    accessToken,
    loading,
    isAuthenticated: !!accessToken,
    login,
    register,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
