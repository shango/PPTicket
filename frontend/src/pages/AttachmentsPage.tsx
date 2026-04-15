import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type AttachmentWithTicket, type Project } from '../lib/api';

function formatSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function AttachmentsPage() {
  const navigate = useNavigate();
  const [attachments, setAttachments] = useState<AttachmentWithTicket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getAllAttachments(selectedProject || undefined)
      .then(setAttachments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedProject]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border-subtle">
        <h1 className="text-[15px] font-semibold text-text-primary">Attachments</h1>
        <div className="h-5 w-px bg-border-subtle" />
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-secondary"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="text-[12px] text-text-muted ml-auto">
          {attachments.length} file{attachments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-text-muted text-[13px]">Loading...</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-text-muted text-[13px]">No attachments found.</p>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-bg-surface border-b border-border">
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">File</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[100px]">Size</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[200px]">Ticket</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[100px]">Project</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[120px]">Uploaded By</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[100px]">Date</th>
                <th className="px-3 py-2.5 w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((att) => (
                <tr key={att.id} className="border-b border-border-subtle hover:bg-bg-elevated/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                      </svg>
                      <span className="text-[13px] text-text-primary truncate max-w-[300px]">{att.filename}</span>
                      {att.mime_type && (
                        <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded flex-shrink-0">
                          {att.mime_type.split('/')[1]?.toUpperCase() || att.mime_type}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-text-muted">{formatSize(att.size_bytes)}</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => navigate(`/tickets/${att.ticket_id}`)}
                      className="text-[12px] text-accent hover:text-accent-hover truncate max-w-[180px] block text-left"
                    >
                      PDO-{att.ticket_number}: {att.ticket_title}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    {att.product_abbreviation ? (
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${att.product_color}15`, color: att.product_color || undefined }}
                      >
                        {att.product_abbreviation}
                      </span>
                    ) : (
                      <span className="text-[12px] text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-text-secondary">{att.uploader_name}</td>
                  <td className="px-3 py-2.5 text-[12px] text-text-muted">
                    {new Date(att.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  </td>
                  <td className="px-3 py-2.5">
                    <a href={api.attachmentDownloadUrl(att.id)} target="_blank" rel="noopener noreferrer"
                      className="p-1 rounded text-text-muted hover:text-accent transition-colors inline-block" title="Download">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
