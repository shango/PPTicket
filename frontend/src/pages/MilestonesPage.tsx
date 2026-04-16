import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Milestone, type Project, type TicketWithMeta, type Column } from '../lib/api';
import { useStore } from '../lib/store';

const priorityColors: Record<string, string> = {
  p0: '#d4564e',
  p1: '#d4944e',
  p2: '#7c7fdf',
  p3: '#5f6270',
};

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatDateFull(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function daysFromNow(unix: number) {
  const now = Date.now() / 1000;
  return Math.ceil((unix - now) / 86400);
}

export function MilestonesPage() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const canEdit = user && ['decision_maker', 'dev', 'admin'].includes(user.role);

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tickets, setTickets] = useState<TicketWithMeta[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState<string | null>(null);
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
      const [m, p, t, c] = await Promise.all([
        api.getMilestones(),
        api.getProjects(),
        api.getTickets(),
        api.getColumns(),
      ]);
      setMilestones(m);
      setProjects(p);
      setTickets(t);
      setColumns(c);
    } catch { setError('Failed to load data.'); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const terminalSlugs = useMemo(
    () => new Set(columns.filter(c => c.is_terminal).map(c => c.slug)),
    [columns]
  );

  // Build roadmap data per project
  const roadmaps = useMemo(() => {
    const projectsToShow = projects.filter(p => !projectFilter || p.id === projectFilter);

    return projectsToShow.map(project => {
      const projectMilestones = milestones
        .filter(m => m.project_id === project.id && (showClosed || m.status !== 'closed') && m.target_date)
        .sort((a, b) => a.target_date! - b.target_date!);

      if (projectMilestones.length === 0) return null;

      const projectTickets = tickets
        .filter(t => t.product_id === project.id && t.edc)
        .sort((a, b) => a.edc! - b.edc!);

      // Group tickets into segments: each segment ends at a milestone
      // Tickets with EDC <= milestone target_date belong to that milestone's segment
      const segments: { milestone: Milestone; tickets: TicketWithMeta[] }[] = [];
      let remainingTickets = [...projectTickets];

      for (const ms of projectMilestones) {
        const segTickets = remainingTickets.filter(t => t.edc! <= ms.target_date!);
        remainingTickets = remainingTickets.filter(t => t.edc! > ms.target_date!);
        segments.push({ milestone: ms, tickets: segTickets });
      }

      return { project, segments, remainingTickets };
    }).filter(Boolean) as { project: Project; segments: { milestone: Milestone; tickets: TicketWithMeta[] }[]; remainingTickets: TicketWithMeta[] }[];
  }, [projects, milestones, tickets, projectFilter, showClosed]);

  async function handleCreate(projectId: string) {
    setCreateError('');
    if (!createForm.name.trim()) { setCreateError('Name is required.'); return; }
    if (!createForm.target_date) { setCreateError('Target date is required for roadmap.'); return; }
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-semibold text-text-primary tracking-tight">Roadmap</h1>
          <div className="h-4 w-px bg-border" />
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-secondary">
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer select-none">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-accent" />
            Closed
          </label>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" /> Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent" /> In Progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger" /> Past EDC
          </span>
        </div>
      </div>

      {error && <p className="text-danger text-[13px] px-6 pt-3">{error}</p>}

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {roadmaps.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-[13px] mb-2">No milestones with target dates found.</p>
            <p className="text-text-muted text-[11px]">Create a milestone with a target date to build your roadmap.</p>
          </div>
        )}

        {roadmaps.map(({ project, segments }) => (
          <div key={project.id}>
            {/* Project header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: project.color }} />
                <h2 className="text-[15px] font-semibold text-text-primary">{project.name}</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${project.color}15`, color: project.color }}>
                  {project.abbreviation}
                </span>
              </div>
              {canEdit && (
                <button
                  onClick={() => { setShowCreate(showCreate === project.id ? null : project.id); setCreateForm({ name: '', description: '', target_date: '' }); setCreateError(''); }}
                  className="text-[12px] text-accent hover:text-accent-hover font-medium flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Milestone
                </button>
              )}
            </div>

            {/* Create form */}
            {showCreate === project.id && (
              <div className="bg-bg-surface border border-border rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Milestone name" className={fieldInput} autoFocus />
                  <input type="date" value={createForm.target_date} onChange={(e) => setCreateForm(f => ({ ...f, target_date: e.target.value }))}
                    className={fieldInput} />
                  <input value={createForm.description} onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional)" className={fieldInput} />
                </div>
                {createError && <p className="text-danger text-[12px] mb-2">{createError}</p>}
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCreate(project.id)} className="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-medium hover:bg-accent-hover">Create</button>
                  <button onClick={() => setShowCreate(null)} className="px-3 py-1.5 text-[12px] text-text-muted hover:text-text-secondary">Cancel</button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="relative overflow-x-auto pb-2">
              <div className="min-w-full">
                {segments.map(({ milestone: ms, tickets: segTickets }, segIdx) => (
                  <TimelineSegment
                    key={ms.id}
                    milestone={ms}
                    tickets={segTickets}
                    projectColor={project.color}
                    isFirst={segIdx === 0}
                    isLast={segIdx === segments.length - 1}
                    terminalSlugs={terminalSlugs}
                    canEdit={!!canEdit}
                    editingId={editingId}
                    editForm={editForm}
                    editError={editError}
                    onEdit={openEdit}
                    onEditChange={setEditForm}
                    onEditSave={handleEdit}
                    onEditCancel={() => setEditingId(null)}
                    onToggleStatus={toggleStatus}
                    onDelete={handleDelete}
                    onTicketClick={(t) => navigate(`/tickets/${t.id}`)}
                    fieldInput={fieldInput}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Timeline Segment ─────────────────────────────────── */

interface SegmentProps {
  milestone: Milestone;
  tickets: TicketWithMeta[];
  projectColor: string;
  isFirst: boolean;
  isLast: boolean;
  terminalSlugs: Set<string>;
  canEdit: boolean;
  editingId: string | null;
  editForm: { name: string; description: string; target_date: string };
  editError: string;
  onEdit: (m: Milestone) => void;
  onEditChange: (f: { name: string; description: string; target_date: string }) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onToggleStatus: (m: Milestone) => void;
  onDelete: (m: Milestone) => void;
  onTicketClick: (t: TicketWithMeta) => void;
  fieldInput: string;
}

function TimelineSegment({
  milestone: ms, tickets, projectColor, isFirst, isLast,
  terminalSlugs, canEdit, editingId, editForm, editError,
  onEdit, onEditChange, onEditSave, onEditCancel, onToggleStatus, onDelete, onTicketClick, fieldInput,
}: SegmentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPast = ms.target_date && ms.target_date * 1000 < Date.now();
  const isClosed = ms.status === 'closed';
  const days = ms.target_date ? daysFromNow(ms.target_date) : null;
  const doneCount = tickets.filter(t => terminalSlugs.has(t.status)).length;
  const totalCount = tickets.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const isEditing = editingId === ms.id;

  return (
    <div className={`flex items-stretch gap-0 ${isClosed && !isEditing ? 'opacity-50' : ''}`}>
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 w-12">
        {/* Vertical line top */}
        <div className={`w-px flex-1 ${isFirst ? 'bg-transparent' : 'bg-border'}`} />
        {/* Milestone diamond */}
        <div className="relative my-1">
          <div
            className="w-4 h-4 rotate-45 rounded-[3px] border-2 transition-colors"
            style={{
              borderColor: isClosed ? 'var(--color-text-muted)' : projectColor,
              backgroundColor: isClosed ? 'var(--color-text-muted)' : isPast ? projectColor : 'transparent',
            }}
          />
        </div>
        {/* Vertical line bottom */}
        <div className={`w-px flex-1 ${isLast ? 'bg-transparent' : 'bg-border'}`} />
      </div>

      {/* Segment content */}
      <div className="flex-1 py-3 pl-2 pr-1 min-w-0">
        {isEditing ? (
          /* Edit form inline */
          <div className="bg-bg-surface border border-border rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input value={editForm.name} onChange={(e) => onEditChange({ ...editForm, name: e.target.value })}
                className={fieldInput} autoFocus />
              <input type="date" value={editForm.target_date} onChange={(e) => onEditChange({ ...editForm, target_date: e.target.value })}
                className={fieldInput} />
              <input value={editForm.description} onChange={(e) => onEditChange({ ...editForm, description: e.target.value })}
                placeholder="Description" className={fieldInput} />
            </div>
            {editError && <p className="text-danger text-[12px]">{editError}</p>}
            <div className="flex items-center gap-2">
              <button onClick={() => onEditSave(ms.id)} className="px-3 py-1 bg-accent text-white rounded-md text-[12px] font-medium hover:bg-accent-hover">Save</button>
              <button onClick={onEditCancel} className="px-3 py-1 text-[12px] text-text-muted hover:text-text-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {/* Milestone header row */}
            <div className="flex items-center gap-3 mb-2 group">
              <h3 className="text-[14px] font-semibold text-text-primary">{ms.name}</h3>
              {ms.target_date && (
                <span className={`text-[11px] font-mono tabular-nums ${isPast && !isClosed ? 'text-danger' : 'text-text-muted'}`}>
                  {formatDateFull(ms.target_date)}
                </span>
              )}
              {days !== null && !isClosed && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  isPast ? 'bg-danger/10 text-danger' :
                  days <= 7 ? 'bg-p1/12 text-p1' :
                  'bg-bg-elevated text-text-muted'
                }`}>
                  {isPast ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                </span>
              )}
              {isClosed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">Closed</span>
              )}
              {/* Progress pill */}
              {totalCount > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  <div className="w-16 h-1 bg-bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: projectColor }} />
                  </div>
                  <span className="text-[10px] text-text-muted tabular-nums">{doneCount}/{totalCount}</span>
                </div>
              )}
              {ms.description && (
                <span className="text-[11px] text-text-muted italic hidden group-hover:inline truncate max-w-xs">{ms.description}</span>
              )}
              {/* Edit controls */}
              {canEdit && (
                <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onToggleStatus(ms)} className="text-[10px] text-text-muted hover:text-text-secondary">{ms.status === 'open' ? 'Close' : 'Reopen'}</button>
                  <button onClick={() => onEdit(ms)} className="text-[10px] text-text-muted hover:text-accent">Edit</button>
                  <button onClick={() => onDelete(ms)} className="text-[10px] text-text-muted hover:text-danger">Delete</button>
                </div>
              )}
            </div>

            {/* Ticket cards — horizontal scroll */}
            {tickets.length > 0 && (
              <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {tickets.map(t => {
                  const isDone = terminalSlugs.has(t.status);
                  const isPastEdc = t.edc && t.edc * 1000 < Date.now() && !isDone;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onTicketClick(t)}
                      className={`shrink-0 w-52 bg-bg-surface border rounded-lg p-2.5 text-left transition-all hover:border-border hover:bg-bg-elevated group/card ${
                        isDone ? 'border-success/20' : isPastEdc ? 'border-danger/25' : 'border-border-subtle'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-text-muted">PDO-{t.ticket_number}</span>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityColors[t.priority] || priorityColors.p3 }} />
                          <span className={`w-2 h-2 rounded-full ${isDone ? 'bg-success' : isPastEdc ? 'bg-danger' : 'bg-accent'}`} />
                        </div>
                      </div>
                      <p className="text-[12px] text-text-primary leading-snug line-clamp-2 mb-1.5 font-medium">{t.title}</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono tabular-nums ${isDone ? 'text-success' : isPastEdc ? 'text-danger' : 'text-text-muted'}`}>
                          {isDone ? 'Done' : ''} {t.edc ? formatDate(t.edc) : ''}
                        </span>
                        {t.assignee_names.length > 0 && (
                          <div className="flex -space-x-1">
                            {t.assignee_names.slice(0, 2).map((name, i) => (
                              <div key={i} className="w-4 h-4 rounded-full bg-accent/15 flex items-center justify-center text-[7px] text-accent font-semibold ring-1 ring-bg-surface">
                                {name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {tickets.length === 0 && (
              <p className="text-[11px] text-text-muted pl-1">No tickets with EDC before this milestone.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
