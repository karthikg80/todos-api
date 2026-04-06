import { useRef, useEffect } from "react";
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
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    drawAgentAvatar(ctx, agentId, size / 2, size / 2, color);
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
