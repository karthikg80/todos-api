import { useState, useCallback } from "react";
import type { AgentId, AvatarMode } from "../types";
import { AGENTS } from "../registry";
import { getOpener, getThinkingLine, getEmptyState } from "../voiceEngine";

export function useAgent(id: AgentId) {
  const agent = AGENTS[id];
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("idle");

  return {
    agent,
    avatarMode,
    setAvatarMode,
    getOpener: useCallback(() => getOpener(agent), [agent]),
    getThinkingLine: useCallback(() => getThinkingLine(agent), [agent]),
    getEmptyState: useCallback(() => getEmptyState(agent), [agent]),
  };
}
