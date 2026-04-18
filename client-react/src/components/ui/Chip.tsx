import type { HTMLAttributes, ReactNode } from "react";

export type ChipFamily =
  | "status"
  | "meta"
  | "tag"
  | "danger"
  | "warning"
  | "success"
  | "ai";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  family: ChipFamily;
  children: ReactNode;
}

export function Chip({ family, className, children, ...rest }: ChipProps) {
  const classes = className ? `chip ${className}` : "chip";
  return (
    <span className={classes} data-family={family} {...rest}>
      {children}
    </span>
  );
}
