import React from 'react';

/**
 * ReviewSkeleton Component
 *
 * Provides animated skeleton loaders with pulsing shimmers
 * to represent the Step 3 Review Checkpoint while the AI pipeline is running
 * or while optimistic edit updates are processing.
 */
export default function ReviewSkeleton({
  title = 'AI Multi-Agent Pipeline Running...',
  subtitle = 'Generating tailored resume bullets, targeted cover letter, ATS compliance audit, and role fit score...',
  activeTab = 'bullets',
  showTabs = true,
  className = '',
}) {
  return (
    <div className={`space-y-8 animate-fadeIn ${className}`}>
      {/* Top Header Card Skeleton */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl animate-pulse">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-28 h-6 rounded-full bg-slate-800" />
              <div className="w-32 h-6 rounded-full bg-slate-800/80" />
            </div>
            <div className="w-64 sm:w-96 h-8 rounded-xl bg-slate-800" />
            <div className="w-48 sm:w-72 h-4 rounded-lg bg-slate-800/60" />
          </div>

          {/* Quick Metrics Badges Skeleton */}
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-24 h-16 rounded-2xl bg-slate-950/80 border border-slate-800 p-3 flex flex-col justify-between items-center"
              >
                <div className="w-12 h-2.5 rounded bg-slate-800" />
                <div className="w-10 h-5 rounded-lg bg-slate-800/80" />
              </div>
            ))}
          </div>
        </div>

        {/* Global Action Toolbar Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-32 h-9 rounded-xl bg-slate-800" />
            <div className="w-28 h-9 rounded-xl bg-slate-800/70" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-36 h-9 rounded-xl bg-slate-800/80" />
            <div className="w-48 h-10 rounded-xl bg-slate-800" />
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-950/30 border border-blue-800/40 text-blue-300">
        <div className="w-4 h-4 rounded-full bg-blue-400 animate-ping shrink-0" />
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-white">{title}</p>
          <p className="text-blue-300/80">{subtitle}</p>
        </div>
      </div>

      {/* Navigation Tabs Bar Skeleton */}
      {showTabs && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse">
          {['Resume Bullets', 'Cover Letter', 'ATS Report', 'Fit Score'].map((tab, idx) => (
            <div
              key={idx}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-slate-800/70 h-9 flex items-center justify-center gap-2"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-slate-700" />
              <div className="w-16 h-3 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      )}

      {/* Main Panel Content Skeleton */}
      <div className="space-y-6 animate-pulse">
        {activeTab === 'bullets' ? (
          /* Resume Bullets Skeleton: 3 side-by-side card pairs */
          <div className="space-y-4">
            {[1, 2, 3].map((bulletIdx) => (
              <div
                key={bulletIdx}
                className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {/* Original Bullet */}
                <div className="space-y-2 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
                  <div className="w-24 h-3 rounded bg-slate-800" />
                  <div className="w-full h-3 rounded bg-slate-800/60" />
                  <div className="w-4/5 h-3 rounded bg-slate-800/60" />
                  <div className="w-3/5 h-3 rounded bg-slate-800/60" />
                </div>

                {/* Tailored Bullet */}
                <div className="space-y-2 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <div className="w-28 h-3 rounded bg-emerald-950/60" />
                    <div className="w-16 h-5 rounded-md bg-slate-800" />
                  </div>
                  <div className="w-full h-3 rounded bg-slate-800/80" />
                  <div className="w-11/12 h-3 rounded bg-slate-800/80" />
                  <div className="w-3/4 h-3 rounded bg-slate-800/80" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'coverLetter' ? (
          /* Cover Letter Skeleton */
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-6">
            {/* Subject Line Skeleton */}
            <div className="w-full h-12 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center px-4">
              <div className="w-64 h-4 rounded bg-slate-800" />
            </div>

            {/* Letter Body Paragraph Shimmers */}
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-4">
              <div className="space-y-2">
                <div className="w-full h-3.5 rounded bg-slate-800/80" />
                <div className="w-11/12 h-3.5 rounded bg-slate-800/70" />
                <div className="w-4/5 h-3.5 rounded bg-slate-800/60" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="w-full h-3.5 rounded bg-slate-800/80" />
                <div className="w-5/6 h-3.5 rounded bg-slate-800/70" />
                <div className="w-3/4 h-3.5 rounded bg-slate-800/60" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="w-11/12 h-3.5 rounded bg-slate-800/80" />
                <div className="w-2/3 h-3.5 rounded bg-slate-800/60" />
              </div>
            </div>
          </div>
        ) : activeTab === 'ats' ? (
          /* ATS Report Skeleton */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score Ring Skeleton */}
            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 flex flex-col items-center justify-center space-y-4">
              <div className="w-36 h-36 rounded-full border-8 border-slate-800 flex items-center justify-center">
                <div className="w-12 h-6 rounded bg-slate-800" />
              </div>
              <div className="w-24 h-4 rounded bg-slate-800" />
            </div>

            {/* Keyword Columns Skeleton */}
            <div className="md:col-span-2 p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="w-32 h-4 rounded bg-slate-800" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
                  <div key={k} className="w-20 h-7 rounded-lg bg-slate-800" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Fit Score Skeleton */
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-32 h-32 rounded-full border-8 border-slate-800 flex items-center justify-center">
                <div className="w-12 h-6 rounded bg-slate-800" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="w-40 h-5 rounded bg-slate-800" />
                <div className="w-full h-3.5 rounded bg-slate-800/70" />
                <div className="w-3/4 h-3.5 rounded bg-slate-800/60" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
