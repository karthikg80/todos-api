import { useRef, useEffect } from "react";
import { ALGORITHMS, mkRng, hashSeed } from "./algorithms";
import type { GenerativePatternProps, PatternBackgroundProps, PatternMode } from "./types";
export type { GenerativePatternProps, PatternBackgroundProps, PatternMode } from "./types";

export function useSeed() {
  return () => Math.floor(Math.random() * 1e9);
}

export { hashSeed };

function drawPattern(
  canvas: HTMLCanvasElement,
  mode: PatternMode,
  seed: number,
  color: string,
  background: string,
  opacity: number,
  density: number,
  height: number,
) {
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = height;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  // Background fill
  if (background !== "transparent") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }

  // Drawing setup
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const rng = mkRng(seed);
  const clampedDensity = Math.max(10, Math.min(100, density));
  const clampedOpacity = Math.max(0, Math.min(1, opacity));

  ALGORITHMS[mode](ctx, W, H, clampedOpacity, clampedDensity, rng);
}

export function GenerativePattern({
  mode,
  seed,
  color = "#D85A30",
  background = "#fff5f1",
  opacity = 0.18,
  density = 45,
  width = "100%",
  height = 400,
  className,
  style,
}: GenerativePatternProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawPattern(canvas, mode, seed, color, background, opacity, density, height);

    // Watch for parent width changes (e.g. carousel slide animation, resize)
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        drawPattern(canvas, mode, seed, color, background, opacity, density, height);
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }
  }, [mode, seed, color, background, opacity, density, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width,
        height,
        display: "block",
        ...style,
      }}
    />
  );
}

export function PatternBackground({
  mode,
  seed,
  color = "#D85A30",
  opacity = 0.12,
}: PatternBackgroundProps) {
  return (
    <GenerativePattern
      mode={mode}
      seed={seed}
      color={color}
      background="transparent"
      opacity={opacity}
      density={45}
      width="100%"
      height={600}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
