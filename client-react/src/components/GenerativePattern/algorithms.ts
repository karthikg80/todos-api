import type { DrawFn } from "./types";

export function mkRng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const flowField: DrawFn = (ctx, W, H, op, density, rng) => {
  const freq = 0.0038;
  const count = Math.round(density * 5);
  const steps = 90;
  const stepLen = 3.8;

  for (let i = 0; i < count; i++) {
    let x = rng() * W;
    let y = rng() * H;
    const lw = 1.4 + rng() * 2.6;
    const alpha = op * (0.4 + rng() * 0.5);

    ctx.beginPath();
    ctx.lineWidth = lw;
    ctx.globalAlpha = alpha;
    ctx.moveTo(x, y);

    for (let s = 0; s < steps; s++) {
      const a =
        Math.sin(x * freq + y * freq * 0.6) * Math.PI * 2.1 +
        Math.cos(x * freq * 0.5 - y * freq * 1.1) * Math.PI * 0.9;
      x += Math.cos(a) * stepLen;
      y += Math.sin(a) * stepLen;

      if (x < -100 || x > W + 100 || y < -100 || y > H + 100) break;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }
};

export const scatteredOrbits: DrawFn = (ctx, W, H, op, density, rng) => {
  const count = Math.round(density * 2.2);

  for (let i = 0; i < count; i++) {
    const cx = -60 + rng() * (W + 120);
    const cy = -60 + rng() * (H + 120);
    const r = 12 + rng() * rng() * 160;
    const startAngle = rng() * Math.PI * 2;
    const sweep = (0.3 + rng() * 1.6) * Math.PI;

    ctx.beginPath();
    ctx.lineWidth = 1.5 + rng() * 3.5;
    ctx.globalAlpha = op * (0.3 + rng() * 0.6);
    ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
};

function edgePt(
  e: 0 | 1 | 2 | 3,
  W: number,
  H: number,
  rng: () => number,
): [number, number] {
  if (e === 0) return [rng() * W, 0];
  if (e === 1) return [W, rng() * H];
  if (e === 2) return [rng() * W, H];
  return [0, rng() * H];
}

export const arcRivers: DrawFn = (ctx, W, H, op, density, rng) => {
  const count = Math.round(density * 0.7);

  for (let i = 0; i < count; i++) {
    const e1 = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
    let e2 = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
    if (e2 === e1) e2 = ((e1 + 1 + Math.floor(rng() * 3)) % 4) as 0 | 1 | 2 | 3;

    const [x1, y1] = edgePt(e1, W, H, rng);
    const [x2, y2] = edgePt(e2, W, H, rng);

    // Control points pulled toward canvas interior
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const bend1 = 0.3 + rng() * 0.7;
    const bend2 = 0.3 + rng() * 0.7;
    const cp1x = x1 + (W / 2 - x1) * bend1 + (rng() - 0.5) * W * 0.3;
    const cp1y = y1 + (H / 2 - y1) * bend1 + (rng() - 0.5) * H * 0.3;
    const cp2x = x2 + (midX - x2) * bend2 + (rng() - 0.5) * W * 0.3;
    const cp2y = y2 + (midY - y2) * bend2 + (rng() - 0.5) * H * 0.3;

    ctx.beginPath();
    ctx.lineWidth = 1.5 + rng() * 4;
    ctx.globalAlpha = op * (0.28 + rng() * 0.55);
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
};

export const spiralField: DrawFn = (ctx, W, H, op, density, rng) => {
  const count = Math.round(density * 0.5);

  for (let i = 0; i < count; i++) {
    const cx = rng() * W;
    const cy = rng() * H;
    const maxR = 18 + rng() * rng() * 130;
    const turns = 0.6 + rng() * 3.2;
    const dir = rng() < 0.5 ? 1 : -1;
    const angleOffset = rng() * Math.PI * 2;
    const totalAngle = turns * Math.PI * 2;
    const pointCount = Math.ceil(totalAngle / 0.05);

    ctx.beginPath();
    ctx.lineWidth = 1.5 + rng() * 2.5;
    ctx.globalAlpha = op * (0.35 + rng() * 0.5);

    for (let p = 0; p <= pointCount; p++) {
      const t = p / pointCount;
      const angle = angleOffset + t * totalAngle * dir;
      const r = t * maxR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }
};

export const ALGORITHMS = {
  flowField,
  scatteredOrbits,
  arcRivers,
  spiralField,
} as const;
