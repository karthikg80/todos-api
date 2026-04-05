import type { ReactNode } from "react";

type PanelColor = "danger" | "accent" | "warning" | "purple" | "success";

interface Props {
  title: string;
  color: PanelColor;
  pinned?: boolean;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function FocusPanel({ title, color, pinned, subtitle, children, className }: Props) {
  return (
    <div className={`focus-panel ${className || ""}`}>
      {pinned && <span className="focus-panel__badge">Pinned</span>}
      <div className="focus-panel__header">
        <span className={`focus-panel__title focus-panel__title--${color}`}>{title}</span>
        {subtitle && <span className="focus-panel__subtitle">{subtitle}</span>}
      </div>
      <div className="focus-panel__body">{children}</div>
    </div>
  );
}
