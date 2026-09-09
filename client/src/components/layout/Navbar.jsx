import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out successfully');
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Nav link style generator
  const getNavLinkClass = ({ isActive }) =>
    `px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'text-white bg-slate-800/80 shadow-sm border border-slate-700/60'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
    }`;

  const getMobileNavLinkClass = ({ isActive }) =>
    `block px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
      isActive
        ? 'text-white bg-slate-800 border border-slate-700'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-6">
            <Link
              to={isAuthenticated ? '/dashboard' : '/'}
              onClick={closeMobileMenu}
              className="flex items-center gap-2 group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                A
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                ApplyForge
              </span>
            </Link>

            {/* Desktop Navigation Links (Authenticated) */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-1.5 ml-4">
                <NavLink to="/dashboard" className={getNavLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/apply" className={getNavLinkClass}>
                  Tailor Application
                </NavLink>
                <NavLink to="/tracker" className={getNavLinkClass}>
                  Tracker
                </NavLink>
              </nav>
            )}
          </div>

          {/* Right: User profile + Auth buttons (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {/* User badge */}
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 font-semibold text-xs flex items-center justify-center border border-blue-500/30">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="text-sm font-medium text-slate-200">
                    {user?.name || user?.email || 'User'}
                  </span>
                </div>

                {/* Logout Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-300 hover:text-white"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button (Hamburger) */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                // Close X Icon
                <svg
                  className="w-6 h-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                // Hamburger Menu Icon
                <svg
                  className="w-6 h-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950/95 px-4 pt-3 pb-5 space-y-3 animate-fade-in backdrop-blur-xl">
          {isAuthenticated ? (
            <>
              {/* Mobile User Header */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 mb-2">
                <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 font-semibold text-sm flex items-center justify-center border border-blue-500/30">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="truncate">
                  <p className="text-sm font-semibold text-white leading-tight">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Mobile Nav Links */}
              <nav className="space-y-1">
                <NavLink
                  to="/dashboard"
                  onClick={closeMobileMenu}
                  className={getMobileNavLinkClass}
                >
                  Dashboard
                </NavLink>
                <NavLink to="/apply" onClick={closeMobileMenu} className={getMobileNavLinkClass}>
                  Tailor Application
                </NavLink>
                <NavLink to="/tracker" onClick={closeMobileMenu} className={getMobileNavLinkClass}>
                  Tracker
                </NavLink>
              </nav>

              {/* Mobile Logout */}
              <div className="pt-2 border-t border-slate-800">
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleLogout}
                  className="w-full justify-center"
                >
                  Logout
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <Link to="/login" onClick={closeMobileMenu} className="block">
                <Button variant="secondary" size="md" className="w-full justify-center">
                  Sign In
                </Button>
              </Link>
              <Link to="/register" onClick={closeMobileMenu} className="block">
                <Button variant="primary" size="md" className="w-full justify-center">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
