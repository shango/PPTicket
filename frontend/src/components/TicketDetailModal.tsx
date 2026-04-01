import { useEffect, useState } from 'react';
import { api, type TicketWithMeta, type Comment, type User } from '../lib/api';
import { useStore } from '../lib/store';

const priorityOptions = [
  { value: 'p0', label: 'P0 — Critical' },
  { value: 'p1', label: 'P1 — High' },
  { value: 'p2', label: 'P2 — Normal' },
  { value: 'p3', label: 'P3 — Low' },
];

const statusOptions = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

interface Props {
  ticket: TicketWithMeta;
  onClose: () => void;
  onUpdate: () => void;
}

export function TicketDetailModal({ ticket, onClose, onUpdate }: Props) {
  const user = useStore((s) => s.user);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [devUsers, setDevUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: ticket.title,
    description: ticket.description || '',
    priority: ticket.priority,
    status: ticket.status,
    assignee_id: ticket.assignee_id || '',
    due_date: ticket.due_date ? new Date(ticket.due_date * 1000).toISOString().split('T')[0] : '',
    tags: ticket.tags.join(', '),
  });

  const canEdit = user && ['dev', 'admin'].includes(user.role);
  const canComment = user && ['decision_maker', 'dev', 'admin'].includes(user.role);

  useEffect(() => {
    api.getComments(ticket.id).then(setComments);
    if (canEdit) {
      api.getUsers().catch(() => []).then((users) => {
        if (Array.isArray(users)) {
          setDevUsers(users.filter((u) => ['dev', 'admin'].includes(u.role)));
        }
      });
    }
  }, [ticket.id, canEdit]);

  async function handleSave() {
    const updates: any = {};
    if (form.title !== ticket.title) updates.title = form.title;
    if (form.description !== (ticket.description || '')) updates.description = form.description;
    if (form.priority !== ticket.priority) updates.priority = form.priority;
    if (form.assignee_id !== (ticket.assignee_id || '')) updates.assignee_id = form.assignee_id || null;
    if (form.tags !== ticket.tags.join(', ')) updates.tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);

    const dueDateUnix = form.due_date ? Math.floor(new Date(form.due_date).getTime() / 1000) : null;
    if (dueDateUnix !== ticket.due_date) updates.due_date = dueDateUnix;

    if (form.status !== ticket.status) {
      await api.moveTicket(ticket.id, form.status, ticket.sort_order);
    }

    if (Object.keys(updates).length > 0) {
      await api.updateTicket(ticket.id, updates);
    }

    setEditing(false);
    onUpdate();
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    const comment = await api.addComment(ticket.id, newComment);
    setComments([...comments, comment]);
    setNewComment('');
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-bg-surface border-l border-zinc-800 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-muted">PDO-{ticket.ticket_number}</span>
            <div className="flex gap-2">
              {canEdit && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs px-2 py-1 rounded bg-bg-elevated text-text-muted hover:text-text-primary"
                >
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="text-text-muted hover:text-text-primary text-lg leading-none"
              >
                x
              </button>
            </div>
          </div>

          {/* Title */}
          {editing ? (
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-lg font-semibold mb-4"
            />
          ) : (
            <h2 className="text-lg font-semibold mb-4">{ticket.title}</h2>
          )}

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="text-xs text-text-muted block mb-1">Status</label>
              {editing ? (
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-bg-elevated border border-zinc-700 rounded px-2 py-1.5 text-sm"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm capitalize">{ticket.status.replace('_', ' ')}</span>
              )}
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Priority</label>
              {editing ? (
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full bg-bg-elevated border border-zinc-700 rounded px-2 py-1.5 text-sm"
                >
                  {priorityOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm uppercase">{ticket.priority}</span>
              )}
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Assignee</label>
              {editing ? (
                <select
                  value={form.assignee_id}
                  onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                  className="w-full bg-bg-elevated border border-zinc-700 rounded px-2 py-1.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {devUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm">{ticket.assignee_id ? 'Assigned' : 'Unassigned'}</span>
              )}
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Due Date</label>
              {editing ? (
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full bg-bg-elevated border border-zinc-700 rounded px-2 py-1.5 text-sm"
                />
              ) : (
                <span className="text-sm">
                  {ticket.due_date
                    ? new Date(ticket.due_date * 1000).toLocaleDateString()
                    : 'None'}
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="text-xs text-text-muted block mb-1">Tags</label>
            {editing ? (
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Comma-separated tags"
                className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-1.5 text-sm"
              />
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {ticket.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-bg-elevated rounded text-text-muted">
                    {tag}
                  </span>
                ))}
                {ticket.tags.length === 0 && <span className="text-xs text-text-muted">None</span>}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="text-xs text-text-muted block mb-1">Description</label>
            {editing ? (
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={6}
                className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm resize-y"
              />
            ) : (
              <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                {ticket.description || 'No description.'}
              </div>
            )}
          </div>

          {/* Save / Cancel */}
          {editing && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={handleSave}
                className="px-4 py-1.5 bg-accent text-white rounded text-sm hover:bg-accent/90"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1.5 bg-bg-elevated text-text-muted rounded text-sm hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Comments */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="text-sm font-medium mb-3">Comments ({comments.length})</h3>
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-bg-elevated rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{comment.author_name}</span>
                    <span className="text-[10px] text-text-muted">
                      {new Date(comment.created_at * 1000).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{comment.body}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-text-muted">No comments yet.</p>
              )}
            </div>

            {canComment && (
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  className="flex-1 bg-bg-elevated border border-zinc-700 rounded px-3 py-1.5 text-sm"
                />
                <button
                  onClick={handleAddComment}
                  className="px-3 py-1.5 bg-accent text-white rounded text-sm hover:bg-accent/90"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
