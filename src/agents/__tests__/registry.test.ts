import { describe, it, expect } from "vitest";
import { AGENTS, getAgentProfile, ALL_AGENT_IDS } from "../registry";
import type { AgentId } from "../../types";

describe("agent registry", () => {
  it("exports all 6 agents", () => {
    expect(ALL_AGENT_IDS).toEqual([
      "orla",
      "finn",
      "mira",
      "echo",
      "sol",
      "kodo",
    ]);
    expect(Object.keys(AGENTS)).toHaveLength(6);
  });

  it("each profile has required fields", () => {
    for (const id of ALL_AGENT_IDS) {
      const profile = AGENTS[id];
      expect(profile.id).toBe(id);
      expect(profile.name).toBeTruthy();
      expect(profile.role).toBeTruthy();
      expect(profile.traits).toHaveLength(3);
      expect(profile.colors.stroke).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(profile.colors.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(profile.voice.systemPromptFragment).toBeTruthy();
      expect(profile.voice.avgWordsPerSentence).toBeGreaterThan(0);
    }
  });

  it("getAgentProfile returns profile for valid id", () => {
    const finn = getAgentProfile("finn");
    expect(finn?.name).toBe("FINN");
    expect(finn?.role).toBe("priority engine");
  });

  it("getAgentProfile returns undefined for invalid id", () => {
    expect(getAgentProfile("nonexistent" as AgentId)).toBeUndefined();
  });

  it("systemPromptFragment contains voice rules", () => {
    const finn = AGENTS.finn;
    expect(finn.voice.systemPromptFragment).toContain("7 words");
    const sol = AGENTS.sol;
    expect(sol.voice.systemPromptFragment).toContain("18 words");
  });
});
