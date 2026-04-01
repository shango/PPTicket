import { useState, useEffect } from 'react';
import { api, type TicketWithMeta } from '../lib/api';
import { useStore } from '../lib/store';

export function SubmitPage() {
  const user = useStore((s) => s.user);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'p2',
    tags: '',
    due_date: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ ticketNumber: number } | null>(null);
  const [error, setError] = useState('');
  const [myTickets, setMyTickets] = useState<TicketWithMeta[]>([]);

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

      const due_date = form.due_date
        ? Math.floor(new Date(form.due_date).getTime() / 1000)
        : undefined;

      const ticket = await api.createTicket({
        title: form.title,
        description: form.description,
        priority: form.priority,
        tags,
        due_date,
      });

      setSuccess({ ticketNumber: ticket.ticket_number });
      setForm({ title: '', description: '', priority: 'p2', tags: '', due_date: '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold mb-6">Submit a Ticket</h1>

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <p className="text-green-400 text-sm">
            Ticket <strong>PDO-{success.ticketNumber}</strong> submitted successfully.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-p0/10 border border-p0/30 rounded-lg p-4 mb-6">
          <p className="text-p0 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-text-muted block mb-1">
            Title <span className="text-p0">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={200}
            required
            className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
            placeholder="Brief summary of the request"
          />
          <span className="text-[10px] text-text-muted">{form.title.length}/200</span>
        </div>

        <div>
          <label className="text-sm text-text-muted block mb-1">
            Description <span className="text-p0">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            minLength={20}
            rows={6}
            className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm resize-y"
            placeholder="Detailed description (min 20 characters). Markdown supported."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-text-muted block mb-1">
              Priority <span className="text-p0">*</span>
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="p0">P0 — Critical / Blocker</option>
              <option value="p1">P1 — High Priority</option>
              <option value="p2">P2 — Normal (default)</option>
              <option value="p3">P3 — Low / Nice to Have</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-text-muted block mb-1">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-text-muted block mb-1">Tags</label>
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
            placeholder="Comma-separated, max 5 (e.g. reporting, urgent, finance)"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>

      {/* My Submissions */}
      {myTickets.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">My Submissions</h2>
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated text-text-muted text-left">
                  <th className="px-4 py-2 font-medium">Ticket #</th>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Priority</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {myTickets.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-800 hover:bg-bg-elevated/50">
                    <td className="px-4 py-2 text-text-muted">PDO-{t.ticket_number}</td>
                    <td className="px-4 py-2">{t.title}</td>
                    <td className="px-4 py-2 uppercase text-text-muted">{t.priority}</td>
                    <td className="px-4 py-2 capitalize text-text-muted">{t.status.replace('_', ' ')}</td>
                    <td className="px-4 py-2 text-text-muted">
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
