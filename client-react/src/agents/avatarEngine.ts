type AgentAvatarId = "orla" | "finn" | "mira" | "echo" | "sol" | "kodo";

function mkRng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawOrla(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  const radii = [36, 27, 19, 11];
  const offsets = [0.30, 1.00, 1.80, 2.70];
  const lws = [1.55, 1.60, 1.50, 1.40];
  const alphas = [0.75, 0.65, 0.55, 0.45];
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.lineWidth = lws[i];
    ctx.globalAlpha = alphas[i];
    ctx.arc(cx, cy, radii[i], offsets[i], offsets[i] + Math.PI * 1.65);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFinn(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let i = 0; i <= 280; i++) {
    const t = i / 280;
    const r = t * 36;
    const a = t * Math.PI * 7 + 0.4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawMira(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 6; i++) {
    const angle = i * (Math.PI / 3) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 28, angle, angle + Math.PI * 0.52);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.globalAlpha = 0.5;
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawEcho(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = 1.5;
  const rng = mkRng(77);
  const freq = 0.055;
  for (let p = 0; p < 9; p++) {
    let x = cx + (rng() - 0.5) * 60;
    let y = cy + (rng() - 0.5) * 60;
    ctx.beginPath();
    ctx.globalAlpha = 0.4 + rng() * 0.35;
    ctx.moveTo(x, y);
    for (let s = 0; s < 28; s++) {
      const a = Math.sin(x * freq) * Math.PI * 2 + Math.cos(y * freq) * Math.PI;
      x += Math.cos(a) * 3.2;
      y += Math.sin(a) * 3.2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSol(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  const rng = mkRng(99);
  const radii = [38, 28, 20, 34];
  const offsets = [0.20, 1.10, 2.30, 3.00];
  for (let i = 0; i < 4; i++) {
    const ocx = cx + rng() * 6 - 3;
    const ocy = cy + rng() * 6 - 3;
    const sweep = (0.8 + rng() * 0.9) * Math.PI;
    ctx.beginPath();
    ctx.lineWidth = 1.4 + rng() * 1.2;
    ctx.globalAlpha = 0.35 + rng() * 0.35;
    ctx.arc(ocx, ocy, radii[i], offsets[i], offsets[i] + sweep);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawKodo(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.lineWidth = 4.5;
  ctx.globalAlpha = 0.75;
  ctx.arc(cx, cy, 33, 0.18, 0.18 + Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.28;
  ctx.arc(cx, cy, 22, 0.50, 0.50 + Math.PI * 1.70);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

const DRAW_MAP: Record<AgentAvatarId, (ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) => void> = {
  orla: drawOrla,
  finn: drawFinn,
  mira: drawMira,
  echo: drawEcho,
  sol: drawSol,
  kodo: drawKodo,
};

export const AVATAR_AGENTS: AgentAvatarId[] = ["orla", "finn", "mira", "echo", "sol", "kodo"];

export function drawAgentAvatar(
  ctx: CanvasRenderingContext2D,
  agentId: string,
  cx: number,
  cy: number,
  color: string,
): void {
  const draw = DRAW_MAP[agentId as AgentAvatarId];
  if (draw) draw(ctx, cx, cy, color);
}
