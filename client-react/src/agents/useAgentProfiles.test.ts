import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAgentProfile } from "./useAgentProfiles";
import { AGENTS } from "./registry";

// Reset module-level cache between tests
vi.mock("./useAgentProfiles", async () => {
  const actual = await vi.importActual("./useAgentProfiles");
  return { ...actual, cachedProfiles: null };
});

describe("getAgentProfile", () => {
  it("returns undefined for undefined agentId", () => {
    expect(getAgentProfile({}, undefined)).toBeUndefined();
  });

  it("returns undefined for unknown agentId", () => {
    expect(getAgentProfile({}, "ghost")).toBeUndefined();
  });

  it("returns the profile for a known agentId", () => {
    expect(getAgentProfile(AGENTS, "finn")).toBe(AGENTS.finn);
    expect(getAgentProfile(AGENTS, "orla")).toBe(AGENTS.orla);
  });

  it("all registry agents are resolvable", () => {
    const ids = Object.keys(AGENTS);
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach((id) => {
      expect(getAgentProfile(AGENTS, id)).toBeDefined();
    });
  });
});
