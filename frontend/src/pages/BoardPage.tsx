import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
} from '@dnd-kit/core';
import { useStore } from '../lib/store';
import { api, type TicketWithMeta, type Project, type Column } from '../lib/api';
import { KanbanColumn } from '../components/KanbanColumn';
import { TicketCard } from '../components/TicketCard';
import { TicketListView } from '../components/TicketListView';

export function BoardPage() {
  const user = useStore((s) => s.user);
  const tickets = useStore((s) => s.tickets);
  const fetchTickets = useStore((s) => s.fetchTickets);
  const optimisticMoveTicket = useStore((s) => s.optimisticMoveTicket);

  const navigate = useNavigate();
  const [columns, setColumns] = useState<Column[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProductFilter] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [myTickets, setMyTickets] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  const canDrag = user ? ['decision_maker', 'dev', 'admin'].includes(user.role) : false;

  const collisionDetection: CollisionDetection = (args) => {
    // Try pointerWithin first — works for empty droppable columns
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    // Fall back to rectIntersection for sorting within columns
    return rectIntersection(args);
  };
  const columnSlugs = useMemo(() => columns.map(c => c.slug), [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const draggingRef = useRef(false);

  useEffect(() => {
    fetchTickets();
    api.getColumns().then(setColumns).catch(() => {});
    api.getProjects().then(setProjects).catch(() => {});

    const interval = setInterval(() => {
      if (!draggingRef.current) fetchTickets();
    }, 5000);
    return () => clearInterval(interval);
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
    if (projectFilter) {
      result = result.filter((t) => t.product_id === projectFilter);
    }
    if (myTickets && user) {
      result = result.filter((t) => t.assignee_ids.includes(user.id));
    }
    return result;
  }, [tickets, search, priorityFilter, projectFilter, myTickets, user]);

  const columnTickets = useMemo(() => {
    const map: Record<string, TicketWithMeta[]> = {};
    for (const col of columns) {
      map[col.slug] = filteredTickets
        .filter((t) => t.status === col.slug)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [filteredTickets, columns]);

  function handleDragStart(event: DragStartEvent) {
    draggingRef.current = true;
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTicket = filteredTickets.find((t) => t.id === active.id);
    if (!activeTicket) return;

    // Resolve target column from droppable ID or from the ticket being hovered
    const overColumn = columnSlugs.find((col) => col === over.id) ||
      columnTickets[Object.keys(columnTickets).find(slug => columnTickets[slug]?.some(t => t.id === over.id)) || '']?.[0]?.status;
    // Simpler: check which column contains the over ticket
    const resolvedColumn = overColumn || (() => {
      for (const slug of columnSlugs) {
        if (columnTickets[slug]?.some(t => t.id === over.id)) return slug;
      }
      return undefined;
    })();

    if (resolvedColumn && resolvedColumn !== activeTicket.status) {
      const colItems = (columnTickets[resolvedColumn] || []).filter(t => t.id !== active.id);
      const tempSort = colItems.length > 0 ? colItems[colItems.length - 1].sort_order + 1 : 1;
      const targetCol = columns.find(c => c.slug === resolvedColumn);
      const sourceCol = columns.find(c => c.slug === activeTicket.status);
      const edcOverride = targetCol?.is_terminal && !sourceCol?.is_terminal
        ? Math.floor(new Date(new Date().toISOString().split('T')[0]).getTime() / 1000)
        : !targetCol?.is_terminal && sourceCol?.is_terminal ? null : undefined;
      optimisticMoveTicket(activeTicket.id, resolvedColumn, tempSort, edcOverride);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    draggingRef.current = false;
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    // Read from store directly to avoid stale closure after optimistic updates
    const currentTickets = useStore.getState().tickets;
    const activeTicket = currentTickets.find((t) => t.id === active.id);
    if (!activeTicket) return;

    // Resolve target column
    let targetColumn = columnSlugs.find((col) => col === over.id);
    if (!targetColumn) {
      for (const slug of columnSlugs) {
        if (currentTickets.some(t => t.status === slug && t.id === over.id)) {
          targetColumn = slug;
          break;
        }
      }
    }
    if (!targetColumn) targetColumn = activeTicket.status;

    const colItems = currentTickets
      .filter((t) => t.status === targetColumn && t.id !== active.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const overIndex = over.id === targetColumn
      ? colItems.length
      : colItems.findIndex((t) => t.id === over.id);

    let newSortOrder: number;
    if (colItems.length === 0) {
      newSortOrder = 1;
    } else if (overIndex <= 0) {
      newSortOrder = colItems[0].sort_order / 2;
    } else if (overIndex >= colItems.length) {
      newSortOrder = colItems[colItems.length - 1].sort_order + 1;
    } else {
      newSortOrder = (colItems[overIndex - 1].sort_order + colItems[overIndex].sort_order) / 2;
    }

    optimisticMoveTicket(activeTicket.id, targetColumn, newSortOrder);

    try {
      await api.moveTicket(activeTicket.id, targetColumn, newSortOrder);
    } catch {
      fetchTickets();
    }
  }

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) : null;
  const hasFilters = search || priorityFilter.length > 0 || projectFilter || myTickets;

  const priorityBtnColors: Record<string, { active: string; dot: string }> = {
    p0: { active: 'bg-p0/15 text-p0 ring-p0/30', dot: 'bg-p0' },
    p1: { active: 'bg-p1/15 text-p1 ring-p1/30', dot: 'bg-p1' },
    p2: { active: 'bg-accent/15 text-accent ring-accent/30', dot: 'bg-accent' },
    p3: { active: 'bg-text-muted/15 text-text-secondary ring-text-muted/30', dot: 'bg-text-muted' },
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border-subtle flex-wrap">
        {/* Search */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-bg-elevated border border-border rounded-lg pl-8 pr-3 py-1.5 text-[13px] w-52"
          />
        </div>

        <div className="h-5 w-px bg-border-subtle" />

        {/* Priority filters */}
        <div className="flex gap-1">
          {(['p0', 'p1', 'p2', 'p3'] as const).map((p) => {
            const isActive = priorityFilter.includes(p);
            const colors = priorityBtnColors[p];
            return (
              <button
                key={p}
                onClick={() =>
                  setPriorityFilter((prev) =>
                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                  )
                }
                className={`text-[11px] px-2 py-1 rounded-md font-semibold uppercase transition-all ${
                  isActive
                    ? `${colors.active} ring-1`
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-border-subtle" />

        {/* Product filter */}
        <select
          value={projectFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-secondary"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* My tickets */}
        <button
          onClick={() => setMyTickets(!myTickets)}
          className={`text-[12px] px-2.5 py-1.5 rounded-lg font-medium transition-all ${
            myTickets
              ? 'bg-accent/12 text-accent ring-1 ring-accent/25'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
          }`}
        >
          My Tickets
        </button>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setPriorityFilter([]); setProductFilter(''); setMyTickets(false); }}
            className="text-[12px] text-text-muted hover:text-text-secondary ml-1"
          >
            All Tickets
          </button>
        )}

        <div className="ml-auto" />

        {/* View toggle */}
        <div className="flex bg-bg-elevated rounded-lg border border-border-subtle p-0.5">
          <button
            onClick={() => setViewMode('board')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            title="Board view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="21" x2="8" y2="3"/><line x1="16" y1="21" x2="16" y2="3"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            title="List view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Board or List */}
      {viewMode === 'board' ? (
        <div className="flex-1 overflow-x-auto px-4 py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 h-full min-w-min">
              {columns.map((col) => (
                <KanbanColumn
                  key={col.slug}
                  status={col.slug}
                  label={col.name}
                  color={col.color}
                  tickets={columnTickets[col.slug] || []}
                  onTicketClick={(t) => navigate(`/tickets/${t.id}`)}
                  isDraggable={canDrag}
                  ticketSize={user?.ticket_size || 'large'}
                  isTerminal={!!col.is_terminal}
                  isInitial={!!col.is_initial}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTicket ? (
                <TicketCard
                  ticket={activeTicket}
                  onClick={() => {}}
                  isDraggable={false}
                  size={user?.ticket_size || 'large'}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-4 py-4">
          <TicketListView
            tickets={filteredTickets}
            columns={columns}
            canEdit={canDrag}
            onTicketClick={(t) => navigate(`/tickets/${t.id}`)}
            onUpdate={() => fetchTickets()}
          />
        </div>
      )}

    </div>
  );
}
