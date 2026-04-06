import { Router } from "express";
import { AGENTS, ALL_AGENT_IDS } from "../agents/registry";
import type { AgentProfile } from "../agents/types";

type PublicAgentProfile = Omit<AgentProfile, "voice"> & {
  voice: Omit<AgentProfile["voice"], "systemPromptFragment">;
};

function stripInternal(profile: AgentProfile): PublicAgentProfile {
  const { systemPromptFragment: _, ...publicVoice } = profile.voice;
  return { ...profile, voice: publicVoice };
}

export function createAgentProfileRouter(): Router {
  const router = Router();

  // Public — no auth required
  router.get("/agent-profiles", (_req, res) => {
    const agents = ALL_AGENT_IDS.map((id) => stripInternal(AGENTS[id]));
    res.json({ agents });
  });

  return router;
}

export function createInternalAgentProfileRouter(): Router {
  const router = Router();

  // Internal — requires agent auth (Bearer token)
  router.get("/internal/agent-profiles", (_req, res) => {
    const agents = ALL_AGENT_IDS.map((id) => AGENTS[id]);
    res.json({ agents });
  });

  return router;
}
