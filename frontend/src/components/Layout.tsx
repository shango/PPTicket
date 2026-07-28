import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { userInitials } from '../lib/api';
import { navItems } from '../lib/nav';
import { CommandPalette } from './CommandPalette';
import { modKeyLabel } from '../lib/platform';

export function Layout() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  // Mod+K from anywhere in the app. Deliberately not guarded on the focused
  // element: it is a browser-level chord, so it never collides with typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user ? userInitials(user) : '';
  const items = navItems(user);

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg transition-colors ${
      sidebarOpen ? 'px-3 py-2' : 'px-0 py-2 justify-center'
    } ${
      isActive
        ? 'bg-accent-muted text-accent'
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
    }`;

  return (
    <div className="h-screen flex bg-bg-base">
      {/* Sidebar */}
      <aside
        className={`shrink-0 flex flex-col bg-bg-surface border-r border-border-subtle transition-all duration-200 ${
          sidebarOpen ? 'w-48' : 'w-12'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center shrink-0 h-12 border-b border-border-subtle ${sidebarOpen ? 'px-3 gap-2.5' : 'justify-center'}`}>
          <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          {sidebarOpen && <span className="text-[14px] font-semibold text-text-primary tracking-tight truncate">PDO Kanban</span>}
        </div>

        {/* Nav */}
        <nav aria-label="Main" className={`flex-1 flex flex-col gap-0.5 py-2 ${sidebarOpen ? 'px-2' : 'px-1'}`}>
          {/* The palette's only discoverable entry point. A shortcut nobody is
              told about is a shortcut nobody uses. */}
          <button
            onClick={() => setPaletteOpen(true)}
            title={sidebarOpen ? undefined : `Search (${modKeyLabel})`}
            className={`flex items-center gap-3 rounded-lg mb-1 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors ${
              sidebarOpen ? 'px-3 py-2' : 'px-0 py-2 justify-center'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {sidebarOpen && (
              <>
                <span className="text-[13px] font-medium flex-1 text-left">Search</span>
                <kbd className="text-[10px] border border-border-subtle rounded px-1 py-px">{modKeyLabel}</kbd>
              </>
            )}
          </button>

          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)} title={sidebarOpen ? undefined : item.label}>
              <span className="shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-[13px] font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section: user + collapse */}
        <div className={`border-t border-border-subtle ${sidebarOpen ? 'px-2' : 'px-1'} py-2 space-y-1`}>
          {/* Log in (anonymous) */}
          {!user && (
            <button
              onClick={() => navigate('/login')}
              className={`w-full flex items-center gap-2.5 rounded-lg py-2 transition-colors hover:bg-bg-hover text-text-secondary hover:text-text-primary ${sidebarOpen ? 'px-3' : 'px-0 justify-center'}`}
              title={sidebarOpen ? undefined : 'Log in'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              {sidebarOpen && <span className="text-[12px] font-medium">Log in</span>}
            </button>
          )}

          {/* User menu */}
          {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              aria-label={`Account menu for ${user.name}`}
              className={`w-full flex items-center gap-2.5 rounded-lg py-2 transition-colors hover:bg-bg-hover ${sidebarOpen ? 'px-3' : 'px-0 justify-center'}`}
            >
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-semibold text-accent shrink-0">
                {initials}
              </div>
              {sidebarOpen && (
                <>
                  <span className="text-[12px] text-text-secondary truncate flex-1 text-left">{user.name}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </>
              )}
            </button>

            {showUserMenu && (
              <div className={`absolute bottom-full mb-1 ${sidebarOpen ? 'left-0 w-48' : 'left-0 w-48'} bg-bg-surface border border-border rounded-lg shadow-xl shadow-black/30 py-1 z-50`}>
                <div className="px-3 py-2 border-b border-border-subtle">
                  <p className="text-[12px] font-medium text-text-primary truncate">{user.name}</p>
                  <p className="text-[10px] text-text-muted mt-0.5 truncate">{user.email}</p>
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary capitalize font-medium">
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
                <div className="py-1">
                  <button onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Profile
                  </button>
                  <button onClick={() => { setShowUserMenu(false); navigate('/stats'); }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    Statistics
                  </button>
                </div>
                <div className="border-t border-border-subtle py-1">
                  <button onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Theme toggle. Deliberately outside the user menu so anonymous
              viewers, who have no user row, can still switch. */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`w-full flex items-center rounded-lg py-1.5 text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors ${sidebarOpen ? 'px-3 gap-3' : 'px-0 justify-center'}`}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            {sidebarOpen && <span className="text-[11px]">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className={`w-full flex items-center rounded-lg py-1.5 text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors ${sidebarOpen ? 'px-3 gap-3' : 'px-0 justify-center'}`}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
              className={`shrink-0 transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`}>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <polyline points="15 8 12 12 15 16"/>
            </svg>
            {sidebarOpen && <span className="text-[11px]">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content. Pages that manage their own scrolling use h-full plus an
          inner overflow container; the rest are plain documents, and without a
          scroller here everything past the fold was unreachable. */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>

      {/* Mounted only while open so it resets its query every time. */}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
