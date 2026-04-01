import { useEffect, useState } from 'react';
import { api, type User } from '../lib/api';
import { useStore } from '../lib/store';

const roleOptions = ['viewer', 'decision_maker', 'dev', 'admin'] as const;
const roleLabels: Record<string, string> = {
  viewer: 'Viewer',
  decision_maker: 'Decision Maker',
  dev: 'Dev',
  admin: 'Admin',
};

export function AdminPage() {
  const currentUser = useStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleRoleChange(userId: string, newRole: string) {
    if (!confirm(`Change this user's role to ${roleLabels[newRole]}?`)) return;
    try {
      await api.updateRole(userId, newRole);
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleSuspend(userId: string) {
    if (!confirm('Suspend this user? They will lose access to the application.')) return;
    try {
      await api.suspendUser(userId);
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  const activeUsers = users.filter((u) => u.role !== 'suspended');
  const suspendedUsers = users.filter((u) => u.role === 'suspended');

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold mb-6">Admin Panel</h1>

      {error && (
        <div className="bg-p0/10 border border-p0/30 rounded-lg p-4 mb-6">
          <p className="text-p0 text-sm">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {roleOptions.map((role) => (
          <div key={role} className="bg-bg-surface border border-zinc-800 rounded-lg p-4">
            <p className="text-2xl font-semibold">{activeUsers.filter((u) => u.role === role).length}</p>
            <p className="text-xs text-text-muted">{roleLabels[role]}s</p>
          </div>
        ))}
      </div>

      {/* User Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-elevated text-text-muted text-left">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Last Login</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {activeUsers.map((u) => (
              <tr key={u.id} className="border-t border-zinc-800 hover:bg-bg-elevated/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {u.avatar_url && (
                      <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                    )}
                    <span>{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-text-muted">{u.email}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="bg-bg-elevated border border-zinc-700 rounded px-2 py-1 text-xs"
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{roleLabels[r]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-text-muted text-xs">
                  {u.last_login ? new Date(u.last_login * 1000).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-2.5 text-text-muted text-xs">
                  {new Date(u.created_at * 1000).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  {u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleSuspend(u.id)}
                      className="text-xs text-p0/70 hover:text-p0"
                    >
                      Suspend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Suspended users */}
      {suspendedUsers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-text-muted mb-3">Suspended Users ({suspendedUsers.length})</h2>
          <div className="border border-zinc-800 rounded-lg overflow-hidden opacity-60">
            <table className="w-full text-sm">
              <tbody>
                {suspendedUsers.map((u) => (
                  <tr key={u.id} className="border-t first:border-t-0 border-zinc-800">
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2 text-text-muted">{u.email}</td>
                    <td className="px-4 py-2 text-text-muted text-xs">Suspended</td>
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
