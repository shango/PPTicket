import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { api, userInitials } from '../lib/api';
import { registerPush, unregisterPush, isPushEnabled } from '../lib/push';

const emailPrefKeys: readonly { key: string; label: string; description: string; adminOnly?: boolean }[] = [
  { key: 'notify_ticket_created', label: 'New ticket created', description: 'When a new ticket is submitted to the board' },
  { key: 'notify_ticket_assigned', label: 'Assigned to a ticket', description: 'When you are added as an assignee on a ticket' },
  { key: 'notify_ticket_done', label: 'Ticket completed', description: 'When a ticket you submitted moves to done' },
  { key: 'notify_ticket_comment', label: 'New comment on ticket', description: 'When someone comments on a ticket you are involved in' },
  { key: 'notify_user_registered', label: 'New user registered', description: 'When a new user signs up for the platform', adminOnly: true },
];

function Toggle({ enabled, onChange, loading }: { enabled: boolean; onChange: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
        enabled ? 'bg-accent' : 'bg-bg-elevated border border-border'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-[17px]' : 'translate-x-0.5'
        } ${enabled ? 'mt-0.5' : 'mt-px'}`}
      />
    </button>
  );
}

export function ProfilePage() {
  const user = useStore((s) => s.user);
  const fetchUser = useStore((s) => s.fetchUser);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', email: '', notification_email: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    isPushEnabled().then(setPushEnabled);
  }, []);

  if (!user) return null;

  const initials = userInitials(user);
  const isAdmin = user.role === 'admin';
  const memberSince = new Date(user.created_at * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  async function handleToggleEmailPref(key: string) {
    const current = (user as any)[key];
    try {
      await api.updateEmailPreferences({ [key]: !current });
      await fetchUser();
    } catch { /* ignore */ }
  }

  async function handleToggleTheme() {
    const newTheme = user!.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      await api.updateTheme(newTheme);
      await fetchUser();
    } catch {
      document.documentElement.setAttribute('data-theme', user!.theme || 'dark');
    }
  }

  async function handleToggleTicketSize() {
    const newSize = user!.ticket_size === 'small' ? 'large' : 'small';
    try {
      await api.updateTicketSize(newSize);
      await fetchUser();
    } catch { /* ignore */ }
  }

  async function handleTogglePush() {
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
  }

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

  function startEditingProfile() {
    setProfileForm({
      first_name: user!.first_name || '',
      last_name: user!.last_name || '',
      email: user!.email,
      notification_email: user!.notification_email || '',
    });
    setProfileError('');
    setEditingProfile(true);
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileError('');
    try {
      const updates: { first_name?: string; last_name?: string; email?: string; notification_email?: string | null } = {};
      if (profileForm.first_name !== (user!.first_name || '')) updates.first_name = profileForm.first_name;
      if (profileForm.last_name !== (user!.last_name || '')) updates.last_name = profileForm.last_name;
      if (profileForm.email !== user!.email) updates.email = profileForm.email;
      if (profileForm.notification_email !== (user!.notification_email || '')) {
        updates.notification_email = profileForm.notification_email || null;
      }
      if (Object.keys(updates).length > 0) {
        await api.updateProfile(updates);
        await fetchUser();
      }
      setEditingProfile(false);
    } catch (e: any) {
      setProfileError(e.message || 'Failed to save profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Settings</h1>

      {/* Profile Card */}
      <section className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h2 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Profile</h2>
        </div>
        <div className="px-6 py-5">
          {!editingProfile ? (
            <>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center text-lg font-bold text-accent shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-text-primary">{user.name}</p>
                  <p className="text-[13px] text-text-muted mt-0.5">{user.email}</p>
              {user.notification_email && (
                <p className="text-[12px] text-text-muted mt-0.5">Notifications: {user.notification_email}</p>
              )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium capitalize">
                      {user.role.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Member since {memberSince}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-border-subtle flex items-center gap-4">
                <button
                  onClick={startEditingProfile}
                  className="text-[13px] text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit Profile
                </button>
                <button
                  onClick={() => { setShowPasswordModal(true); setPwError(''); setPwSuccess(''); setPwForm({ current: '', new: '', confirm: '' }); }}
                  className="text-[13px] text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Change Password
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {profileError && (
                <div className="bg-danger/8 border border-danger/20 rounded-lg p-2.5">
                  <p className="text-danger text-xs">{profileError}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">First Name</label>
                  <input
                    type="text" value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">Last Name</label>
                  <input
                    type="text" value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Work Email</label>
                <input
                  type="email" value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Notification Email</label>
                <input
                  type="email" value={profileForm.notification_email}
                  onChange={(e) => setProfileForm({ ...profileForm, notification_email: e.target.value })}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm"
                  placeholder="Personal email for notifications (optional)"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveProfile} disabled={profileSaving}
                  className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
                >
                  {profileSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="px-4 py-2 bg-bg-elevated text-text-secondary border border-border rounded-lg text-sm hover:text-text-primary hover:bg-bg-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Appearance Card */}
      <section className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h2 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Appearance</h2>
        </div>
        <div className="divide-y divide-border-subtle">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-text-primary">Theme</p>
              <p className="text-[12px] text-text-muted mt-0.5">
                {user.theme === 'light' ? 'Light mode' : 'Dark mode'}
              </p>
            </div>
            <Toggle enabled={user.theme === 'dark'} onChange={handleToggleTheme} />
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-text-primary">Compact Tickets</p>
              <p className="text-[12px] text-text-muted mt-0.5">
                {user.ticket_size === 'small' ? 'Showing smaller ticket cards' : 'Showing larger ticket cards'}
              </p>
            </div>
            <Toggle enabled={user.ticket_size === 'small'} onChange={handleToggleTicketSize} />
          </div>
        </div>
      </section>

      {/* Notifications Card */}
      <section className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h2 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Notifications</h2>
        </div>
        <div className="divide-y divide-border-subtle">
          {/* Push notifications */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-text-primary">Push Notifications</p>
              <p className="text-[12px] text-text-muted mt-0.5">Receive browser push notifications</p>
            </div>
            <Toggle enabled={pushEnabled} onChange={handleTogglePush} loading={pushLoading} />
          </div>

          {/* Section sub-header */}
          <div className="px-6 pt-4 pb-2">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Email Notifications</p>
          </div>

          {/* Email preferences */}
          {emailPrefKeys
            .filter(pref => !pref.adminOnly || isAdmin)
            .map((pref) => (
              <div key={pref.key} className="px-6 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-text-primary">{pref.label}</p>
                  <p className="text-[12px] text-text-muted mt-0.5">{pref.description}</p>
                </div>
                <Toggle
                  enabled={!!(user as any)[pref.key]}
                  onChange={() => handleToggleEmailPref(pref.key)}
                />
              </div>
            ))}
        </div>
      </section>

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
