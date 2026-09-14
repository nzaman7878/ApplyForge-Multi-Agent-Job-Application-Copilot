import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  KANBAN_COLUMNS,
  getStatusInfo,
  getFitScoreStyle,
  getDaysSinceApplied,
  getCompanyLogoColor,
  getCompanyInitials,
} from './constants';

const STATUS_ORDER = {
  wishlist: 1,
  drafted: 1,
  applied: 2,
  interviewing: 3,
  offer: 4,
  rejected: 5,
};

/**
 * Extracts numeric score from fitScore field
 */
function extractScore(fitScore) {
  if (fitScore === undefined || fitScore === null) return -1;
  if (typeof fitScore === 'number') return fitScore;
  if (typeof fitScore.score === 'number') return fitScore.score;
  const parsed = parseInt(fitScore.score, 10);
  return isNaN(parsed) ? -1 : parsed;
}

/**
 * Extracts timestamp milliseconds from application
 */
function extractDate(app) {
  const raw = app.appliedAt || app.appliedDate || app.createdAt;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * ApplicationTable Component
 *
 * Full-featured sortable table view of applications.
 *
 * Sortable columns:
 * - Company (company name, A-Z / Z-A)
 * - Date (applied date, newest / oldest)
 * - Score (fit score, highest / lowest)
 * - Status (lifecycle stage hierarchy)
 *
 * @param {Object} props
 * @param {Array} props.applications - List of applications
 * @param {Function} [props.onStatusChange] - Status update handler
 * @param {Function} [props.onMarkFollowUp] - Follow-up update handler
 * @param {Boolean} [props.isLoading] - Loading state
 */
export default function ApplicationTable({
  applications = [],
  onStatusChange,
  isLoading = false,
}) {
  const [sortKey, setSortKey] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [activeStatusMenuId, setActiveStatusMenuId] = useState(null);

  // Toggle sort order or switch column
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'score' || key === 'date' ? 'desc' : 'asc');
    }
  };

  // Sort applications list
  const sortedApplications = useMemo(() => {
    const list = [...applications];

    list.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'company': {
          const compA = (a.company || '').toLowerCase();
          const compB = (b.company || '').toLowerCase();
          comparison = compA.localeCompare(compB);
          break;
        }
        case 'date': {
          const dateA = extractDate(a);
          const dateB = extractDate(b);
          comparison = dateA - dateB;
          break;
        }
        case 'score': {
          const scoreA = extractScore(a.fitScore);
          const scoreB = extractScore(b.fitScore);
          comparison = scoreA - scoreB;
          break;
        }
        case 'status': {
          const rankA = STATUS_ORDER[(a.status || 'applied').toLowerCase()] || 2;
          const rankB = STATUS_ORDER[(b.status || 'applied').toLowerCase()] || 2;
          comparison = rankA - rankB;
          break;
        }
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [applications, sortKey, sortOrder]);

  // Helper for render sort icon
  const renderSortIndicator = (key) => {
    if (sortKey !== key) {
      return <span className="text-slate-600 group-hover:text-slate-400 text-[10px] ml-1">↕</span>;
    }
    return (
      <span className="text-blue-400 font-bold text-xs ml-1">
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  if (applications.length === 0 && !isLoading) {
    return (
      <div className="p-12 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40">
        <span className="text-4xl">📂</span>
        <h3 className="text-sm font-bold text-slate-200 mt-2">No applications found</h3>
        <p className="text-xs text-slate-400 mt-1">
          Try clearing your search query or submit a new application.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl transition-opacity duration-200 ${
        isLoading ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
              {/* Company & Role */}
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer hover:text-white transition group select-none"
                onClick={() => handleSort('company')}
                aria-sort={
                  sortKey === 'company'
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-1">
                  <span>Company & Role</span>
                  {renderSortIndicator('company')}
                </div>
              </th>

              {/* Status */}
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer hover:text-white transition group select-none"
                onClick={() => handleSort('status')}
                aria-sort={
                  sortKey === 'status'
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {renderSortIndicator('status')}
                </div>
              </th>

              {/* Fit Score */}
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer hover:text-white transition group select-none"
                onClick={() => handleSort('score')}
                aria-sort={
                  sortKey === 'score'
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-1">
                  <span>Fit Score</span>
                  {renderSortIndicator('score')}
                </div>
              </th>

              {/* Applied Date */}
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer hover:text-white transition group select-none"
                onClick={() => handleSort('date')}
                aria-sort={
                  sortKey === 'date'
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-1">
                  <span>Applied Date</span>
                  {renderSortIndicator('date')}
                </div>
              </th>

              {/* Follow-Up */}
              <th scope="col" className="py-3.5 px-4 text-slate-400">
                Follow-Up
              </th>

              {/* Actions */}
              <th scope="col" className="py-3.5 px-4 text-right text-slate-400">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/60">
            {sortedApplications.map((app) => {
              const appId = app.id || app._id;
              const company = app.company || 'Untitled Company';
              const roleTitle = app.roleTitle || app.role || 'Position';
              const statusInfo = getStatusInfo(app.status);
              const scoreInfo = getFitScoreStyle(extractScore(app.fitScore));
              const daysSince = getDaysSinceApplied(app.appliedAt || app.appliedDate);
              const companyColor = getCompanyLogoColor(company);
              const initials = getCompanyInitials(company);
              const isOverdue = Boolean(app.isOverdue);
              const isStatusMenuOpen = activeStatusMenuId === appId;

              return (
                <tr
                  key={appId}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {/* Company & Role */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* Logo Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-xs tracking-wider shadow-sm border ${companyColor}`}
                          title={company}
                        >
                          {initials}
                        </div>
                        {isOverdue && (
                          <span
                            title="Follow-up due"
                            className="flex h-2.5 w-2.5 absolute -top-1 -right-1"
                          >
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 ring-2 ring-slate-900" />
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <Link
                          to={`/applications/${appId}`}
                          className="font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate block text-sm"
                          title={roleTitle}
                        >
                          {roleTitle}
                        </Link>
                        <p className="text-slate-400 text-xs truncate mt-0.5" title={company}>
                          {company}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge with Quick Menu */}
                  <td className="py-3 px-4">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveStatusMenuId((prev) => (prev === appId ? null : appId))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer hover:ring-2 hover:ring-blue-500/30 ${statusInfo.badgeBg}`}
                        title="Click to change status"
                      >
                        <span>{statusInfo.icon}</span>
                        <span>{statusInfo.title}</span>
                        <span className="text-[10px] opacity-60">▾</span>
                      </button>

                      {/* Dropdown Popover */}
                      {isStatusMenuOpen && onStatusChange && (
                        <div
                          className="absolute left-0 top-full mt-1 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-30 animate-fadeIn"
                          onMouseLeave={() => setActiveStatusMenuId(null)}
                        >
                          <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                            Move Stage
                          </div>
                          <div className="py-1 space-y-0.5">
                            {KANBAN_COLUMNS.map((col) => (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => {
                                  setActiveStatusMenuId(null);
                                  onStatusChange(appId, col.statusKey);
                                }}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition text-left ${
                                  app.status === col.statusKey || app.status === col.id
                                    ? 'bg-blue-500/20 text-blue-300 font-semibold'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>{col.icon}</span>
                                  <span>{col.title}</span>
                                </span>
                                {(app.status === col.statusKey || app.status === col.id) && (
                                  <span className="text-blue-400">✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Fit Score */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border font-medium text-[11px] ${scoreInfo.badgeClass}`}
                    >
                      {scoreInfo.label}
                    </span>
                  </td>

                  {/* Applied Date */}
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                    <div className="flex flex-col">
                      <span>{app.appliedAt || app.appliedDate ? new Date(app.appliedAt || app.appliedDate).toLocaleDateString() : 'Drafted'}</span>
                      <span className="text-[10px] text-slate-500">{daysSince}</span>
                    </div>
                  </td>

                  {/* Follow-Up */}
                  <td className="py-3 px-4 text-xs">
                    {app.nextFollowUpAt ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono ${
                          isOverdue
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        }`}
                      >
                        <span>{isOverdue ? '⚠️ Due' : '🔔'}</span>
                        <span>{new Date(app.nextFollowUpAt).toLocaleDateString()}</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/applications/${appId}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white transition font-medium text-xs shadow-sm"
                    >
                      <span>View</span>
                      <span>→</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
