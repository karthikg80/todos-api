import type { ReactNode } from "react";

export interface ViewStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  loadingContent?: ReactNode;
  emptyContent?: ReactNode;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ViewState({
  loading,
  error,
  empty,
  loadingContent,
  emptyContent,
  onRetry,
  children,
}: ViewStateProps) {
  if (loading) {
    return (
      <div className="view-state view-state--loading" aria-busy="true">
        <div className="view-state__loading">
          {loadingContent ?? <span>Loading…</span>}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-state view-state--error" role="alert">
        <div className="view-state__error">
          <p>{error}</p>
          {onRetry && (
            <button
              type="button"
              className="view-state__retry"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="view-state view-state--empty">
        <div className="view-state__empty">{emptyContent}</div>
      </div>
    );
  }

  return <>{children}</>;
}
