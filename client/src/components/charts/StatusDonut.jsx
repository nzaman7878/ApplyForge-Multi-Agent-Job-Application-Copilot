import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { BaseChartWrapper } from './BaseChartWrapper';
import { STATUS_COLORS } from './chartTheme';

const STATUS_CONFIG = {
  wishlist: { label: 'Drafted', color: STATUS_COLORS.wishlist || '#64748b' },
  applied: { label: 'Applied', color: STATUS_COLORS.applied || '#3b82f6' },
  interviewing: {
    label: 'Interviewing',
    color: STATUS_COLORS.interviewing || '#f59e0b',
  },
  offer: { label: 'Offer', color: STATUS_COLORS.offer || '#10b981' },
  rejected: { label: 'Rejected', color: STATUS_COLORS.rejected || '#ef4444' },
};

/**
 * Custom Tooltip for Donut Chart Slices
 */
function DonutTooltipContent({ active, payload, total }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0]?.payload;
  if (!data) return null;

  const count = data.value || 0;
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
  const color = data.color || STATUS_CONFIG[data.status]?.color || '#3b82f6';

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md text-xs min-w-[140px]">
      <div className="flex items-center gap-2 mb-1.5 border-b border-slate-800 pb-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full shadow-sm"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold text-slate-100">{data.name}</span>
      </div>
      <div className="flex items-center justify-between text-slate-300">
        <span>Count:</span>
        <span className="font-bold tabular-nums text-slate-100">
          {count} {count === 1 ? 'app' : 'apps'}
        </span>
      </div>
      <div className="flex items-center justify-between text-slate-400 mt-1">
        <span>Share:</span>
        <span className="font-semibold tabular-nums text-blue-400">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

/**
 * StatusDonut Component
 *
 * Donut chart displaying candidate applications distributed by pipeline status
 * with color coding, centered total count, and interactive stage breakdown.
 *
 * @param {Object} props
 * @param {Object|Array} [props.data] - Status counts object { wishlist: N, applied: N, ... } or byStatus object
 * @param {number} [props.total] - Optional explicit total count
 * @param {boolean} [props.isLoading=false] - Loading state
 * @param {number|string} [props.height=300] - Chart height
 * @param {string} [props.title='Pipeline Status Breakdown'] - Chart title
 * @param {string} [props.subtitle='Distribution of applications across recruitment stages'] - Chart subtitle
 * @param {React.ReactNode} [props.action] - Optional header action
 * @param {string} [props.className=''] - Additional card class names
 */
export function StatusDonut({
  data = {},
  total: explicitTotal,
  isLoading = false,
  height = 300,
  title = 'Pipeline Status Breakdown',
  subtitle = 'Distribution across recruitment stages',
  action,
  className = '',
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  // Normalize data to standard array
  const { chartData, totalCount } = useMemo(() => {
    let raw = data;
    if (data && typeof data === 'object' && data.byStatus) {
      raw = data.byStatus;
    }

    let items = [];

    if (Array.isArray(raw)) {
      items = raw.map((item) => ({
        status: item.status || item.name?.toLowerCase(),
        name:
          STATUS_CONFIG[item.status]?.label ||
          item.name ||
          item.status ||
          'Unknown',
        value: Number(item.value ?? item.count ?? 0),
        color:
          item.color ||
          STATUS_CONFIG[item.status]?.color ||
          STATUS_CONFIG[item.name?.toLowerCase()]?.color ||
          '#64748b',
      }));
    } else if (raw && typeof raw === 'object') {
      const order = ['applied', 'interviewing', 'offer', 'wishlist', 'rejected'];
      const keys = Object.keys(raw);
      // Sort in intuitive pipeline order
      const sortedKeys = order.filter((k) => keys.includes(k));
      for (const k of keys) {
        if (!sortedKeys.includes(k)) sortedKeys.push(k);
      }

      items = sortedKeys.map((key) => ({
        status: key,
        name: STATUS_CONFIG[key]?.label || key.charAt(0).toUpperCase() + key.slice(1),
        value: Number(raw[key] || 0),
        color: STATUS_CONFIG[key]?.color || '#64748b',
      }));
    }

    const calculatedTotal =
      explicitTotal !== undefined
        ? explicitTotal
        : items.reduce((sum, item) => sum + item.value, 0);

    return {
      chartData: items,
      totalCount: calculatedTotal,
    };
  }, [data, explicitTotal]);

  const isEmpty = useMemo(() => {
    return totalCount === 0 || chartData.every((item) => item.value === 0);
  }, [totalCount, chartData]);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  return (
    <BaseChartWrapper
      title={title}
      subtitle={subtitle}
      action={action}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No applications tracked yet"
      emptyDescription="Create or approve an application to visualize your pipeline stage distribution."
      height={height}
      responsive={false}
      className={className}
    >
      <div className="flex h-full w-full flex-col md:flex-row items-center justify-between gap-4">
        {/* Donut Chart with Centered Total Count */}
        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: '220px', height: '220px' }}
        >
          <PieChart width={220} height={220}>
            <Tooltip
              content={<DonutTooltipContent total={totalCount} />}
              cursor={false}
            />
            <Pie
              data={chartData.filter((d) => d.value > 0)}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              stroke="#0f172a"
              strokeWidth={2}
            >
              {chartData
                .filter((d) => d.value > 0)
                .map((entry, index) => {
                  const isHovered = activeIndex === index;
                  return (
                    <Cell
                      key={`cell-${entry.status}-${index}`}
                      fill={entry.color}
                      className="transition-all duration-200 cursor-pointer"
                      opacity={
                        activeIndex === null || isHovered ? 1 : 0.65
                      }
                      style={{
                        filter: isHovered
                          ? 'drop-shadow(0 0 8px rgba(255,255,255,0.25))'
                          : 'none',
                      }}
                    />
                  );
                })}
            </Pie>
          </PieChart>

          {/* Center Content: Total Application Count */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold tracking-tight text-slate-100 tabular-nums">
              {totalCount}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Total Apps
            </span>
          </div>
        </div>

        {/* Legend / Breakdown List */}
        <div className="flex w-full flex-1 flex-col justify-center space-y-2 border-t md:border-t-0 md:border-l border-slate-800/80 pt-3 md:pt-0 md:pl-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Stage Breakdown
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chartData.map((item) => {
              const share =
                totalCount > 0
                  ? ((item.value / totalCount) * 100).toFixed(0)
                  : 0;

              return (
                <div
                  key={item.status}
                  className={`flex items-center justify-between rounded-lg p-2 transition-colors duration-150 ${
                    item.value > 0
                      ? 'bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/30'
                      : 'opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-medium text-slate-300">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tabular-nums text-slate-100">
                      {item.value}
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-400 w-8 text-right">
                      {share}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BaseChartWrapper>
  );
}

export default StatusDonut;
