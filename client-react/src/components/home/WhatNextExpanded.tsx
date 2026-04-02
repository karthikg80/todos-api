import type { NextWorkInputs, NextWorkRecommendation } from "../../types/nextWork";
import { WhatNextRow } from "./WhatNextRow";

const TIME_PRESETS: { label: string; minutes: number }[] = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "4h", minutes: 240 },
];

const ENERGY_OPTIONS: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
const ENERGY_LABELS: Record<string, string> = { low: "Low", medium: "Med", high: "High" };

interface Props {
  visible: NextWorkRecommendation[];
  inputs: NextWorkInputs;
  refreshing: boolean;
  error: string | null;
  onInputsChange: (inputs: NextWorkInputs) => void;
  onStart: (taskId: string) => void;
  onSnooze: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
  onRefresh: () => void;
  onCollapse: () => void;
}

export function WhatNextExpanded({
  visible,
  inputs,
  refreshing,
  error,
  onInputsChange,
  onStart,
  onSnooze,
  onDismiss,
  onRefresh,
  onCollapse,
}: Props) {
  const top5 = visible.slice(0, 5);

  return (
    <div className="whatnext-expanded">
      {/* Filter controls */}
      <div className="whatnext-filters">
        <div className="whatnext-filter-group">
          <span className="whatnext-filter-label">Time</span>
          <div className="whatnext-chips">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.minutes}
                className={`whatnext-chip${inputs.availableMinutes === p.minutes ? " whatnext-chip--active" : ""}`}
                onClick={() => onInputsChange({
                  ...inputs,
                  availableMinutes: inputs.availableMinutes === p.minutes ? undefined : p.minutes,
                })}
                aria-pressed={inputs.availableMinutes === p.minutes}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="whatnext-filter-group">
          <span className="whatnext-filter-label">Energy</span>
          <div className="whatnext-chips">
            {ENERGY_OPTIONS.map((e) => (
              <button
                key={e}
                className={`whatnext-chip${inputs.energy === e ? " whatnext-chip--active" : ""}`}
                onClick={() => onInputsChange({
                  ...inputs,
                  energy: inputs.energy === e ? undefined : e,
                })}
                aria-pressed={inputs.energy === e}
              >
                {ENERGY_LABELS[e]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Updating indicator */}
      {refreshing && <div className="whatnext-refreshing">Updating...</div>}

      {/* Error with retry (stale data still visible) */}
      {error && (
        <div className="whatnext-error-subtle">
          Couldn't refresh —{" "}
          <button className="whatnext-retry-link" onClick={onRefresh}>Retry</button>
        </div>
      )}

      {/* Recommendation list */}
      {top5.length > 0 ? (
        <div className="whatnext-list">
          {top5.map((rec, i) => (
            <WhatNextRow
              key={rec.taskId}
              rec={rec}
              isTop={i === 0}
              onStart={onStart}
              onSnooze={onSnooze}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      ) : (
        <div className="whatnext-empty">
          All caught up! Try different time or energy settings for more.
        </div>
      )}

      {/* Collapse */}
      <button className="whatnext-collapse" onClick={onCollapse}>
        Show less
      </button>
    </div>
  );
}
