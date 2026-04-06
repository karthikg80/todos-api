import type { AgentProfile, AvatarMode } from "../types";
import { AgentAvatar } from "./AgentAvatar";

const SIZES = { sm: 32, md: 48, lg: 72 } as const;

interface Props {
  agent: AgentProfile;
  size?: "sm" | "md" | "lg";
  showRole?: boolean;
  showName?: boolean;
  mode?: AvatarMode;
  onClick?: () => void;
}

export function AgentBadge({
  agent,
  size = "md",
  showRole = true,
  showName = true,
  mode = "idle",
  onClick,
}: Props) {
  const px = SIZES[size];
  const showText = size !== "sm" && (showName || showRole);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size === "lg" ? 12 : 8,
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <AgentAvatar agent={agent} size={px} mode={mode} />
      {showText && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {showName && (
            <span
              style={{
                fontSize: size === "lg" ? 16 : 13,
                fontWeight: 600,
                color: agent.colors.textDark,
                letterSpacing: "0.04em",
              }}
            >
              {agent.name}
            </span>
          )}
          {showRole && (
            <span
              style={{
                fontSize: size === "lg" ? 13 : 11,
                color: agent.colors.stroke,
                opacity: 0.75,
              }}
            >
              {agent.role}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
