import { useEffect, useState, useMemo } from 'react';
import { api, type TicketWithMeta, type Column, type Project, type User } from '../lib/api';

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-5 bg-bg-elevated rounded-full overflow-hidden flex-1">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg p-4">
      <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--color-text-primary)' }}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export function StatsPage() {
  const [tickets, setTickets] = useState<TicketWithMeta[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getTickets(),
      api.getColumns(),
      api.getProjects(),
      api.getUsers().catch(() => []),
    ]).then(([t, c, p, u]) => {
      setTickets(t);
      setColumns(c);
      setProjects(p);
      if (Array.isArray(u)) setUsers(u.filter(usr => usr.role !== 'suspended'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const terminalSlugs = useMemo(() => new Set(columns.filter(c => c.is_terminal).map(c => c.slug)), [columns]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const done = tickets.filter(t => terminalSlugs.has(t.status));
    const open = tickets.filter(t => !terminalSlugs.has(t.status));
    const bugsDone = done.filter(t => t.ticket_type === 'bug');
    const featuresDone = done.filter(t => t.ticket_type === 'feature');
    const bugsOpen = open.filter(t => t.ticket_type === 'bug');
    const featuresOpen = open.filter(t => t.ticket_type === 'feature');
    return { total, done: done.length, open: open.length, bugsDone: bugsDone.length, featuresDone: featuresDone.length, bugsOpen: bugsOpen.length, featuresOpen: featuresOpen.length };
  }, [tickets, terminalSlugs]);

  const projectStats = useMemo(() => {
    return projects.map(p => {
      const pTickets = tickets.filter(t => t.product_id === p.id);
      const done = pTickets.filter(t => terminalSlugs.has(t.status));
      const open = pTickets.filter(t => !terminalSlugs.has(t.status));
      return {
        project: p,
        total: pTickets.length,
        done: done.length,
        open: open.length,
        bugsDone: done.filter(t => t.ticket_type === 'bug').length,
        featuresDone: done.filter(t => t.ticket_type === 'feature').length,
        bugsOpen: open.filter(t => t.ticket_type === 'bug').length,
        featuresOpen: open.filter(t => t.ticket_type === 'feature').length,
      };
    }).filter(p => p.total > 0).sort((a, b) => b.total - a.total);
  }, [tickets, projects, terminalSlugs]);

  const devStats = useMemo(() => {
    const devs = users.filter(u => ['dev', 'admin'].includes(u.role));
    return devs.map(u => {
      const assigned = tickets.filter(t => t.assignee_ids.includes(u.id));
      const done = assigned.filter(t => terminalSlugs.has(t.status));
      const open = assigned.filter(t => !terminalSlugs.has(t.status));
      return {
        user: u,
        total: assigned.length,
        done: done.length,
        open: open.length,
        bugsDone: done.filter(t => t.ticket_type === 'bug').length,
        featuresDone: done.filter(t => t.ticket_type === 'feature').length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [tickets, users, terminalSlugs]);

  const statusBreakdown = useMemo(() => {
    return columns.map(c => ({
      column: c,
      count: tickets.filter(t => t.status === c.slug).length,
    }));
  }, [tickets, columns]);

  const maxStatus = Math.max(...statusBreakdown.map(s => s.count), 1);
  const maxProject = Math.max(...projectStats.map(p => p.total), 1);
  const maxDev = Math.max(...devStats.map(d => d.total), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted text-[13px]">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 overflow-y-auto h-full">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Statistics</h1>
        <p className="text-[13px] text-text-muted mt-1">Team productivity and project health overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Tickets" value={stats.total} />
        <StatCard label="Open" value={stats.open} color="var(--color-accent)" sub={`${stats.bugsOpen} bugs, ${stats.featuresOpen} features`} />
        <StatCard label="Bugs Fixed" value={stats.bugsDone} color="var(--color-danger)" />
        <StatCard label="Features Shipped" value={stats.featuresDone} color="var(--color-success)" />
      </div>

      {/* Status pipeline */}
      <div className="bg-bg-surface border border-border-subtle rounded-lg p-5 mb-6">
        <h2 className="text-[13px] font-semibold text-text-primary mb-4">Pipeline</h2>
        <div className="space-y-2.5">
          {statusBreakdown.map(({ column, count }) => (
            <div key={column.id} className="flex items-center gap-3">
              <span className="text-[12px] text-text-secondary w-24 shrink-0 truncate">{column.name}</span>
              <Bar value={count} max={maxStatus} color={column.color} />
              <span className="text-[12px] text-text-muted w-8 text-right font-mono">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-project */}
      {projectStats.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-5 mb-6">
          <h2 className="text-[13px] font-semibold text-text-primary mb-4">By Project</h2>
          <div className="space-y-4">
            {projectStats.map(({ project, total, done, bugsDone, featuresDone, bugsOpen, featuresOpen }) => (
              <div key={project.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium" style={{ color: project.color }}>{project.name}</span>
                    <span className="text-[10px] text-text-muted">{done}/{total} done</span>
                  </div>
                </div>
                <div className="flex gap-1 h-5 rounded-full overflow-hidden bg-bg-elevated">
                  {bugsDone > 0 && (
                    <div className="h-full bg-danger/70 transition-all duration-500" style={{ width: `${(bugsDone / maxProject) * 100}%` }} title={`${bugsDone} bugs fixed`} />
                  )}
                  {featuresDone > 0 && (
                    <div className="h-full bg-success/70 transition-all duration-500" style={{ width: `${(featuresDone / maxProject) * 100}%` }} title={`${featuresDone} features shipped`} />
                  )}
                  {bugsOpen > 0 && (
                    <div className="h-full bg-danger/20 transition-all duration-500" style={{ width: `${(bugsOpen / maxProject) * 100}%` }} title={`${bugsOpen} open bugs`} />
                  )}
                  {featuresOpen > 0 && (
                    <div className="h-full bg-success/20 transition-all duration-500" style={{ width: `${(featuresOpen / maxProject) * 100}%` }} title={`${featuresOpen} open features`} />
                  )}
                </div>
                <div className="flex gap-4 mt-1">
                  <span className="text-[10px] text-text-muted"><span className="inline-block w-2 h-2 rounded-full bg-danger/70 mr-1" />{bugsDone} bugs fixed</span>
                  <span className="text-[10px] text-text-muted"><span className="inline-block w-2 h-2 rounded-full bg-success/70 mr-1" />{featuresDone} features shipped</span>
                  <span className="text-[10px] text-text-muted"><span className="inline-block w-2 h-2 rounded-full bg-danger/20 mr-1" />{bugsOpen} open bugs</span>
                  <span className="text-[10px] text-text-muted"><span className="inline-block w-2 h-2 rounded-full bg-success/20 mr-1" />{featuresOpen} open features</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-developer */}
      {devStats.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-5 mb-6">
          <h2 className="text-[13px] font-semibold text-text-primary mb-4">Dev Team</h2>
          <div className="space-y-3">
            {devStats.map(({ user, total, done, open, bugsDone, featuresDone }) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-[10px] text-accent font-semibold shrink-0">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-text-primary truncate">{user.name}</span>
                    <span className="text-[10px] text-text-muted">{done} done, {open} open</span>
                  </div>
                  <div className="flex gap-1 h-4 rounded-full overflow-hidden bg-bg-elevated">
                    {bugsDone > 0 && (
                      <div className="h-full bg-danger/70 transition-all duration-500" style={{ width: `${(bugsDone / maxDev) * 100}%` }} title={`${bugsDone} bugs fixed`} />
                    )}
                    {featuresDone > 0 && (
                      <div className="h-full bg-success/70 transition-all duration-500" style={{ width: `${(featuresDone / maxDev) * 100}%` }} title={`${featuresDone} features shipped`} />
                    )}
                    {open > 0 && (
                      <div className="h-full bg-accent/20 transition-all duration-500" style={{ width: `${(open / maxDev) * 100}%` }} title={`${open} open`} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
