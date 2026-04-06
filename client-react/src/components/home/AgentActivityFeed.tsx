import { useState, useEffect } from "react";
import { apiCall } from "../../api/client";
import { useAgentProfiles, getAgentProfile } from "../../agents/useAgentProfiles";
import { AgentSigil } from "./AgentSigil";

interface ActivityEntry {
  agentId: string;
  agentName: string;
  jobName: string;
  periodKey: string;
  narration: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function AgentActivityFeed() {
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

  if (loading || entries.length === 0) return null;

  return (
    <div className="activity-feed">
      {entries.map((entry, i) => {
        const agent = getAgentProfile(profiles, entry.agentId);
        return (
          <div key={`${entry.agentId}-${entry.periodKey}-${i}`} className="activity-entry">
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
                  {entry.agentName}
                </span>
                <span className="activity-entry__meta">
                  {entry.jobName} &middot; {new Date(entry.createdAt).toLocaleString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="activity-entry__narration">{entry.narration}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
