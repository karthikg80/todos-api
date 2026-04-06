import { useRef, useEffect } from "react";
import { arcRivers, mkRng } from "../GenerativePattern/algorithms";
import { AGENTS } from "../../agents/registry";

// ── Agent drawing functions (inline, not from avatarEngine which clears canvas) ──

function drawOrla(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  frame: number,
): void {
  const drift = frame * 0.003;
  (
    [
      [36, 0.3, 1.55],
      [27, 1.0, 1.6],
      [19, 1.8, 1.5],
      [11, 2.7, 1.4],
    ] as [number, number, number][]
  ).forEach(([r, off, sw], i) => {
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      r,
      off + drift * (i + 1) * 0.3,
      off + drift * (i + 1) * 0.3 + Math.PI * 1.65,
    );
    ctx.lineWidth = sw;
    ctx.globalAlpha = 0.75 - i * 0.1;
    ctx.stroke();
  });
}

function drawFinn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  frame: number,
): void {
  const animOffset = frame * 0.04;
  ctx.beginPath();
  for (let i = 0; i <= 280; i++) {
    const t = i / 280;
    const r = t * 36;
    const a = t * Math.PI * 7 + 0.4 + animOffset;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
}

function drawMira(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  frame: number,
): void {
  const drift = frame * 0.005;
  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI / 3) - Math.PI / 2 + drift;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 28, a, a + Math.PI * 0.52);
    ctx.lineWidth = 2.8 - i * 0.1;
    ctx.globalAlpha = 0.6 + i * 0.04;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35;
  ctx.stroke();
}

function drawEcho(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  frame: number,
  regionW: number,
  regionH: number,
): void {
  const rng = mkRng(AGENTS.echo.avatarSeed);
  const freq = 0.055;
  const stepOffset = frame * 0.5;
  for (let p = 0; p < 9; p++) {
    let x = ox + rng() * regionW;
    let y = oy + rng() * regionH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 28; s++) {
      const a =
        Math.sin((x + stepOffset) * freq) * Math.PI * 2 +
        Math.cos((y + stepOffset) * freq * 0.8) * Math.PI;
      x += Math.cos(a) * 3.2;
      y += Math.sin(a) * 3.2;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.5 + rng();
    ctx.globalAlpha = 0.35 + rng() * 0.4;
    ctx.stroke();
  }
}

function drawSol(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const rng = mkRng(AGENTS.sol.avatarSeed);
  (
    [
      [38, 0.2, 1.3],
      [28, 1.1, 1.5],
      [20, 2.3, 1.4],
      [34, 3.0, 1.2],
    ] as [number, number, number][]
  ).forEach(([r, off, sw]) => {
    const sweep = (0.8 + rng() * 0.9) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx + rng() * 6 - 3, cy + rng() * 6 - 3, r, off, off + sweep);
    ctx.lineWidth = sw;
    ctx.globalAlpha = 0.4 + rng() * 0.35;
    ctx.stroke();
  });
}

function drawKodo(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, 33, 0.18, 0.18 + Math.PI * 1.85);
  ctx.lineWidth = 4.5;
  ctx.globalAlpha = 0.75;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0.5, 0.5 + Math.PI * 1.7);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.28;
  ctx.stroke();
}

// ── Agent layout and rendering ────────────────

interface AgentSlot {
  id: keyof typeof AGENTS;
  xPct: number;
  yPct: number;
  draw: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    frame: number,
    w: number,
    h: number,
  ) => void;
}

const SLOTS: AgentSlot[] = [
  {
    id: "orla",
    xPct: 0.18,
    yPct: 0.3,
    draw: (ctx, x, y, f) => drawOrla(ctx, x, y, f),
  },
  {
    id: "finn",
    xPct: 0.5,
    yPct: 0.2,
    draw: (ctx, x, y, f) => drawFinn(ctx, x, y, f),
  },
  {
    id: "mira",
    xPct: 0.82,
    yPct: 0.35,
    draw: (ctx, x, y, f) => drawMira(ctx, x, y, f),
  },
  {
    id: "echo",
    xPct: 0.25,
    yPct: 0.7,
    draw: (ctx, x, y, f) => drawEcho(ctx, x - 40, y - 40, f, 80, 80),
  },
  {
    id: "sol",
    xPct: 0.6,
    yPct: 0.75,
    draw: (ctx, x, y) => drawSol(ctx, x, y),
  },
  {
    id: "kodo",
    xPct: 0.8,
    yPct: 0.65,
    draw: (ctx, x, y) => drawKodo(ctx, x, y),
  },
];

function renderComposition(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  frame: number,
): void {
  ctx.clearRect(0, 0, W, H);

  // Layer 1: warm background
  ctx.fillStyle = "#faf9f6";
  ctx.fillRect(0, 0, W, H);

  // Layer 2: arcRivers at very low opacity
  ctx.save();
  ctx.strokeStyle = "#8a7e6e";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  arcRivers(ctx, W, H, 0.05, 40, mkRng(42));
  ctx.restore();

  // Layer 3: agent sigils in thinking mode
  for (const slot of SLOTS) {
    const agent = AGENTS[slot.id];
    ctx.save();
    ctx.strokeStyle = agent.colors.stroke;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    slot.draw(ctx, W * slot.xPct, H * slot.yPct, frame, W, H);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

// ── Component ─────────────────────────────────

export function AgentCompositionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let frame = 0;

    const loop = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;

      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      frame++;
      renderComposition(ctx, W, H, frame);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
