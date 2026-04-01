import { Outlet, NavLink } from 'react-router-dom';
import { useStore } from '../lib/store';

export function Layout() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);

  if (!user) return null;

  const canSubmit = ['decision_maker', 'dev', 'admin'].includes(user.role);
  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-bg-surface border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-accent">PDO Kanban</span>
          <nav className="flex gap-1">
            <NavLink
              to="/board"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm transition-colors ${isActive ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'}`
              }
            >
              Board
            </NavLink>
            {canSubmit && (
              <NavLink
                to="/submit"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm transition-colors ${isActive ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'}`
                }
              >
                Submit Ticket
              </NavLink>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm transition-colors ${isActive ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'}`
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {user.avatar_url && (
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
            )}
            <span className="text-sm text-text-muted">{user.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted capitalize">
              {user.role.replace('_', ' ')}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
