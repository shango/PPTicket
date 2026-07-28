import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  /** Muted text beside the title: a count, or a one-line description. */
  subtitle?: string;
  /** Controls that belong with the title, e.g. filters. Separated by a rule. */
  children?: React.ReactNode;
  /** Right-aligned buttons. */
  actions?: React.ReactNode;
  /** Only for pages with no sidebar entry, where Back is the way out. */
  backTo?: string;
  backLabel?: string;
}

/**
 * The one page header. Every page used to roll its own - three different title
 * sizes, two different bar paddings, "Back to board" on an arbitrary subset,
 * and no title at all on the board - so moving between pages felt like moving
 * between apps.
 */
export function PageHeader({ title, subtitle, children, actions, backTo, backLabel = 'Back to board' }: Props) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center gap-2.5 px-5 py-2.5 min-h-[46px] shrink-0 border-b border-border-subtle flex-wrap">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary transition-colors mr-1"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          {backLabel}
        </button>
      )}

      <h1 className="text-[15px] font-semibold text-text-primary tracking-tight shrink-0">{title}</h1>

      {subtitle && <span className="text-[12px] text-text-muted shrink-0">{subtitle}</span>}

      {children && (
        <>
          <div className="h-5 w-px bg-border-subtle" />
          {children}
        </>
      )}

      {actions && <div className="ml-auto flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
