import { useState, useEffect, useMemo } from 'react';
import { api, type Milestone, type Project } from '../lib/api';
import { useStore } from '../lib/store';

export function MilestonesPage() {
  const user = useStore((s) => s.user);
  const canEdit = user && ['dev', 'admin'].includes(user.role);
  const canDelete = user && user.role === 'admin';

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState<string | null>(null); // project_id or null
  const [createForm, setCreateForm] = useState({ name: '', description: '', target_date: '' });
  const [createError, setCreateError] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', target_date: '' });
  const [editError, setEditError] = useState('');

  // Filter
  const [projectFilter, setProjectFilter] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([api.getMilestones(), api.getProjects()]);
      setMilestones(m);
      setProjects(p);
    } catch { setError('Failed to load milestones.'); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const grouped = useMemo(() => {
    const filtered = milestones.filter(m => {
      if (projectFilter && m.project_id !== projectFilter) return false;
      if (!showClosed && m.status === 'closed') return false;
      return true;
    });
    const groups: Record<string, { project: Project; milestones: Milestone[] }> = {};
    for (const m of filtered) {
      if (!groups[m.project_id]) {
        const project = projects.find(p => p.id === m.project_id);
        if (!project) continue;
        groups[m.project_id] = { project, milestones: [] };
      }
      groups[m.project_id].milestones.push(m);
    }
    return Object.values(groups).sort((a, b) => a.project.name.localeCompare(b.project.name));
  }, [milestones, projects, projectFilter, showClosed]);

  async function handleCreate(projectId: string) {
    setCreateError('');
    if (!createForm.name.trim()) { setCreateError('Name is required.'); return; }
    try {
      await api.createMilestone({
        name: createForm.name.trim(),
        project_id: projectId,
        description: createForm.description.trim() || undefined,
        target_date: createForm.target_date ? Math.floor(new Date(createForm.target_date).getTime() / 1000) : undefined,
      });
      setShowCreate(null);
      setCreateForm({ name: '', description: '', target_date: '' });
      fetchData();
    } catch (e: any) { setCreateError(e.message); }
  }

  function openEdit(m: Milestone) {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      description: m.description || '',
      target_date: m.target_date ? new Date(m.target_date * 1000).toISOString().split('T')[0] : '',
    });
    setEditError('');
  }

  async function handleEdit(id: string) {
    setEditError('');
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    try {
      await api.updateMilestone(id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        target_date: editForm.target_date ? Math.floor(new Date(editForm.target_date).getTime() / 1000) : null,
      });
      setEditingId(null);
      fetchData();
    } catch (e: any) { setEditError(e.message); }
  }

  async function toggleStatus(m: Milestone) {
    try {
      await api.updateMilestone(m.id, { status: m.status === 'open' ? 'closed' : 'open' });
      fetchData();
    } catch { /* ignore */ }
  }

  async function handleDelete(m: Milestone) {
    if (!confirm(`Delete milestone "${m.name}"? Tickets will be unlinked.`)) return;
    try {
      await api.deleteMilestone(m.id);
      fetchData();
    } catch (e: any) { setError(e.message); }
  }

  const fieldInput = 'w-full bg-bg-elevated border border-border rounded-md px-2.5 py-1.5 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent';

  if (loading) return <div className="flex items-center justify-center h-full text-text-muted">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Milestones</h1>
        <div className="flex items-center gap-3">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={`${fieldInput} w-44`}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-text-muted cursor-pointer">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-accent" />
            Show closed
          </label>
        </div>
      </div>

      {error && <p className="text-danger text-[13px] mb-4">{error}</p>}

      {grouped.length === 0 && (
        <p className="text-text-muted text-[13px]">No milestones found.</p>
      )}

      {grouped.map(({ project, milestones: ms }) => (
        <div key={project.id} className="mb-8">
          {/* Project header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: `${project.color}15`, color: project.color }}>
                {project.abbreviation}
              </span>
              <h2 className="text-[15px] font-semibold text-text-primary">{project.name}</h2>
            </div>
            {canEdit && (
              <button
                onClick={() => { setShowCreate(showCreate === project.id ? null : project.id); setCreateForm({ name: '', description: '', target_date: '' }); setCreateError(''); }}
                className="text-[12px] text-accent hover:text-accent-hover font-medium"
              >
                + New Milestone
              </button>
            )}
          </div>

          {/* Create form */}
          {showCreate === project.id && (
            <div className="bg-bg-surface border border-border rounded-lg p-3 mb-3 space-y-2">
              <input value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Milestone name" className={fieldInput} autoFocus />
              <textarea value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)" rows={2} className={`${fieldInput} resize-none`} />
              <input type="date" value={createForm.target_date} onChange={(e) => setCreateForm(f => ({ ...f, target_date: e.target.value }))}
                className={fieldInput} />
              {createError && <p className="text-danger text-[12px]">{createError}</p>}
              <div className="flex items-center gap-2">
                <button onClick={() => handleCreate(project.id)} className="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-medium hover:bg-accent-hover">Create</button>
                <button onClick={() => setShowCreate(null)} className="px-3 py-1.5 text-[12px] text-text-muted hover:text-text-secondary">Cancel</button>
              </div>
            </div>
          )}

          {/* Milestone cards */}
          <div className="space-y-2">
            {ms.map(m => (
              <div key={m.id} className={`bg-bg-surface border rounded-lg p-3 ${m.status === 'closed' ? 'border-border-subtle opacity-60' : 'border-border'}`}>
                {editingId === m.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className={fieldInput} autoFocus />
                    <textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Description" rows={2} className={`${fieldInput} resize-none`} />
                    <input type="date" value={editForm.target_date} onChange={(e) => setEditForm(f => ({ ...f, target_date: e.target.value }))}
                      className={fieldInput} />
                    {editError && <p className="text-danger text-[12px]">{editError}</p>}
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(m.id)} className="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-medium hover:bg-accent-hover">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-[12px] text-text-muted hover:text-text-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* Read mode */
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-text-primary">{m.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.status === 'open' ? 'bg-success/10 text-success' : 'bg-bg-elevated text-text-muted'}`}>
                          {m.status}
                        </span>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleStatus(m)} className="text-[11px] text-text-muted hover:text-text-secondary">
                            {m.status === 'open' ? 'Close' : 'Reopen'}
                          </button>
                          <button onClick={() => openEdit(m)} className="text-[11px] text-text-muted hover:text-accent">Edit</button>
                          {canDelete && (
                            <button onClick={() => handleDelete(m)} className="text-[11px] text-text-muted hover:text-danger">Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                    {m.description && <p className="text-[12px] text-text-secondary mb-2">{m.description}</p>}
                    <div className="flex items-center gap-4 text-[11px] text-text-muted">
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-300"
                            style={{ width: m.total_tickets > 0 ? `${(m.done_tickets / m.total_tickets) * 100}%` : '0%' }}
                          />
                        </div>
                        <span>{m.done_tickets}/{m.total_tickets}</span>
                      </div>
                      {m.target_date && (
                        <span className={m.status === 'open' && m.target_date * 1000 < Date.now() ? 'text-danger' : ''}>
                          Target: {new Date(m.target_date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
