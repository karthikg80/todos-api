import { useRef, useEffect } from "react";
import type { AgentProfile } from "../types";
import { drawAgentAvatar } from "../avatarEngine";

interface Props {
  agent: AgentProfile;
  size?: number;
  className?: string;
}

export function AgentAvatar({ agent, size = 48, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    const cx = size / 2;
    const cy = size / 2;
    drawAgentAvatar(ctx, agent.id, cx, cy, agent.colors.stroke);
  }, [agent, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "block",
      }}
    />
  );
}
