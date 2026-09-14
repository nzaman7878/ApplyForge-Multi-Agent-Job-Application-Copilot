import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';

/**
 * KanbanColumn Component
 * Droppable container for each application lifecycle stage.
 */
export default function KanbanColumn({
  column,
  applications = [],
  onStatusChange,
  onMarkFollowUp,
}) {
  const { id, title, icon, color, headerBg, badgeBg } = column;

  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'Column',
      column,
    },
  });

  const itemIds = applications.map((app) => app.id || app._id);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border bg-slate-900/40 min-w-[280px] w-full flex-1 transition-colors duration-200 ${
        isOver
          ? 'border-blue-500/60 bg-blue-950/20 shadow-lg shadow-blue-500/10'
          : 'border-slate-800/80'
      }`}
    >
      {/* Column Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-800/80 rounded-t-xl ${headerBg}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" role="img" aria-label={title}>
            {icon}
          </span>
          <h3 className="font-semibold text-sm text-slate-200 tracking-tight">
            {title}
          </h3>
        </div>

        {/* Count badge */}
        <span
          className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full border ${badgeBg} ${color}`}
        >
          {applications.length}
        </span>
      </div>

      {/* Cards container */}
      <div className="flex-1 p-3 flex flex-col gap-3 min-h-[350px]">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {applications.length > 0 ? (
            applications.map((app) => (
              <KanbanCard
                key={app.id || app._id}
                application={app}
                onStatusChange={onStatusChange}
                onMarkFollowUp={onMarkFollowUp}
              />
            ))
          ) : (
            <div
              className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isOver
                  ? 'border-blue-500/40 bg-blue-500/5 text-blue-300'
                  : 'border-slate-800/60 text-slate-400'
              }`}
            >
              <p className="text-xs font-medium">
                {isOver ? 'Drop application here' : 'No applications in this stage'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Drag cards here to update status
              </p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
