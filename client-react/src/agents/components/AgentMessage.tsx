import { useState, useEffect } from "react";
import type { AgentProfile } from "../types";
import { AgentBadge } from "./AgentBadge";
import { getThinkingLine } from "../voiceEngine";

interface Props {
  agent: AgentProfile;
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  className?: string;
}

export function AgentMessage({
  agent,
  content,
  isStreaming,
  timestamp,
  className,
}: Props) {
  const [thinkingText, setThinkingText] = useState(() =>
    getThinkingLine(agent),
  );

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setThinkingText(getThinkingLine(agent));
    }, 1800);
    return () => clearInterval(interval);
  }, [isStreaming, agent]);

  const timeStr = timestamp
    ? timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div
      className={className}
      style={{
        borderLeft: `2px solid ${agent.colors.stroke}66`,
        background: `${agent.colors.bg}99`,
        borderRadius: 8,
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <AgentBadge
          agent={agent}
          size="sm"
          mode={isStreaming ? "thinking" : "idle"}
        />
        {timeStr && (
          <span style={{ fontSize: 11, color: "#999" }}>{timeStr}</span>
        )}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: agent.colors.textDark,
        }}
      >
        {isStreaming ? (
          <span style={{ opacity: 0.6, fontStyle: "italic" }}>
            {thinkingText}
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
