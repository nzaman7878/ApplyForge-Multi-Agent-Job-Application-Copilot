import React from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * BaseChartWrapper Component
 *
 * Provides a standardized, beautifully themed dark-mode container for Recharts charts
 * with title, subtitle, custom actions, loading states, empty states, and responsive sizing.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.title] - Header title
 * @param {React.ReactNode} [props.subtitle] - Header subtitle / description
 * @param {React.ReactNode} [props.action] - Optional action element on header right (e.g., filter buttons)
 * @param {boolean} [props.isLoading=false] - Whether data is loading (shows skeleton loader)
 * @param {boolean} [props.isEmpty=false] - Whether chart has no data
 * @param {string} [props.emptyMessage='No data available yet'] - Primary empty state message
 * @param {string} [props.emptyDescription] - Secondary empty state guidance
 * @param {number|string} [props.height=300] - Chart container height in pixels or string
 * @param {boolean} [props.responsive=true] - Whether to automatically wrap children in ResponsiveContainer
 * @param {React.ReactNode} [props.footer] - Optional footer content (e.g. key takeaway, badge)
 * @param {string} [props.className=''] - Additional styling classes for outer card
 * @param {React.ReactNode|Function} props.children - Chart component(s)
 */
export function BaseChartWrapper({
  title,
  subtitle,
  action,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data available yet',
  emptyDescription = 'Activity will appear here once you track or submit applications.',
  height = 300,
  responsive = true,
  footer,
  className = '',
  children,
}) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-slate-700/80 ${className}`}
    >
      {/* Chart Header */}
      {(title || subtitle || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-400 font-normal">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}

      {/* Chart Body */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {isLoading ? (
          /* Loading Skeleton State */
          <div className="flex h-full w-full flex-col justify-end space-y-3 p-4 animate-pulse">
            <div className="flex h-full items-end gap-3 justify-around pt-6">
              <div className="h-1/3 w-8 rounded-t bg-slate-800" />
              <div className="h-2/3 w-8 rounded-t bg-slate-800" />
              <div className="h-1/2 w-8 rounded-t bg-slate-800" />
              <div className="h-4/5 w-8 rounded-t bg-slate-800" />
              <div className="h-3/5 w-8 rounded-t bg-slate-800" />
              <div className="h-2/5 w-8 rounded-t bg-slate-800" />
              <div className="h-full w-8 rounded-t bg-slate-800" />
            </div>
            <div className="h-2 w-full rounded bg-slate-800" />
            <div className="flex justify-between">
              <div className="h-2 w-12 rounded bg-slate-800" />
              <div className="h-2 w-12 rounded bg-slate-800" />
              <div className="h-2 w-12 rounded bg-slate-800" />
            </div>
          </div>
        ) : isEmpty ? (
          /* Empty State */
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400 shadow-inner">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-200">{emptyMessage}</p>
            {emptyDescription && (
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                {emptyDescription}
              </p>
            )}
          </div>
        ) : responsive ? (
          /* Responsive Chart Wrapper */
          <ResponsiveContainer width="100%" height="100%">
            {typeof children === 'function' ? children({ height }) : children}
          </ResponsiveContainer>
        ) : (
          /* Non-responsive Fixed Chart */
          typeof children === 'function' ? children({ height }) : children
        )}
      </div>

      {/* Optional Footer */}
      {footer && (
        <div className="mt-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
}

export default BaseChartWrapper;
