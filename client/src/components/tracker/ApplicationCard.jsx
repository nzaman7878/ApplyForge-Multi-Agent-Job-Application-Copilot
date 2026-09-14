import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  KANBAN_COLUMNS,
  getStatusInfo,
  getFitScoreStyle,
  getDaysSinceApplied,
} from './constants';

/**
 * Deterministically generates a gradient based on company name string
 */
function getCompanyLogoColor(companyName = '') {
  const gradients = [
    'from-blue-600 to-indigo-600 text-blue-100 border-blue-400/30',
    'from-violet-600 to-purple-600 text-purple-100 border-purple-400/30',
    'from-emerald-600 to-teal-600 text-emerald-100 border-emerald-400/30',
    'from-amber-600 to-orange-600 text-amber-100 border-amber-400/30',
    'from-rose-600 to-pink-600 text-rose-100 border-rose-400/30',
    'from-cyan-600 to-blue-600 text-cyan-100 border-cyan-400/30',
  ];

  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

/**
 * Extracts initials from company name (up to 2 characters)
 */
function getCompanyInitials(name = '') {
  const clean = name.trim();
  if (!clean) return 'AP';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * ApplicationCard Component
 *
 * Compact presentation:
 * - Company logo placeholder with dynamic brand initials
 * - Role title and company name
 * - Status badge & fit score badge
 * - Days since applied timestamp
 *
 * Hover:
 * - Reveals quick actions toolbar: View, Edit Status, Mark Follow-up
 *
 * @param {Object} props
 * @param {Object} props.application - Full application record
 * @param {Function} [props.onStatusChange] - Callback(applicationId, newStatus)
 * @param {Function} [props.onMarkFollowUp] - Callback(applicationId, nextFollowUpDate)
 * @param {Function} [props.onView] - Optional override callback for view action
 * @param {String} [props.className] - Additional classes
 * @param {Boolean} [props.isOverlay] - If rendered inside drag overlay
 */
export default function ApplicationCard({
  application,
  onStatusChange,
  onMarkFollowUp,
  onView,
  className = '',
  isOverlay = false,
}) {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isFollowUpMenuOpen, setIsFollowUpMenuOpen] = useState(false);

  const statusMenuRef = useRef(null);
  const followUpMenuRef = useRef(null);

  const {
    id: appId,
    _id,
    company = 'Untitled Company',
    roleTitle = 'Position',
    role,
    appliedAt,
    appliedDate,
    fitScore,
    status = 'applied',
    nextFollowUpAt,
    notes,
    isOverdue,
  } = application || {};

  const cardId = appId || _id;
  const displayRole = roleTitle || role || 'Position';

  // Compute styles
  const rawScore =
    fitScore?.score !== undefined ? fitScore.score : typeof fitScore === 'number' ? fitScore : null;
  const scoreInfo = getFitScoreStyle(rawScore);
  const statusInfo = getStatusInfo(status);
  const companyColor = getCompanyLogoColor(company);
  const initials = getCompanyInitials(company);
  const daysSinceApplied = getDaysSinceApplied(appliedAt || appliedDate);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target)
      ) {
        setIsStatusMenuOpen(false);
      }
      if (
        followUpMenuRef.current &&
        !followUpMenuRef.current.contains(event.target)
      ) {
        setIsFollowUpMenuOpen(false);
      }
    }

    if (isStatusMenuOpen || isFollowUpMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusMenuOpen, isFollowUpMenuOpen]);

  // Handle Quick Status Change
  const handleSelectStatus = (newStatusKey) => {
    setIsStatusMenuOpen(false);
    if (onStatusChange && newStatusKey !== status) {
      onStatusChange(cardId, newStatusKey);
    }
  };

  // Handle Quick Follow-Up Scheduling
  const handleSetFollowUpDays = (days) => {
    setIsFollowUpMenuOpen(false);
    if (!onMarkFollowUp) return;

    if (days === null) {
      onMarkFollowUp(cardId, null);
      return;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    onMarkFollowUp(cardId, targetDate.toISOString());
  };

  return (
    <div
      className={`group relative rounded-xl border bg-slate-900/90 p-3.5 shadow-sm transition-all duration-200 ${
        isOverlay
          ? 'border-blue-500/70 shadow-2xl shadow-blue-500/20 rotate-1 scale-105 ring-2 ring-blue-500/40 bg-slate-900 z-50'
          : 'border-slate-800 hover:border-slate-700 hover:bg-slate-850 hover:shadow-md'
      } ${className}`}
    >
      {/* Main compact card content */}
      <div className="flex items-start gap-3">
        {/* Company Logo Placeholder */}
        <div className="relative shrink-0">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-xs tracking-wider shadow-md border ${companyColor}`}
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

        {/* Role & Company details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <h4
              className="font-semibold text-sm text-slate-100 truncate group-hover:text-blue-400 transition-colors"
              title={displayRole}
            >
              {displayRole}
            </h4>
          </div>

          <p className="text-xs text-slate-400 font-medium truncate mt-0.5" title={company}>
            {company}
          </p>

          {/* Days since applied & notes preview */}
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
              ⏱️ {daysSinceApplied}
            </span>
            {nextFollowUpAt && !isOverdue && (
              <span className="text-[10px] text-indigo-300 font-mono" title="Scheduled follow-up">
                🔔 Follow-up scheduled
              </span>
            )}
            {notes && (
              <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={notes}>
                📝 {notes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Badges footer row: Status badge + Fit score */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/60 text-[11px]">
        {/* Status Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${statusInfo.badgeBg}`}
        >
          <span>{statusInfo.icon}</span>
          <span>{statusInfo.title}</span>
        </span>

        {/* Fit Score Badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-medium text-[10px] ${scoreInfo.badgeClass}`}
        >
          {scoreInfo.label}
        </span>
      </div>

      {/* Hover Quick Actions Toolbar */}
      <div
        className={`absolute inset-x-2 bottom-2 rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-1.5 flex items-center justify-between gap-1 shadow-lg transition-all duration-150 ${
          isStatusMenuOpen || isFollowUpMenuOpen
            ? 'opacity-100 pointer-events-auto z-30'
            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto z-20'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action 1: View */}
        {onView ? (
          <button
            type="button"
            onClick={() => onView(application)}
            className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-md text-[11px] font-medium text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white transition"
            title="View full application details"
            aria-label="View application details"
          >
            <span>👁️</span>
            <span>View</span>
          </button>
        ) : (
          <Link
            to={`/applications/${cardId}`}
            className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-md text-[11px] font-medium text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white transition"
            title="View full application details"
            aria-label="View application details"
          >
            <span>👁️</span>
            <span>View</span>
          </Link>
        )}

        {/* Action 2: Edit Status */}
        <div className="relative flex-1" ref={statusMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsStatusMenuOpen((prev) => !prev);
              setIsFollowUpMenuOpen(false);
            }}
            className={`w-full inline-flex items-center justify-center gap-1 py-1 px-2 rounded-md text-[11px] font-medium transition ${
              isStatusMenuOpen
                ? 'bg-blue-600 text-white'
                : 'text-slate-200 bg-slate-800/80 hover:bg-slate-700 hover:text-white'
            }`}
            title="Update application stage"
            aria-label="Edit application status"
          >
            <span>🔄</span>
            <span>Status</span>
          </button>

          {/* Status Dropdown Popover */}
          {isStatusMenuOpen && (
            <div className="absolute left-0 bottom-full mb-1.5 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-40">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                Move Stage
              </div>
              <div className="py-1 space-y-0.5">
                {KANBAN_COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleSelectStatus(col.statusKey)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition text-left ${
                      status === col.statusKey || status === col.id
                        ? 'bg-blue-500/20 text-blue-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{col.icon}</span>
                      <span>{col.title}</span>
                    </span>
                    {(status === col.statusKey || status === col.id) && (
                      <span className="text-blue-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action 3: Mark Follow-Up */}
        <div className="relative flex-1" ref={followUpMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsFollowUpMenuOpen((prev) => !prev);
              setIsStatusMenuOpen(false);
            }}
            className={`w-full inline-flex items-center justify-center gap-1 py-1 px-2 rounded-md text-[11px] font-medium transition ${
              isFollowUpMenuOpen
                ? 'bg-amber-600 text-white'
                : isOverdue
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'text-slate-200 bg-slate-800/80 hover:bg-slate-700 hover:text-white'
            }`}
            title="Schedule or mark follow-up"
            aria-label="Mark follow-up reminder"
          >
            <span>⏰</span>
            <span>Follow-up</span>
          </button>

          {/* Follow-up schedule dropdown */}
          {isFollowUpMenuOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-40">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                Remind Follow-Up
              </div>
              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleSetFollowUpDays(0)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-amber-300 hover:bg-slate-800 transition text-left"
                >
                  <span>⚡</span>
                  <span>Due Today</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFollowUpDays(3)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left"
                >
                  <span>📅</span>
                  <span>In 3 Days</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFollowUpDays(7)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left"
                >
                  <span>🗓️</span>
                  <span>In 1 Week</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFollowUpDays(null)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-rose-950/40 hover:text-rose-300 transition text-left border-t border-slate-800/80 mt-1 pt-1.5"
                >
                  <span>✖️</span>
                  <span>Clear Reminder</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
