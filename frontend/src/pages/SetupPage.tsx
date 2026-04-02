import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useStore } from '../lib/store';

export function SetupPage() {
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fetchUser = useStore((s) => s.fetchUser);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.setup(form);
      setToken(result.token);
      await fetchUser();
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
          <p className="text-text-muted">Create your admin account to get started</p>
        </div>

        {error && (
          <div className="bg-danger/8 border border-danger/20 rounded-lg p-3 mb-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1.5 font-medium">First Name</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1.5 font-medium">Last Name</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
                className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm"
              placeholder="you@pdoexperts.fb.com"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3.5 py-2.5 text-sm"
              placeholder="Min 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
