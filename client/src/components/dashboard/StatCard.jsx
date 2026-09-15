import React, { useEffect, useState, useRef } from 'react';

/**
 * Animated number counter component.
 * Animates smoothly from 0 to target value on load using ease-out cubic interpolation.
 */
export function AnimatedCounterDisplay({
  value,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const startValRef = useRef(0);

  const numericTarget =
    typeof value === 'number'
      ? value
      : !isNaN(parseFloat(value))
      ? parseFloat(value)
      : null;

  useEffect(() => {
    // If value is not a valid number (e.g. '--' or 'N/A'), don't animate
    if (numericTarget === null) {
      return;
    }

    // Check for user preference for reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const startVal = startValRef.current;
    const delta = numericTarget - startVal;

    if (prefersReducedMotion || delta === 0) {
      frameRef.current = requestAnimationFrame(() => {
        setDisplayValue(numericTarget);
        startValRef.current = numericTarget;
      });
      return;
    }

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: 1 - (1 - progress)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + delta * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(numericTarget);
        startValRef.current = numericTarget;
      }
    };

    startTimeRef.current = null;
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [numericTarget, duration]);

  if (numericTarget === null) {
    return <span className={className}>{value ?? '--'}</span>;
  }

  const formattedNumber = displayValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
}

/**
 * Trend indicator badge comparing against previous month.
 */
export function TrendIndicator({
  trend,
  defaultPeriod = 'vs previous month',
  className = '',
}) {
  if (trend === null || trend === undefined) return null;

  let val = trend;
  let period = defaultPeriod;
  let direction = null;
  let isPositiveGood = true;

  if (typeof trend === 'object' && trend !== null) {
    val = trend.value;
    if (trend.period) period = trend.period;
    if (trend.direction) direction = trend.direction;
    if (trend.isPositiveGood !== undefined) isPositiveGood = trend.isPositiveGood;
  }

  const numVal = typeof val === 'number' ? val : parseFloat(val);
  const isNumeric = !isNaN(numVal);

  if (!direction && isNumeric) {
    if (numVal > 0) direction = 'up';
    else if (numVal < 0) direction = 'down';
    else direction = 'neutral';
  }

  // Format string with +/- prefix if numeric
  let formattedVal = String(val ?? '');
  if (isNumeric && typeof val === 'number') {
    const sign = numVal > 0 ? '+' : '';
    formattedVal = `${sign}${numVal}%`;
  } else if (
    isNumeric &&
    !formattedVal.startsWith('+') &&
    !formattedVal.startsWith('-') &&
    numVal > 0
  ) {
    formattedVal = `+${formattedVal}`;
  }

  const isUp = direction === 'up';
  const isDown = direction === 'down';
  const isNeutral = direction === 'neutral' || (!isUp && !isDown);

  // Determine good/bad sentiment
  const isGood = isPositiveGood ? isUp : isDown;
  const isBad = isPositiveGood ? isDown : isUp;

  let colorClasses = 'text-slate-400 bg-slate-800/80 border-slate-700/80';
  if (!isNeutral) {
    if (isGood) {
      colorClasses = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
    } else if (isBad) {
      colorClasses = 'text-rose-400 bg-rose-950/40 border-rose-500/30';
    }
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap text-xs ${className}`}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${colorClasses} tracking-tight transition-colors`}
      >
        {isUp && (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        )}
        {isDown && (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
          </svg>
        )}
        {isNeutral && (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        )}
        <span>{formattedVal}</span>
      </span>
      {period && (
        <span className="text-slate-400 text-xs font-medium tracking-tight">
          {period}
        </span>
      )}
    </div>
  );
}

const COLOR_VARIANTS = {
  blue: {
    bgHover: 'group-hover:border-blue-500/40 group-hover:shadow-blue-500/10',
    topGlow: 'bg-gradient-to-r from-blue-500/30 via-indigo-500/20 to-transparent',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20 group-hover:border-blue-500/40',
    accentText: 'text-blue-400',
  },
  emerald: {
    bgHover: 'group-hover:border-emerald-500/40 group-hover:shadow-emerald-500/10',
    topGlow: 'bg-gradient-to-r from-emerald-500/30 via-teal-500/20 to-transparent',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40',
    accentText: 'text-emerald-400',
  },
  purple: {
    bgHover: 'group-hover:border-purple-500/40 group-hover:shadow-purple-500/10',
    topGlow: 'bg-gradient-to-r from-purple-500/30 via-violet-500/20 to-transparent',
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400 group-hover:bg-purple-500/20 group-hover:border-purple-500/40',
    accentText: 'text-purple-400',
  },
  amber: {
    bgHover: 'group-hover:border-amber-500/40 group-hover:shadow-amber-500/10',
    topGlow: 'bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-transparent',
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20 group-hover:border-amber-500/40',
    accentText: 'text-amber-400',
  },
  cyan: {
    bgHover: 'group-hover:border-cyan-500/40 group-hover:shadow-cyan-500/10',
    topGlow: 'bg-gradient-to-r from-cyan-500/30 via-sky-500/20 to-transparent',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40',
    accentText: 'text-cyan-400',
  },
  rose: {
    bgHover: 'group-hover:border-rose-500/40 group-hover:shadow-rose-500/10',
    topGlow: 'bg-gradient-to-r from-rose-500/30 via-pink-500/20 to-transparent',
    iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400 group-hover:bg-rose-500/20 group-hover:border-rose-500/40',
    accentText: 'text-rose-400',
  },
};

