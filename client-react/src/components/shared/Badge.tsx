import type { ReactNode } from "react";

export type BadgeTone = "info" | "warning" | "success" | "muted" | "danger";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  children?: ReactNode;
  className?: string;
}

export function Badge({
  tone = "muted",
  size = "md",
  children,
  className,
}: BadgeProps) {
  const classes = ["badge", `badge--${tone}`];
  if (size !== "md") classes.push(`badge--${size}`);
  if (className) classes.push(className);
  return <span className={classes.join(" ")}>{children}</span>;
}
