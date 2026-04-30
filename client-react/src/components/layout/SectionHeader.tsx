export interface SectionHeaderProps {
  title: string;
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function SectionHeader({
  title,
  count,
  collapsed = false,
  onToggle,
  loading = false,
  error = null,
  onRetry,
}: SectionHeaderProps) {
  const collapsible = onToggle !== undefined;
  const showBadge = count !== undefined && count !== null && !loading && !error;

  const inner = (
    <>
      {collapsible && (
        <span
          className="section-header__chevron"
          style={{
            transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
          }}
          aria-hidden="true"
        >
          ›
        </span>
      )}
      <span className="section-header__title">{title}</span>
      {showBadge && (
        <span className="section-header__badge" aria-hidden="true">
          {count}
        </span>
      )}
      {loading && (
        <span
          className="section-header__loading-indicator"
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <div className="section-header">
      {collapsible ? (
        <button
          className="section-header__toggle"
          aria-expanded={!collapsed}
          onClick={onToggle}
          type="button"
        >
          {inner}
        </button>
      ) : (
        <div className="section-header__static">{inner}</div>
      )}
      {error && onRetry && (
        <button
          className="section-header__retry"
          onClick={onRetry}
          type="button"
          aria-label={`Retry loading ${title}`}
        >
          Retry
        </button>
      )}
    </div>
  );
}
