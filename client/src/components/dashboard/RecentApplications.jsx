import React from 'react';
import { Link } from 'react-router-dom';
import {
  getStatusInfo,
  getFitScoreStyle,
  getDaysSinceApplied,
  getCompanyLogoColor,
  getCompanyInitials,
} from '../tracker/constants';

/**
 * Format a raw date into a clean human-readable date
 */
function formatAppliedDate(dateVal) {
  if (!dateVal) return 'Drafted';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'Drafted';

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * RecentApplications Panel Component
 *
 * Displays the last 5 applications with status, fit score, applied date,
 * company logo placeholder, and quick links to the full application detail page.
 *
 * @param {Object} props
 * @param {Array} [props.applications=[]] - Array of application documents
 * @param {boolean} [props.isLoading=false] - Loading state for skeleton placeholders
 * @param {number} [props.maxItems=5] - Maximum items to display (defaults to 5)
 * @param {string} [props.className=''] - Additional container classes
 */
export default function RecentApplications({
  applications = [],
  isLoading = false,
  maxItems = 5,
  className = '',
}) {
  const displayApplications = (applications || []).slice(0, maxItems);

  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 backdrop-blur-md shadow-xl transition-all ${className}`}
    >
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg shadow-sm">
            📋
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Recent Applications
              </h2>
              {!isLoading && displayApplications.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80">
                  Last {displayApplications.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Latest tailored job submissions and active pipeline progression.
            </p>
          </div>
        </div>

        <Link
          to="/tracker"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-400 hover:text-blue-300 transition group self-start sm:self-auto"
        >
          <span>View All in Tracker</span>
          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      </div>

      {/* Loading Skeleton Rows */}
      {isLoading && (
        <div className="divide-y divide-slate-800/60 mt-2">
          {[...Array(maxItems)].map((_, i) => (
            <div
              key={i}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse"
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-800 rounded" />
                  <div className="h-3 w-28 bg-slate-800/80 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-20 bg-slate-800 rounded-md" />
                <div className="h-6 w-24 bg-slate-800 rounded-md" />
                <div className="h-8 w-24 bg-slate-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && displayApplications.length === 0 && (
        <div className="py-12 px-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
            💼
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            No applications yet
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            You haven't submitted any tailored job applications yet. Generate your first tailored package to start tracking.
          </p>
          <Link
            to="/apply"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition shadow-md shadow-blue-500/20"
          >
            <span>✨</span>
            <span>Tailor Your First Application</span>
          </Link>
        </div>
      )}

      {/* Applications List */}
      {!isLoading && displayApplications.length > 0 && (
        <div className="divide-y divide-slate-800/60 mt-1">
          {displayApplications.map((app) => {
            const appId = app.id || app._id || app.runId;
            const company = app.company || 'Untitled Company';
            const role = app.roleTitle || app.role || 'Position';
            const status = app.status || 'applied';

            // Extract numeric fit score
            const rawScore =
              app.fitScore?.score !== undefined
                ? app.fitScore.score
                : typeof app.fitScore === 'number'
                ? app.fitScore
                : null;

            const scoreInfo = getFitScoreStyle(rawScore);
            const statusInfo = getStatusInfo(status);
            const companyColor = getCompanyLogoColor(company);
            const initials = getCompanyInitials(company);
            const relativeDate = getDaysSinceApplied(app.appliedAt || app.appliedDate || app.createdAt);
            const formattedDate = formatAppliedDate(app.appliedAt || app.appliedDate || app.createdAt);

            return (
              <div
                key={appId}
                className="py-3.5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 hover:bg-slate-800/30 rounded-xl px-2 sm:px-3 -mx-2 sm:-mx-3 transition-colors group"
              >
                {/* Left: Company Logo Initials + Role + Company */}
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-xs tracking-wider shadow-md border shrink-0 ${companyColor}`}
                    title={company}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                        {role}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                      <span className="font-medium text-slate-300 truncate max-w-[180px]" title={company}>
                        {company}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400 font-mono text-[11px]" title={formattedDate}>
                        ⏱️ {relativeDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Badges + Quick Action Link */}
                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${statusInfo.badgeBg}`}
                  >
                    <span className="text-xs">{statusInfo.icon}</span>
                    <span>{statusInfo.title}</span>
                  </span>

                  {/* Fit Score Badge */}
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg border font-medium text-xs ${scoreInfo.badgeClass}`}
                    title={rawScore !== null ? `Fit Score: ${rawScore}/100` : 'Score not available'}
                  >
                    {scoreInfo.label}
                  </span>

                  {/* Quick Link to Application Detail */}
                  <Link
                    to={`/applications/${appId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white border border-slate-700/80 hover:border-blue-500 transition shadow-sm shrink-0"
                    title="View full application history, cover letter, and ATS report"
                  >
                    <span>View Detail</span>
                    <span className="text-slate-400 group-hover:text-white transition-colors">→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
