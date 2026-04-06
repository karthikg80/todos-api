import { useState, useEffect } from "react";
import { apiCall } from "../api/client";
import type { AgentProfile } from "./types";

let cachedProfiles: Record<string, AgentProfile> | null = null;

export function useAgentProfiles(): Record<string, AgentProfile> {
  const [profiles, setProfiles] = useState<Record<string, AgentProfile>>(
    cachedProfiles ?? {},
  );

  useEffect(() => {
    if (cachedProfiles) return;

    apiCall("/api/agent-profiles")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { agents: AgentProfile[] }) => {
        const map: Record<string, AgentProfile> = {};
        for (const agent of data.agents) {
          map[agent.id] = agent;
        }
        cachedProfiles = map;
        setProfiles(map);
      })
      .catch((err) => {
        console.error("Failed to load agent profiles:", err);
      });
  }, []);

  return profiles;
}

export function getAgentProfile(
  profiles: Record<string, AgentProfile>,
  agentId: string | undefined,
): AgentProfile | undefined {
  if (!agentId) return undefined;
  return profiles[agentId];
}
