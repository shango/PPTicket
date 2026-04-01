import { useEffect, useState, useMemo } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useStore } from '../lib/store';
import { api, type TicketWithMeta } from '../lib/api';
import { KanbanColumn } from '../components/KanbanColumn';
import { TicketCard } from '../components/TicketCard';
import { TicketDetailModal } from '../components/TicketDetailModal';

const COLUMNS = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;

export function BoardPage() {
  const user = useStore((s) => s.user);
  const tickets = useStore((s) => s.tickets);
  const fetchTickets = useStore((s) => s.fetchTickets);
  const optimisticMoveTicket = useStore((s) => s.optimisticMoveTicket);

  const [selectedTicket, setSelectedTicket] = useState<TicketWithMeta | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [myTickets, setMyTickets] = useState(false);

  const canDrag = user ? ['dev', 'admin'].includes(user.role) : false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filteredTickets = useMemo(() => {
    let result = tickets;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    if (priorityFilter.length > 0) {
      result = result.filter((t) => priorityFilter.includes(t.priority));
    }
    if (myTickets && user) {
      result = result.filter((t) => t.assignee_id === user.id);
    }
    return result;
  }, [tickets, search, priorityFilter, myTickets, user]);

  const columnTickets = useMemo(() => {
    const map: Record<string, TicketWithMeta[]> = {};
    for (const col of COLUMNS) {
      map[col] = filteredTickets
        .filter((t) => t.status === col)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [filteredTickets]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTicket = tickets.find((t) => t.id === active.id);
    if (!activeTicket) return;

    // Determine which column we're over
    const overColumn = COLUMNS.find((col) => col === over.id) ||
      tickets.find((t) => t.id === over.id)?.status;

    if (overColumn && overColumn !== activeTicket.status) {
      optimisticMoveTicket(activeTicket.id, overColumn, activeTicket.sort_order);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTicket = tickets.find((t) => t.id === active.id);
    if (!activeTicket) return;

    const targetColumn = COLUMNS.find((col) => col === over.id) ||
      tickets.find((t) => t.id === over.id)?.status;

    if (!targetColumn) return;

    // Calculate new sort order using fractional indexing
    const columnItems = tickets
      .filter((t) => t.status === targetColumn && t.id !== active.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const overIndex = over.id === targetColumn
      ? columnItems.length
      : columnItems.findIndex((t) => t.id === over.id);

    let newSortOrder: number;
    if (columnItems.length === 0) {
      newSortOrder = 1;
    } else if (overIndex <= 0) {
      newSortOrder = columnItems[0].sort_order / 2;
    } else if (overIndex >= columnItems.length) {
      newSortOrder = columnItems[columnItems.length - 1].sort_order + 1;
    } else {
      newSortOrder = (columnItems[overIndex - 1].sort_order + columnItems[overIndex].sort_order) / 2;
    }

    optimisticMoveTicket(activeTicket.id, targetColumn, newSortOrder);

    try {
      await api.moveTicket(activeTicket.id, targetColumn, newSortOrder);
    } catch {
      fetchTickets(); // Rollback on error
    }
  }

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 flex-wrap">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-elevated border border-zinc-700 rounded px-3 py-1.5 text-sm w-60"
        />
        <div className="flex gap-1">
          {['p0', 'p1', 'p2', 'p3'].map((p) => (
            <button
              key={p}
              onClick={() =>
                setPriorityFilter((prev) =>
                  prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                )
              }
              className={`text-xs px-2 py-1 rounded uppercase ${
                priorityFilter.includes(p)
                  ? 'bg-accent text-white'
                  : 'bg-bg-elevated text-text-muted hover:text-text-primary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={() => setMyTickets(!myTickets)}
          className={`text-xs px-2 py-1 rounded ${
            myTickets
              ? 'bg-accent text-white'
              : 'bg-bg-elevated text-text-muted hover:text-text-primary'
          }`}
        >
          My Tickets
        </button>
        {(search || priorityFilter.length > 0 || myTickets) && (
          <button
            onClick={() => { setSearch(''); setPriorityFilter([]); setMyTickets(false); }}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-4 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-min">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col}
                status={col}
                tickets={columnTickets[col]}
                onTicketClick={(t) => setSelectedTicket(t)}
                isDraggable={canDrag}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTicket ? (
              <TicketCard
                ticket={activeTicket}
                onClick={() => {}}
                isDraggable={false}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={() => {
            fetchTickets();
            setSelectedTicket(null);
          }}
        />
      )}
    </div>
  );
}
