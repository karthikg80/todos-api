import { useRef, useEffect } from "react";
import type { AgentId } from "../../agents/types";
import { AGENTS } from "../../agents/registry";
import { drawAgentAvatar } from "../../agents/avatarEngine";

interface Props {
  agentId: string;
  color: string;
  bg: string;
  size: number;
}

export function AgentSigil({ agentId, color, bg, size }: Props) {
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

    const agent = AGENTS[agentId as AgentId];
    if (agent) {
      drawAgentAvatar(ctx, size, agent, "idle");
    } else {
      // Fallback for unknown agent IDs: draw a simple circle
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [agentId, color, bg, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}`,
      }}
    />
  );
}
