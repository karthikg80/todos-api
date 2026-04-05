import type { ReactNode } from "react";
import type { PanelProvenance } from "../../types/focusBrief";

interface Props {
  provenance?: PanelProvenance;
  reason: string;
  /** @deprecated Use TarotCardBack illustration prop instead */
  pixelArt?: ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CardBackContent({ provenance, reason, pixelArt: _pixelArt }: Props) {
  if (!provenance) {
    return (
      <>
        <div className="tarot-inscription__label tarot-inscription__label--sys">Source unknown</div>
        <div className="tarot-inscription__rule" />
        <div className="tarot-inscription__label tarot-inscription__label--sys">Surfaced because</div>
        <div className="tarot-inscription__text">{reason}</div>
      </>
    );
  }

  const isAi = provenance.source === "ai";

  if (isAi) {
    return (
      <>
        <div className="tarot-inscription__label tarot-inscription__label--ai">Divined by</div>
        {provenance.model && (
          <div className="tarot-inscription__source">{provenance.model}</div>
        )}
        <div className="tarot-inscription__detail">
          {[
            provenance.temperature != null && `temp ${provenance.temperature}`,
            provenance.maxTokens != null && `${provenance.maxTokens} tokens`,
            provenance.inputSummary,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>

        {provenance.promptIntent && (
          <>
            <div className="tarot-inscription__rule" />
            <div className="tarot-inscription__label tarot-inscription__label--ai">Intent</div>
            <p className="tarot-inscription__intent">"{provenance.promptIntent}"</p>
          </>
        )}

        {provenance.generatedAt && (
          <>
            <div className="tarot-inscription__rule" />
            <div className="tarot-inscription__label tarot-inscription__label--ai">Cast at</div>
            <div className="tarot-inscription__text">
              {new Date(provenance.generatedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              {provenance.cacheExpiresAt &&
                ` · Fresh until ${new Date(provenance.cacheExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            </div>
          </>
        )}
      </>
    );
  }

  // Deterministic
  return (
    <>
      <div className="tarot-inscription__label tarot-inscription__label--sys">Computed by</div>
      <div className="tarot-inscription__source">{provenance.method || "System Query"}</div>
      <div className="tarot-inscription__detail">{provenance.freshness || "real-time"}</div>

      {provenance.filter && (
        <>
          <div className="tarot-inscription__rule" />
          <div className="tarot-inscription__label tarot-inscription__label--sys">Rule</div>
          <p className="tarot-inscription__mono">{provenance.filter}</p>
        </>
      )}

      {provenance.dataBreakdown && (
        <>
          <div className="tarot-inscription__rule" />
          <div className="tarot-inscription__label tarot-inscription__label--sys">Reading</div>
          <div className="tarot-inscription__text">{provenance.dataBreakdown}</div>
        </>
      )}

      {reason && (
        <>
          <div className="tarot-inscription__rule" />
          <div className="tarot-inscription__label tarot-inscription__label--sys">
            Surfaced because
          </div>
          <div className="tarot-inscription__text" style={{ fontStyle: "italic" }}>
            "{reason}"
          </div>
        </>
      )}
    </>
  );
}
