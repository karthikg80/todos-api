import type { CSSProperties } from "react";

export type PatternMode =
  | "flowField"
  | "scatteredOrbits"
  | "arcRivers"
  | "spiralField";

export interface GenerativePatternProps {
  mode: PatternMode;
  seed: number;
  color?: string;
  background?: string;
  opacity?: number;
  density?: number;
  width?: string | number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}

export interface PatternBackgroundProps {
  mode: PatternMode;
  seed: number;
  color?: string;
  opacity?: number;
}

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  op: number,
  density: number,
  rng: () => number,
) => void;
