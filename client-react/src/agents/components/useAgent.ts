import { useCallback } from "react";
import type { AgentId } from "../types";
import { AGENTS } from "../registry";
import { getOpener, getThinkingLine, getEmptyState } from "../voiceEngine";

export function useAgent(id: AgentId) {
  const agent = AGENTS[id];

  return {
    agent,
    getOpener: useCallback(() => getOpener(agent), [agent]),
    getThinkingLine: useCallback(() => getThinkingLine(agent), [agent]),
    getEmptyState: useCallback(() => getEmptyState(agent), [agent]),
  };
}
