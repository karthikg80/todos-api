import type { SVGProps } from "react";

export interface BrandMarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Product mark — stacked horizons + rising sun motif. Planning by
 * day (the sun rising over horizon lines), reflection by the
 * layered horizons. Uses design-system tokens so light/dark follow
 * the current theme. Lifted from the v2 spec brand-mark SVG.
 */
export function BrandMark({
  size = 24,
  className,
  ...rest
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-hidden="true"
      {...rest}
    >
      <line
        x1="4"
        y1="18"
        x2="20"
        y2="18"
        stroke="var(--muted)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="14"
        x2="18"
        y2="14"
        stroke="var(--muted-light)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="12" cy="14" r="4" fill="var(--accent-secondary)" />
      <path
        d="M12 14 A4 4 0 0 1 16 18 L8 18 A4 4 0 0 1 12 14 Z"
        fill="var(--accent)"
      />
    </svg>
  );
}
