import type { ReactNode } from "react";
import type { PanelProvenance } from "../../types/focusBrief";

interface Props {
  provenance: PanelProvenance;
  reason: string;
  pixelArt?: ReactNode;
}

export function CardBack({ provenance, reason, pixelArt }: Props) {
  const isAi = provenance.source === "ai";

  return (
    <div className="card-back">
      <div className="card-back__header">How this was generated</div>

      <div className={`card-back__badge card-back__badge--${isAi ? "ai" : "deterministic"}`}>
        <span className="card-back__badge-dot" />
        {isAi ? "AI-generated" : "Deterministic"}
      </div>

      {pixelArt && <div className="card-back__art">{pixelArt}</div>}

      <div className="card-back__grid">
        {isAi ? (
          <>
            {provenance.model && (
              <>
                <span className="card-back__label">Model</span>
                <span className="card-back__value card-back__value--mono">{provenance.model}</span>
              </>
            )}
            {provenance.temperature != null && (
              <>
                <span className="card-back__label">Temperature</span>
                <span className="card-back__value card-back__value--mono">
                  {provenance.temperature}
                </span>
              </>
            )}
            {provenance.maxTokens != null && (
              <>
                <span className="card-back__label">Max tokens</span>
                <span className="card-back__value card-back__value--mono">
                  {provenance.maxTokens}
                </span>
              </>
            )}
            {provenance.generatedAt && (
              <>
                <span className="card-back__label">Generated</span>
                <span className="card-back__value">
                  {new Date(provenance.generatedAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
            {provenance.cacheStatus && (
              <>
                <span className="card-back__label">Cache</span>
                <span className="card-back__value">
                  {provenance.cacheStatus === "fresh" ? "Fresh" : "Stale"}
                  {provenance.cacheExpiresAt &&
                    ` (expires ${new Date(provenance.cacheExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`}
                </span>
              </>
            )}
            {provenance.inputSummary && (
              <>
                <span className="card-back__label">Input</span>
                <span className="card-back__value">{provenance.inputSummary}</span>
              </>
            )}
          </>
        ) : (
          <>
            {provenance.method && (
              <>
                <span className="card-back__label">Method</span>
                <span className="card-back__value">{provenance.method}</span>
              </>
            )}
            {provenance.freshness && (
              <>
                <span className="card-back__label">Freshness</span>
                <span className="card-back__value">{provenance.freshness}</span>
              </>
            )}
            {provenance.filter && (
              <>
                <span className="card-back__label">Filter</span>
                <span className="card-back__value card-back__value--mono">{provenance.filter}</span>
              </>
            )}
            {provenance.dataBreakdown && (
              <>
                <span className="card-back__label">Data</span>
                <span className="card-back__value">{provenance.dataBreakdown}</span>
              </>
            )}
            {provenance.itemsShown && (
              <>
                <span className="card-back__label">Shown</span>
                <span className="card-back__value">{provenance.itemsShown}</span>
              </>
            )}
          </>
        )}
      </div>

      {isAi && provenance.promptIntent && (
        <div className="card-back__section">
          <div className="card-back__section-label">Prompt Intent</div>
          <p className="card-back__section-text">{provenance.promptIntent}</p>
        </div>
      )}

      {!isAi && provenance.logic && (
        <div className="card-back__section">
          <div className="card-back__section-label">Logic</div>
          <p className="card-back__section-text">{provenance.logic}</p>
        </div>
      )}

      <div className="card-back__section">
        <div className="card-back__section-label">Why this panel is showing</div>
        <p className="card-back__section-text">{reason}</p>
      </div>
    </div>
  );
}
