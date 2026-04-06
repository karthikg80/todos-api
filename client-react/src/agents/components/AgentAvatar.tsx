import { useRef, useEffect } from "react";
import type { AgentProfile, AvatarMode } from "../types";
import { drawAgentAvatar, startAnimation } from "../avatarEngine";

interface Props {
  agent: AgentProfile;
  size?: number;
  mode?: AvatarMode;
  className?: string;
}

export function AgentAvatar({
  agent,
  size = 48,
  mode = "idle",
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mode === "thinking") {
      return startAnimation(canvas, agent);
    }

    ctx.scale(dpr, dpr);
    drawAgentAvatar(ctx, size, agent, mode);
  }, [agent, size, mode]);

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
