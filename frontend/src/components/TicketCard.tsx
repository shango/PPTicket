import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TicketWithMeta } from '../lib/api';

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
}

export function TicketCard({ ticket, onClick, isDraggable, size = 'large' }: Props) {
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

  const isSmall = size === 'small';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-bg-surface border border-border-subtle border-l-[3px] rounded-lg ${isSmall ? 'p-1.5' : 'p-3'} cursor-pointer hover:bg-bg-elevated hover:border-border transition-all duration-150 ${isDragging ? 'shadow-xl shadow-black/40 scale-[1.02]' : ''}`}
    >
      {/* Top row: ticket number, product, type, priority */}
      <div className={`flex items-center justify-between ${isSmall ? 'mb-1' : 'mb-2'}`}>
        <div className="flex items-center gap-1.5">
          <span className={`${isSmall ? 'text-[10px]' : 'text-[11px]'} font-mono text-text-muted font-medium`}>PDO-{ticket.ticket_number}</span>
          {ticket.product_abbreviation && (
            <span
              className={`${isSmall ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} rounded font-medium`}
              style={{ backgroundColor: `${ticket.product_color}15`, color: ticket.product_color || undefined }}
            >
              {ticket.product_abbreviation}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!isSmall && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              ticket.ticket_type === 'feature' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
            }`}>
              {ticket.ticket_type === 'feature' ? 'Feature' : 'Bug'}
            </span>
          )}
          <span
            className={`${isSmall ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} rounded font-semibold`}
            style={{ backgroundColor: pStyle.bg, color: pStyle.text }}
          >
            {ticket.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className={`${isSmall ? 'text-[12px] line-clamp-1 mb-1' : 'text-[13px] line-clamp-2 mb-2'} font-medium text-text-primary leading-snug`}>{ticket.title}</h3>

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
        <div>
          {!isSmall && ticket.edc && (
            <span className={isPastEdc ? 'text-danger' : ''}>
              EDC {new Date(ticket.edc * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
            </span>
          )}
        </div>
        {ticket.assignee_names.length > 0 && (
          <div className="flex -space-x-1.5">
            {ticket.assignee_names.slice(0, isSmall ? 2 : 3).map((name, i) => (
              <div key={i} className={`${isSmall ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'} rounded-full bg-accent/15 flex items-center justify-center text-accent font-semibold ring-1 ring-bg-surface`}>
                {name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
            ))}
            {ticket.assignee_names.length > (isSmall ? 2 : 3) && (
              <div className={`${isSmall ? 'w-5 h-5 text-[8px]' : 'w-6 h-6 text-[9px]'} rounded-full bg-bg-elevated flex items-center justify-center text-text-muted font-medium ring-1 ring-bg-surface`}>
                +{ticket.assignee_names.length - (isSmall ? 2 : 3)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
