import React, { useState, useMemo } from 'react';

/**
 * Tier configurations for Fit Score evaluation
 */
const TIER_CONFIG = {
  strong: {
    label: 'Strong Match',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/15',
    textClass: 'text-emerald-400',
    strokeColor: '#10b981',
    description: 'Candidate meets core and advanced prerequisites with proven impact in similar scopes.',
    icon: '🏆',
  },
  moderate: {
    label: 'Moderate Match',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/15',
    textClass: 'text-amber-400',
    strokeColor: '#f59e0b',
    description: 'Candidate aligns with core requirements but has addressable gaps in preferred technologies.',
    icon: '⚡',
  },
  stretch: {
    label: 'Stretch Target',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/15',
    textClass: 'text-rose-400',
    strokeColor: '#f43f5e',
    description: 'Role represents an ambitious progression; emphasize transferable skills and accelerated learning.',
    icon: '🎯',
  },
};

/**
 * Severity configuration for gap analysis items
 */
const SEVERITY_CONFIG = {
  high: {
    label: 'High Severity',
    sublabel: 'Core Requirement',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    barColor: 'bg-rose-500',
    dotColor: 'bg-rose-400',
  },
  medium: {
    label: 'Medium Severity',
    sublabel: 'Preferred Qualification',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    barColor: 'bg-amber-500',
    dotColor: 'bg-amber-400',
  },
  low: {
    label: 'Low Severity',
    sublabel: 'Bonus / Nice-to-Have',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    barColor: 'bg-blue-500',
    dotColor: 'bg-blue-400',
  },
};

/**
 * Large Radial Dial Component for 0-100 Score
 */
