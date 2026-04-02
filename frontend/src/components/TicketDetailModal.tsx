import { useEffect, useRef, useState } from 'react';
import { api, type TicketWithMeta, type Comment, type User, type Project, type Column } from '../lib/api';
import { useStore } from '../lib/store';

const priorityOptions = [
  { value: 'p0', label: 'P0 — Critical' },
  { value: 'p1', label: 'P1 — High' },
  { value: 'p2', label: 'P2 — Normal' },
  { value: 'p3', label: 'P3 — Low' },
];

function AssigneeSelect({ users, selectedIds, onChange }: { users: User[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = users.filter((u) => !selectedIds.includes(u.id) && u.name.toLowerCase().includes(search.toLowerCase()));
  const selected = users.filter((u) => selectedIds.includes(u.id));

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-medium">
              {u.name}
              <button type="button" onClick={() => onChange(selectedIds.filter(id => id !== u.id))}
                className="hover:text-danger ml-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={selected.length > 0 ? 'Add more...' : 'Search users...'}
        className="w-full bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[13px]"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-bg-surface border border-border rounded-lg shadow-lg shadow-black/30 max-h-36 overflow-y-auto">
          {filtered.map((u) => (
            <button key={u.id} type="button"
              onClick={() => { onChange([...selectedIds, u.id]); setSearch(''); }}
              className="w-full text-left px-2.5 py-1.5 text-[13px] text-text-secondary hover:bg-bg-elevated hover:text-text-primary">
              {u.name}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search && (
        <div className="absolute z-10 mt-1 w-full bg-bg-surface border border-border rounded-lg shadow-lg shadow-black/30 px-2.5 py-2 text-[12px] text-text-muted">
          No matching users
        </div>
      )}
    </div>
  );
}

interface Props {
  ticket: TicketWithMeta;
  onClose: () => void;
  onUpdate: () => void;
}

export function TicketDetailModal({ ticket, onClose, onUpdate }: Props) {
  const user = useStore((s) => s.user);
  const fetchTickets = useStore((s) => s.fetchTickets);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [devUsers, setDevUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusColumns, setStatusColumns] = useState<Column[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    title: ticket.title,
    description: ticket.description || '',
    priority: ticket.priority,
    status: ticket.status,
    assignee_ids: ticket.assignee_ids || [],
    edc: ticket.edc ? new Date(ticket.edc * 1000).toISOString().split('T')[0] : '',
    product_version: ticket.product_version || '',
    ticket_type: ticket.ticket_type || 'bug',
    product_id: ticket.product_id || '',
    tags: ticket.tags.join(', '),
  });

  const canEdit = user && ['dev', 'admin'].includes(user.role);
  const canComment = user && ['decision_maker', 'dev', 'admin'].includes(user.role);

  useEffect(() => {
    api.getComments(ticket.id).then(setComments).catch(() => {});
    api.getProjects().then(setProjects).catch(() => {});
    api.getColumns().then(setStatusColumns).catch(() => {});
    if (canEdit) {
      api.getUsers().catch(() => []).then((users) => {
        if (Array.isArray(users)) {
          setDevUsers(users.filter((u) => ['dev', 'admin'].includes(u.role)));
        }
      });
    }
  }, [ticket.id, canEdit]);

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const updates: any = {};
      if (form.title !== ticket.title) updates.title = form.title;
      if (form.description !== (ticket.description || '')) updates.description = form.description;
      if (form.priority !== ticket.priority) updates.priority = form.priority;
      const currentIds = (ticket.assignee_ids || []).slice().sort().join(',');
      const newIds = form.assignee_ids.slice().sort().join(',');
      if (currentIds !== newIds) updates.assignee_ids = form.assignee_ids;
      if (form.tags !== ticket.tags.join(', ')) updates.tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      if (form.product_version !== (ticket.product_version || '')) updates.product_version = form.product_version || null;
      if (form.ticket_type !== (ticket.ticket_type || 'bug')) updates.ticket_type = form.ticket_type;
      if (form.product_id !== (ticket.product_id || '')) updates.product_id = form.product_id || null;
      const edcUnix = form.edc ? Math.floor(new Date(form.edc).getTime() / 1000) : null;
      if (edcUnix !== ticket.edc) updates.edc = edcUnix;

      if (form.status !== ticket.status) {
        await api.moveTicket(ticket.id, form.status, ticket.sort_order);
      }
      if (Object.keys(updates).length > 0) {
        await api.updateTicket(ticket.id, updates);
      }
      setEditing(false);
      onUpdate();
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  const [commentError, setCommentError] = useState('');

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setCommentError('');
    try {
      const comment = await api.addComment(ticket.id, newComment);
      setComments([...comments, comment]);
      setNewComment('');
    } catch (e: any) {
      setCommentError(e.message || 'Failed to add comment.');
    }
  }

  const fieldLabel = "text-[11px] text-text-muted block mb-1 font-medium uppercase tracking-wider";
  const fieldInput = "w-full bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[13px]";
  const fieldValue = "text-[13px] text-text-secondary";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-bg-surface border-l border-border h-full overflow-y-auto shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-mono text-text-muted font-medium">PDO-{ticket.ticket_number}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                ticket.ticket_type === 'feature' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
              }`}>
                {ticket.ticket_type === 'feature' ? 'Feature' : 'Bug'}
              </span>
              {ticket.product_name && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${ticket.product_color}15`, color: ticket.product_color || undefined }}>
                  {ticket.product_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {canEdit && !editing && (
                <button onClick={() => setEditing(true)}
                  className="text-[12px] px-2.5 py-1 rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover font-medium">
                  Edit
                </button>
              )}
              <button onClick={onClose}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Title */}
          {editing ? (
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${fieldInput} text-lg font-semibold mb-5`} />
          ) : (
            <h2 className="text-lg font-semibold text-text-primary mb-5 leading-snug">{ticket.title}</h2>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-6 pb-6 border-b border-border-subtle">
            <div>
              <label className={fieldLabel}>Status</label>
              {editing ? (
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fieldInput}>
                  {statusColumns.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                </select>
              ) : (
                <span className={fieldValue}>{statusColumns.find(c => c.slug === ticket.status)?.name || ticket.status}</span>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Priority</label>
              {editing ? (
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={fieldInput}>
                  {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <span className={`${fieldValue} uppercase font-mono font-medium`}>{ticket.priority}</span>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Assignees</label>
              {editing ? (
                <AssigneeSelect
                  users={devUsers}
                  selectedIds={form.assignee_ids}
                  onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
                />
              ) : (
                <span className={fieldValue}>{ticket.assignee_names.length > 0 ? ticket.assignee_names.join(', ') : 'Unassigned'}</span>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Est. Completion</label>
              {canEdit ? (
                <input type="date" value={form.edc}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setForm({ ...form, edc: val });
                    if (!editing) {
                      const edcUnix = val ? Math.floor(new Date(val).getTime() / 1000) : null;
                      try {
                        await api.updateTicket(ticket.id, { edc: edcUnix });
                        fetchTickets();
                      } catch (e: any) {
                        setSaveError('EDC save failed: ' + e.message);
                      }
                    }
                  }}
                  className={fieldInput} />
              ) : (
                <span className={fieldValue}>{ticket.edc ? new Date(ticket.edc * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—'}</span>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Project</label>
              {editing ? (
                <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className={fieldInput}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <span className={fieldValue}>
                  {ticket.product_name ? (
                    <span style={{ color: ticket.product_color || undefined }}>{ticket.product_name}</span>
                  ) : 'None'}
                </span>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Type</label>
              {editing ? (
                <select value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value as 'bug' | 'feature' })} className={fieldInput}>
                  <option value="bug">Bug</option>
                  <option value="feature">Feature Request</option>
                </select>
              ) : canEdit ? (
                <button
                  className={`text-[13px] font-medium px-2 py-0.5 rounded cursor-pointer hover:opacity-80 ${
                    ticket.ticket_type === 'feature' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}
                  title={`Click to switch to ${ticket.ticket_type === 'feature' ? 'Bug' : 'Feature'}`}
                  onClick={async () => {
                    const newType = ticket.ticket_type === 'feature' ? 'bug' : 'feature';
                    try {
                      await api.updateTicket(ticket.id, { ticket_type: newType });
                      onUpdate();
                    } catch (e: any) {
                      setSaveError('Type change failed: ' + e.message);
                    }
                  }}
                >
                  {ticket.ticket_type === 'feature' ? 'Feature' : 'Bug'}
                  <svg className="inline ml-1 opacity-50" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/>
                  </svg>
                </button>
              ) : (
                <span className={`${fieldValue} ${ticket.ticket_type === 'feature' ? 'text-success' : 'text-danger'}`}>
                  {ticket.ticket_type === 'feature' ? 'Feature' : 'Bug'}
                </span>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Version</label>
              {editing ? (
                <input value={form.product_version} onChange={(e) => setForm({ ...form, product_version: e.target.value })} placeholder="e.g. 2.4.1" className={fieldInput} />
              ) : (
                <span className={`${fieldValue} font-mono`}>{ticket.product_version || '—'}</span>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Tags</label>
              {editing ? (
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Comma-separated" className={fieldInput} />
              ) : (
                <div className="flex gap-1 flex-wrap">
                  {ticket.tags.map((tag) => (
                    <span key={tag} className="text-[11px] px-1.5 py-0.5 bg-bg-elevated rounded text-text-muted">{tag}</span>
                  ))}
                  {ticket.tags.length === 0 && <span className={fieldValue}>—</span>}
                </div>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Submitted By</label>
              <span className={fieldValue}>{ticket.submitter_name || '—'}</span>
            </div>
            <div>
              <label className={fieldLabel}>Submitted</label>
              <span className={fieldValue}>{new Date(ticket.created_at * 1000).toLocaleString()}</span>
            </div>
          </div>

          {/* Save / Cancel */}
          {editing && (
            <div className="mb-6">
              {saveError && (
                <div className="bg-danger/8 border border-danger/20 rounded-lg p-2.5 mb-3">
                  <p className="text-danger text-xs">{saveError}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-1.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => { setEditing(false); setSaveError(''); }} disabled={saving}
                    className="px-4 py-1.5 bg-bg-elevated border border-border text-text-secondary rounded-lg text-[13px] hover:text-text-primary hover:bg-bg-hover disabled:opacity-50">
                    Cancel
                  </button>
                </div>
                {user?.role === 'admin' && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ticket PDO-${ticket.ticket_number}? This cannot be undone.`)) return;
                      try { await api.deleteTicket(ticket.id); onUpdate(); } catch (e: any) { setSaveError(e.message); }
                    }}
                    className="text-[12px] text-danger/60 hover:text-danger font-medium">
                    Delete Ticket
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-6 pb-6 border-b border-border-subtle">
            <label className={`${fieldLabel} mb-2`}>Description</label>
            {editing ? (
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={6}
                className={`${fieldInput} resize-y`} />
            ) : (
              <div className="text-[13px] text-text-secondary whitespace-pre-wrap leading-relaxed">
                {ticket.description || 'No description.'}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <h3 className={`${fieldLabel} mb-3`}>Comments <span className="text-text-muted">({comments.length})</span></h3>
            <div className="space-y-2.5 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-bg-elevated rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center text-[9px] text-accent font-semibold">
                      {comment.author_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </div>
                    <span className="text-[12px] font-medium text-text-primary">{comment.author_name}</span>
                    <span className="text-[10px] text-text-muted">
                      {new Date(comment.created_at * 1000).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[13px] text-text-secondary whitespace-pre-wrap pl-7">{comment.body}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-[13px] text-text-muted">No comments yet.</p>
              )}
            </div>

            {canComment && (
              <div>
                {commentError && (
                  <div className="bg-danger/8 border border-danger/20 rounded-lg p-2 mb-2">
                    <p className="text-danger text-[11px]">{commentError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Write a comment..."
                    className={`flex-1 ${fieldInput}`}
                  />
                  <button onClick={handleAddComment}
                    className="px-3.5 py-1.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover">
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
