import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';

/**
 * Helper to determine fit score badge color and label
 */
function getFitScoreStyle(score) {
  if (score === undefined || score === null) {
    return {
      label: 'Fit: N/A',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }
  const numericScore = typeof score === 'number' ? score : parseInt(score, 10);
  if (numericScore >= 80) {
    return {
      label: `${numericScore}/100 Strong`,
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    };
  }
  if (numericScore >= 60) {
    return {
      label: `${numericScore}/100 Moderate`,
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    };
  }
  return {
    label: `${numericScore}/100 Stretch`,
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };
}

/**
 * Format timestamp nicely
 */
function formatAppliedDate(dateVal) {
  if (!dateVal) return 'Drafted';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

/**
 * KanbanCard Component
 * Displays application card in Kanban column with drag handle,
 * company, role title, applied date, and fit score badge.
 */
export default function KanbanCard({ application, isOverlay = false }) {
  const {
    id: appId,
    _id,
    company = 'Untitled Company',
    roleTitle = 'Position',
    appliedAt,
    appliedDate,
    fitScore,
    status,
    notes,
  } = application;

  const cardId = appId || _id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cardId,
    data: {
      type: 'Application',
      application,
    },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const rawScore =
    fitScore?.score !== undefined ? fitScore.score : typeof fitScore === 'number' ? fitScore : null;
  const scoreInfo = getFitScoreStyle(rawScore);
  const formattedDate = formatAppliedDate(appliedAt || appliedDate);

  const isOverdue = Boolean(application.isOverdue);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={0}
      role="button"
      aria-label={`Application for ${roleTitle} at ${company}, status: ${status}`}
      className={`group relative select-none rounded-xl border bg-slate-900/90 p-4 shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing ${
        isDragging
          ? 'opacity-30 border-blue-500/50 shadow-lg scale-95'
          : isOverlay
          ? 'border-blue-500/70 shadow-2xl shadow-blue-500/20 rotate-2 scale-105 ring-2 ring-blue-500/40 bg-slate-900 z-50'
          : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 hover:shadow-md'
      }`}
    >
      {/* Top row: Company & Follow-up urgency beacon */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="font-semibold text-slate-100 text-sm tracking-tight truncate group-hover:text-blue-400 transition-colors">
          {company}
        </h4>
        {isOverdue && (
          <span
            title="Follow-up is overdue!"
            className="flex h-2 w-2 relative shrink-0 mt-1"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}
      </div>

      {/* Role title */}
      <p className="text-xs font-medium text-slate-300 truncate mb-3">
        {roleTitle}
      </p>

      {/* Badges row: Fit Score & Applied Date */}
      <div className="flex items-center justify-between gap-2 text-[11px] pt-2 border-t border-slate-800/60">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-medium ${scoreInfo.badgeClass}`}
        >
          {scoreInfo.label}
        </span>

        <span className="text-slate-400 flex items-center gap-1 font-mono text-[10px]">
          📅 {formattedDate}
        </span>
      </div>

      {/* Direct link on card hover / details jump */}
      <div className="mt-3 pt-2 border-t border-slate-800/40 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
          {notes ? `📝 ${notes.slice(0, 24)}...` : 'Drag to change stage'}
        </span>
        <Link
          to={`/applications/${cardId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline font-medium"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
