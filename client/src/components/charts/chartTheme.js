/**
 * Chart Theme & Palette Configuration for ApplyForge
 * Built for sleek dark-mode aesthetics with high-contrast accessibility
 */

export const CHART_COLORS = {
  primary: '#3b82f6', // blue-500
  secondary: '#8b5cf6', // violet-500
  success: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  info: '#06b6d4', // cyan-500
  accent: '#ec4899', // pink-500
  muted: '#64748b', // slate-500
};

export const STATUS_COLORS = {
  wishlist: '#64748b', // slate-500
  applied: '#3b82f6', // blue-500
  interviewing: '#f59e0b', // amber-500
  offer: '#10b981', // emerald-500
  rejected: '#ef4444', // red-500
};

export const FIT_TIER_COLORS = {
  stretch: '#ef4444', // red-500 (<60)
  moderate: '#f59e0b', // amber-500 (60-79)
  strong: '#10b981', // emerald-500 (80-100)
};

export const chartTheme = {
  grid: {
    stroke: 'rgba(148, 163, 184, 0.12)',
    strokeDasharray: '3 3',
  },
  axis: {
    stroke: 'rgba(148, 163, 184, 0.25)',
    tick: {
      fill: '#94a3b8',
      fontSize: 12,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    },
    tickLine: {
      stroke: 'rgba(148, 163, 184, 0.25)',
    },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(51, 65, 85, 0.8)',
      borderRadius: '0.5rem',
      boxShadow:
        '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
      color: '#f8fafc',
      fontSize: '0.8125rem',
      backdropFilter: 'blur(10px)',
      padding: '10px 14px',
    },
    itemStyle: {
      color: '#cbd5e1',
      fontSize: '0.8125rem',
      paddingTop: '2px',
      paddingBottom: '2px',
    },
    labelStyle: {
      color: '#f8fafc',
      fontWeight: 600,
      marginBottom: '6px',
    },
  },
  legend: {
    wrapperStyle: {
      paddingTop: '12px',
      fontSize: '0.8125rem',
      color: '#94a3b8',
    },
  },
};
