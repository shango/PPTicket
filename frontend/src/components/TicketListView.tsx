import { useState, useEffect, useRef, useMemo } from 'react';
import { api, type TicketWithMeta, type User, type Column } from '../lib/api';

interface Props {
  tickets: TicketWithMeta[];
  columns: Column[];
  canEdit: boolean;
  onTicketClick: (ticket: TicketWithMeta) => void;
  onUpdate: () => void;
}

type SortKey = 'status' | 'priority' | 'title' | 'assignees' | 'edc' | 'product' | 'created_at';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

export function TicketListView({ tickets, columns, canEdit, onTicketClick, onUpdate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [devUsers, setDevUsers] = useState<User[]>([]);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (canEdit) {
      api.getUsers().catch(() => []).then((users) => {
        if (Array.isArray(users)) setDevUsers(users.filter(u => ['decision_maker', 'dev', 'admin'].includes(u.role)));
      });
    }
  }, [canEdit]);

  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus();
  }, [editingCell]);

  const columnOrder = useMemo(() => {
    const map: Record<string, number> = {};
    columns.forEach((c, i) => { map[c.slug] = i; });
    return map;
  }, [columns]);

  const sorted = useMemo(() => {
    const arr = [...tickets];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'status': cmp = (columnOrder[a.status] ?? 99) - (columnOrder[b.status] ?? 99); break;
        case 'priority': cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9); break;
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'assignees': cmp = (a.assignee_names[0] || '').localeCompare(b.assignee_names[0] || ''); break;
        case 'edc': cmp = (a.edc || 0) - (b.edc || 0); break;
        case 'product': cmp = (a.product_name || '').localeCompare(b.product_name || ''); break;
        case 'created_at': cmp = a.created_at - b.created_at; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [tickets, sortKey, sortDir, columnOrder]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function startEdit(id: string, field: string, value: string) {
    if (!canEdit) return;
    setEditingCell({ id, field });
    setEditValue(value);
  }

  async function saveEdit(ticket: TicketWithMeta) {
    if (!editingCell) return;
    const { field } = editingCell;
    try {
      if (field === 'title' && editValue.trim() && editValue !== ticket.title) {
        await api.updateTicket(ticket.id, { title: editValue.trim() });
        onUpdate();
      } else if (field === 'description' && editValue !== (ticket.description || '')) {
        await api.updateTicket(ticket.id, { description: editValue });
        onUpdate();
      } else if (field === 'edc') {
        const edcUnix = editValue ? Math.floor(new Date(editValue).getTime() / 1000) : null;
        if (edcUnix !== ticket.edc) {
          await api.updateTicket(ticket.id, { edc: edcUnix });
          onUpdate();
        }
      }
    } catch { /* ignore */ }
    setEditingCell(null);
  }

  async function toggleAssignee(ticketId: string, currentIds: string[], userId: string) {
    const newIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId];
    try {
      await api.updateTicket(ticketId, { assignee_ids: newIds });
      onUpdate();
    } catch { /* ignore */ }
  }

  function SortHeader({ label, sortKeyName, className }: { label: string; sortKeyName: SortKey; className?: string }) {
    const active = sortKey === sortKeyName;
    return (
      <th
        className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-text-primary ${
          active ? 'text-accent' : 'text-text-muted'
        } ${className || ''}`}
        onClick={() => handleSort(sortKeyName)}
      >
        <span className="flex items-center gap-1">
          {label}
          {active && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              {sortDir === 'asc' ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
            </svg>
          )}
        </span>
      </th>
    );
  }

  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    columns.forEach(c => { map[c.slug] = c.color; });
    return map;
  }, [columns]);

  const statusNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    columns.forEach(c => { map[c.slug] = c.name; });
    return map;
  }, [columns]);

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse min-w-[900px]">
        <thead className="sticky top-0 z-10 bg-bg-surface border-b border-border">
          <tr>
            <SortHeader label="Status" sortKeyName="status" className="w-[120px]" />
            <SortHeader label="Priority" sortKeyName="priority" className="w-[70px]" />
            <SortHeader label="Title" sortKeyName="title" />
            <SortHeader label="Assignees" sortKeyName="assignees" className="w-[160px]" />
            <SortHeader label="EDC" sortKeyName="edc" className="w-[110px]" />
            <SortHeader label="Product" sortKeyName="product" className="w-[100px]" />
            <SortHeader label="Created" sortKeyName="created_at" className="w-[90px]" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((ticket) => {
            const col = columns.find(c => c.slug === ticket.status);
            const isTerminal = col?.is_terminal;
            const missingEdc = !ticket.edc && !col?.is_initial && !isTerminal;
            return (
              <tr
                key={ticket.id}
                className={`border-b hover:transition-colors group ${
                  missingEdc
                    ? 'bg-danger/[0.04] border-danger/20 hover:bg-danger/[0.08]'
                    : 'border-border-subtle hover:bg-bg-elevated/50'
                }`}
                style={{ borderLeftWidth: 3, borderLeftColor: ticket.product_color || 'transparent' }}
              >
                {/* Status */}
                <td className="px-3 py-2" onClick={() => onTicketClick(ticket)}>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                    style={{ backgroundColor: `${statusColorMap[ticket.status]}15`, color: statusColorMap[ticket.status] }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColorMap[ticket.status] }} />
                    {statusNameMap[ticket.status] || ticket.status}
                  </span>
                </td>

                {/* Priority */}
                <td className="px-3 py-2" onClick={() => onTicketClick(ticket)}>
                  <span className={`text-[11px] font-semibold uppercase ${
                    ticket.priority === 'p0' ? 'text-p0' :
                    ticket.priority === 'p1' ? 'text-p1' :
                    ticket.priority === 'p2' ? 'text-accent' : 'text-text-muted'
                  }`}>
                    {ticket.priority}
                  </span>
                </td>

                {/* Title (inline editable) */}
                <td className="px-3 py-2">
                  {editingCell?.id === ticket.id && editingCell.field === 'title' ? (
                    <input
                      ref={inputRef as React.Ref<HTMLInputElement>}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(ticket)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(ticket); if (e.key === 'Escape') setEditingCell(null); }}
                      className="w-full bg-bg-elevated border border-accent/40 rounded px-2 py-1 text-[13px]"
                    />
                  ) : (
                    <div
                      onClick={() => canEdit ? startEdit(ticket.id, 'title', ticket.title) : onTicketClick(ticket)}
                      className={`text-[13px] font-medium text-text-primary leading-snug ${canEdit ? 'cursor-text hover:bg-bg-elevated/60 rounded px-2 py-1 -mx-2 -my-1' : 'cursor-pointer'}`}
                    >
                      {ticket.title}
                      {ticket.description && (
                        <p className="text-[11px] text-text-muted font-normal line-clamp-1 mt-0.5">{ticket.description}</p>
                      )}
                    </div>
                  )}
                </td>

                {/* Assignees (inline editable dropdown) */}
                <td className="px-3 py-2">
                  {canEdit ? (
                    <AssigneeCell
                      ticket={ticket}
                      devUsers={devUsers}
                      onToggle={(userId) => toggleAssignee(ticket.id, ticket.assignee_ids, userId)}
                    />
                  ) : (
                    <span className="text-[12px] text-text-secondary">
                      {ticket.assignee_names.join(', ') || '—'}
                    </span>
                  )}
                </td>

                {/* EDC (inline editable) */}
                <td className="px-3 py-2">
                  {editingCell?.id === ticket.id && editingCell.field === 'edc' ? (
                    <input
                      ref={inputRef as React.Ref<HTMLInputElement>}
                      type="date"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(ticket)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(ticket); if (e.key === 'Escape') setEditingCell(null); }}
                      className="bg-bg-elevated border border-accent/40 rounded px-2 py-1 text-[12px]"
                    />
                  ) : (
                    <span
                      onClick={() => canEdit ? startEdit(ticket.id, 'edc', ticket.edc ? new Date(ticket.edc * 1000).toISOString().split('T')[0] : '') : undefined}
                      className={`text-[12px] ${canEdit ? 'cursor-text hover:bg-bg-elevated/60 rounded px-2 py-1 -mx-2 -my-1' : ''} ${
                        isTerminal ? 'text-success' :
                        ticket.edc && ticket.edc * 1000 < Date.now() ? 'text-danger' : 'text-text-muted'
                      }`}
                    >
                      {ticket.edc
                        ? `${isTerminal ? 'Done' : ''} ${new Date(ticket.edc * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
                        : missingEdc ? <span className="text-danger font-semibold">No EDC</span> : '—'}
                    </span>
                  )}
                </td>

                {/* Product */}
                <td className="px-3 py-2" onClick={() => onTicketClick(ticket)}>
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

                {/* Created */}
                <td className="px-3 py-2 text-[12px] text-text-muted" onClick={() => onTicketClick(ticket)}>
                  {new Date(ticket.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-text-muted text-[13px]">No tickets found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AssigneeCell({ ticket, devUsers, onToggle }: { ticket: TicketWithMeta; devUsers: User[]; onToggle: (userId: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(!open)}
        className="text-[12px] text-text-secondary cursor-pointer hover:bg-bg-elevated/60 rounded px-2 py-1 -mx-2 -my-1 min-h-[24px] flex items-center flex-wrap gap-1"
      >
        {ticket.assignee_names.length > 0 ? (
          ticket.assignee_names.map((name, i) => (
            <span key={i} className="bg-accent/10 text-accent text-[11px] px-1.5 py-px rounded font-medium">{name.split(' ')[0]}</span>
          ))
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-bg-surface border border-border rounded-lg shadow-xl shadow-black/30 py-1 z-30 max-h-48 overflow-y-auto">
          {devUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => onToggle(u.id)}
              className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-hover transition-colors flex items-center gap-2"
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                ticket.assignee_ids.includes(u.id) ? 'bg-accent border-accent' : 'border-border'
              }`}>
                {ticket.assignee_ids.includes(u.id) && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              <span className="text-text-primary">{u.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
