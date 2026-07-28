import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { api, type TicketWithMeta, type Project, type Column, type Milestone } from '../lib/api';
import { KanbanColumn } from '../components/KanbanColumn';
import { TicketCard } from '../components/TicketCard';
import { TicketListView } from '../components/TicketListView';
import { PageHeader } from '../components/PageHeader';

export function BoardPage() {
  const user = useStore((s) => s.user);
  const tickets = useStore((s) => s.tickets);
  const loading = useStore((s) => s.loading);
  const loadError = useStore((s) => s.error);
  const lastSync = useStore((s) => s.lastSync);
  const fetchTickets = useStore((s) => s.fetchTickets);
  const optimisticMoveTicket = useStore((s) => s.optimisticMoveTicket);

  const navigate = useNavigate();
  const [columns, setColumns] = useState<Column[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Filters live in the URL so a board view can be linked to a colleague, and so
  // opening a ticket and coming back does not silently reset them.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const priorityFilter = useMemo(
    () => (searchParams.get('priority') || '').split(',').filter(Boolean),
    [searchParams]
  );
  const projectFilter = searchParams.get('project') || '';
  const milestoneFilter = searchParams.get('milestone') || '';
  const myTickets = searchParams.get('mine') === '1';
  const viewMode: 'board' | 'list' = searchParams.get('view') === 'list' ? 'list' : 'board';

  const setParam = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['q', 'priority', 'project', 'milestone', 'mine'].forEach((k) => next.delete(k));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // The input is kept local so typing stays responsive, then debounced into the
  // URL. The first effect picks up changes made elsewhere (clear filters, Back).
  const [searchDraft, setSearchDraft] = useState(search);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setSearchDraft(search); }, [search]);
  useEffect(() => {
    if (searchDraft === search) return;
    const t = setTimeout(() => setParam('q', searchDraft), 250);
    return () => clearTimeout(t);
  }, [searchDraft, search, setParam]);

  const canDrag = user ? ['decision_maker', 'dev', 'admin'].includes(user.role) : false;
  const canCreate = !!user && ['decision_maker', 'dev', 'admin'].includes(user.role);

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
    api.getMilestones({ status: 'open' }).then(setMilestones).catch(() => {});

    const interval = setInterval(() => {
      if (!draggingRef.current) fetchTickets();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  // Keyboard shortcuts. Ignored while typing so they never eat real input.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (typing) {
        if (e.key === 'Escape' && el === searchRef.current) {
          setSearchDraft('');
          setParam('q', '');
          searchRef.current?.blur();
        }
        return;
      }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === 'n' && canCreate) { e.preventDefault(); navigate('/submit'); return; }
      if (e.key === 'b') { setParam('view', ''); return; }
      if (e.key === 'l') { setParam('view', 'list'); return; }
      if (e.key === 'r') { e.preventDefault(); fetchTickets(); return; }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canCreate, navigate, setParam, fetchTickets]);

  const filteredTickets = useMemo(() => {
    let result = tickets;
    if (search) {
      const q = search.toLowerCase();
      // Also match the ticket number, with or without the PDO- prefix, so a
      // reference from a chat message or an email can be pasted straight in.
      const numeric = q.replace(/^pdo-?/, '');
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q)
          || t.description?.toLowerCase().includes(q)
          || (!!numeric && String(t.ticket_number) === numeric)
      );
    }
    if (priorityFilter.length > 0) {
      result = result.filter((t) => priorityFilter.includes(t.priority));
    }
    if (projectFilter) {
      result = result.filter((t) => t.product_id === projectFilter);
    }
    if (milestoneFilter) {
      result = result.filter((t) => t.milestone_id === milestoneFilter);
    }
    if (myTickets && user) {
      result = result.filter((t) => t.assignee_ids.includes(user.id));
    }
    return result;
  }, [tickets, search, priorityFilter, projectFilter, milestoneFilter, myTickets, user]);

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
  const hasFilters = !!(search || priorityFilter.length > 0 || projectFilter || milestoneFilter || myTickets);
  const firstLoad = loading && tickets.length === 0;

  const priorityBtnColors: Record<string, { active: string; dot: string }> = {
    p0: { active: 'bg-p0/15 text-p0 ring-p0/30', dot: 'bg-p0' },
    p1: { active: 'bg-p1/15 text-p1 ring-p1/30', dot: 'bg-p1' },
    p2: { active: 'bg-accent/15 text-accent ring-accent/30', dot: 'bg-accent' },
    p3: { active: 'bg-text-muted/15 text-text-secondary ring-text-muted/30', dot: 'bg-text-muted' },
  };

  function togglePriority(p: string) {
    const next = priorityFilter.includes(p)
      ? priorityFilter.filter((x) => x !== p)
      : [...priorityFilter, p];
    setParam('priority', next.join(','));
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Board"
        actions={
          <>
            {/* Result count, so a filter that hides everything is legible */}
            {hasFilters && !firstLoad && (
              <span className="text-[12px] text-text-muted tabular-nums">
                {filteredTickets.length} of {tickets.length}
              </span>
            )}

            <LiveIndicator lastSync={lastSync} loading={loading} onRefresh={() => fetchTickets()} />

            {/* New Ticket */}
            {canCreate && (
              <button
                onClick={() => navigate('/submit')}
                title="New ticket (n)"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-[12px] font-medium hover:bg-accent-hover transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Ticket
              </button>
            )}

            {/* View toggle. Two unlabelled icons read as a pair of buttons
                rather than a view switcher, so the list view went unfound. */}
            <div className="flex bg-bg-elevated rounded-lg border border-border-subtle p-0.5" role="group" aria-label="View">
              <button
                onClick={() => setParam('view', '')}
                aria-pressed={viewMode === 'board'}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${viewMode === 'board' ? 'bg-bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                title="Board view (b)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="21" x2="8" y2="3"/><line x1="16" y1="21" x2="16" y2="3"/>
                </svg>
                Board
              </button>
              <button
                onClick={() => setParam('view', 'list')}
                aria-pressed={viewMode === 'list'}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${viewMode === 'list' ? 'bg-bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                title="List view (l)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                List
              </button>
            </div>
          </>
        }
      >
        {/* Search */}
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchRef}
            type="text"
            aria-label="Search tickets"
            placeholder="Search..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="bg-bg-elevated border border-border rounded-lg pl-8 pr-8 py-1.5 text-[13px] w-52"
          />
          {!searchDraft && (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted border border-border-subtle rounded px-1 pointer-events-none">
              /
            </kbd>
          )}
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
                aria-pressed={isActive}
                onClick={() => togglePriority(p)}
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
          aria-label="Filter by project"
          onChange={(e) => setParam('project', e.target.value)}
          className="bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-secondary"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Milestone filter */}
        <select
          value={milestoneFilter}
          aria-label="Filter by milestone"
          onChange={(e) => setParam('milestone', e.target.value)}
          className="bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-secondary"
        >
          <option value="">All Milestones</option>
          {milestones
            .filter(m => !projectFilter || m.project_id === projectFilter)
            .map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
        </select>

        {/* My tickets */}
        {user && (
          <button
            aria-pressed={myTickets}
            onClick={() => setParam('mine', myTickets ? '' : '1')}
            className={`text-[12px] px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              myTickets
                ? 'bg-accent/12 text-accent ring-1 ring-accent/25'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            }`}
          >
            My Tickets
          </button>
        )}

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-[12px] text-text-muted hover:text-text-secondary ml-1"
          >
            All Tickets
          </button>
        )}
      </PageHeader>

      {/* A failed refresh used to be completely silent. */}
      {loadError && (
        <div className="flex items-center gap-3 px-5 py-2 bg-danger/8 border-b border-danger/20">
          <p className="text-danger text-[12px]">{loadError}</p>
          <button onClick={() => fetchTickets()} className="text-[12px] text-danger font-medium hover:underline">
            Retry
          </button>
        </div>
      )}

      {firstLoad ? (
        <BoardSkeleton />
      ) : filteredTickets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className="text-text-muted opacity-40 mb-3">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          {hasFilters ? (
            <>
              <p className="text-[13px] text-text-secondary">No tickets match these filters.</p>
              <button onClick={clearFilters} className="text-[13px] text-accent hover:text-accent-hover font-medium mt-1.5">
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] text-text-secondary">The board is empty.</p>
              {canCreate ? (
                <button onClick={() => navigate('/submit')} className="text-[13px] text-accent hover:text-accent-hover font-medium mt-1.5">
                  Submit the first ticket
                </button>
              ) : (
                <p className="text-[12px] text-text-muted mt-1">Nothing has been submitted yet.</p>
              )}
            </>
          )}
        </div>
      ) : viewMode === 'board' ? (
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

/**
 * The board silently refetches every 30s. Without this you cannot tell whether
 * what you are looking at is current, stale, or the result of a failed poll -
 * and there was no way to ask for fresh data short of reloading the page.
 */
function LiveIndicator({ lastSync, loading, onRefresh }: { lastSync: number | null; loading: boolean; onRefresh: () => void }) {
  // Deliberately a clock time, not "2m ago": a relative label has to be
  // recomputed on a timer to stay honest, and this one cannot go stale.
  const stamp = lastSync
    ? new Date(lastSync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      title={stamp ? `Auto-refreshes every 30s. Last updated ${stamp}. Click to refresh now (r).` : 'Refresh (r)'}
      aria-label="Refresh tickets"
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-60"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${loading ? 'bg-accent animate-pulse' : 'bg-success'}`} />
      <span className="tabular-nums">{loading ? 'Syncing' : stamp || 'Live'}</span>
    </button>
  );
}

/** Matches the shape of the real board so the first paint does not jump. */
function BoardSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-4 py-4" aria-busy="true" aria-label="Loading tickets">
      <div className="flex gap-3 h-full">
        {[0, 1, 2, 3, 4].map((col) => (
          <div key={col} className="min-w-[272px] w-[272px] shrink-0">
            <div className="flex items-center gap-2 px-3 py-2.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-bg-elevated" />
              <div className="h-3 w-20 rounded bg-bg-elevated" />
            </div>
            <div className="flex flex-col gap-1.5 px-1.5">
              {Array.from({ length: 3 - (col % 3) }).map((_, i) => (
                <div key={i} className="h-[86px] rounded-lg bg-bg-surface border border-l-[3px] border-border-subtle animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
