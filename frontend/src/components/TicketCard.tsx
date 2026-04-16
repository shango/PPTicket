import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, type TicketWithMeta } from '../lib/api';

const priorityStyles: Record<string, { bg: string; text: string }> = {
  p0: { bg: 'rgba(212, 86, 78, 0.12)', text: '#d4564e' },
  p1: { bg: 'rgba(212, 148, 78, 0.12)', text: '#d4944e' },
  p2: { bg: 'rgba(124, 127, 223, 0.12)', text: '#7c7fdf' },
  p3: { bg: 'rgba(95, 98, 112, 0.15)', text: '#5f6270' },
};

interface Props {
  ticket: TicketWithMeta;
  onClick: () => void;
  isDraggable: boolean;
  size?: 'small' | 'large';
  isTerminal?: boolean;
  isInitial?: boolean;
}

export function TicketCard({ ticket, onClick, isDraggable, size = 'large', isTerminal, isInitial }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    disabled: !isDraggable,
  });

  const pStyle = priorityStyles[ticket.priority] || priorityStyles.p3;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: ticket.product_color || '#2a2c35',
  };

  const isPastEdc = ticket.edc && ticket.edc * 1000 < Date.now();
  const missingEdc = !ticket.edc && !isInitial && !isTerminal;

  const isSmall = size === 'small';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`border border-l-[3px] rounded-lg ${isSmall ? 'px-1.5 py-1' : 'p-3'} cursor-pointer transition-all duration-150 ${isDragging ? 'shadow-xl shadow-black/40 scale-[1.02]' : ''} ${
        missingEdc
          ? 'bg-danger/[0.06] border-danger/25 hover:bg-danger/[0.10] hover:border-danger/40'
          : 'bg-bg-surface border-border-subtle hover:bg-bg-elevated hover:border-border'
      }`}
    >
      {/* Top row: ticket number, product, type, priority */}
      <div className={`flex items-center justify-between ${isSmall ? 'mb-0.5' : ticket.product_name ? 'mb-0.5' : 'mb-2'}`}>
        <div className="flex items-center gap-1.5">
          <span className={`${isSmall ? 'text-[9px]' : 'text-[11px]'} font-mono text-text-muted font-medium`}>PDO-{ticket.ticket_number}</span>
          {!isSmall && ticket.product_name && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[72px]"
              style={{ backgroundColor: `${ticket.product_color}15`, color: ticket.product_color || undefined }}
            >
              {ticket.product_name.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`${isSmall ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} rounded font-medium ${
            ticket.ticket_type === 'feature' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}>
            {ticket.ticket_type === 'feature' ? 'Feature' : 'Bug'}
          </span>
          <span
            className={`${isSmall ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} rounded font-semibold`}
            style={{ backgroundColor: pStyle.bg, color: pStyle.text }}
          >
            {ticket.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className={`${isSmall ? 'text-[11px] line-clamp-1 mb-0.5' : 'text-[13px] line-clamp-2 mb-2'} font-medium text-text-primary leading-snug`}>{ticket.title}</h3>

      {/* Cover image — large cards only */}
      {!isSmall && ticket.cover_image_id && (
        <div className="mb-2 rounded overflow-hidden bg-bg-elevated">
          <img
            src={api.attachmentDownloadUrl(ticket.cover_image_id)}
            alt=""
            className="w-full h-24 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Tags — hidden in small mode */}
      {!isSmall && ticket.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {ticket.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-bg-elevated rounded text-text-muted">
              {tag}
            </span>
          ))}
          {ticket.tags.length > 2 && (
            <span className="text-[10px] text-text-muted">+{ticket.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between ${isSmall ? 'text-[10px]' : 'text-[11px]'} text-text-muted`}>
        <div className="flex items-center gap-2">
          {ticket.attachment_count > (ticket.cover_image_id ? 1 : 0) && (
            <span className="flex items-center gap-0.5" title={`${ticket.attachment_count} attachment${ticket.attachment_count > 1 ? 's' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              {ticket.attachment_count}
            </span>
          )}
          {ticket.edc ? (
            <span className={isTerminal ? 'text-success' : isPastEdc ? 'text-danger' : ''}>
              {isTerminal ? 'Done' : 'EDC'} {new Date(ticket.edc * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
            </span>
          ) : missingEdc ? (
            <span className="text-danger font-semibold">No EDC</span>
          ) : null}
        </div>
        {ticket.assignee_names.length > 0 && (
          <div className={`flex items-center gap-1 ${isSmall ? 'text-[9px]' : 'text-[10px]'} text-text-muted truncate`}>
            {ticket.assignee_names.slice(0, isSmall ? 1 : 2).map((name, i) => (
              <span key={i}>{i > 0 && ', '}{name.split(' ')[0]}</span>
            ))}
            {ticket.assignee_names.length > (isSmall ? 1 : 2) && (
              <span>+{ticket.assignee_names.length - (isSmall ? 1 : 2)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
