import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { userInitials } from '../lib/api';

export function Layout() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const canSubmit = ['decision_maker', 'dev', 'admin'].includes(user.role);
  const canArchive = ['dev', 'admin'].includes(user.role);
  const isAdmin = user.role === 'admin';
  const initials = userInitials(user);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
      isActive
        ? 'bg-accent-muted text-accent'
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      {/* Navbar */}
      <header className="bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle px-5 py-2.5 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-text-primary tracking-tight">PDO Kanban</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <nav className="flex gap-0.5">
            <NavLink to="/board" className={navLinkClass}>Board</NavLink>
            {canSubmit && <NavLink to="/submit" className={navLinkClass}>New Ticket</NavLink>}
            <NavLink to="/milestones" className={navLinkClass}>Milestones</NavLink>
            <NavLink to="/attachments" className={navLinkClass}>Files</NavLink>
            {canArchive && <NavLink to="/archive" className={navLinkClass}>Archive</NavLink>}
          </nav>
        </div>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[11px] font-semibold text-accent">
              {initials}
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1.5 w-56 bg-bg-surface border border-border rounded-lg shadow-xl shadow-black/30 py-1 z-50">
              <div className="px-3 py-2.5 border-b border-border-subtle">
                <p className="text-[13px] font-medium text-text-primary">{user.name}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{user.email}</p>
                <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary capitalize font-medium">
                  {user.role.replace('_', ' ')}
                </span>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setShowDropdown(false); navigate('/profile'); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  Profile & Settings
                </button>
                <button
                  onClick={() => { setShowDropdown(false); navigate('/stats'); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  Statistics
                </button>
                {isAdmin && (
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/admin'); }}
                    className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    Admin Panel
                  </button>
                )}
              </div>
              <div className="border-t border-border-subtle py-1">
                <button
                  onClick={() => { setShowDropdown(false); logout(); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
