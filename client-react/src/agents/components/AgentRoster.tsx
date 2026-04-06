import { useState } from "react";
import type { AgentProfile, AgentId } from "../types";
import { AGENTS } from "../registry";
import { AgentAvatar } from "./AgentAvatar";

interface Props {
  onSelect?: (agent: AgentProfile) => void;
  initialSelected?: AgentId;
}

const AGENT_LIST = Object.values(AGENTS);

export function AgentRoster({ onSelect, initialSelected }: Props) {
  const [selected, setSelected] = useState<AgentId | null>(
    initialSelected ?? null,
  );

  const selectedAgent = selected ? AGENTS[selected] : null;
  const selectedRow = selected
    ? Math.floor(AGENT_LIST.findIndex((a) => a.id === selected) / 3)
    : -1;

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        {AGENT_LIST.map((agent, i) => {
          const isSelected = agent.id === selected;
          const row = Math.floor(i / 3);

          return (
            <>
              <button
                key={agent.id}
                onClick={() => {
                  const next = isSelected ? null : agent.id;
                  setSelected(next);
                  if (next) onSelect?.(agent);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: 16,
                  border: `2px solid ${isSelected ? agent.colors.stroke : "transparent"}`,
                  borderRadius: 12,
                  background: isSelected ? agent.colors.bg : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "inherit",
                }}
              >
                <AgentAvatar agent={agent} size={80} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: agent.colors.textDark,
                  }}
                >
                  {agent.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: agent.colors.stroke,
                    opacity: 0.75,
                  }}
                >
                  {agent.role}
                </span>
              </button>
              {/* Detail panel after last card in selected row */}
              {i % 3 === 2 && row === selectedRow && selectedAgent && (
                <div
                  key={`detail-${selectedAgent.id}`}
                  style={{
                    gridColumn: "1 / -1",
                    overflow: "hidden",
                    maxHeight: 300,
                    transition: "max-height 0.3s ease",
                    background: selectedAgent.colors.bg,
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedAgent.traits.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          borderRadius: 99,
                          background: selectedAgent.colors.traitBg,
                          color: selectedAgent.colors.textDark,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      fontStyle: "italic",
                      color: selectedAgent.colors.textDark,
                      margin: "0 0 12px",
                      lineHeight: 1.5,
                    }}
                  >
                    "{selectedAgent.quote}"
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      fontSize: 12,
                      color: selectedAgent.colors.textDark,
                    }}
                  >
                    <div>
                      <strong>Superpower:</strong> {selectedAgent.superpower}
                    </div>
                    <div>
                      <strong>Quirk:</strong> {selectedAgent.quirk}
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <strong>Best called when:</strong>{" "}
                      {selectedAgent.bestCalledWhen}
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })}
      </div>
    </div>
  );
}
