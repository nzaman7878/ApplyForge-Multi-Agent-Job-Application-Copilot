import React from 'react';

/**
 * Custom Recharts Tooltip with dark-mode styling and value formatting
 *
 * @param {Object} props - Recharts tooltip props (active, payload, label)
 * @param {string} [props.valuePrefix=''] - Optional prefix for values (e.g. '$')
 * @param {string} [props.valueSuffix=''] - Optional suffix for values (e.g. '%', ' apps')
 * @param {Function} [props.formatter] - Optional value formatter (value, name, item) => string
 * @param {Function} [props.labelFormatter] - Optional label formatter (label) => string
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = '',
  valueSuffix = '',
  formatter,
  labelFormatter,
}) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const formattedLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md transition-all duration-150 text-xs">
      {formattedLabel && (
        <div className="mb-2 font-semibold text-slate-200 border-b border-slate-800 pb-1.5 flex items-center justify-between gap-4">
          <span>{formattedLabel}</span>
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const color = entry.color || entry.stroke || entry.fill || '#3b82f6';
          const name = entry.name || entry.dataKey;
          const rawValue = entry.value;
          const displayValue = formatter
            ? formatter(rawValue, name, entry)
            : `${valuePrefix}${rawValue !== undefined && rawValue !== null ? rawValue : 0}${valueSuffix}`;

          return (
            <div
              key={`tooltip-item-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize text-slate-400 font-medium">
                  {name}
                </span>
              </div>
              <span className="font-semibold text-slate-100 tabular-nums">
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChartTooltip;
