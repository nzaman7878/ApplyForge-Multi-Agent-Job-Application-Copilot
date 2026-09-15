import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { BaseChartWrapper } from './BaseChartWrapper';
import { chartTheme, CHART_COLORS, STATUS_COLORS } from './chartTheme';

/**
 * Custom Tooltip with week details and by-status breakdown
 */
function TimelineTooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const point = payload[0]?.payload;
  const count = point?.count ?? payload[0]?.value ?? 0;
  const byStatus = point?.byStatus || {};

  let dateRangeText = label;
  if (point?.weekStart && point?.weekEnd) {
    const start = new Date(point.weekStart);
    const end = new Date(point.weekEnd);
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    dateRangeText = `${monthNames[start.getUTCMonth()]} ${start.getUTCDate()} – ${monthNames[end.getUTCMonth()]} ${end.getUTCDate()}`;
  }

  const activeStatuses = Object.entries(byStatus).filter(([, val]) => val > 0);

  return (
    <div className="min-w-[180px] rounded-lg border border-slate-700/80 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs">
      <div className="mb-2 border-b border-slate-800 pb-2">
        <div className="font-semibold text-slate-100 flex items-center justify-between gap-3">
          <span>Week of {label}</span>
          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
            {count} {count === 1 ? 'app' : 'apps'}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400 font-normal">
          {dateRangeText}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-slate-300 font-medium">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shadow-sm"
              style={{ backgroundColor: CHART_COLORS.primary }}
            />
            Total Applications
          </span>
          <span className="font-bold tabular-nums text-slate-100">{count}</span>
        </div>

        {/* By-status Breakdown if active */}
        {activeStatuses.length > 0 && (
          <div className="mt-2.5 border-t border-slate-800/80 pt-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              By Stage
            </div>
            {activeStatuses.map(([statusKey, val]) => (
              <div
                key={statusKey}
                className="flex items-center justify-between text-[11px] text-slate-400"
              >
                <span className="flex items-center gap-1.5 capitalize">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        STATUS_COLORS[statusKey] || CHART_COLORS.muted,
                    }}
                  />
                  {statusKey}
                </span>
                <span className="font-semibold tabular-nums text-slate-200">
                  {val}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TimelineChart Component
 *
 * Area chart visualizing application submission velocity per week over the last 12 weeks.
 *
 * @param {Object} props
 * @param {Array} [props.data=[]] - Array of week points from /api/analytics/timeline
 * @param {boolean} [props.isLoading=false] - Loading state
 * @param {number|string} [props.height=300] - Height of chart in pixels
 * @param {string} [props.title='Application Velocity Timeline'] - Chart title
 * @param {string} [props.subtitle='Applications tracked and submitted over the last 12 weeks'] - Chart subtitle
 * @param {React.ReactNode} [props.action] - Optional action slot in header
 * @param {string} [props.className=''] - Additional container classes
 */
export function TimelineChart({
  data = [],
  isLoading = false,
  height = 300,
  title = 'Application Velocity Timeline',
  subtitle = 'Weekly submission pace across the last 12 weeks',
  action,
  className = '',
}) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data;
  }, [data]);

  const isEmpty = useMemo(() => {
    if (!chartData || chartData.length === 0) return true;
    return chartData.every((item) => !item.count || item.count === 0);
  }, [chartData]);

  // Derived metrics for summary badge and footer
  const { totalApps, peakWeek, avgWeekly } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { totalApps: 0, peakWeek: null, avgWeekly: 0 };
    }
    const total = chartData.reduce((acc, curr) => acc + (curr.count || 0), 0);
    const maxItem = chartData.reduce(
      (max, curr) => ((curr.count || 0) > (max?.count || 0) ? curr : max),
      chartData[0]
    );
    const avg = chartData.length > 0 ? (total / chartData.length).toFixed(1) : 0;
    return {
      totalApps: total,
      peakWeek: maxItem && maxItem.count > 0 ? maxItem : null,
      avgWeekly: avg,
    };
  }, [chartData]);

  const headerBadge = (
    <div className="flex items-center gap-2">
      {totalApps > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          {totalApps} Total In Period
        </span>
      )}
      {action}
    </div>
  );

  const footerSummary = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div>
          <span className="text-slate-400">Weekly Average: </span>
          <span className="font-semibold text-slate-200 tabular-nums">
            {avgWeekly} apps/week
          </span>
        </div>
        {peakWeek && (
          <div className="border-l border-slate-800 pl-4">
            <span className="text-slate-400">Peak Week: </span>
            <span className="font-semibold text-emerald-400 tabular-nums">
              {peakWeek.label} ({peakWeek.count} apps)
            </span>
          </div>
        )}
      </div>
      <div className="text-[11px] text-slate-400">
        Updated in real-time from application dates
      </div>
    </div>
  );

  return (
    <BaseChartWrapper
      title={title}
      subtitle={subtitle}
      action={headerBadge}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No application timeline data yet"
      emptyDescription="Submit applications or set applied dates to see your weekly submission trajectory."
      height={height}
      footer={totalApps > 0 ? footerSummary : null}
      className={className}
    >
      <AreaChart
        data={chartData}
        margin={{ top: 12, right: 12, left: -20, bottom: 4 }}
      >
        <defs>
          <linearGradient id="timelineAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={CHART_COLORS.primary}
              stopOpacity={0.45}
            />
            <stop
              offset="95%"
              stopColor={CHART_COLORS.primary}
              stopOpacity={0.0}
            />
          </linearGradient>
        </defs>

        <CartesianGrid
          stroke={chartTheme.grid.stroke}
          strokeDasharray={chartTheme.grid.strokeDasharray}
          vertical={false}
        />

        <XAxis
          dataKey="label"
          stroke={chartTheme.axis.stroke}
          tick={chartTheme.axis.tick}
          tickLine={false}
          axisLine={false}
          dy={8}
          interval="preserveStartEnd"
        />

        <YAxis
          allowDecimals={false}
          stroke={chartTheme.axis.stroke}
          tick={chartTheme.axis.tick}
          tickLine={false}
          axisLine={false}
          dx={-4}
        />

        <Tooltip
          content={<TimelineTooltipContent />}
          cursor={{
            stroke: 'rgba(59, 130, 246, 0.4)',
            strokeWidth: 1.5,
            strokeDasharray: '4 4',
          }}
        />

        <Area
          type="monotone"
          dataKey="count"
          name="Applications"
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          fill="url(#timelineAreaGradient)"
          isAnimationActive={true}
          animationDuration={1000}
          animationEasing="ease-out"
          dot={{
            r: 3,
            fill: CHART_COLORS.primary,
            strokeWidth: 2,
            stroke: '#0f172a',
          }}
          activeDot={{
            r: 6,
            fill: '#60a5fa',
            strokeWidth: 2.5,
            stroke: '#0f172a',
            className: 'filter drop-shadow-md',
          }}
        />
      </AreaChart>
    </BaseChartWrapper>
  );
}

export default TimelineChart;
