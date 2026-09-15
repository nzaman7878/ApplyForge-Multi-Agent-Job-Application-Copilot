import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BaseChartWrapper } from './BaseChartWrapper';
import { chartTheme, CHART_COLORS } from './chartTheme';

/**
 * Helper: extracts numeric score from polymorphic fitScore field
 */
function extractScore(fitScore) {
  if (typeof fitScore === 'number' && !isNaN(fitScore)) {
    return fitScore;
  }
  if (fitScore && typeof fitScore.score === 'number' && !isNaN(fitScore.score)) {
    return fitScore.score;
  }
  return null;
}

/**
 * Helper: checks if application received a callback/response
 */
function checkHasResponse(app) {
  if (app.status === 'interviewing' || app.status === 'offer') {
    return true;
  }
  if (Array.isArray(app.statusHistory)) {
    return app.statusHistory.some(
      (h) => h.status === 'interviewing' || h.status === 'offer'
    );
  }
  return false;
}

/**
 * Custom Tooltip for Score vs Response Grouped Bar Chart
 */
function ScoreTooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) return null;

  const total = point.total || 0;
  const responses = point.responses || 0;
  const rate = point.responseRate !== undefined ? point.responseRate : 0;

  return (
    <div className="min-w-[190px] rounded-lg border border-slate-700/80 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs">
      <div className="mb-2 border-b border-slate-800 pb-2">
        <div className="font-semibold text-slate-100 flex items-center justify-between gap-3">
          <span>Fit Score {label}</span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300 font-bold">
            {rate}% Callback
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {point.tierName || 'Fit Score Tier'}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            Total Applications:
          </span>
          <span className="font-bold tabular-nums text-slate-100">{total}</span>
        </div>

        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Callbacks Received:
          </span>
          <span className="font-bold tabular-nums text-blue-400">
            {responses}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5 text-slate-300">
          <span className="flex items-center gap-1.5 font-medium text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Response Rate:
          </span>
          <span className="font-extrabold tabular-nums text-emerald-400">
            {rate}%
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * ScoreVsResponseBar Component
 *
 * Grouped bar chart comparing fit score bands (0-40, 41-70, 71-100) vs callback/response rate %,
 * with dynamic insight callout highlighting correlation between tailoring quality and callbacks.
 *
 * @param {Object} props
 * @param {Array|Object} [props.data] - Data payload: either raw applications array, or { bands, tiers } from /api/analytics/score-vs-response
 * @param {Array} [props.applications] - Optional raw applications array for direct grouping
 * @param {boolean} [props.isLoading=false] - Loading state
 * @param {number|string} [props.height=320] - Chart height
 * @param {string} [props.title='Fit Score vs Response Rate'] - Chart title
 * @param {string} [props.subtitle='Correlation between AI tailoring alignment score and callback rate'] - Chart subtitle
 * @param {React.ReactNode} [props.action] - Optional action slot in header
 * @param {string} [props.className=''] - Additional container classes
 */
export function ScoreVsResponseBar({
  data,
  applications,
  isLoading = false,
  height = 320,
  title = 'Fit Score vs Response Rate',
  subtitle = 'Correlation between AI tailoring quality and recruiter callbacks',
  action,
  className = '',
}) {
  // Normalize data into the 3 canonical bands: 0-40, 41-70, 71-100
  const chartData = useMemo(() => {
    // If explicit applications array provided
    const appList = applications || (Array.isArray(data) ? data : null);

    if (appList && appList.length > 0 && appList[0]?.company) {
      const bands = [
        {
          band: '0-40',
          name: '0–40',
          tierName: 'Stretch (<40)',
          total: 0,
          responses: 0,
          responseRate: 0,
        },
        {
          band: '41-70',
          name: '41–70',
          tierName: 'Moderate (41–70)',
          total: 0,
          responses: 0,
          responseRate: 0,
        },
        {
          band: '71-100',
          name: '71–100',
          tierName: 'Strong (71–100)',
          total: 0,
          responses: 0,
          responseRate: 0,
        },
      ];

      for (const app of appList) {
        const score = extractScore(app.fitScore);
        if (score === null) continue;
        const hasResp = checkHasResponse(app);

        if (score <= 40) {
          bands[0].total++;
          if (hasResp) bands[0].responses++;
        } else if (score <= 70) {
          bands[1].total++;
          if (hasResp) bands[1].responses++;
        } else {
          bands[2].total++;
          if (hasResp) bands[2].responses++;
        }
      }

      for (const b of bands) {
        b.responseRate =
          b.total > 0 ? Number(((b.responses / b.total) * 100).toFixed(1)) : 0;
      }
      return bands;
    }

    // If pre-computed bands or tiers from /api/analytics/score-vs-response
    if (data && typeof data === 'object') {
      if (Array.isArray(data.bands) && data.bands.length > 0) {
        // Map 4 bands or custom bands to standard 3 bands
        const sourceBands = data.bands;
        if (sourceBands.length === 3) {
          return sourceBands.map((b) => ({
            band: b.band,
            name: b.name || b.band,
            tierName: b.label || b.band,
            total: b.total || 0,
            responses: b.responses || 0,
            responseRate: Number(b.responseRate || 0),
          }));
        }

        // Aggregate 4 bands into 3 bands: (0-59 -> 0-40 approx/tier, 60-74/75-84 -> 41-70, 85-100 -> 71-100)
        const b1 = sourceBands[0] || {};
        const b2 = sourceBands[1] || {};
        const b3 = sourceBands[2] || {};
        const b4 = sourceBands[3] || {};

        const midTotal = (b2.total || 0) + (b3.total || 0);
        const midResponses = (b2.responses || 0) + (b3.responses || 0);

        return [
          {
            band: '0-40',
            name: '0–40',
            tierName: 'Stretch (Low Fit)',
            total: b1.total || 0,
            responses: b1.responses || 0,
            responseRate: Number(b1.responseRate || 0),
          },
          {
            band: '41-70',
            name: '41–70',
            tierName: 'Moderate Fit',
            total: midTotal,
            responses: midResponses,
            responseRate:
              midTotal > 0
                ? Number(((midResponses / midTotal) * 100).toFixed(1))
                : 0,
          },
          {
            band: '71-100',
            name: '71–100',
            tierName: 'Strong (High Fit)',
            total: b4.total || 0,
            responses: b4.responses || 0,
            responseRate: Number(b4.responseRate || 0),
          },
        ];
      }

      if (data.tiers) {
        return [
          {
            band: '0-40',
            name: '0–40',
            tierName: 'Stretch (<60)',
            total: data.tiers.stretch?.total || 0,
            responses: data.tiers.stretch?.responses || 0,
            responseRate: Number(data.tiers.stretch?.responseRate || 0),
          },
          {
            band: '41-70',
            name: '41–70',
            tierName: 'Moderate (60–79)',
            total: data.tiers.moderate?.total || 0,
            responses: data.tiers.moderate?.responses || 0,
            responseRate: Number(data.tiers.moderate?.responseRate || 0),
          },
          {
            band: '71-100',
            name: '71–100',
            tierName: 'Strong (80–100)',
            total: data.tiers.strong?.total || 0,
            responses: data.tiers.strong?.responses || 0,
            responseRate: Number(data.tiers.strong?.responseRate || 0),
          },
        ];
      }
    }

    // Default empty 3 bands
    return [
      { band: '0-40', name: '0–40', tierName: 'Stretch', total: 0, responses: 0, responseRate: 0 },
      { band: '41-70', name: '41–70', tierName: 'Moderate', total: 0, responses: 0, responseRate: 0 },
      { band: '71-100', name: '71–100', tierName: 'Strong', total: 0, responses: 0, responseRate: 0 },
    ];
  }, [data, applications]);

  const isEmpty = useMemo(() => {
    return chartData.every((b) => b.total === 0);
  }, [chartData]);

  // Compute insight correlation text
  const insight = useMemo(() => {
    const low = chartData.find((b) => b.band === '0-40') || { responseRate: 0, total: 0 };
    const high = chartData.find((b) => b.band === '71-100') || { responseRate: 0, total: 0 };

    if (high.total > 0 && low.total > 0 && high.responseRate > low.responseRate) {
      const diff = Math.round(high.responseRate - low.responseRate);
      return {
        message: `Higher tailoring quality correlates with +${diff}% more callbacks (${high.responseRate}% vs ${low.responseRate}%)`,
        highlight: `+${diff}% more callbacks`,
        isPositive: true,
      };
    }

    if (high.total > 0 && high.responseRate > 0) {
      return {
        message: `Applications with 71–100 fit score reached a ${high.responseRate}% callback rate.`,
        highlight: `${high.responseRate}% callback rate`,
        isPositive: true,
      };
    }

    return {
      message:
        'Higher tailoring quality typically correlates with 2.5x to 3x higher callback rates.',
      highlight: '2.5x to 3x higher callback rates',
      isPositive: true,
    };
  }, [chartData]);

  return (
    <BaseChartWrapper
      title={title}
      subtitle={subtitle}
      action={action}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No fit score correlation data yet"
      emptyDescription="Tailor applications and track status updates to analyze how fit scores impact callback velocity."
      height={height}
      className={className}
    >
      <div className="flex flex-col h-full justify-between">
        {/* Insight Callout Banner */}
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2 text-xs text-emerald-300">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </span>
          <p className="font-medium">
            <span className="font-semibold text-emerald-200">Insight: </span>
            {insight.message}
          </p>
        </div>

        {/* Grouped Bar Chart */}
        <div className="flex-1 w-full min-h-[220px]">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 4 }}
            barGap={6}
          >
            <CartesianGrid
              stroke={chartTheme.grid.stroke}
              strokeDasharray={chartTheme.grid.strokeDasharray}
              vertical={false}
            />

            <XAxis
              dataKey="name"
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              tickLine={false}
              axisLine={false}
              dy={6}
            />

            {/* Left YAxis: Total Applications Count */}
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              stroke={chartTheme.axis.stroke}
              tick={chartTheme.axis.tick}
              tickLine={false}
              axisLine={false}
              dx={-4}
            />

            {/* Right YAxis: Response Rate % */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              stroke={chartTheme.axis.stroke}
              tick={{ ...chartTheme.axis.tick, fill: '#10b981' }}
              tickLine={false}
              axisLine={false}
              unit="%"
              dx={4}
            />

            <Tooltip
              content={<ScoreTooltipContent />}
              cursor={{ fill: 'rgba(51, 65, 85, 0.25)' }}
            />

            <Legend
              wrapperStyle={{
                paddingTop: '8px',
                fontSize: '11px',
                color: '#94a3b8',
              }}
              iconType="circle"
              iconSize={8}
            />

            {/* Bar 1: Total Applications (Left Axis) */}
            <Bar
              yAxisId="left"
              dataKey="total"
              name="Applications"
              fill="#475569"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
            />

            {/* Bar 2: Callback Rate % (Right Axis) */}
            <Bar
              yAxisId="right"
              dataKey="responseRate"
              name="Callback Rate (%)"
              fill={CHART_COLORS.success}
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={1000}
            />
          </BarChart>
        </div>
      </div>
    </BaseChartWrapper>
  );
}

export default ScoreVsResponseBar;
