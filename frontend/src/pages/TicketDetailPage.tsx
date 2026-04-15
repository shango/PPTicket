import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getToken, type TicketWithMeta, type Comment, type User, type Project, type Column, type SubTask, type Attachment } from '../lib/api';
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

function renderCommentBody(body: string) {
  const parts = body.split(/(@[\w][\w\s]*?)(?=\s@|\s*$|[.!?,;:])/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      return <span key={i} className="text-accent font-medium">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.user);
  const fetchTickets = useStore((s) => s.fetchTickets);

  const [ticket, setTicket] = useState<TicketWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [devUsers, setDevUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusColumns, setStatusColumns] = useState<Column[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: '',
    status: '',
    assignee_ids: [] as string[],
    edc: '',
    product_version: '',
    ticket_type: 'bug' as 'bug' | 'feature',
    product_id: '',
    tags: '',
  });

  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState({ title: '', description: '', due_date: '' });
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editSubtaskForm, setEditSubtaskForm] = useState({ title: '', description: '', due_date: '' });
  const [subtaskError, setSubtaskError] = useState('');
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const [subtaskAttachments, setSubtaskAttachments] = useState<Record<string, Attachment[]>>({});
  const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);

  const canEdit = currentUser && ['dev', 'admin'].includes(currentUser.role);
  const canComment = currentUser && ['decision_maker', 'dev', 'admin'].includes(currentUser.role);
  const canManageSubtasks = currentUser && ['decision_maker', 'dev', 'admin'].includes(currentUser.role);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getTicket(id)
      .then((t) => {
        setTicket(t);
        setForm({
          title: t.title,
          description: t.description || '',
          priority: t.priority,
          status: t.status,
          assignee_ids: t.assignee_ids || [],
          edc: t.edc ? new Date(t.edc * 1000).toISOString().split('T')[0] : '',
          product_version: t.product_version || '',
          ticket_type: t.ticket_type || 'bug',
          product_id: t.product_id || '',
          tags: t.tags.join(', '),
        });
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });

    api.getComments(id).then(setComments).catch(() => {});
    api.getSubtasks(id).then(setSubtasks).catch(() => {});
    api.getProjects().then(setProjects).catch(() => {});
    api.getColumns().then(setStatusColumns).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (canEdit) {
      api.getUsers().catch(() => []).then((users) => {
        if (Array.isArray(users)) {
          setDevUsers(users.filter((u) => ['decision_maker', 'dev', 'admin'].includes(u.role)));
        }
      });
    }
  }, [canEdit]);

  function handleBack() {
    navigate('/board');
  }

  async function refreshTicket() {
    if (!id) return;
    try {
      const t = await api.getTicket(id);
      setTicket(t);
      setForm({
        title: t.title,
        description: t.description || '',
        priority: t.priority,
        status: t.status,
        assignee_ids: t.assignee_ids || [],
        edc: t.edc ? new Date(t.edc * 1000).toISOString().split('T')[0] : '',
        product_version: t.product_version || '',
        ticket_type: t.ticket_type || 'bug',
        product_id: t.product_id || '',
        tags: t.tags.join(', '),
      });
    } catch { /* ignore */ }
    fetchTickets();
  }

  async function handleSave() {
    if (!ticket) return;
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

      const statusChanged = form.status !== ticket.status;
      const targetColTerminal = statusColumns.find(c => c.slug === form.status)?.is_terminal;
      const sourceColTerminal = statusColumns.find(c => c.slug === ticket.status)?.is_terminal;
      const moveHandlesEdc = statusChanged && (targetColTerminal !== sourceColTerminal);
      if (!moveHandlesEdc && edcUnix !== ticket.edc) updates.edc = edcUnix;

      if (statusChanged) {
        await api.moveTicket(ticket.id, form.status, ticket.sort_order);
      }
      if (Object.keys(updates).length > 0) {
        await api.updateTicket(ticket.id, updates);
      }
      setEditing(false);
      await refreshTicket();
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  const [commentError, setCommentError] = useState('');
  const [mentionUsers, setMentionUsers] = useState<{ id: string; name: string }[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.getUserNames().then(setMentionUsers).catch(() => {});
  }, []);

  const mentionFiltered = mentionUsers.filter(u =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== currentUser?.id
  );

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setNewComment(val);
    const pos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, pos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex >= 0 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ' || textBeforeCursor[atIndex - 1] === '\n')) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes('\n')) {
        setMentionQuery(query);
        setMentionStartPos(atIndex);
        setMentionOpen(true);
        setMentionIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  }

  function insertMention(name: string) {
    const before = newComment.slice(0, mentionStartPos);
    const after = newComment.slice(commentRef.current?.selectionStart || mentionStartPos + mentionQuery.length + 1);
    const updated = `${before}@${name} ${after}`;
    setNewComment(updated);
    setMentionOpen(false);
    setTimeout(() => {
      const pos = mentionStartPos + name.length + 2;
      commentRef.current?.focus();
      commentRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen && mentionFiltered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionFiltered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionFiltered[mentionIndex].name); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) { e.preventDefault(); handleAddComment(); }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !ticket) return;
    setCommentError('');
    try {
      const comment = await api.addComment(ticket.id, newComment);
      setComments([...comments, comment]);
      setNewComment('');
    } catch (e: any) {
      setCommentError(e.message || 'Failed to add comment.');
    }
  }

  async function handleAddSubtask() {
    if (!subtaskForm.title.trim() || !ticket) return;
    setSubtaskError('');
    try {
      const due_date = subtaskForm.due_date ? Math.floor(new Date(subtaskForm.due_date).getTime() / 1000) : null;
      const st = await api.createSubtask(ticket.id, {
        title: subtaskForm.title,
        description: subtaskForm.description || undefined,
        due_date,
      });
      setSubtasks([...subtasks, st]);
      setSubtaskForm({ title: '', description: '', due_date: '' });
      setShowAddSubtask(false);
    } catch (e: any) {
      setSubtaskError(e.message || 'Failed to add subtask.');
    }
  }

  async function handleToggleSubtask(st: SubTask) {
    if (!ticket) return;
    try {
      const updated = await api.updateSubtask(ticket.id, st.id, { completed: !st.completed });
      setSubtasks(subtasks.map(s => s.id === st.id ? updated : s));
    } catch { /* ignore */ }
  }

  async function handleSaveSubtask(subtaskId: string) {
    if (!ticket) return;
    setSubtaskError('');
    try {
      const due_date = editSubtaskForm.due_date ? Math.floor(new Date(editSubtaskForm.due_date).getTime() / 1000) : null;
      const updated = await api.updateSubtask(ticket.id, subtaskId, {
        title: editSubtaskForm.title,
        description: editSubtaskForm.description || null,
        due_date,
      });
      setSubtasks(subtasks.map(s => s.id === subtaskId ? updated : s));
      setEditingSubtaskId(null);
    } catch (e: any) {
      setSubtaskError(e.message || 'Failed to update subtask.');
    }
  }

  async function handleDeleteSubtask(subtaskId: string) {
    if (!ticket || !confirm('Delete this subtask?')) return;
    try {
      await api.deleteSubtask(ticket.id, subtaskId);
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    } catch { /* ignore */ }
  }

  async function loadSubtaskAttachments(subtaskId: string) {
    if (!ticket) return;
    try {
      const atts = await api.getSubtaskAttachments(ticket.id, subtaskId);
      setSubtaskAttachments(prev => ({ ...prev, [subtaskId]: atts }));
    } catch { /* ignore */ }
  }

  async function handleSubtaskFileUpload(subtaskId: string, file: File) {
    if (!ticket) return;
    if (file.size > 10 * 1024 * 1024) { setSubtaskError('Max file size is 10MB.'); return; }
    setUploadingSubtaskId(subtaskId);
    try {
      const { key, upload_url } = await api.getSubtaskUploadUrl(ticket.id, subtaskId, file.name, file.type);
      const token = getToken();
      const BASE = import.meta.env.VITE_API_BASE_URL || '';
      const IS_CROSS_ORIGIN = !!BASE;
      await fetch(`${BASE}${upload_url}`, {
        method: 'PUT',
        credentials: IS_CROSS_ORIGIN ? 'omit' : 'include',
        headers: { 'Content-Type': file.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: file,
      });
      await api.registerSubtaskAttachment(ticket.id, subtaskId, {
        filename: file.name, url: key, mime_type: file.type, size_bytes: file.size,
      });
      await loadSubtaskAttachments(subtaskId);
      setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, attachment_count: s.attachment_count + 1 } : s));
    } catch (e: any) {
      setSubtaskError(e.message || 'Upload failed.');
    } finally {
      setUploadingSubtaskId(null);
    }
  }

  const fieldLabel = "text-[11px] text-text-muted block mb-1 font-medium uppercase tracking-wider";
  const fieldInput = "w-full bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[13px]";
  const fieldValue = "text-[13px] text-text-secondary";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted text-[13px]">Loading...</p>
      </div>
    );
  }

  if (notFound || !ticket) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary mb-2">Ticket not found</h1>
          <button onClick={handleBack} className="text-accent hover:text-accent-hover text-[13px]">Back to board</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Back + header bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleBack}
            className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to board
          </button>
          <div className="flex items-center gap-1.5">
            {canEdit && !editing && !ticket.archived_at && (
              <button onClick={async () => {
                if (!confirm('Archive this ticket? It will be removed from the board.')) return;
                try { await api.archiveTicket(ticket.id); fetchTickets(); navigate('/board'); } catch { /* ignore */ }
              }}
                className="text-[12px] px-2.5 py-1 rounded-md bg-bg-elevated border border-border text-text-muted hover:text-danger hover:border-danger/30 font-medium transition-colors">
                Archive
              </button>
            )}
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)}
                className="text-[12px] px-2.5 py-1 rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover font-medium">
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Title row */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-2">
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
          {editing ? (
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${fieldInput} text-xl font-semibold`} />
          ) : (
            <h1 className="text-xl font-semibold text-text-primary leading-snug">{ticket.title}</h1>
          )}
        </div>

        {/* Two-column layout */}
        <div className="flex gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
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
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ticket PDO-${ticket.ticket_number}? This cannot be undone.`)) return;
                        try { await api.deleteTicket(ticket.id); fetchTickets(); navigate('/board'); } catch (e: any) { setSaveError(e.message); }
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

            {/* Subtasks */}
            <div className="mb-6 pb-6 border-b border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <h3 className={fieldLabel}>
                  Sub-tasks <span className="text-text-muted">
                    ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                  </span>
                </h3>
                {canManageSubtasks && !showAddSubtask && (
                  <button onClick={() => setShowAddSubtask(true)}
                    className="text-[12px] px-2 py-0.5 rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover font-medium">
                    + Add
                  </button>
                )}
              </div>

              {subtaskError && (
                <div className="bg-danger/8 border border-danger/20 rounded-lg p-2 mb-2">
                  <p className="text-danger text-[11px]">{subtaskError}</p>
                </div>
              )}

              {subtasks.length > 0 && (
                <div className="w-full h-1.5 bg-bg-elevated rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all duration-300"
                    style={{ width: `${(subtasks.filter(s => s.completed).length / subtasks.length) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {subtasks.map((st) => (
                  <div key={st.id} className="bg-bg-elevated rounded-lg">
                    {editingSubtaskId === st.id ? (
                      <div className="p-3 space-y-2">
                        <input value={editSubtaskForm.title}
                          onChange={(e) => setEditSubtaskForm({ ...editSubtaskForm, title: e.target.value })}
                          className={`${fieldInput} text-[13px]`} placeholder="Title" />
                        <textarea value={editSubtaskForm.description}
                          onChange={(e) => setEditSubtaskForm({ ...editSubtaskForm, description: e.target.value })}
                          className={`${fieldInput} text-[13px] resize-none`} rows={2} placeholder="Description (optional)" />
                        <input type="date" value={editSubtaskForm.due_date}
                          onChange={(e) => setEditSubtaskForm({ ...editSubtaskForm, due_date: e.target.value })}
                          className={`${fieldInput} text-[13px]`} />
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveSubtask(st.id)}
                            className="px-3 py-1 bg-accent text-white rounded-lg text-[12px] font-medium hover:bg-accent-hover">
                            Save
                          </button>
                          <button onClick={() => setEditingSubtaskId(null)}
                            className="px-3 py-1 bg-bg-surface border border-border text-text-secondary rounded-lg text-[12px] hover:text-text-primary">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5">
                        <div className="flex items-start gap-2">
                          {canManageSubtasks && (
                            <button onClick={() => handleToggleSubtask(st)}
                              className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                st.completed
                                  ? 'bg-success border-success text-white'
                                  : 'border-border hover:border-accent'
                              }`}>
                              {st.completed ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              ) : null}
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[13px] font-medium ${st.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                                {st.title}
                              </span>
                              {st.due_date && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  !st.completed && st.due_date < Math.floor(Date.now() / 1000)
                                    ? 'bg-danger/10 text-danger'
                                    : 'bg-bg-surface text-text-muted'
                                }`}>
                                  {new Date(st.due_date * 1000).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {st.attachment_count > 0 && (
                                <span className="text-[10px] text-text-muted">
                                  <svg className="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                                  </svg>
                                  {st.attachment_count}
                                </span>
                              )}
                            </div>
                            {st.description && (
                              <p className={`text-[12px] mt-0.5 ${st.completed ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                                {st.description}
                              </p>
                            )}

                            {expandedSubtaskId === st.id && (
                              <div className="mt-2 pl-0.5">
                                {subtaskAttachments[st.id]?.map(att => (
                                  <div key={att.id} className="flex items-center gap-1.5 text-[11px] text-text-muted py-0.5">
                                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                                    </svg>
                                    <span className="truncate">{att.filename}</span>
                                    {canManageSubtasks && (
                                      <button onClick={async () => {
                                        await api.deleteAttachment(att.id);
                                        await loadSubtaskAttachments(st.id);
                                        setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, attachment_count: Math.max(0, s.attachment_count - 1) } : s));
                                      }}
                                        className="text-text-muted hover:text-danger ml-auto flex-shrink-0">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {canManageSubtasks && (
                                  <label className="flex items-center gap-1.5 text-[11px] text-accent hover:text-accent-hover cursor-pointer mt-1">
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    {uploadingSubtaskId === st.id ? 'Uploading...' : 'Attach file'}
                                    <input type="file" className="hidden"
                                      disabled={uploadingSubtaskId === st.id}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleSubtaskFileUpload(st.id, file);
                                        e.target.value = '';
                                      }} />
                                  </label>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => {
                              if (expandedSubtaskId === st.id) {
                                setExpandedSubtaskId(null);
                              } else {
                                setExpandedSubtaskId(st.id);
                                loadSubtaskAttachments(st.id);
                              }
                            }}
                              className="p-0.5 rounded text-text-muted hover:text-text-secondary" title="Attachments">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                              </svg>
                            </button>
                            {canManageSubtasks && (
                              <>
                                <button onClick={() => {
                                  setEditingSubtaskId(st.id);
                                  setEditSubtaskForm({
                                    title: st.title,
                                    description: st.description || '',
                                    due_date: st.due_date ? new Date(st.due_date * 1000).toISOString().split('T')[0] : '',
                                  });
                                }}
                                  className="p-0.5 rounded text-text-muted hover:text-text-secondary" title="Edit">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button onClick={() => handleDeleteSubtask(st.id)}
                                  className="p-0.5 rounded text-text-muted hover:text-danger" title="Delete">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {showAddSubtask && (
                <div className="mt-2 bg-bg-elevated rounded-lg p-3 space-y-2">
                  <input value={subtaskForm.title}
                    onChange={(e) => setSubtaskForm({ ...subtaskForm, title: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); }}
                    className={`${fieldInput} text-[13px]`} placeholder="Subtask title" autoFocus />
                  <textarea value={subtaskForm.description}
                    onChange={(e) => setSubtaskForm({ ...subtaskForm, description: e.target.value })}
                    className={`${fieldInput} text-[13px] resize-none`} rows={2} placeholder="Description (optional)" />
                  <div>
                    <label className="text-[11px] text-text-muted block mb-0.5">Due date</label>
                    <input type="date" value={subtaskForm.due_date}
                      onChange={(e) => setSubtaskForm({ ...subtaskForm, due_date: e.target.value })}
                      className={`${fieldInput} text-[13px]`} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddSubtask}
                      className="px-3 py-1 bg-accent text-white rounded-lg text-[12px] font-medium hover:bg-accent-hover">
                      Add
                    </button>
                    <button onClick={() => { setShowAddSubtask(false); setSubtaskForm({ title: '', description: '', due_date: '' }); }}
                      className="px-3 py-1 bg-bg-surface border border-border text-text-secondary rounded-lg text-[12px] hover:text-text-primary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {subtasks.length === 0 && !showAddSubtask && (
                <p className="text-[13px] text-text-muted">No sub-tasks.</p>
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
                      <span className="text-[12px] font-medium text-text-primary">{comment.author_name || 'Deleted User'}</span>
                      <span className="text-[10px] text-text-muted">
                        {new Date(comment.created_at * 1000).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[13px] text-text-secondary whitespace-pre-wrap pl-7">{renderCommentBody(comment.body)}</p>
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
                  <div className="relative">
                    <div className="flex gap-2">
                      <textarea
                        ref={commentRef}
                        value={newComment}
                        onChange={handleCommentChange}
                        onKeyDown={handleCommentKeyDown}
                        placeholder="Write a comment... Use @ to mention someone"
                        rows={2}
                        className={`flex-1 ${fieldInput} resize-none`}
                      />
                      <button onClick={handleAddComment}
                        className="px-3.5 py-1.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent-hover self-end">
                        Send
                      </button>
                    </div>
                    {mentionOpen && mentionFiltered.length > 0 && (
                      <div className="absolute bottom-full mb-1 left-0 w-64 bg-bg-surface border border-border rounded-lg shadow-lg shadow-black/30 max-h-36 overflow-y-auto z-10">
                        {mentionFiltered.slice(0, 8).map((u, i) => (
                          <button key={u.id} type="button"
                            onMouseDown={(e) => { e.preventDefault(); insertMention(u.name); }}
                            className={`w-full text-left px-2.5 py-1.5 text-[13px] flex items-center gap-2 ${
                              i === mentionIndex ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-elevated'
                            }`}>
                            <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center text-[9px] text-accent font-semibold shrink-0">
                              {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            {u.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-64 shrink-0">
            <div className="sticky top-4 space-y-4">
              <div className="bg-bg-elevated rounded-lg p-4 space-y-4">
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
                          await refreshTicket();
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
                        <span key={tag} className="text-[11px] px-1.5 py-0.5 bg-bg-surface rounded text-text-muted">{tag}</span>
                      ))}
                      {ticket.tags.length === 0 && <span className={fieldValue}>—</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-bg-elevated rounded-lg p-4 space-y-3">
                <div>
                  <label className={fieldLabel}>Submitted By</label>
                  <span className={fieldValue}>{ticket.submitter_name || '—'}</span>
                </div>
                <div>
                  <label className={fieldLabel}>Submitted</label>
                  <span className={fieldValue}>{new Date(ticket.created_at * 1000).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
