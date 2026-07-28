import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useStore } from '../lib/store';

export function ChangePasswordPage() {
  const [form, setForm] = useState({ current: '', new: '', confirm: '', notificationEmail: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setMustChangePassword = useStore((s) => s.setMustChangePassword);
  const logout = useStore((s) => s.logout);
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
      const result = await api.changePassword(form.current, form.new, form.notificationEmail || undefined);
      // The old session was revoked server-side; keep this device signed in.
      setToken(result.token);
      setMustChangePassword(false);
      navigate('/board', { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const fieldInput = 'w-full bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-1">Set a new password</h1>
          <p className="text-text-muted text-sm">Your account is using a temporary password</p>
        </div>

        {error && (
          <div className="bg-danger/8 border border-danger/20 rounded-lg p-3 mb-5">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Current Password</label>
            <input
              type="password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              required
              autoComplete="current-password"
              className={fieldInput}
              placeholder="Temporary password from your admin"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">New Password</label>
            <input
              type="password"
              value={form.new}
              onChange={(e) => setForm({ ...form, new: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
              className={fieldInput}
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Confirm New Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
              className={fieldInput}
            />
            {form.confirm.length > 0 && form.new !== form.confirm && (
              <p className="text-danger text-[11px] mt-1.5">Passwords do not match.</p>
            )}
          </div>
          <div className="pt-4 border-t border-border-subtle">
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Personal Email for Notifications</label>
            <input
              type="email"
              value={form.notificationEmail}
              onChange={(e) => setForm({ ...form, notificationEmail: e.target.value })}
              className={fieldInput}
              placeholder="you@example.com (optional)"
            />
            <p className="text-[11px] text-text-muted mt-1.5">
              Ticket notifications will be sent here instead of your work email
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-lg shadow-accent/10"
          >
            {loading ? 'Setting password...' : 'Set New Password'}
          </button>
        </form>

        {/* Without this the page is a dead end: every other route redirects back
            here until the password is changed. */}
        <p className="text-center text-[11px] text-text-muted mt-6">
          Wrong account?{' '}
          <button onClick={() => logout()} className="text-accent hover:text-accent-hover font-medium">
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