/**
 * Base StatCard Component.
 * Features animated numeric counter on load, trend indicator vs previous month,
 * glassmorphic styling, and skeleton loading support.
 */
export default function StatCard({
  title,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1000,
  trend,
  icon,
  color = 'blue',
  helperText,
  isLoading = false,
  onClick,
  className = '',
}) {
  const theme = COLOR_VARIANTS[color] || COLOR_VARIANTS.blue;

  if (isLoading) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 backdrop-blur-md animate-pulse ${className}`}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="h-4 w-28 bg-slate-800 rounded-md" />
          <div className="w-10 h-10 rounded-xl bg-slate-800" />
        </div>
        <div className="h-9 w-24 bg-slate-800 rounded-lg mb-4" />
        <div className="h-5 w-36 bg-slate-800/80 rounded-md" />
      </div>
    );
  }

  const isClickable = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group relative overflow-hidden rounded-2xl bg-slate-900/70 border border-slate-800/80 p-6 backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-xl ${theme.bgHover} ${
        isClickable ? 'cursor-pointer hover:bg-slate-900/90' : ''
      } ${className}`}
    >
      {/* Subtle top edge ambient glow strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${theme.topGlow} opacity-70 group-hover:opacity-100 transition-opacity`}
      />

      {/* Header: Title and Icon */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-400 tracking-wide uppercase">
          {title}
        </h3>
        {icon && (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 shrink-0 ${theme.iconBg}`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Main KPI Value with Animated Counter */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
          <AnimatedCounterDisplay
            value={value}
            duration={duration}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
          />
        </span>
      </div>

      {/* Trend indicator or helper note */}
      {trend !== undefined && trend !== null ? (
        <TrendIndicator trend={trend} className="mt-3.5" />
      ) : helperText ? (
        <p className="text-xs text-slate-400 font-medium mt-3.5 leading-relaxed">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Specialized Preset Cards for Dashboard KPIs                                */
/* -------------------------------------------------------------------------- */

/**
 * Total Applied KPI Card
 */
export function TotalAppliedCard({
  value = 0,
  trend,
  isLoading = false,
  onClick,
}) {
  return (
    <StatCard
      title="Total Applied"
      value={value}
      decimals={0}
      color="blue"
      trend={
        trend !== undefined
          ? trend
          : { value: '+12%', direction: 'up', period: 'vs previous month' }
      }
      helperText="Active job applications tracked"
      icon={
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      }
      isLoading={isLoading}
      onClick={onClick}
    />
  );
}

/**
 * Response Rate KPI Card
 */
export function ResponseRateCard({
  value = 0,
  trend,
  isLoading = false,
  onClick,
}) {
  return (
    <StatCard
      title="Response Rate"
      value={value}
      suffix="%"
      decimals={1}
      color="emerald"
      trend={
        trend !== undefined
          ? trend
          : { value: '+4.5%', direction: 'up', period: 'vs previous month' }
      }
      helperText="Interviews and recruiter responses"
      icon={
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      isLoading={isLoading}
      onClick={onClick}
    />
  );
}

/**
 * Avg Fit Score KPI Card
 */
export function AvgFitScoreCard({
  value = 0,
  trend,
  isLoading = false,
  onClick,
}) {
  return (
    <StatCard
      title="Avg Fit Score"
      value={value}
      suffix="/100"
      decimals={0}
      color="purple"
      trend={
        trend !== undefined
          ? trend
          : { value: '+3.2%', direction: 'up', period: 'vs previous month' }
      }
      helperText="Semantic JD fit & keyword match"
      icon={
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      }
      isLoading={isLoading}
      onClick={onClick}
    />
  );
}

/**
 * Open Follow-ups KPI Card
 */
export function OpenFollowUpsCard({
  value = 0,
  trend,
  isLoading = false,
  onClick,
}) {
  return (
    <StatCard
      title="Open Follow-ups"
      value={value}
      decimals={0}
      color="amber"
      trend={
        trend !== undefined
          ? trend
          : {
              value: '-2',
              direction: 'down',
              period: 'vs previous month',
              isPositiveGood: false,
            }
      }
      helperText="Pending outreach reminders due"
      icon={
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      isLoading={isLoading}
      onClick={onClick}
    />
  );
}

/**
 * Responsive 4-column KPI Cards Grid container.
 * Accepts analytics summary and due follow-ups data, rendering the 4 KPI cards.
 */
export function KPICardsGrid({
  totalApplied = 0,
  responseRate = 0,
  avgFitScore = 0,
  openFollowUps = 0,
  trends = {},
  isLoading = false,
  onCardClick,
  className = '',
}) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${className}`}
    >
      <TotalAppliedCard
        value={totalApplied}
        trend={trends.totalApplied}
        isLoading={isLoading}
        onClick={onCardClick ? () => onCardClick('totalApplied') : undefined}
      />
      <ResponseRateCard
        value={responseRate}
        trend={trends.responseRate}
        isLoading={isLoading}
        onClick={onCardClick ? () => onCardClick('responseRate') : undefined}
      />
      <AvgFitScoreCard
        value={avgFitScore}
        trend={trends.avgFitScore}
        isLoading={isLoading}
        onClick={onCardClick ? () => onCardClick('avgFitScore') : undefined}
      />
      <OpenFollowUpsCard
        value={openFollowUps}
        trend={trends.openFollowUps}
        isLoading={isLoading}
        onClick={onCardClick ? () => onCardClick('openFollowUps') : undefined}
      />
    </div>
  );
}
