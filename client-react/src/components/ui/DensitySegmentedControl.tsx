import type { Density } from "../../hooks/useDensity";
import { SegmentedControl } from "../shared/SegmentedControl";

const DENSITY_OPTIONS: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Default" },
  { value: "spacious", label: "Spacious" },
];

export interface DensitySegmentedControlProps {
  value: Density;
  onChange: (next: Density) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Inline segmented control for switching the list-view density.
 * Thin wrapper over the existing `SegmentedControl` primitive so
 * header chrome can promote the setting out of the view menu.
 */
export function DensitySegmentedControl({
  value,
  onChange,
  ariaLabel = "Row density",
  className,
}: DensitySegmentedControlProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as Density)}
      ariaLabel={ariaLabel}
      className={className}
      options={DENSITY_OPTIONS.map(({ value: v, label }) => ({
        value: v,
        label,
        buttonId: `densitySegment-${v}`,
      }))}
    />
  );
}
