// client-react/src/components/home/TarotCard.tsx
import type { ReactNode } from "react";
import { AgentSigil } from "./AgentSigil";

export interface TarotCardProps {
  name: string;
  numeral: string;
  source: "ai" | "sys";
  illustration: ReactNode;
  illustrationCaption?: string;
  subtitle?: string;
  children: ReactNode;
  hero?: boolean;
  agent?: {
    id: string;
    name: string;
    role: string;
    colors: { stroke: string; bg: string; textDark: string };
  };
}

export function TarotCardFront({
  name,
  numeral,
  source,
  illustration,
  illustrationCaption,
  subtitle,
  children,
  hero,
  agent,
}: TarotCardProps) {
  const cornerClass = source === "ai" ? "tarot-corner--ai" : "tarot-corner--sys";
  const sourceLabel = source === "ai" ? "◇ AI" : "▪ SYS";

  return (
    <div
      className="tarot-frame"
      style={agent ? { borderColor: agent.colors.stroke, background: agent.colors.bg } : undefined}
    >
      <div className="tarot-corners">
        {agent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AgentSigil agentId={agent.id} color={agent.colors.stroke} bg={agent.colors.bg} size={32} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: agent.colors.textDark }}>{agent.name}</div>
              <div style={{ fontSize: 10, color: agent.colors.textDark, opacity: 0.7 }}>{agent.role}</div>
            </div>
          </div>
        ) : (
          <span className={`tarot-corner ${cornerClass}`}>{sourceLabel}</span>
        )}
        <span className={`tarot-corner ${cornerClass}`}>{numeral}</span>
      </div>
      <div className="tarot-name">{name}</div>
      {subtitle && <div className="tarot-subtitle">{subtitle}</div>}
      <div className={`tarot-illustration${hero ? " tarot-illustration--hero" : ""}`}>
        {illustration}
      </div>
      {illustrationCaption && (
        <div className="tarot-illustration__caption">{illustrationCaption}</div>
      )}
      <div className="tarot-divider" />
      <div className="tarot-content">
        {children}
      </div>
      <div className="tarot-corners tarot-corners--bottom">
        <span className={`tarot-corner ${cornerClass}`}>{numeral}</span>
        <span className={`tarot-corner ${cornerClass}`}>{sourceLabel}</span>
      </div>
    </div>
  );
}

export function TarotCardBack({
  name,
  numeral,
  source,
  illustration,
  children,
  agent,
}: Omit<TarotCardProps, "illustrationCaption" | "hero" | "subtitle">) {
  const cornerClass = source === "ai" ? "tarot-corner--ai" : "tarot-corner--sys";
  const sourceLabel = source === "ai" ? "◇ AI" : "▪ SYS";
  const suitSymbol = source === "ai" ? "◇" : "▪";

  return (
    <div
      className="tarot-frame"
      style={agent ? { borderColor: agent.colors.stroke, background: agent.colors.bg } : undefined}
    >
      <div className="tarot-corners">
        {agent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AgentSigil agentId={agent.id} color={agent.colors.stroke} bg={agent.colors.bg} size={24} />
            <div style={{ fontSize: 11, fontWeight: 700, color: agent.colors.textDark }}>{agent.name}</div>
          </div>
        ) : (
          <span className={`tarot-corner ${cornerClass}`}>{sourceLabel}</span>
        )}
        <span className={`tarot-corner ${cornerClass}`}>{numeral}</span>
      </div>
      <div className="tarot-name">{name} — Reversed</div>
      <div className="tarot-illustration">
        {illustration}
      </div>
      <div className="tarot-divider--ornament">
        <span>{suitSymbol}</span>
      </div>
      <div className="tarot-inscription">
        {children}
      </div>
      <div className="tarot-corners tarot-corners--bottom">
        <span className={`tarot-corner ${cornerClass}`}>{numeral}</span>
        <span className={`tarot-corner ${cornerClass}`}>{sourceLabel}</span>
      </div>
    </div>
  );
}
