import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import { useStore } from '../lib/store';

export function SetupPage() {
  const [form, setForm] = useState({ email: '', name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fetchUser = useStore((s) => s.fetchUser);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.setup(form.email, form.password, form.name);
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
          <div className="bg-p0/10 border border-p0/30 rounded-lg p-3 mb-4">
            <p className="text-p0 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-text-muted block mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="text-sm text-text-muted block mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
              placeholder="you@pdoexperts.fb.com"
            />
          </div>
          <div>
            <label className="text-sm text-text-muted block mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              className="w-full bg-bg-elevated border border-zinc-700 rounded px-3 py-2 text-sm"
              placeholder="Min 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
