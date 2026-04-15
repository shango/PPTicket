import { useState, useEffect, useMemo } from 'react';
import { api, type TicketWithMeta, type Column } from '../lib/api';

export function ArchivePage() {
  const [tickets, setTickets] = useState<TicketWithMeta[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  async function fetchArchived() {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        api.getTickets({ archived: '1' }),
        api.getColumns(),
      ]);
      setTickets(t);
      setColumns(c);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { fetchArchived(); }, []);

  const statusNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    columns.forEach(c => { map[c.slug] = c.name; });
    return map;
  }, [columns]);

  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    columns.forEach(c => { map[c.slug] = c.color; });
    return map;
  }, [columns]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === tickets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tickets.map(t => t.id)));
    }
  }

  async function handleRestore() {
    if (selected.size === 0) return;
    setRestoring(true);
    try {
      await api.unarchiveTickets(Array.from(selected));
      setSelected(new Set());
      await fetchArchived();
    } catch { /* ignore */ }
    setRestoring(false);
  }

  return (
    <div className="h-full flex flex-col px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Archived Tickets</h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} in archive
          </p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            {restoring ? 'Restoring...' : `Restore ${selected.size} to To Do`}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-text-muted text-[13px]">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
              <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
            </svg>
            <p className="text-[13px]">No archived tickets</p>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-bg-surface border-b border-border">
              <tr>
                <th className="px-3 py-2.5 w-[40px]">
                  <input
                    type="checkbox"
                    checked={selected.size === tickets.length && tickets.length > 0}
                    onChange={toggleAll}
                    className="accent-accent"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[70px]">#</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Title</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[120px]">Last Status</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[70px]">Priority</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[100px]">Product</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[110px]">Done</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[110px]">Archived</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={`border-b border-border-subtle transition-colors cursor-pointer ${
                    selected.has(ticket.id)
                      ? 'bg-accent/[0.06]'
                      : 'hover:bg-bg-elevated/50'
                  }`}
                  onClick={() => toggleSelect(ticket.id)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(ticket.id)}
                      onChange={() => toggleSelect(ticket.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-accent"
                    />
                  </td>
                  <td className="px-3 py-2 text-[12px] text-text-muted font-mono">
                    {ticket.ticket_number}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-[13px] font-medium text-text-primary leading-snug line-clamp-1">
                      {ticket.title}
                    </div>
                    {ticket.description && (
                      <p className="text-[11px] text-text-muted font-normal line-clamp-1 mt-0.5">{ticket.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                      style={{ backgroundColor: `${statusColorMap[ticket.status]}15`, color: statusColorMap[ticket.status] }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColorMap[ticket.status] }} />
                      {statusNameMap[ticket.status] || ticket.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] font-semibold uppercase ${
                      ticket.priority === 'p0' ? 'text-p0' :
                      ticket.priority === 'p1' ? 'text-p1' :
                      ticket.priority === 'p2' ? 'text-accent' : 'text-text-muted'
                    }`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {ticket.product_abbreviation ? (
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${ticket.product_color}15`, color: ticket.product_color || undefined }}
                      >
                        {ticket.product_abbreviation}
                      </span>
                    ) : (
                      <span className="text-[12px] text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-success">
                    {ticket.edc
                      ? new Date(ticket.edc * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-text-muted">
                    {ticket.archived_at
                      ? new Date(ticket.archived_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
