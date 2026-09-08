import React from 'react';
import { Spinner } from './Spinner';

/**
 * Full page or container loading screen with brand styling and ambient glow.
 *
 * @param {Object} props
 * @param {string} [props.message='Loading ApplyForge...']
 * @param {boolean} [props.fullScreen=true]
 * @param {string} [props.className='']
 */
export const PageLoader = ({
  message = 'Loading ApplyForge...',
  fullScreen = true,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 transition-opacity duration-300 ${
        fullScreen
          ? 'fixed inset-0 z-50 min-h-screen bg-slate-950/90 backdrop-blur-md'
          : 'w-full py-16'
      } ${className}`}
      role="alert"
      aria-busy="true"
    >
      <div className="relative flex flex-col items-center gap-5">
        {/* Ambient background glow */}
        <div className="absolute -inset-6 rounded-full bg-blue-500/15 blur-2xl animate-pulse pointer-events-none" />

        {/* Brand Icon & Spinner combo */}
        <div className="relative flex items-center justify-center">
          <Spinner size="xl" variant="primary" label={message} />
          <div className="absolute w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-blue-500/30">
            A
          </div>
        </div>

        {/* Informational message */}
        {message && (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-200 tracking-wide">{message}</p>
            <p className="text-xs text-slate-500 mt-0.5">Please wait a moment</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PageLoader;
