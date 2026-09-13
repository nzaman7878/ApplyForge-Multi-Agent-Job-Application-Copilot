import React, { useState, useMemo } from 'react';

/**
 * Importance Badge configuration
 */
const IMPORTANCE_CONFIG = {
  required: {
    label: 'Required',
    classes: 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-semibold',
    indicator: 'bg-rose-400',
  },
  preferred: {
    label: 'Preferred',
    classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-medium',
    indicator: 'bg-blue-400',
  },
  bonus: {
    label: 'Bonus',
    classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30 font-medium',
    indicator: 'bg-purple-400',
  },
};

/**
 * Renders an SVG circular progress ring for ATS match score.
 */
function ScoreProgressRing({ score = 0, size = 120, strokeWidth = 10 }) {
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  // Score color tiers
  const getScoreColor = (val) => {
    if (val >= 80) return { stroke: '#10b981', text: 'text-emerald-400', label: 'Strong Match' };
    if (val >= 60) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'Moderate Match' };
    return { stroke: '#f43f5e', text: 'text-rose-400', label: 'Needs Improvement' };
  };

  const { stroke, text, label } = getScoreColor(normalizedScore);

  return (
    <div className="flex flex-col items-center justify-center relative">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center label */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`text-3xl font-extrabold tracking-tight ${text}`}>
            {normalizedScore}
            <span className="text-sm font-semibold">%</span>
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            ATS Score
          </span>
        </div>
      </div>

      <span
        className={`mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase ${
          normalizedScore >= 80
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : normalizedScore >= 60
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * ATSReport Component
 *
 * Displays candidate ATS compliance:
 * - Circular animated score ring with tier classification
 * - Two-column responsive layout: Matched Keywords (green) vs Missing Keywords (red)
 * - Required / Preferred / Bonus importance badges
 * - Section match locations and missing keyword suggestions
 * - Interactive filtering & search
 *
 * @param {Object} props
 * @param {Object} props.atsReport - ATS keyword agent report
 * @param {Array} props.atsReport.matchedKeywords - [{ keyword, importance, location }]
 * @param {Array} props.atsReport.missingKeywords - [{ keyword, importance, suggestion }]
 * @param {number} props.atsReport.overallScore - Integer 0-100
 * @param {string} [props.className] - Optional container classes
 */
export default function ATSReport({ atsReport, className = '' }) {
  const [filterImportance, setFilterImportance] = useState('all'); // 'all' | 'required' | 'preferred' | 'bonus'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSuggestions, setExpandedSuggestions] = useState({});

  const rawMatched = atsReport?.matchedKeywords;
  const rawMissing = atsReport?.missingKeywords;
  const matchedList = useMemo(() => rawMatched || [], [rawMatched]);
  const missingList = useMemo(() => rawMissing || [], [rawMissing]);
  const score = atsReport?.overallScore ?? 0;

  // Count breakdowns
  const totalKeywords = matchedList.length + missingList.length;
  const matchedCount = matchedList.length;
  const missingCount = missingList.length;

  const requiredMatched = matchedList.filter((k) => k.importance === 'required').length;
  const requiredTotal =
    requiredMatched + missingList.filter((k) => k.importance === 'required').length;

  // Toggle suggestion view
  const toggleSuggestion = (index) => {
    setExpandedSuggestions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Filtered lists based on importance and search query
  const filteredMatched = useMemo(() => {
    return matchedList.filter((item) => {
      const matchesImp = filterImportance === 'all' || item.importance === filterImportance;
      const matchesSearch =
        !searchQuery || item.keyword.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesImp && matchesSearch;
    });
  }, [matchedList, filterImportance, searchQuery]);

  const filteredMissing = useMemo(() => {
    return missingList.filter((item) => {
      const matchesImp = filterImportance === 'all' || item.importance === filterImportance;
      const matchesSearch =
        !searchQuery || item.keyword.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesImp && matchesSearch;
    });
  }, [missingList, filterImportance, searchQuery]);

  if (!atsReport && totalKeywords === 0) {
    return (
      <div className={`p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center ${className}`}>
        <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-white">No ATS Report Available</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Run the multi-agent pipeline to generate a weighted keyword match report against the target job description.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card: Progress Ring + Breakdown Statistics */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Overall ATS Progress Ring */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreProgressRing score={score} size={110} strokeWidth={9} />

          <div className="text-center sm:text-left space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              ATS Keyword Compliance Audit
            </h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Evaluating resume keyword frequency, section density, and semantic alignment with role requirements.
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {matchedCount} Matched ({totalKeywords > 0 ? Math.round((matchedCount / totalKeywords) * 100) : 0}%)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {missingCount} Missing ({totalKeywords > 0 ? Math.round((missingCount / totalKeywords) * 100) : 0}%)
              </span>
              {requiredTotal > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {requiredMatched}/{requiredTotal} Required Core Skills
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Legend & Importance Weights */}
        <div className="shrink-0 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800">
            Keyword Importance Weights
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Required (3x weight)
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Core criteria</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Preferred (2x weight)
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Strong plus</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Bonus (1x weight)
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Nice to have</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 bg-slate-950/60 border border-slate-800/90 rounded-2xl">
        {/* Importance Filter Tabs */}
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Keywords' },
            { id: 'required', label: 'Required' },
            { id: 'preferred', label: 'Preferred' },
            { id: 'bonus', label: 'Bonus' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterImportance(tab.id)}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                filterImportance === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Keyword Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
          <svg
            className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Two-Column Keyword Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: MATCHED KEYWORDS (Green Tags)              */}
        {/* ======================================================== */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Matched Keywords</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {filteredMatched.length}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">Found in resume sections and tailored bullets</p>
              </div>
            </div>
          </div>

          {filteredMatched.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-400">No matched keywords found</p>
              <p className="text-[11px] text-slate-500">
                {searchQuery || filterImportance !== 'all'
                  ? 'Try clearing your search or importance filters'
                  : 'Candidate resume does not contain the extracted role keywords'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredMatched.map((item, idx) => {
                const impConfig = IMPORTANCE_CONFIG[item.importance] || IMPORTANCE_CONFIG.preferred;

                return (
                  <div
                    key={`${item.keyword}-${idx}`}
                    className="group relative flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-500/40 hover:border-emerald-400 transition-all duration-200 shadow-sm"
                  >
                    {/* Checkmark Icon */}
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>

                    {/* Keyword Name */}
                    <span className="text-xs font-semibold text-emerald-200 group-hover:text-emerald-100">
                      {item.keyword}
                    </span>

                    {/* Importance Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wider uppercase ${impConfig.classes}`}
                    >
                      {impConfig.label}
                    </span>

                    {/* Section Location Pill (if detected) */}
                    {item.location && (
                      <span
                        className="text-[10px] text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[120px]"
                        title={`Detected in: ${item.location}`}
                      >
                        {item.location}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: MISSING KEYWORDS (Red Tags)               */}
        {/* ======================================================== */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-rose-500/30 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-sm">
                ✕
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Missing Keywords</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {filteredMissing.length}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">Target requirements not recognized in resume text</p>
              </div>
            </div>
          </div>

          {filteredMissing.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base mb-2">
                ✓
              </div>
              <p className="text-xs font-semibold text-emerald-400">100% Keyword Coverage!</p>
              <p className="text-[11px] text-slate-400">
                All extracted role keywords are present in your resume.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredMissing.map((item, idx) => {
                const impConfig = IMPORTANCE_CONFIG[item.importance] || IMPORTANCE_CONFIG.preferred;
                const isExpanded = Boolean(expandedSuggestions[idx]);

                return (
                  <div
                    key={`${item.keyword}-${idx}`}
                    className="p-3 rounded-xl bg-rose-950/25 hover:bg-rose-950/40 border border-rose-500/35 hover:border-rose-400 transition-all duration-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>

                        <span className="text-xs font-bold text-rose-200 truncate">
                          {item.keyword}
                        </span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wider uppercase shrink-0 ${impConfig.classes}`}
                        >
                          {impConfig.label}
                        </span>
                      </div>

                      {/* Expand / Suggestion Toggle */}
                      {item.suggestion && (
                        <button
                          type="button"
                          onClick={() => toggleSuggestion(idx)}
                          className="text-[10px] text-rose-300 hover:text-white px-2 py-0.5 rounded bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 transition shrink-0 cursor-pointer"
                        >
                          {isExpanded ? 'Hide Tip' : 'Action Tip'}
                        </button>
                      )}
                    </div>

                    {/* Actionable Suggestion Callout */}
                    {item.suggestion && isExpanded && (
                      <div className="p-2.5 rounded-lg bg-slate-950/70 border border-rose-500/20 text-[11px] text-slate-300 leading-relaxed animate-fadeIn">
                        <p className="font-semibold text-rose-300 mb-0.5 flex items-center gap-1">
                          <span>💡 Optimization Suggestion</span>
                        </p>
                        <span>{item.suggestion}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
