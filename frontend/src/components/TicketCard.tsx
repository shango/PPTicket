import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TicketWithMeta } from '../lib/api';

const priorityColors: Record<string, string> = {
  p0: 'bg-p0 text-white',
  p1: 'bg-p1 text-white',
  p2: 'bg-p2 text-white',
  p3: 'bg-p3 text-white',
};

const priorityLabels: Record<string, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = ticket.due_date && ticket.due_date * 1000 < Date.now();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-bg-surface border border-zinc-800 rounded-lg p-3 cursor-pointer hover:border-zinc-700 transition-colors ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-muted">PDO-{ticket.ticket_number}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[ticket.priority]}`}>
          {priorityLabels[ticket.priority]}
        </span>
      </div>

      <h3 className="text-sm font-medium text-text-primary mb-2 line-clamp-2">{ticket.title}</h3>

      <div className="flex items-center gap-2 flex-wrap">
        {ticket.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-bg-elevated rounded text-text-muted">
            {tag}
          </span>
        ))}
        {ticket.tags.length > 2 && (
          <span className="text-[10px] text-text-muted">+{ticket.tags.length - 2} more</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-text-muted">
        <div className="flex items-center gap-2">
          {ticket.due_date && (
            <span className={isOverdue ? 'text-p0' : ''}>
              {new Date(ticket.due_date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {ticket.assignee_id && (
          <div className="w-5 h-5 rounded-full bg-accent/30 flex items-center justify-center text-[9px] text-accent font-medium">
            A
          </div>
        )}
      </div>
    </div>
  );
}
