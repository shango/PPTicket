import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

export function ChangePasswordPage() {
  const [form, setForm] = useState({ current: '', new: '', confirm: '', notificationEmail: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setMustChangePassword = useStore((s) => s.setMustChangePassword);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.new !== form.confirm) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(form.current, form.new, form.notificationEmail || undefined);
      setMustChangePassword(false);
      navigate('/board', { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-accent mb-2">PDO Kanban</h1>
          <p className="text-text-muted">Set a new password and add a personal email for notifications</p>
        </div>

        {error && (
          <div className="bg-p0/10 border border-p0/30 rounded-lg p-3 mb-4">
            <p className="text-p0 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-text-muted block mb-1">Current Password</label>
            <input
              type="password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              required
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
              placeholder="Temporary password from your admin"
            />
          </div>
          <div>
            <label className="text-sm text-text-muted block mb-1">New Password</label>
            <input
              type="password"
              value={form.new}
              onChange={(e) => setForm({ ...form, new: e.target.value })}
              required
              minLength={8}
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="text-sm text-text-muted block mb-1">Confirm New Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              minLength={8}
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="pt-2 border-t border-border-subtle">
            <label className="text-sm text-text-muted block mb-1">Personal Email for Notifications</label>
            <input
              type="email"
              value={form.notificationEmail}
              onChange={(e) => setForm({ ...form, notificationEmail: e.target.value })}
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
              placeholder="you@gmail.com (optional)"
            />
            <p className="text-[11px] text-text-muted mt-1.5">
              Ticket notifications will be sent here instead of your work email
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Setting password...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
