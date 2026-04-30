import type { ReactNode } from "react";

type CtaConfig = { label: string; onClick: () => void };

export interface EmptyStateProps {
  illustration?: ReactNode;
  headline: ReactNode;
  copy?: ReactNode;
  cta?: ReactNode | CtaConfig;
  className?: string;
}

function renderCta(cta: ReactNode | CtaConfig | undefined): ReactNode {
  if (cta === undefined) return null;
  if (
    cta !== null &&
    typeof cta === "object" &&
    !Array.isArray(cta) &&
    "label" in (cta as Record<string, unknown>) &&
    "onClick" in (cta as Record<string, unknown>)
  ) {
    const config = cta as CtaConfig;
    return (
      <button
        type="button"
        className="empty-state__cta btn btn--primary"
        onClick={config.onClick}
      >
        {config.label}
      </button>
    );
  }
  return cta as ReactNode;
}

export function EmptyState({
  illustration,
  headline,
  copy,
  cta,
  className,
}: EmptyStateProps) {
  const rootClassName = `empty-state${className ? ` ${className}` : ""}`;
  return (
    <div className={rootClassName}>
      {illustration && (
        <div className="empty-state__illustration">{illustration}</div>
      )}
      <p className="empty-state__headline">{headline}</p>
      {copy && <p className="empty-state__copy">{copy}</p>}
      {cta !== undefined && (
        <div className="empty-state__actions">{renderCta(cta)}</div>
      )}
    </div>
  );
}
