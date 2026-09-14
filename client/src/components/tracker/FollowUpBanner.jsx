import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getStatusInfo,
  getCompanyLogoColor,
  getCompanyInitials,
} from './constants';

/**
 * Calculates human-readable overdue duration
 */
function getOverdueText(dateVal) {
  if (!dateVal) return 'Due today';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'Due today';

  const now = new Date();
  const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));

  if (diffHours < 24) return 'Due today';
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day overdue';
  return `${diffDays} days overdue`;
}

/**
 * FollowUpBanner Component
 *
 * Rendered at the top of the Tracker dashboard when follow-up reminders are due.
 * Provides instant actions to:
 * - Mark as followed-up (archives reminder and records lastFollowUpAt)
 * - Snooze reminder (+1 day, +3 days, +1 week)
 * - View full application dossier
 *
 * @param {Object} props
 * @param {Array} props.dueFollowUps - List of overdue application records
 * @param {Function} props.onMarkFollowedUp - Callback(applicationId)
 * @param {Function} props.onSnooze - Callback(applicationId, days)
 */
export default function FollowUpBanner({
  dueFollowUps = [],
  onMarkFollowedUp,
  onSnooze,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeSnoozeId, setActiveSnoozeId] = useState(null);
  const snoozeRef = useRef(null);

  // Close snooze popup on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (snoozeRef.current && !snoozeRef.current.contains(event.target)) {
        setActiveSnoozeId(null);
      }
    }
    if (activeSnoozeId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeSnoozeId]);

  if (!dueFollowUps || dueFollowUps.length === 0) {
    return null;
  }

  const count = dueFollowUps.length;

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-950/25 to-slate-900/60 p-4 sm:p-5 shadow-xl shadow-amber-950/20 backdrop-blur-md transition-all duration-200">
      {/* Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
        <div className="flex items-center gap-3">
          {/* Urgent Pulsing Beacon */}
          <div className="flex h-4 w-4 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 ring-4 ring-amber-500/20" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-white tracking-tight flex items-center gap-1.5">
                <span>🔔 Action Required:</span>
                <span className="text-amber-300">
                  {count} Recruitment Follow-Up{count > 1 ? 's' : ''} Due
                </span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold font-mono">
                {count} Urgent
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Keep recruiter momentum active. Send a check-in message, update your status, or snooze.
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {count > 1 && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
            >
              <span>{isExpanded ? 'Collapse List' : `View All (${count})`}</span>
              <span>{isExpanded ? '▴' : '▾'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Overdue Items List */}
      {isExpanded && (
        <div className="mt-3.5 space-y-2.5">
          {dueFollowUps.map((app) => {
            const appId = app.id || app._id;
            const company = app.company || 'Untitled Company';
            const roleTitle = app.roleTitle || app.role || 'Position';
            const statusInfo = getStatusInfo(app.status);
            const overdueText = getOverdueText(app.nextFollowUpAt);
            const companyColor = getCompanyLogoColor(company);
            const initials = getCompanyInitials(company);
            const isSnoozeOpen = activeSnoozeId === appId;

            return (
              <div
                key={appId}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-amber-500/20 hover:border-amber-500/40 transition-colors"
              >
                {/* Left: Company & Role info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-xs tracking-wider shadow-sm border shrink-0 ${companyColor}`}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/applications/${appId}`}
                        className="font-bold text-sm text-slate-100 hover:text-amber-300 transition-colors truncate"
                      >
                        {company}
                      </Link>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusInfo.badgeBg}`}
                      >
                        <span>{statusInfo.icon}</span>
                        <span>{statusInfo.title}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span className="truncate">{roleTitle}</span>
                      <span>•</span>
                      <span className="text-amber-400 font-semibold font-mono text-[11px]">
                        ⚠️ {overdueText}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {/* Mark Followed-Up Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onMarkFollowedUp) onMarkFollowedUp(appId);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
                    title="Mark this follow-up as completed"
                  >
                    <span>✓</span>
                    <span>Followed Up</span>
                  </button>

                  {/* Snooze Dropdown */}
                  <div className="relative" ref={isSnoozeOpen ? snoozeRef : null}>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSnoozeId((prev) => (prev === appId ? null : appId))
                      }
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        isSnoozeOpen
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-900 border-amber-500/30 text-amber-200 hover:bg-amber-500/20'
                      }`}
                      title="Snooze this follow-up reminder"
                    >
                      <span>💤</span>
                      <span>Snooze</span>
                      <span className="text-[10px]">▾</span>
                    </button>

                    {isSnoozeOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-40 animate-fadeIn">
                        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                          Snooze Reminder
                        </div>
                        <div className="py-1 space-y-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSnoozeId(null);
                              if (onSnooze) onSnooze(appId, 1);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left"
                          >
                            <span>⏱️</span>
                            <span>Tomorrow (+1d)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSnoozeId(null);
                              if (onSnooze) onSnooze(appId, 3);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left"
                          >
                            <span>📅</span>
                            <span>In 3 Days</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSnoozeId(null);
                              if (onSnooze) onSnooze(appId, 7);
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition text-left"
                          >
                            <span>🗓️</span>
                            <span>In 1 Week</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* View dossier link */}
                  <Link
                    to={`/applications/${appId}`}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition border border-slate-800"
                    title="Open full application details"
                  >
                    <span>↗</span>
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
