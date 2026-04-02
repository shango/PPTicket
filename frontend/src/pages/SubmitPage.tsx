import { useState, useEffect } from 'react';
import { api, type TicketWithMeta, type Project, type User } from '../lib/api';
import { useStore } from '../lib/store';

export function SubmitPage() {
  const user = useStore((s) => s.user);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'p2',
    ticket_type: 'bug' as 'bug' | 'feature',
    product_id: '',
    submitter_id: '',
    tags: '',
    product_version: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ ticketNumber: number } | null>(null);
  const [error, setError] = useState('');
  const [myTickets, setMyTickets] = useState<TicketWithMeta[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
    if (isAdmin) {
      api.getUsers().then((users) => {
        if (Array.isArray(users)) setAllUsers(users.filter(u => u.role !== 'suspended'));
      }).catch(() => {});
    }
    if (user) {
      setForm(f => ({ ...f, submitter_id: f.submitter_id || user.id }));
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user) {
      api.getTickets({ submitter: user.id }).then(setMyTickets).catch(() => {});
    }
  }, [user, success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
        product_version: form.product_version || null,
        ticket_type: form.ticket_type,
        product_id: form.product_id || null,
        submitter_id: form.submitter_id || null,
      });

      setSuccess({ ticketNumber: ticket.ticket_number });
      setForm({ title: '', description: '', priority: 'p2', ticket_type: 'bug', product_id: '', submitter_id: user?.id || '', tags: '', product_version: '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldLabel = "text-[12px] text-text-secondary block mb-1.5 font-medium";
  const fieldInput = "w-full bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-[13px]";

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">New Ticket</h1>
        <p className="text-[13px] text-text-muted mt-1">Submit a bug report or feature request</p>
      </div>

      {success && (
        <div className="bg-success/8 border border-success/20 rounded-lg p-4 mb-6">
          <p className="text-success text-[13px]">
            Ticket <strong className="font-mono">PDO-{success.ticketNumber}</strong> submitted successfully.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-danger/8 border border-danger/20 rounded-lg p-4 mb-6">
          <p className="text-danger text-[13px]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type + Product + Submitter row */}
        <div className={`grid gap-4 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div>
            <label className={fieldLabel}>Type <span className="text-danger">*</span></label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-[13px]">
                <input type="radio" name="ticket_type" checked={form.ticket_type === 'bug'}
                  onChange={() => setForm({ ...form, ticket_type: 'bug' })} className="accent-[#d4564e]" />
                <span className={form.ticket_type === 'bug' ? 'text-text-primary' : 'text-text-muted'}>Bug</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[13px]">
                <input type="radio" name="ticket_type" checked={form.ticket_type === 'feature'}
                  onChange={() => setForm({ ...form, ticket_type: 'feature' })} className="accent-[#5bae7a]" />
                <span className={form.ticket_type === 'feature' ? 'text-text-primary' : 'text-text-muted'}>Feature</span>
              </label>
            </div>
          </div>
          <div>
            <label className={fieldLabel}>Project <span className="text-danger">*</span></label>
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              required className={fieldInput}>
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.abbreviation})</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className={fieldLabel}>Submitted By <span className="text-danger">*</span></label>
              <select value={form.submitter_id} onChange={(e) => setForm({ ...form, submitter_id: e.target.value })}
                required className={fieldInput}>
                <option value="">Select submitter...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

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
              <option value="p0">P0 — Critical / Blocker</option>
              <option value="p1">P1 — High Priority</option>
              <option value="p2">P2 — Normal (default)</option>
              <option value="p3">P3 — Low / Nice to Have</option>
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Version</label>
            <input value={form.product_version} onChange={(e) => setForm({ ...form, product_version: e.target.value })}
              className={fieldInput} placeholder="e.g. 2.4.1" />
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
                    <td className="px-4 py-2.5 font-mono text-text-muted">PDO-{t.ticket_number}</td>
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
  );
}
