import type { ReactNode } from "react";
import type { PanelProvenance } from "../../types/focusBrief";
import { AgentSigil } from "./AgentSigil";

interface Props {
  provenance?: PanelProvenance;
  reason: string;
  /** @deprecated Use TarotCardBack illustration prop instead */
  pixelArt?: ReactNode;
  agent?: {
    id: string;
    name: string;
    role: string;
    traits: [string, string, string];
    quote: string;
    colors: { stroke: string; bg: string; textDark: string; traitBg: string };
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CardBackContent({
  provenance,
  reason,
  pixelArt: _pixelArt,
  agent,
}: Props) {
  if (!provenance) {
    return (
      <>
        <div className="tarot-inscription__label tarot-inscription__label--sys">
          Source unknown
        </div>
        <div className="tarot-inscription__rule" />
        <div className="tarot-inscription__label tarot-inscription__label--sys">
          Surfaced because
        </div>
        <div className="tarot-inscription__text">{reason}</div>
      </>
    );
  }

  const isAi = provenance.source === "ai";

  if (isAi) {
    return (
      <>
        {agent && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AgentSigil
                agentId={agent.id}
                color={agent.colors.stroke}
                bg={agent.colors.bg}
                size={48}
              />
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    color: agent.colors.textDark,
                    fontSize: 15,
                  }}
                >
                  {agent.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: agent.colors.textDark,
                    opacity: 0.7,
                  }}
                >
                  {agent.role}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {agent.traits.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 9,
                        background: agent.colors.traitBg,
                        color: agent.colors.textDark,
                        padding: "1px 5px",
                        borderRadius: 6,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p
              style={{
                fontSize: 11,
                color: agent.colors.textDark,
                fontStyle: "italic",
                margin: "8px 0 0",
                opacity: 0.8,
              }}
            >
              "{agent.quote}"
            </p>
          </div>
        )}
        <div className="tarot-inscription__label tarot-inscription__label--ai">
          {agent ? "Powered by" : "Divined by"}
        </div>
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
            <div className="tarot-inscription__label tarot-inscription__label--ai">
              Intent
            </div>
            <p className="tarot-inscription__intent">
              "{provenance.promptIntent}"
            </p>
          </>
        )}

        {provenance.generatedAt && (
          <>
            <div className="tarot-inscription__rule" />
            <div className="tarot-inscription__label tarot-inscription__label--ai">
              Cast at
            </div>
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
      <div className="tarot-inscription__label tarot-inscription__label--sys">
        Computed by
      </div>
      <div className="tarot-inscription__source">
        {provenance.method || "System Query"}
      </div>
      <div className="tarot-inscription__detail">
        {provenance.freshness || "real-time"}
      </div>

      {provenance.filter && (
        <>
          <div className="tarot-inscription__rule" />
          <div className="tarot-inscription__label tarot-inscription__label--sys">
            Rule
          </div>
          <p className="tarot-inscription__mono">{provenance.filter}</p>
        </>
      )}

      {provenance.dataBreakdown && (
        <>
          <div className="tarot-inscription__rule" />
          <div className="tarot-inscription__label tarot-inscription__label--sys">
            Reading
          </div>
          <div className="tarot-inscription__text">
            {provenance.dataBreakdown}
          </div>
        </>
      )}

      {reason && (
        <>
          <div className="tarot-inscription__rule" />
          <div className="tarot-inscription__label tarot-inscription__label--sys">
            Surfaced because
          </div>
          <div
            className="tarot-inscription__text"
            style={{ fontStyle: "italic" }}
          >
            "{reason}"
          </div>
        </>
      )}
    </>
  );
}
