import { useEffect, useState } from 'react';
import { api, type User, type Project, type Column } from '../lib/api';
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
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', first_name: '', last_name: '', password: '', role: 'viewer' });
  const [createError, setCreateError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', role: '' });
  const [editError, setEditError] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', abbreviation: '', color: '#7c7fdf', default_owner_id: '' });
  const [projectError, setProjectError] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectForm, setEditProjectForm] = useState({ name: '', abbreviation: '', color: '#7c7fdf', default_owner_id: '' });
  const [editProjectError, setEditProjectError] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [showCreateColumn, setShowCreateColumn] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: '', color: '#5f6270' });
  const [columnError, setColumnError] = useState('');
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [editColumnForm, setEditColumnForm] = useState({ name: '', color: '#5f6270' });
  const [editColumnError, setEditColumnError] = useState('');
  const [archiveDays, setArchiveDays] = useState('7');
  const [archiveDaysSaved, setArchiveDaysSaved] = useState('7');
  const [archiveSaving, setArchiveSaving] = useState(false);

  async function fetchUsers() {
    try { setUsers(await api.getUsers()); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  async function fetchProjects() {
    try { setProjects(await api.getProjects()); } catch {}
  }
  async function fetchColumns() {
    try { setColumns(await api.getColumns()); } catch {}
  }

  async function fetchSettings() {
    try {
      const s = await api.getSettings();
      if (s.archive_after_days) { setArchiveDays(s.archive_after_days); setArchiveDaysSaved(s.archive_after_days); }
    } catch {}
  }

  useEffect(() => { fetchUsers(); fetchProjects(); fetchColumns(); fetchSettings(); }, []);

  function openEditUser(u: User) {
    setEditingUser(u);
    setEditForm({ first_name: u.first_name || u.name.split(' ')[0] || '', last_name: u.last_name || u.name.split(' ').slice(1).join(' ') || '', email: u.email, role: u.role });
    setEditError('');
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    try {
      await api.updateUser(editingUser.id, editForm);
      setEditingUser(null);
      fetchUsers();
    } catch (e: any) { setEditError(e.message); }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Permanently delete this user? This cannot be undone. Their ticket assignments will be cleared.')) return;
    try { await api.deleteUser(userId); fetchUsers(); } catch (e: any) { alert(e.message); }
  }

  async function handleRoleChange(userId: string, currentRole: string, newRole: string) {
    if (newRole === currentRole) return;
    if (!confirm(`Change this user's role to ${roleLabels[newRole]}?`)) return;
    try { await api.updateRole(userId, newRole); fetchUsers(); } catch (e: any) { alert(e.message); }
  }
  async function handleSuspend(userId: string) {
    if (!confirm('Suspend this user? They will lose access.')) return;
    try { await api.suspendUser(userId); fetchUsers(); } catch (e: any) { alert(e.message); }
  }
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault(); setCreateError('');
    try { await api.createUser(newUser); setNewUser({ email: '', first_name: '', last_name: '', password: '', role: 'viewer' }); setShowCreate(false); fetchUsers(); }
    catch (e: any) { setCreateError(e.message); }
  }
  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault(); setProjectError('');
    try { await api.createProject({ ...newProject, default_owner_id: newProject.default_owner_id || undefined }); setNewProject({ name: '', abbreviation: '', color: '#7c7fdf', default_owner_id: '' }); setShowCreateProject(false); fetchProjects(); }
    catch (e: any) { setProjectError(e.message); }
  }
  async function handleDeleteProject(id: string) {
    if (!confirm('Delete this product?')) return;
    try { await api.deleteProject(id); fetchProjects(); } catch (e: any) { alert(e.message); }
  }

  function openEditProject(p: Project) {
    setEditingProject(p);
    setEditProjectForm({ name: p.name, abbreviation: p.abbreviation, color: p.color, default_owner_id: p.default_owner_id || '' });
    setEditProjectError('');
  }
  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProject) return;
    setEditProjectError('');
    try {
      await api.updateProject(editingProject.id, { ...editProjectForm, default_owner_id: editProjectForm.default_owner_id || null });
      setEditingProject(null);
      fetchProjects();
    } catch (e: any) { setEditProjectError(e.message); }
  }

  function openEditColumn(col: Column) {
    setEditingColumn(col);
    setEditColumnForm({ name: col.name, color: col.color });
    setEditColumnError('');
  }
  async function handleSaveColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!editingColumn) return;
    setEditColumnError('');
    try {
      await api.updateColumn(editingColumn.id, editColumnForm);
      setEditingColumn(null);
      fetchColumns();
    } catch (e: any) { setEditColumnError(e.message); }
  }

  async function handleCreateColumn(e: React.FormEvent) {
    e.preventDefault(); setColumnError('');
    try { await api.createColumn(newColumn); setNewColumn({ name: '', color: '#5f6270' }); setShowCreateColumn(false); fetchColumns(); }
    catch (e: any) { setColumnError(e.message); }
  }
  async function handleDeleteColumn(id: string) {
    if (!confirm('Delete this column? Tickets must be moved out first.')) return;
    try { await api.deleteColumn(id); fetchColumns(); } catch (e: any) { alert(e.message); }
  }
  async function handleMoveColumn(index: number, direction: -1 | 1) {
    const newCols = [...columns];
    const target = index + direction;
    if (target < 0 || target >= newCols.length) return;
    [newCols[index], newCols[target]] = [newCols[target], newCols[index]];
    const order = newCols.map((c, i) => ({ id: c.id, sort_order: i + 1 }));
    setColumns(newCols);
    try { await api.reorderColumns(order); } catch { fetchColumns(); }
  }
  async function handleToggleColumnFlag(id: string, flag: 'is_initial' | 'is_terminal', value: boolean) {
    try { await api.updateColumn(id, { [flag]: value }); fetchColumns(); } catch (e: any) { alert(e.message); }
  }

  async function handleExportCSV() {
    try {
      const tickets = await api.getTickets();
      const headers = ['Ticket #', 'Title', 'Description', 'Status', 'Priority', 'Type', 'Project', 'Milestone', 'Assignee', 'Submitted By', 'EDC', 'Tags', 'Created', 'Updated'];
      const rows = tickets.map(t => [
        `PDO-${t.ticket_number}`,
        t.title,
        t.description || '',
        t.status,
        t.priority.toUpperCase(),
        t.ticket_type,
        t.product_name || '',
        t.milestone_name || '',
        (t.assignee_names || []).join('; '),
        t.submitter_name || '',
        t.edc ? new Date(t.edc * 1000).toLocaleDateString() : '',
        (t.tags || []).join('; '),
        new Date(t.created_at * 1000).toLocaleString(),
        new Date(t.updated_at * 1000).toLocaleString(),
      ]);
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pdo-tickets-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-text-muted text-[13px]">Loading...</p></div>;

  const activeUsers = users.filter((u) => u.role !== 'suspended');
  const suspendedUsers = users.filter((u) => u.role === 'suspended');

  const fieldInput = "bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px]";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Admin</h1>
          <p className="text-[13px] text-text-muted mt-1">Manage users and projects</p>
        </div>
        <button onClick={handleExportCSV}
          className="text-[12px] px-3 py-1.5 bg-bg-elevated border border-border text-text-secondary rounded-lg font-medium hover:text-text-primary hover:bg-bg-hover flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {error && (
        <div className="bg-danger/8 border border-danger/20 rounded-lg p-4 mb-6">
          <p className="text-danger text-[13px]">{error}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {roleOptions.map((role) => (
          <div key={role} className="bg-bg-surface border border-border-subtle rounded-lg p-4">
            <p className="text-2xl font-bold text-text-primary tabular-nums">{activeUsers.filter((u) => u.role === role).length}</p>
            <p className="text-[11px] text-text-muted mt-0.5 font-medium uppercase tracking-wider">{roleLabels[role]}s</p>
          </div>
        ))}
      </div>

      {/* Users section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary">Users</h2>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)}
              className="text-[12px] px-3 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover">
              Add User
            </button>
          )}
        </div>

        {showCreate && (
          <form onSubmit={handleCreateUser} className="bg-bg-surface border border-border rounded-lg p-4 space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">New User</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {createError && <p className="text-danger text-[12px]">{createError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <input value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} placeholder="First name" required className={fieldInput} />
              <input value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} placeholder="Last name" required className={fieldInput} />
              <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" required className={fieldInput} />
              <div className="relative">
                <input type={showNewUserPassword ? 'text' : 'password'} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Temp password (min 8)" required minLength={8} className={`${fieldInput} w-full pr-9`} />
                <button type="button" onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                  {showNewUserPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className={fieldInput}>
                {roleOptions.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
              </select>
            </div>
            <button type="submit" className="text-[12px] px-4 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover">Create User</button>
          </form>
        )}

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-bg-elevated text-text-muted text-left">
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">User</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Email</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Role</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Last Login</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Joined</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((u) => (
                <tr key={u.id} className="border-t border-border-subtle hover:bg-bg-elevated/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] text-accent font-semibold">
                        {u.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-text-primary">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select value={u.role} onChange={(e) => handleRoleChange(u.id, u.role, e.target.value)}
                      className="bg-bg-elevated border border-border rounded-md px-2 py-1 text-[12px]">
                      {roleOptions.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted text-[12px]">
                    {u.last_login ? new Date(u.last_login * 1000).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted text-[12px]">
                    {new Date(u.created_at * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditUser(u)} className="text-[11px] text-text-muted hover:text-text-primary font-medium">Edit</button>
                      {u.id !== currentUser?.id && (
                        <>
                          <button onClick={() => handleSuspend(u.id)} className="text-[11px] text-p1/70 hover:text-p1 font-medium">Suspend</button>
                          <button onClick={() => handleDeleteUser(u.id)} className="text-[11px] text-danger/60 hover:text-danger font-medium">Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {suspendedUsers.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[12px] font-medium text-text-muted mb-2 uppercase tracking-wider">Suspended ({suspendedUsers.length})</h3>
            <div className="border border-border-subtle rounded-lg overflow-hidden opacity-50">
              <table className="w-full text-[13px]">
                <tbody>
                  {suspendedUsers.map((u) => (
                    <tr key={u.id} className="border-t first:border-t-0 border-border-subtle">
                      <td className="px-4 py-2 text-text-secondary">{u.name}</td>
                      <td className="px-4 py-2 text-text-muted">{u.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Projects section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary">Projects</h2>
          {!showCreateProject && (
            <button onClick={() => setShowCreateProject(true)}
              className="text-[12px] px-3 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover">
              Add Project
            </button>
          )}
        </div>

        {showCreateProject && (
          <form onSubmit={handleCreateProject} className="bg-bg-surface border border-border rounded-lg p-4 space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">New Project</h3>
              <button type="button" onClick={() => setShowCreateProject(false)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {projectError && <p className="text-danger text-[12px]">{projectError}</p>}
            <div className="grid grid-cols-[1fr_1fr_1fr_60px] gap-3">
              <input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="Project name" required className={fieldInput} />
              <input value={newProject.abbreviation} onChange={(e) => setNewProject({ ...newProject, abbreviation: e.target.value })} placeholder="Abbrev (e.g. GEN)" required maxLength={5} className={fieldInput} />
              <select value={newProject.default_owner_id} onChange={(e) => setNewProject({ ...newProject, default_owner_id: e.target.value })} className={fieldInput}>
                <option value="">No default owner</option>
                {activeUsers.filter(u => ['dev', 'admin'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input type="color" value={newProject.color} onChange={(e) => setNewProject({ ...newProject, color: e.target.value })} className="h-10 w-full bg-bg-elevated border border-border rounded-lg cursor-pointer" />
            </div>
            <button type="submit" className="text-[12px] px-4 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover">Create</button>
          </form>
        )}

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-bg-elevated text-text-muted text-left">
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider w-12"></th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Code</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Default Owner</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-border-subtle hover:bg-bg-elevated/40 transition-colors">
                  <td className="px-4 py-2.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} /></td>
                  <td className="px-4 py-2.5 text-text-primary font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-text-muted font-mono text-[12px]">{p.abbreviation}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={p.default_owner_id || ''}
                      onChange={async (e) => {
                        try { await api.updateProject(p.id, { default_owner_id: e.target.value || null }); fetchProjects(); } catch (err: any) { alert(err.message); }
                      }}
                      className="bg-bg-elevated border border-border rounded-md px-2 py-1 text-[12px]"
                    >
                      <option value="">None</option>
                      {activeUsers.filter(u => ['dev', 'admin'].includes(u.role)).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditProject(p)} className="text-[11px] text-text-muted hover:text-text-primary font-medium">Edit</button>
                      <button onClick={() => handleDeleteProject(p.id)} className="text-[11px] text-danger/60 hover:text-danger font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted text-[13px]">No projects yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Columns section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary">Board Columns</h2>
          {!showCreateColumn && (
            <button onClick={() => setShowCreateColumn(true)}
              className="text-[12px] px-3 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover">
              Add Column
            </button>
          )}
        </div>

        {showCreateColumn && (
          <form onSubmit={handleCreateColumn} className="bg-bg-surface border border-border rounded-lg p-4 space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">New Column</h3>
              <button type="button" onClick={() => setShowCreateColumn(false)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {columnError && <p className="text-danger text-[12px]">{columnError}</p>}
            <div className="grid grid-cols-[1fr_60px] gap-3">
              <input value={newColumn.name} onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })} placeholder="Column name" required className={fieldInput} />
              <input type="color" value={newColumn.color} onChange={(e) => setNewColumn({ ...newColumn, color: e.target.value })} className="h-10 w-full bg-bg-elevated border border-border rounded-lg cursor-pointer" />
            </div>
            <button type="submit" className="text-[12px] px-4 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover">Create</button>
          </form>
        )}

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-bg-elevated text-text-muted text-left">
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider w-16">Order</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider w-10"></th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Slug</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider text-center">Initial</th>
                <th className="px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider text-center">Done</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => (
                <tr key={col.id} className="border-t border-border-subtle hover:bg-bg-elevated/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => handleMoveColumn(i, -1)} disabled={i === 0}
                        className="text-text-muted hover:text-text-primary disabled:opacity-20 p-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <button onClick={() => handleMoveColumn(i, 1)} disabled={i === columns.length - 1}
                        className="text-text-muted hover:text-text-primary disabled:opacity-20 p-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} /></td>
                  <td className="px-4 py-2.5 text-text-primary font-medium">{col.name}</td>
                  <td className="px-4 py-2.5 text-text-muted font-mono text-[12px]">{col.slug}</td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="radio" name="initial_col" checked={!!col.is_initial}
                      onChange={() => handleToggleColumnFlag(col.id, 'is_initial', true)}
                      className="accent-accent" />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="radio" name="terminal_col" checked={!!col.is_terminal}
                      onChange={() => handleToggleColumnFlag(col.id, 'is_terminal', true)}
                      className="accent-success" />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditColumn(col)} className="text-[11px] text-text-muted hover:text-text-primary font-medium">Edit</button>
                      {!col.is_initial && (
                        <button onClick={() => handleDeleteColumn(col.id)} className="text-[11px] text-danger/60 hover:text-danger font-medium">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {columns.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted text-[13px]">No columns configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-muted mt-2">
          <strong>Initial</strong> = new tickets land here. <strong>Done</strong> = triggers completion notification to submitter.
        </p>
      </div>

      {/* Settings */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-text-primary mb-4">Settings</h2>
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-text-primary font-medium">Auto-archive after</p>
              <p className="text-[11px] text-text-muted mt-0.5">Tickets in the Done column will be automatically archived after this many days.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={archiveDays}
                onChange={(e) => setArchiveDays(e.target.value)}
                className="w-20 bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-[13px] text-center"
              />
              <span className="text-[13px] text-text-muted">days</span>
              {archiveDays !== archiveDaysSaved && (
                <button
                  onClick={async () => {
                    setArchiveSaving(true);
                    try {
                      await api.updateSettings({ archive_after_days: archiveDays });
                      setArchiveDaysSaved(archiveDays);
                    } catch (e: any) { alert(e.message); }
                    setArchiveSaving(false);
                  }}
                  disabled={archiveSaving}
                  className="text-[12px] px-3 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50"
                >
                  {archiveSaving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingUser(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {editError && (
              <div className="bg-danger/8 border border-danger/20 rounded-lg p-2.5 mb-4">
                <p className="text-danger text-xs">{editError}</p>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">First Name</label>
                  <input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} required className={fieldInput + ' w-full'} />
                </div>
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">Last Name</label>
                  <input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} required className={fieldInput + ' w-full'} />
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required className={fieldInput + ' w-full'} />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={fieldInput + ' w-full'}>
                  {roleOptions.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover">Save</button>
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 bg-bg-elevated border border-border text-text-secondary rounded-lg text-sm hover:text-text-primary hover:bg-bg-hover">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingProject(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Edit Project</h2>
              <button onClick={() => setEditingProject(null)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {editProjectError && (
              <div className="bg-danger/8 border border-danger/20 rounded-lg p-2.5 mb-4">
                <p className="text-danger text-xs">{editProjectError}</p>
              </div>
            )}
            <form onSubmit={handleSaveProject} className="space-y-3">
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">Name</label>
                  <input value={editProjectForm.name} onChange={(e) => setEditProjectForm({ ...editProjectForm, name: e.target.value })} required className={fieldInput + ' w-full'} />
                </div>
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">Color</label>
                  <input type="color" value={editProjectForm.color} onChange={(e) => setEditProjectForm({ ...editProjectForm, color: e.target.value })} className="h-10 w-full bg-bg-elevated border border-border rounded-lg cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Abbreviation</label>
                <input value={editProjectForm.abbreviation} onChange={(e) => setEditProjectForm({ ...editProjectForm, abbreviation: e.target.value })} required maxLength={5} className={fieldInput + ' w-full'} />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1.5 font-medium">Default Owner</label>
                <select value={editProjectForm.default_owner_id} onChange={(e) => setEditProjectForm({ ...editProjectForm, default_owner_id: e.target.value })} className={fieldInput + ' w-full'}>
                  <option value="">None</option>
                  {activeUsers.filter(u => ['dev', 'admin'].includes(u.role)).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover">Save</button>
                <button type="button" onClick={() => setEditingProject(null)} className="px-4 py-2 bg-bg-elevated border border-border text-text-secondary rounded-lg text-sm hover:text-text-primary hover:bg-bg-hover">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Column Modal */}
      {editingColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingColumn(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Edit Column</h2>
              <button onClick={() => setEditingColumn(null)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {editColumnError && (
              <div className="bg-danger/8 border border-danger/20 rounded-lg p-2.5 mb-4">
                <p className="text-danger text-xs">{editColumnError}</p>
              </div>
            )}
            <form onSubmit={handleSaveColumn} className="space-y-3">
              <div className="grid grid-cols-[1fr_60px] gap-3">
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">Name</label>
                  <input value={editColumnForm.name} onChange={(e) => setEditColumnForm({ ...editColumnForm, name: e.target.value })} required className={fieldInput + ' w-full'} />
                </div>
                <div>
                  <label className="text-xs text-text-secondary block mb-1.5 font-medium">Color</label>
                  <input type="color" value={editColumnForm.color} onChange={(e) => setEditColumnForm({ ...editColumnForm, color: e.target.value })} className="h-10 w-full bg-bg-elevated border border-border rounded-lg cursor-pointer" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover">Save</button>
                <button type="button" onClick={() => setEditingColumn(null)} className="px-4 py-2 bg-bg-elevated border border-border text-text-secondary rounded-lg text-sm hover:text-text-primary hover:bg-bg-hover">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
