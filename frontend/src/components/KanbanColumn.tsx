import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TicketWithMeta } from '../lib/api';
import { TicketCard } from './TicketCard';

interface Props {
  status: string;
  label: string;
  color: string;
  tickets: TicketWithMeta[];
  onTicketClick: (ticket: TicketWithMeta) => void;
  isDraggable: boolean;
}

export function KanbanColumn({ status, label, color, tickets, onTicketClick, isDraggable }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      className={`flex flex-col min-w-[272px] w-[272px] shrink-0 rounded-lg transition-all duration-200 ${isOver ? 'bg-accent/[0.04] ring-1 ring-accent/10' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <h2 className="text-[13px] font-semibold text-text-secondary">{label}</h2>
        <span className="text-[11px] text-text-muted font-mono ml-auto tabular-nums">
          {tickets.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-1.5 px-1.5 pb-4 overflow-y-auto min-h-[200px]"
      >
        <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
              isDraggable={isDraggable}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
