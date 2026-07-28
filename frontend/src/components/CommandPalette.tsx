import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { navItems } from '../lib/nav';

interface Command {
  id: string;
  label: string;
  /** Right-aligned muted text: the section a ticket is in, a shortcut hint. */
  hint?: string;
  section: string;
  /** Extra text to match against that is not shown, e.g. "PDO-12". */
  keywords?: string;
  icon?: React.ReactNode;
  run: () => void;
}

const iconClass = 'shrink-0 text-text-muted';

function Icon({ path }: { path: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={iconClass}>
      {path}
    </svg>
  );
}

/**
 * Cmd/Ctrl+K. Reaching a ticket used to mean going to the board, clearing
 * whatever filters were on it and searching - from a page that is not the
 * board, that is four steps to open something you already know the number of.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const tickets = useStore((s) => s.tickets);
  const fetchTickets = useStore((s) => s.fetchTickets);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const logout = useStore((s) => s.logout);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => onClose(), [onClose]);

  // Mounted only while open, so this runs once per opening. Tickets are in the
  // store only after the board has loaded them, and the palette is reachable
  // from pages that never load them.
  useEffect(() => {
    if (tickets.length === 0) fetchTickets();
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => { navigate(to); close(); };
    const list: Command[] = navItems(user).map((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      section: 'Go to',
      icon: item.icon,
      run: go(item.to),
    }));

    if (user) {
      list.push({
        id: 'nav:/profile', label: 'Settings', section: 'Go to', run: go('/profile'),
        icon: <Icon path={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />,
      });
      list.push({
        id: 'nav:/stats', label: 'Statistics', section: 'Go to', run: go('/stats'),
        icon: <Icon path={<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>} />,
      });
    }

    list.push({
      id: 'action:theme',
      label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      section: 'Actions',
      keywords: 'theme dark light appearance',
      icon: <Icon path={<circle cx="12" cy="12" r="9"/>} />,
      run: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); close(); },
    });

    list.push(
      user
        ? {
            id: 'action:logout', label: 'Sign out', section: 'Actions',
            icon: <Icon path={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} />,
            run: () => { close(); logout(); },
          }
        : {
            id: 'action:login', label: 'Log in', section: 'Actions',
            icon: <Icon path={<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>} />,
            run: go('/login'),
          }
    );

    for (const t of tickets) {
      list.push({
        id: `ticket:${t.id}`,
        label: t.title,
        hint: `PDO-${t.ticket_number}`,
        keywords: `pdo-${t.ticket_number} ${t.ticket_number} ${t.product_name || ''}`,
        section: 'Tickets',
        icon: <Icon path={<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/></>} />,
        run: go(`/tickets/${t.id}`),
      });
    }

    return list;
  }, [user, tickets, theme, navigate, close, setTheme, logout]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Tickets are unbounded, so an empty query shows the pages and actions only.
    if (!q) return commands.filter((c) => c.section !== 'Tickets');
    const matches = commands.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.keywords || '').toLowerCase().includes(q)
    );
    return matches.slice(0, 30);
  }, [commands, query]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected, results]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((i) => (i + 1) % Math.max(results.length, 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((i) => (i - 1 + results.length) % Math.max(results.length, 1)); return; }
    if (e.key === 'Enter') { e.preventDefault(); results[selected]?.run(); }
  }

  let lastSection = '';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center pt-[12vh] px-4"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-lg bg-bg-surface border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 px-3.5 border-b border-border-subtle">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search tickets, jump to a page..."
            aria-label="Search tickets and pages"
            className="flex-1 bg-transparent border-0 py-3 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="text-[10px] text-text-muted border border-border-subtle rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[13px] text-text-muted">No matches.</p>
          ) : (
            results.map((cmd, i) => {
              const header = cmd.section !== lastSection ? cmd.section : null;
              lastSection = cmd.section;
              return (
                <div key={cmd.id}>
                  {header && (
                    <p className="px-3.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      {header}
                    </p>
                  )}
                  <button
                    data-selected={i === selected}
                    onClick={cmd.run}
                    onMouseMove={() => setSelected(i)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors ${
                      i === selected ? 'bg-accent-muted text-accent' : 'text-text-secondary'
                    }`}
                  >
                    {cmd.icon}
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.hint && <span className="text-[11px] font-mono text-text-muted shrink-0">{cmd.hint}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
