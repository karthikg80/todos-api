interface SectionHeaderProps {
  title: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function SectionHeader({
  title,
  count,
  isCollapsed,
  onToggle,
  loading = false,
  error = null,
  onRetry,
}: SectionHeaderProps) {
  return (
    <div className="tuneup-section__header">
      <button
        className="tuneup-section__toggle"
        aria-expanded={!isCollapsed}
        onClick={onToggle}
        type="button"
      >
        <span
          className="tuneup-section__chevron"
          style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
        >
          ›
        </span>
        <span className="tuneup-section__title">{title}</span>
        {!loading && !error && (
          <span className="tuneup-section__badge" aria-hidden="true">
            {count}
          </span>
        )}
        {loading && (
          <span className="tuneup-section__loading-indicator" aria-hidden="true" />
        )}
      </button>
      {error && onRetry && (
        <button
          className="tuneup-section__retry"
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
