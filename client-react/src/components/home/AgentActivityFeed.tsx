import { useState, useEffect } from "react";
import { apiCall } from "../../api/client";
import {
  useAgentProfiles,
  getAgentProfile,
} from "../../agents/useAgentProfiles";
import { AgentSigil } from "./AgentSigil";

interface ActivityEntry {
  agentId: string;
  jobName: string;
  periodKey: string;
  narration: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Props {
  standalone?: boolean;
}

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffMs = today.getTime() - entryDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 5)
    return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDay(
  entries: ActivityEntry[],
): Array<{ label: string; entries: ActivityEntry[] }> {
  const groups: Array<{ label: string; entries: ActivityEntry[] }> = [];
  let currentLabel = "";

  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    if (label !== currentLabel) {
      groups.push({ label, entries: [entry] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].entries.push(entry);
    }
  }

  return groups;
}

export function AgentActivityFeed({ standalone = false }: Props) {
  const profiles = useAgentProfiles();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("/agent-activity")
      .then((res) => res.json())
      .then((data: { entries: ActivityEntry[] }) => setEntries(data.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    if (standalone) {
      return (
        <div className="activity-feed activity-feed--loading">
          <div className="loading-skeleton">
            <div className="loading-skeleton__row" />
            <div className="loading-skeleton__row" />
            <div className="loading-skeleton__row" />
          </div>
        </div>
      );
    }
    return null;
  }

  if (entries.length === 0) {
    if (standalone) {
      return (
        <div className="activity-feed activity-feed--empty">
          <p className="activity-feed__empty-text">
            No agent activity in the last 7 days.
          </p>
        </div>
      );
    }
    return null;
  }

  const renderEntry = (entry: ActivityEntry, i: number) => {
    const agent = getAgentProfile(profiles, entry.agentId);
    return (
      <div
        key={`${entry.agentId}-${entry.periodKey}-${i}`}
        className="activity-entry"
      >
        {agent && (
          <AgentSigil
            agentId={agent.id}
            color={agent.colors.stroke}
            bg={agent.colors.bg}
            size={32}
          />
        )}
        <div className="activity-entry__body">
          <div className="activity-entry__header">
            <span
              className="activity-entry__name"
              style={{ color: agent?.colors.textDark }}
            >
              {agent?.name ?? entry.agentId}
            </span>
            <span className="activity-entry__meta">
              {entry.jobName} &middot;{" "}
              {new Date(entry.createdAt).toLocaleString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="activity-entry__narration">{entry.narration}</p>
        </div>
      </div>
    );
  };

  if (standalone) {
    const groups = groupByDay(entries);
    return (
      <div className="activity-feed">
        {groups.map((group) => (
          <div key={group.label} className="activity-feed__day">
            <h3 className="activity-feed__date-header">{group.label}</h3>
            {group.entries.map(renderEntry)}
          </div>
        ))}
      </div>
    );
  }

  return <div className="activity-feed">{entries.map(renderEntry)}</div>;
}