function LargeScoreDial({ score = 0, tier = 'moderate' }) {
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));
  const tierInfo = TIER_CONFIG[tier.toLowerCase()] || TIER_CONFIG.moderate;

  // Arc configuration (260 degree arc gauge)
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  // Use a 260 degree arc
  const arcDegree = 260;
  const arcLength = (arcDegree / 360) * 2 * Math.PI * radius;
  const strokeDashoffset = arcLength - (normalizedScore / 100) * arcLength;
  const rotationOffset = 140; // centers 260 degree arc with opening at the bottom

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      role="img"
      aria-label={`Role Fit Score: ${normalizedScore} out of 100, evaluated as ${tierInfo.label}`}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          className="transform"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: `rotate(${rotationOffset}deg)` }}
          aria-hidden="true"
        >
          {/* Background gauge track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} 9999`}
            strokeLinecap="round"
            fill="transparent"
          />

          {/* Active colored arc gauge */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tierInfo.strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} 9999`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${tierInfo.strokeColor}40)`,
            }}
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 text-center pointer-events-none">
          <span className="text-5xl font-black text-white tracking-tight">
            {normalizedScore}
          </span>
          <span className="text-xs font-semibold text-slate-400 -mt-1">
            out of 100
          </span>
          <span className="mt-1 text-[10px] uppercase font-bold tracking-widest text-slate-500">
            Fit Rating
          </span>
        </div>
      </div>

      {/* Tier Badge Indicator below dial */}
      <div className="mt-2 text-center space-y-1">
        <span
          className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border shadow-lg tracking-wide uppercase ${tierInfo.badgeClass}`}
        >
          <span aria-hidden="true">{tierInfo.icon}</span>
          <span>{tierInfo.label}</span>
        </span>
        <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto leading-tight pt-1">
          {tierInfo.description}
        </p>
      </div>
    </div>
  );
}

/**
 * FitScore Component
 *
 * Visualizes the Fit Scoring Agent node output:
 * - Large score dial (0–100) with color-coded gauge
 * - Tier badge: Strong / Moderate / Stretch
 * - Itemized gap list with severity indicators (High/Medium/Low) and actionable suggestions
 * - Key competitive candidate strengths
 * - Severity filter tabs
 *
 * @param {Object} props
 * @param {Object} props.fitScore - Fit score analysis object
 * @param {number} props.fitScore.score - Integer 0-100
 * @param {'strong'|'moderate'|'stretch'} props.fitScore.tier - Compatibility tier
 * @param {Array<{ skill: string, severity: 'high'|'medium'|'low', suggestion: string }>} [props.fitScore.gaps]
 * @param {Array<string>} [props.fitScore.strengths]
 * @param {string} [props.className] - Optional container classes
 */
export default function FitScore({ fitScore, className = '' }) {
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'high' | 'medium' | 'low'
  const [expandedGapIndices, setExpandedGapIndices] = useState({});

  const score = fitScore?.score ?? 0;
  const tier = fitScore?.tier || (score >= 80 ? 'strong' : score >= 60 ? 'moderate' : 'stretch');
  const rawGaps = fitScore?.gaps;
  const rawStrengths = fitScore?.strengths;

  const gaps = useMemo(() => rawGaps || [], [rawGaps]);
  const strengths = useMemo(() => rawStrengths || [], [rawStrengths]);

  // Counts by severity
  const highGapsCount = gaps.filter((g) => g.severity === 'high').length;
  const mediumGapsCount = gaps.filter((g) => g.severity === 'medium').length;
  const lowGapsCount = gaps.filter((g) => g.severity === 'low').length;

  const toggleGap = (index) => {
    setExpandedGapIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Filtered gaps
  const filteredGaps = useMemo(() => {
    if (severityFilter === 'all') return gaps;
    return gaps.filter((g) => g.severity === severityFilter);
  }, [gaps, severityFilter]);

  if (!fitScore && gaps.length === 0 && strengths.length === 0) {
    return (
      <div className={`p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center ${className}`}>
        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-white">No Fit Score Available</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Run the multi-agent pipeline to generate an in-depth candidate-role fit score and gap analysis.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Card: Large Dial + Evaluation Overview */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Large Score Dial */}
        <div className="shrink-0 flex justify-center w-full md:w-auto">
          <LargeScoreDial score={score} tier={tier} />
        </div>

        {/* Right: Analytical Overview & High-Impact Strengths */}
        <div className="flex-1 space-y-5">
          <div className="space-y-1.5 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Multi-Agent Fit & Gap Assessment</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Role Compatibility Synthesis
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
              Composite score combining algorithmic ATS keyword frequency with qualitative evaluation of domain seniority, technical breadth, and project achievements.
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <p className="text-[11px] font-medium text-slate-400">Total Gaps</p>
              <p className="text-xl font-extrabold text-white mt-0.5">{gaps.length}</p>
              <span className="text-[10px] text-slate-500">Identified</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <p className="text-[11px] font-medium text-slate-400">High Severity</p>
              <p className="text-xl font-extrabold text-rose-400 mt-0.5">{highGapsCount}</p>
              <span className="text-[10px] text-rose-400/70 font-semibold">Priority bridge</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <p className="text-[11px] font-medium text-slate-400">Key Strengths</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{strengths.length}</p>
              <span className="text-[10px] text-emerald-400/70 font-semibold">Standout assets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Standout Strengths Section */}
      {strengths.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/30 shadow-xl space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
              ✓
            </div>
            <h4 className="text-sm font-bold text-white tracking-tight">
              Standout Candidate Strengths & Competitive Edges
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {strengths.map((str, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-200"
              >
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✦</span>
                <span className="leading-relaxed">{str}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap Analysis Section */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Skill & Experience Gap Analysis</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {gaps.length} Total
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Specific missing competencies paired with concrete strategies to bridge them.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800" role="group" aria-label="Filter skill gaps by severity">
            {[
              { id: 'all', label: `All (${gaps.length})` },
              { id: 'high', label: `High (${highGapsCount})`, color: 'text-rose-400' },
              { id: 'medium', label: `Medium (${mediumGapsCount})`, color: 'text-amber-400' },
              { id: 'low', label: `Low (${lowGapsCount})`, color: 'text-blue-400' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSeverityFilter(tab.id)}
                aria-pressed={severityFilter === tab.id}
                aria-label={`Filter gaps by ${tab.label}`}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  severityFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gap List */}
        {filteredGaps.length === 0 ? (
          <div className="p-8 text-center space-y-1">
            <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base mb-2">
              ✓
            </div>
            <p className="text-xs font-semibold text-emerald-400">
              {severityFilter === 'all'
                ? 'No skill gaps identified! Excellent profile alignment.'
                : `No gaps found matching the "${severityFilter}" severity filter.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3" role="region" aria-label="Identified skill gaps list">
            {filteredGaps.map((gap, index) => {
              const sev = SEVERITY_CONFIG[gap.severity] || SEVERITY_CONFIG.medium;
              const isExpanded = expandedGapIndices[index] !== false; // expanded by default

              return (
                <div
                  key={`${gap.skill}-${index}`}
                  className="rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition overflow-hidden shadow-sm"
                >
                  {/* Gap Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleGap(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleGap(index);
                      }
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`gap-suggestion-${index}`}
                    aria-label={`Skill gap: ${gap.skill}, ${sev.label}. ${isExpanded ? 'Collapse' : 'Expand'} suggestion`}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/40 transition select-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${sev.dotColor} shrink-0`} aria-hidden="true" />
                      <div className="min-w-0">
                        <h5 className="text-sm font-bold text-white truncate">
                          {gap.skill}
                        </h5>
                        <p className="text-[11px] text-slate-400">{sev.sublabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${sev.badge}`}
                      >
                        {sev.label}
                      </span>
                      <span className="text-slate-500 text-xs" aria-hidden="true">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Suggestion Callout Body */}
                  {isExpanded && (
                    <div
                      id={`gap-suggestion-${index}`}
                      className="px-4 pb-4 pt-1 border-t border-slate-900 bg-slate-900/30 animate-fadeIn"
                    >
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1">
                        <p className="font-semibold text-blue-400 flex items-center gap-1.5 text-[11px]">
                          <span aria-hidden="true">💡</span>
                          <span>Actionable Suggestion to Bridge Gap:</span>
                        </p>
                        <p className="leading-relaxed text-slate-300 pl-4 border-l-2 border-blue-500/40">
                          {gap.suggestion}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
