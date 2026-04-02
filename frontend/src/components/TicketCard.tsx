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
}

export function TicketCard({ ticket, onClick, isDraggable }: Props) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-bg-surface border border-border-subtle border-l-[3px] rounded-lg p-3 cursor-pointer hover:bg-bg-elevated hover:border-border transition-all duration-150 ${isDragging ? 'shadow-xl shadow-black/40 scale-[1.02]' : ''}`}
    >
      {/* Top row: ticket number, product, type, priority */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-text-muted font-medium">PDO-{ticket.ticket_number}</span>
          {ticket.product_abbreviation && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: `${ticket.product_color}15`, color: ticket.product_color || undefined }}
            >
              {ticket.product_abbreviation}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            ticket.ticket_type === 'feature' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}>
            {ticket.ticket_type === 'feature' ? 'Feature' : 'Bug'}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
            style={{ backgroundColor: pStyle.bg, color: pStyle.text }}
          >
            {ticket.priority.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-medium text-text-primary mb-2 line-clamp-2 leading-snug">{ticket.title}</h3>

      {/* Tags */}
      {ticket.tags.length > 0 && (
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
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <div>
          {ticket.edc && (
            <span className={isPastEdc ? 'text-danger' : ''}>
              EDC {new Date(ticket.edc * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {ticket.assignee_name && (
          <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-[10px] text-accent font-semibold">
            {ticket.assignee_name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
