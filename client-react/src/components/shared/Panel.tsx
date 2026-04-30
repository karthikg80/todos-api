import type { ReactNode } from "react";

export interface PanelProps {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Panel({ title, action, children, className }: PanelProps) {
  const showHeader = title !== undefined || action !== undefined;
  const rootClassName = `panel${className ? ` ${className}` : ""}`;
  return (
    <section className={rootClassName}>
      {showHeader && (
        <div className="panel__header">
          {title !== undefined && <div className="panel__title">{title}</div>}
          {action !== undefined && (
            <div className="panel__action">{action}</div>
          )}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}
