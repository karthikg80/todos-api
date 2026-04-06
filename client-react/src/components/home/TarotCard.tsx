// client-react/src/components/home/TarotCard.tsx
import type { ReactNode } from "react";

export interface TarotCardProps {
  name: string;
  numeral: string;
  source: "ai" | "sys";
  illustration: ReactNode;
  illustrationCaption?: string;
  subtitle?: string;
  children: ReactNode;
  hero?: boolean;
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
}: TarotCardProps) {
  const cornerClass = source === "ai" ? "tarot-corner--ai" : "tarot-corner--sys";
  const sourceLabel = source === "ai" ? "◇ AI" : "▪ SYS";

  return (
    <div className="tarot-frame">
      <div className="tarot-corners">
        <span className={`tarot-corner ${cornerClass}`}>{sourceLabel}</span>
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
}: Omit<TarotCardProps, "illustrationCaption" | "hero">) {
  const cornerClass = source === "ai" ? "tarot-corner--ai" : "tarot-corner--sys";
  const sourceLabel = source === "ai" ? "◇ AI" : "▪ SYS";
  const suitSymbol = source === "ai" ? "◇" : "▪";

  return (
    <div className="tarot-frame">
      <div className="tarot-corners">
        <span className={`tarot-corner ${cornerClass}`}>{sourceLabel}</span>
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
