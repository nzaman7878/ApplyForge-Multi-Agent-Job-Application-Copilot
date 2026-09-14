import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ApplicationCard from './ApplicationCard';

/**
 * KanbanCard Component
 * Wraps ApplicationCard with @dnd-kit sortable drag handles for the Kanban board.
 */
export default function KanbanCard({
  application,
  isOverlay = false,
  onStatusChange,
  onMarkFollowUp,
}) {
  const cardId = application?.id || application?._id;

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={0}
      role="button"
      aria-label={`Application for ${application?.roleTitle || application?.role || 'Position'} at ${application?.company || 'Company'}`}
      className={`select-none cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <ApplicationCard
        application={application}
        isOverlay={isOverlay}
        onStatusChange={onStatusChange}
        onMarkFollowUp={onMarkFollowUp}
      />
    </div>
  );
}

