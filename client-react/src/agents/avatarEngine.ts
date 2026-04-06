import type { AgentProfile, AgentId, AvatarMode } from "./types";

function mkRng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type DrawerFn = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  agent: AgentProfile,
  mode: AvatarMode,
  frame: number,
) => void;

const drawOrla: DrawerFn = (ctx, cx, cy) => {
  (
    [
      [36, 0.3, 1.55],
      [27, 1.0, 1.6],
      [19, 1.8, 1.5],
      [11, 2.7, 1.4],
    ] as [number, number, number][]
  ).forEach(([r, off, sw], i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, off, off + Math.PI * 1.65);
    ctx.lineWidth = sw;
    ctx.globalAlpha = 0.75 - i * 0.1;
    ctx.stroke();
  });
};

const drawFinn: DrawerFn = (ctx, cx, cy, _size, _agent, mode, frame) => {
  const animOffset = mode === "thinking" ? frame * 0.04 : 0;
  ctx.beginPath();
  for (let i = 0; i < 280; i++) {
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
};

const drawMira: DrawerFn = (ctx, cx, cy) => {
  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI / 3) - Math.PI / 2;
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
};

const drawEcho: DrawerFn = (ctx, _cx, _cy, size, agent, mode, frame) => {
  const rng = mkRng(agent.avatarSeed);
  const freq = 0.055;
  const stepOffset = mode === "thinking" ? frame * 0.5 : 0;
  for (let i = 0; i < 9; i++) {
    let x = rng() * size;
    let y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 28; s++) {
      const a =
        Math.sin((x + stepOffset) * freq) * Math.PI * 2 +
        Math.cos((y + stepOffset) * freq * 0.8) * Math.PI;
      x += Math.cos(a) * 3.2;
      y += Math.sin(a) * 3.2;
      if (x < -5 || x > size + 5 || y < -5 || y > size + 5) break;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.5 + rng();
    ctx.globalAlpha = 0.35 + rng() * 0.4;
    ctx.stroke();
  }
};

const drawSol: DrawerFn = (ctx, cx, cy, _size, agent) => {
  const rng = mkRng(agent.avatarSeed);
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
};

const drawKodo: DrawerFn = (ctx, cx, cy) => {
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
};

const DRAWERS: Record<AgentId, DrawerFn> = {
  orla: drawOrla,
  finn: drawFinn,
  mira: drawMira,
  echo: drawEcho,
  sol: drawSol,
  kodo: drawKodo,
};

export function drawAgentAvatar(
  ctx: CanvasRenderingContext2D,
  size: number,
  agent: AgentProfile,
  mode: AvatarMode,
  frame: number = 0,
): void {
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = agent.colors.bg;
  ctx.fill();

  ctx.strokeStyle = agent.colors.stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawer = DRAWERS[agent.id];
  drawer(ctx, cx, cy, size, agent, mode, frame);

  ctx.globalAlpha = 1;
}

export function startAnimation(
  canvas: HTMLCanvasElement,
  agent: AgentProfile,
): () => void {
  let frame = 0;
  let rafId = 0;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = window.devicePixelRatio || 1;
  const size = canvas.width / dpr;

  const loop = () => {
    frame++;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawAgentAvatar(ctx, size, agent, "thinking", frame);
    ctx.restore();
    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(rafId);
}
