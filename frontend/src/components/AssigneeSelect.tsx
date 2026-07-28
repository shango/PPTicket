import { useState, useEffect, useRef } from 'react';
import type { User } from '../lib/api';

interface Props {
  users: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/** Shared by the submit form and the ticket detail sidebar. */
export function AssigneeSelect({ users, selectedIds, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = users.filter((u) => !selectedIds.includes(u.id) && u.name.toLowerCase().includes(search.toLowerCase()));
  const selected = users.filter((u) => selectedIds.includes(u.id));

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-medium">
              {u.name}
              <button type="button" onClick={() => onChange(selectedIds.filter(id => id !== u.id))}
                aria-label={`Remove ${u.name}`}
                className="hover:text-danger ml-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
          // Enter would otherwise submit the surrounding form mid-search.
          if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) { onChange([...selectedIds, filtered[0].id]); setSearch(''); }
          }
        }}
        aria-label="Search users to assign"
        placeholder={selected.length > 0 ? 'Add more...' : 'Search users...'}
        className="w-full bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[13px]"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-bg-surface border border-border rounded-lg shadow-lg shadow-black/30 max-h-36 overflow-y-auto">
          {filtered.map((u) => (
            <button key={u.id} type="button"
              onClick={() => { onChange([...selectedIds, u.id]); setSearch(''); }}
              className="w-full text-left px-2.5 py-1.5 text-[13px] text-text-secondary hover:bg-bg-elevated hover:text-text-primary">
              {u.name}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search && (
        <div className="absolute z-10 mt-1 w-full bg-bg-surface border border-border rounded-lg shadow-lg shadow-black/30 px-2.5 py-2 text-[12px] text-text-muted">
          No matching users
        </div>
      )}
    </div>
  );
}
