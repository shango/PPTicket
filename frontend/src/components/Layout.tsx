import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api, userInitials } from '../lib/api';
import { registerPush, unregisterPush, isPushEnabled } from '../lib/push';

export function Layout() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const fetchUser = useStore((s) => s.fetchUser);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
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

  useEffect(() => {
    isPushEnabled().then(setPushEnabled);
  }, []);

  if (!user) return null;

  const canSubmit = ['decision_maker', 'dev', 'admin'].includes(user.role);
  const isAdmin = user.role === 'admin';
  const initials = userInitials(user);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.new !== pwForm.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwLoading(true);
    try {
      await api.changePassword(pwForm.current, pwForm.new);
      setPwSuccess('Password changed successfully.');
      setPwForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (e: any) {
      setPwError(e.message);
    } finally {
      setPwLoading(false);
    }
  }

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
                  onClick={async () => {
                    setPushLoading(true);
                    try {
                      if (pushEnabled) {
                        await unregisterPush();
                        setPushEnabled(false);
                      } else {
                        const ok = await registerPush();
                        setPushEnabled(ok);
                      }
                    } catch { /* ignore */ }
                    setPushLoading(false);
                  }}
                  disabled={pushLoading}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pushEnabled ? 'text-accent' : 'text-text-muted'}>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {pushLoading ? 'Loading...' : pushEnabled ? 'Notifications On' : 'Notifications Off'}
                </button>
                <button
                  onClick={async () => {
                    const newTheme = user.theme === 'light' ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', newTheme);
                    try {
                      await api.updateTheme(newTheme);
                      await fetchUser();
                    } catch { /* revert on failure */ document.documentElement.setAttribute('data-theme', user.theme || 'dark'); }
                  }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
                >
                  {user.theme === 'light' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  )}
                  {user.theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
                <button
                  onClick={async () => {
                    const newSize = user.ticket_size === 'small' ? 'large' : 'small';
                    try {
                      await api.updateTicketSize(newSize);
                      await fetchUser();
                    } catch { /* ignore */ }
                  }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
                >
                  {user.ticket_size === 'small' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                      <rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="21" x2="8" y2="3"/><line x1="16" y1="21" x2="16" y2="3"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                      <rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="21" x2="8" y2="3"/><line x1="16" y1="21" x2="16" y2="3"/><line x1="2" y1="12" x2="22" y2="12"/>
                    </svg>
                  )}
                  {user.ticket_size === 'small' ? 'Large Tickets' : 'Small Tickets'}
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
                <button
                  onClick={() => { setShowDropdown(false); setShowPasswordModal(true); setPwError(''); setPwSuccess(''); setPwForm({ current: '', new: '', confirm: '' }); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Change Password
                </button>
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

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowPasswordModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Change Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {pwError && (
              <div className="bg-danger/8 border border-danger/20 rounded-lg p-2.5 mb-4">
                <p className="text-danger text-xs">{pwError}</p>
              </div>
            )}
            {pwSuccess && (
              <div className="bg-success/8 border border-success/20 rounded-lg p-2.5 mb-4">
                <p className="text-success text-xs">{pwSuccess}</p>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Current Password</label>
                <input type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} required
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">New Password</label>
                <input type="password" value={pwForm.new} onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })} required minLength={8}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Confirm New Password</label>
                <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required minLength={8}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={pwLoading}
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50">
                  {pwLoading ? 'Changing...' : 'Update Password'}
                </button>
                <button type="button" onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 bg-bg-elevated text-text-secondary border border-border rounded-lg text-sm hover:text-text-primary hover:bg-bg-hover">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
