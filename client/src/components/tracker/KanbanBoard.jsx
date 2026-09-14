import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

import { KANBAN_COLUMNS, normalizeStatusToColumnId } from './constants';

/**
 * KanbanBoard Component
 * Full-width interactive Kanban board with 5 columns, drag-and-drop between stages,
 * optimistic updates, and DragOverlay preview.
 *
 * @param {Array} applications - List of applications from tracker
 * @param {Function} onStatusChange - Callback(applicationId, newStatus) when dropped
 * @param {Boolean} isLoading - Indicates whether applications are loading
 */
export default function KanbanBoard({
  applications = [],
  onStatusChange,
  onMarkFollowUp,
  isLoading = false,
}) {
  const [activeCard, setActiveCard] = useState(null);

  // Configure pointer and keyboard sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require dragging 5px before drag initiates, preventing accidental drags on click
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group applications into columns
  const columnApplications = useMemo(() => {
    const map = {
      wishlist: [],
      applied: [],
      interviewing: [],
      rejected: [],
      offer: [],
    };

    applications.forEach((app) => {
      const colId = normalizeStatusToColumnId(app.status);
      if (map[colId]) {
        map[colId].push(app);
      } else {
        map.applied.push(app);
      }
    });

    return map;
  }, [applications]);

  // Handle Drag Start
  const handleDragStart = (event) => {
    const { active } = event;
    const cardData = active.data.current?.application;
    if (cardData) {
      setActiveCard(cardData);
    } else {
      const found = applications.find(
        (a) => (a.id || a._id) === active.id
      );
      if (found) setActiveCard(found);
    }
  };

  // Handle Drag End
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Determine target column ID
    let targetColumnId = null;

    // 1. Dropped directly onto a Column container
    if (KANBAN_COLUMNS.some((c) => c.id === overId)) {
      targetColumnId = overId;
    }
    // 2. Dropped over another Card in a column
    else if (over.data.current?.type === 'Application') {
      const overApp = over.data.current.application;
      targetColumnId = normalizeStatusToColumnId(overApp.status);
    }
    // 3. Fallback: search applications list
    else {
      const overApp = applications.find(
        (a) => (a.id || a._id) === overId
      );
      if (overApp) {
        targetColumnId = normalizeStatusToColumnId(overApp.status);
      }
    }

    if (!targetColumnId) return;

    // Find the active application
    const activeApp = applications.find(
      (a) => (a.id || a._id) === activeId
    );

    if (!activeApp) return;

    const currentColumnId = normalizeStatusToColumnId(activeApp.status);

    // If dropped into the same column, no status change needed
    if (currentColumnId === targetColumnId) {
      return;
    }

    // Map column ID to canonical status value
    const targetCol = KANBAN_COLUMNS.find((c) => c.id === targetColumnId);
    const newStatus = targetCol ? targetCol.statusKey : targetColumnId;

    if (onStatusChange) {
      onStatusChange(activeId, newStatus);
    }
  };

  return (
    <div className={`w-full transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Horizontal scrollable columns grid */}
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[500px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              applications={columnApplications[col.id] || []}
              onStatusChange={onStatusChange}
              onMarkFollowUp={onMarkFollowUp}
            />
          ))}
        </div>

        {/* Floating preview of the card while dragging */}
        <DragOverlay>
          {activeCard ? (
            <KanbanCard application={activeCard} isOverlay={true} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
