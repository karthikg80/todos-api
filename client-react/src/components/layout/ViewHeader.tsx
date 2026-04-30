import type { ReactNode } from "react";

export type CrumbItem = { label: string; onClick?: () => void };

export interface ViewHeaderProps {
  crumb?: string | CrumbItem[];
  title: string;
  count?: number | string;
  subtitle?: ReactNode;
  controls?: ReactNode;
  actions?: ReactNode;
  back?: { onClick: () => void; label?: string };
}

function normalizeCrumb(
  crumb: string | CrumbItem[] | undefined,
  title: string,
): CrumbItem[] {
  if (!crumb) return [];
  if (typeof crumb === "string") {
    const segments = crumb
      .split(/\s*›\s*/)
      .map((label) => label.trim())
      .filter(Boolean);
    // Drop the trailing segment when it matches the title, since the h1 already
    // shows the current view. Avoids duplicate "Settings → Tune-up" + h1 "Tune-up".
    if (segments.length > 0 && segments[segments.length - 1] === title) {
      segments.pop();
    }
    return segments.map((label) => ({ label }));
  }
  return crumb;
}

export function ViewHeader({
  crumb,
  title,
  count,
  subtitle,
  controls,
  actions,
  back,
}: ViewHeaderProps) {
  const items = normalizeCrumb(crumb, title);
  const backLabel = back?.label ?? "Back";

  return (
    <header className="view-header">
      <div className="view-header__top">
        {back && (
          <button
            type="button"
            className="view-header__back btn"
            onClick={back.onClick}
            aria-label={backLabel}
          >
            ← {backLabel}
          </button>
        )}
        <div className="view-header__titles">
          {items.length > 0 && (
            <nav className="view-header__crumb" aria-label="Location">
              {items.map((item, i) => (
                <span key={i} className="view-header__crumb-item">
                  {i > 0 && (
                    <span className="view-header__crumb-sep" aria-hidden="true">
                      ›
                    </span>
                  )}
                  {item.onClick ? (
                    <button
                      type="button"
                      className="view-header__crumb-link"
                      onClick={item.onClick}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className="view-header__crumb-label">
                      {item.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div className="view-header__title-row">
            <h1 className="view-header__title">{title}</h1>
            {count !== undefined && count !== null && (
              <span className="view-header__count">{count}</span>
            )}
          </div>
          {subtitle && <div className="view-header__subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="view-header__actions">{actions}</div>}
      </div>
      {controls && <div className="view-header__controls">{controls}</div>}
    </header>
  );
}
