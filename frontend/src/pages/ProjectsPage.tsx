import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Project, type TicketWithMeta } from '../lib/api';
import { PageHeader } from '../components/PageHeader';


export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tickets, setTickets] = useState<TicketWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getProjects(), api.getTickets()])
      .then(([p, t]) => { setProjects(p); setTickets(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function ticketCount(projectId: string) {
    return tickets.filter(t => t.product_id === projectId).length;
  }

  if (loading) return <div className="flex items-center justify-center h-full text-text-muted">Loading...</div>;

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Projects" subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {projects.length === 0 ? (
            <p className="text-text-muted text-[13px]">No projects yet.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-elevated text-[11px] text-text-muted uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5 font-medium">Project</th>
                    <th className="text-left px-4 py-2.5 font-medium">Code</th>
                    <th className="text-left px-4 py-2.5 font-medium">Default Owner</th>
                    <th className="text-right px-4 py-2.5 font-medium">Tickets</th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => {
                    const count = ticketCount(p.id);
                    return (
                      <tr key={p.id} className="border-t border-border-subtle hover:bg-bg-elevated/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="text-[13px] font-medium text-text-primary">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">{p.abbreviation}</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-text-secondary">
                          {p.default_owner_name || <span className="text-text-muted">-</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[13px] text-text-secondary tabular-nums">{count}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/board?project=${encodeURIComponent(p.id)}`)}
                            className="text-[11px] text-text-muted hover:text-accent transition-colors"
                            title={`View ${p.name} on the board`}
                            aria-label={`View ${p.name} on the board`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
