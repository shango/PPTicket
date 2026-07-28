import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type TicketWithMeta, type Project, type User, type Milestone, type Column } from '../lib/api';
import { useStore } from '../lib/store';
import { AssigneeSelect } from '../components/AssigneeSelect';
import { PageHeader } from '../components/PageHeader';

export function SubmitPage() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const canAssign = user && ['dev', 'admin'].includes(user.role);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'p2',
    ticket_type: '' as '' | 'bug' | 'feature',
    product_id: '',
    tags: '',
    milestone_id: '',
  });
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  // Columns are admin-configurable, so the landing column cannot be a pair of
  // hardcoded slugs - renaming or deleting "backlog"/"todo" broke creation.
  const [columns, setColumns] = useState<Column[]>([]);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ ticketNumber: number; ticketId: string } | null>(null);
  const [error, setError] = useState('');
  const [myTickets, setMyTickets] = useState<TicketWithMeta[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [devUsers, setDevUsers] = useState<User[]>([]);
  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
    api.getMilestones({ status: 'open' }).then(setMilestones).catch(() => {});
    api.getColumns().then((cols) => {
      setColumns(cols);
      setStatus((cols.find(c => c.is_initial) || cols[0])?.slug || '');
    }).catch(() => {});
    if (canAssign) {
      api.getUsers().then((users) => {
        if (Array.isArray(users)) setDevUsers(users.filter(u => ['decision_maker', 'dev', 'admin'].includes(u.role)));
      }).catch(() => {});
    }
  }, [canAssign]);

  useEffect(() => {
    if (user) {
      api.getTickets({ submitter: user.id }).then(setMyTickets).catch(() => {});
    }
  }, [user, success]);

  const filteredMilestones = useMemo(
    () => milestones.filter(m => form.product_id && m.project_id === form.product_id),
    [milestones, form.product_id]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.ticket_type) {
      setError('Please select a ticket type.');
      return;
    }
    setSubmitting(true);

    try {
      const tags = form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5)
        : undefined;

      const ticket = await api.createTicket({
        title: form.title,
        description: form.description,
        priority: form.priority,
        tags,
        milestone_id: form.milestone_id || null,
        ticket_type: form.ticket_type as 'bug' | 'feature',
        product_id: form.product_id || null,
        ...(canAssign ? { assignee_ids: assigneeIds, status } : {}),
      });

      setSuccess({ ticketNumber: ticket.ticket_number, ticketId: ticket.id });
      setForm({ title: '', description: '', priority: 'p2', ticket_type: '', product_id: '', tags: '', milestone_id: '' });
      setAssigneeIds([]);
      setStatus((columns.find(c => c.is_initial) || columns[0])?.slug || '');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldLabel = "text-[12px] text-text-secondary block mb-1.5 font-medium";
  const fieldInput = "w-full bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-[13px]";

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="New Ticket" subtitle="Submit a bug report or feature request" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {success && (
            <div className="bg-success/8 border border-success/20 rounded-lg p-4 mb-6 flex items-center justify-between gap-3">
              <p className="text-success text-[13px]">
                Ticket <strong className="font-mono">PDO-{success.ticketNumber}</strong> submitted successfully.
              </p>
              {/* The form used to just clear itself, leaving no way back to the
                  thing that was just created. */}
              <button
                onClick={() => navigate(`/tickets/${success.ticketId}`)}
                className="text-[13px] text-success font-medium hover:underline shrink-0"
              >
                Open ticket
              </button>
            </div>
          )}

          {error && (
            <div className="bg-danger/8 border border-danger/20 rounded-lg p-4 mb-6">
              <p className="text-danger text-[13px]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type + Project row */}
            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className={fieldLabel}>Type <span className="text-danger">*</span></label>
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setForm({ ...form, ticket_type: 'bug' })}
                    className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                      form.ticket_type === 'bug'
                        ? 'bg-danger/10 border-danger/40 text-danger'
                        : 'bg-bg-elevated border-border text-text-muted hover:text-text-secondary hover:border-border'
                    }`}>
                    <svg className="inline mr-1.5 -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Bug
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, ticket_type: 'feature' })}
                    className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                      form.ticket_type === 'feature'
                        ? 'bg-success/10 border-success/40 text-success'
                        : 'bg-bg-elevated border-border text-text-muted hover:text-text-secondary hover:border-border'
                    }`}>
                    <svg className="inline mr-1.5 -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    Feature
                  </button>
                </div>
              </div>
              <div>
                <label className={fieldLabel}>Project <span className="text-danger">*</span></label>
                <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value, milestone_id: '' })}
                  required className={fieldInput}>
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.abbreviation})</option>
                  ))}
                </select>
              </div>
            </div>

            {canAssign && (
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className={fieldLabel}>Assign To</label>
                  <AssigneeSelect users={devUsers} selectedIds={assigneeIds} onChange={setAssigneeIds} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="submit-status">Status</label>
                  <select id="submit-status" value={status} onChange={(e) => setStatus(e.target.value)} className={fieldInput}>
                    {columns.filter(c => !c.is_terminal).map(c => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className={fieldLabel}>Title <span className="text-danger">*</span></label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200} required className={fieldInput} placeholder="Brief summary of the request" />
              <span className="text-[10px] text-text-muted mt-1 block">{form.title.length}/200</span>
            </div>

            <div>
              <label className={fieldLabel}>Description <span className="text-danger">*</span></label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                required minLength={20} rows={5} className={`${fieldInput} resize-y`}
                placeholder="Detailed description (min 20 characters). Markdown supported." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabel}>Priority <span className="text-danger">*</span></label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={fieldInput}>
                  <option value="p0">P0 - Critical / Blocker</option>
                  <option value="p1">P1 - High Priority</option>
                  <option value="p2">P2 - Normal (default)</option>
                  <option value="p3">P3 - Low / Nice to Have</option>
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Milestone</label>
                <select value={form.milestone_id} onChange={(e) => setForm({ ...form, milestone_id: e.target.value })}
                  className={fieldInput} disabled={!form.product_id}>
                  <option value="">{form.product_id ? 'None' : 'Select a project first'}</option>
                  {filteredMilestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Tags</label>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className={fieldInput} placeholder="Comma-separated, max 5 (e.g. reporting, urgent)" />
            </div>

            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 bg-accent text-white rounded-lg text-[13px] font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-lg shadow-accent/10">
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>

          {/* My Submissions */}
          {myTickets.length > 0 && (
            <div className="mt-12">
              <h2 className="text-base font-semibold text-text-primary mb-4">My Submissions</h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-bg-elevated text-text-muted text-left">
                      <th className="px-4 py-2.5 font-medium">Ticket</th>
                      <th className="px-4 py-2.5 font-medium">Title</th>
                      <th className="px-4 py-2.5 font-medium">Priority</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTickets.map((t) => (
                      <tr key={t.id} className="border-t border-border-subtle hover:bg-bg-elevated/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-text-muted">
                          <button onClick={() => navigate(`/tickets/${t.id}`)} className="hover:text-accent transition-colors">
                            PDO-{t.ticket_number}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-text-primary">{t.title}</td>
                        <td className="px-4 py-2.5 uppercase text-text-muted font-mono text-[11px]">{t.priority}</td>
                        <td className="px-4 py-2.5 capitalize text-text-muted">{t.status.replace('_', ' ')}</td>
                        <td className="px-4 py-2.5 text-text-muted">
                          {new Date(t.created_at * 1000).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
