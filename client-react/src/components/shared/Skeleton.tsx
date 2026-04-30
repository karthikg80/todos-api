export type SkeletonVariant = "row" | "card" | "board-column" | "panel";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  "aria-label"?: string;
  className?: string;
}

const DEFAULT_COUNTS: Record<SkeletonVariant, number> = {
  row: 3,
  card: 1,
  "board-column": 3,
  panel: 1,
};

export function Skeleton({
  variant = "row",
  count,
  "aria-label": ariaLabel = "Loading…",
  className,
}: SkeletonProps) {
  const resolvedCount = count ?? DEFAULT_COUNTS[variant];
  const rootClassName = `skeleton skeleton--${variant}${className ? ` ${className}` : ""}`;

  let body: React.ReactNode;
  if (variant === "row") {
    body = Array.from({ length: resolvedCount }, (_, i) => (
      <div key={i} className="skeleton__row" />
    ));
  } else if (variant === "card") {
    body = Array.from({ length: resolvedCount }, (_, i) => (
      <div key={i} className="skeleton__card" />
    ));
  } else if (variant === "board-column") {
    body = Array.from({ length: resolvedCount }, (_, i) => (
      <div key={i} className="skeleton__card" />
    ));
  } else {
    body = <div className="skeleton__panel" />;
  }

  return (
    <div
      className={rootClassName}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {body}
    </div>
  );
}
