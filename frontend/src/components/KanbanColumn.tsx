import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TicketWithMeta } from '../lib/api';
import { TicketCard } from './TicketCard';

const statusLabels: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

interface Props {
  status: string;
  tickets: TicketWithMeta[];
  onTicketClick: (ticket: TicketWithMeta) => void;
  isDraggable: boolean;
}

export function KanbanColumn({ status, tickets, onTicketClick, isDraggable }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      className={`flex flex-col min-w-[260px] w-[260px] shrink-0 rounded-lg transition-colors ${isOver ? 'bg-accent/5' : ''}`}
    >
      <div className="flex items-center justify-between px-3 py-2 mb-2">
        <h2 className="text-sm font-medium text-text-muted">{statusLabels[status]}</h2>
        <span className="text-xs text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
          {tickets.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-2 px-1.5 pb-4 overflow-y-auto min-h-[200px]"
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
