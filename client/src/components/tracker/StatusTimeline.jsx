import React from 'react';
import { getStatusInfo } from './constants';

/**
 * Format date for timeline entry
 */
function formatTimelineDate(dateVal) {
  if (!dateVal) return 'Date unknown';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Date unknown';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Date unknown';
  }
}

/**
 * Calculate relative time string
 */
function getRelativeTime(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

/**
 * StatusTimeline Component
 * Displays the complete timestamped audit trail of status transitions.
 *
 * @param {Array} statusHistory - Array of { status, changedAt }
 * @param {String} currentStatus - Current active status
 * @param {Function} [onStatusChange] - Optional callback to move to next stage
 */
export default function StatusTimeline({
  statusHistory = [],
  currentStatus = 'applied',
  onStatusChange,
}) {
  // Normalize history entries
  const entries = Array.isArray(statusHistory) && statusHistory.length > 0
    ? statusHistory
    : [{ status: currentStatus, changedAt: new Date().toISOString() }];

  const currentInfo = getStatusInfo(currentStatus);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⏳</span>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Application Status Timeline
            </h3>
            <p className="text-xs text-slate-400">
              Audit trail of hiring milestones & status transitions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Current:</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentInfo.badgeBg}`}
          >
            <span>{currentInfo.icon}</span>
            <span>{currentInfo.title}</span>
          </span>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-indigo-500 before:to-slate-800">
        {entries.map((entry, idx) => {
          const isLatest = idx === entries.length - 1;
          const info = getStatusInfo(entry.status);
          const formattedDate = formatTimelineDate(entry.changedAt);
          const relative = getRelativeTime(entry.changedAt);

          return (
            <div key={idx} className="relative group">
              {/* Timeline marker node */}
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isLatest
                    ? 'border-blue-400 bg-blue-600 shadow-lg shadow-blue-500/50 ring-4 ring-blue-500/20'
                    : 'border-slate-600 bg-slate-800'
                }`}
              >
                {isLatest ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                )}
              </div>

              {/* Entry content card */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isLatest
                    ? 'border-blue-500/40 bg-blue-950/20 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{info.icon}</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-100">
                      {info.title}
                    </span>
                    {isLatest && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Current Stage
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <span className="text-[11px] font-mono text-slate-400">
                      {formattedDate}
                    </span>
                    {relative && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {relative}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick advance shortcut if not at final stage */}
      {onStatusChange && currentStatus !== 'offer' && currentStatus !== 'rejected' && (
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">Advance to next hiring stage:</span>
          <div className="flex gap-1.5">
            {currentStatus === 'wishlist' && (
              <button
                type="button"
                onClick={() => onStatusChange('applied')}
                className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition font-medium"
              >
                Mark as Applied 🚀
              </button>
            )}
            {currentStatus === 'applied' && (
              <button
                type="button"
                onClick={() => onStatusChange('interviewing')}
                className="px-2.5 py-1 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600 hover:text-white transition font-medium"
              >
                Interview Scheduled 🎯
              </button>
            )}
            {currentStatus === 'interviewing' && (
              <>
                <button
                  type="button"
                  onClick={() => onStatusChange('offer')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition font-medium"
                >
                  Offer Received 🏆
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange('rejected')}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white transition font-medium"
                >
                  Rejected ✖️
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
