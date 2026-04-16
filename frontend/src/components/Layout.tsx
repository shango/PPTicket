import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { userInitials } from '../lib/api';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  visible?: boolean;
}

export function Layout() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const canArchive = ['dev', 'admin'].includes(user.role);
  const isAdmin = user.role === 'admin';
  const initials = userInitials(user);

  const navItems: NavItem[] = [
    {
      to: '/board', label: 'Board',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    },
    {
      to: '/milestones', label: 'Roadmap',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
    },
    {
      to: '/projects', label: 'Projects',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      to: '/attachments', label: 'Files',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
    },
    {
      to: '/archive', label: 'Archive', visible: canArchive,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
    },
    {
      to: '/admin', label: 'Admin', visible: isAdmin,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    },
  ];

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
        {/* Logo + collapse toggle */}
        <div className={`flex items-center shrink-0 h-12 border-b border-border-subtle ${sidebarOpen ? 'px-3 gap-2.5' : 'justify-center'}`}>
          <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-accent">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          {sidebarOpen && <span className="text-[14px] font-semibold text-text-primary tracking-tight truncate flex-1">PDO Kanban</span>}
          <button
            onClick={toggleSidebar}
            className={`shrink-0 p-1 rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors ${sidebarOpen ? '' : 'mt-0'}`}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
              className={`transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`}>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <polyline points="15 8 12 12 15 16"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 flex flex-col gap-0.5 py-2 ${sidebarOpen ? 'px-2' : 'px-1'}`}>
          {navItems.filter(item => item.visible !== false).map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)} title={sidebarOpen ? undefined : item.label}>
              <span className="shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-[13px] font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section: user + collapse */}
        <div className={`border-t border-border-subtle ${sidebarOpen ? 'px-2' : 'px-1'} py-2 space-y-1`}>
          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
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

        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
