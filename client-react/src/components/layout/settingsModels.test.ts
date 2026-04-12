// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  mergePlanningPreferences,
  parsePreferredContexts,
  DEFAULT_SOUL_PROFILE,
  DEFAULT_USER_PREFERENCES,
  CHUNK_MINUTE_OPTIONS,
  SOUL_PLANNING_STYLE_OPTIONS,
  SOUL_ENERGY_PATTERN_OPTIONS,
  SOUL_TONE_OPTIONS,
  SOUL_DAILY_RITUAL_OPTIONS,
} from "./settingsModels";

describe("settingsModels", () => {
  describe("constants", () => {
    it("defines DEFAULT_SOUL_PROFILE with expected structure", () => {
      expect(DEFAULT_SOUL_PROFILE).toHaveProperty("lifeAreas");
      expect(DEFAULT_SOUL_PROFILE).toHaveProperty("tone", "calm");
      expect(DEFAULT_SOUL_PROFILE).toHaveProperty("planningStyle", "both");
    });

    it("defines DEFAULT_USER_PREFERENCES with expected structure", () => {
      expect(DEFAULT_USER_PREFERENCES).toHaveProperty("weekendsActive", true);
      expect(DEFAULT_USER_PREFERENCES).toHaveProperty("waitingFollowUpDays", 7);
      expect(DEFAULT_USER_PREFERENCES).toHaveProperty("soulProfile");
    });

    it("defines CHUNK_MINUTE_OPTIONS with 6 entries", () => {
      expect(CHUNK_MINUTE_OPTIONS).toHaveLength(6);
      expect(CHUNK_MINUTE_OPTIONS[0]).toHaveProperty("value", "");
      expect(CHUNK_MINUTE_OPTIONS[5]).toHaveProperty("value", "90");
    });

    it("defines SOUL_PLANNING_STYLE_OPTIONS with 3 entries", () => {
      expect(SOUL_PLANNING_STYLE_OPTIONS).toHaveLength(3);
    });

    it("defines SOUL_ENERGY_PATTERN_OPTIONS with 4 entries", () => {
      expect(SOUL_ENERGY_PATTERN_OPTIONS).toHaveLength(4);
    });

    it("defines SOUL_TONE_OPTIONS with 4 entries", () => {
      expect(SOUL_TONE_OPTIONS).toHaveLength(4);
    });

    it("defines SOUL_DAILY_RITUAL_OPTIONS with 4 entries", () => {
      expect(SOUL_DAILY_RITUAL_OPTIONS).toHaveLength(4);
    });
  });

  describe("mergePlanningPreferences", () => {
    it("returns defaults for null input", () => {
      const result = mergePlanningPreferences(null);
      expect(result).toEqual(DEFAULT_USER_PREFERENCES);
    });

    it("returns defaults for undefined input", () => {
      const result = mergePlanningPreferences(undefined);
      expect(result).toEqual(DEFAULT_USER_PREFERENCES);
    });

    it("returns defaults for empty object", () => {
      const result = mergePlanningPreferences({});
      expect(result).toEqual(DEFAULT_USER_PREFERENCES);
    });

    it("overrides maxDailyTasks when provided", () => {
      const result = mergePlanningPreferences({ maxDailyTasks: 10 });
      expect(result.maxDailyTasks).toBe(10);
    });

    it("overrides weekendsActive when provided", () => {
      const result = mergePlanningPreferences({ weekendsActive: false });
      expect(result.weekendsActive).toBe(false);
    });

    it("preserves preferredContexts array when provided", () => {
      const result = mergePlanningPreferences({ preferredContexts: ["work", "home"] });
      expect(result.preferredContexts).toEqual(["work", "home"]);
    });

    it("uses default contexts when not an array", () => {
      const result = mergePlanningPreferences({ preferredContexts: "not-an-array" as any });
      expect(result.preferredContexts).toEqual([]);
    });

    it("merges soulProfile with defaults", () => {
      const result = mergePlanningPreferences({
        soulProfile: { tone: "direct" },
      });
      expect(result.soulProfile.tone).toBe("direct");
      expect(result.soulProfile.lifeAreas).toEqual([]);
      expect(result.soulProfile.planningStyle).toBe("both");
    });

    it("handles null soulProfile gracefully", () => {
      const result = mergePlanningPreferences({
        soulProfile: null,
      });
      expect(result.soulProfile).toEqual(DEFAULT_SOUL_PROFILE);
    });
  });

  describe("parsePreferredContexts", () => {
    it("splits comma-separated values", () => {
      expect(parsePreferredContexts("work, home, health")).toEqual(["work", "home", "health"]);
    });

    it("trims whitespace", () => {
      expect(parsePreferredContexts("  work  ,  home  ")).toEqual(["work", "home"]);
    });

    it("filters empty values", () => {
      expect(parsePreferredContexts("work, , home, ")).toEqual(["work", "home"]);
    });

    it("removes duplicates case-insensitively", () => {
      expect(parsePreferredContexts("Work, work, HOME, home")).toEqual(["Work", "HOME"]);
    });

    it("returns empty array for empty input", () => {
      expect(parsePreferredContexts("")).toEqual([]);
      expect(parsePreferredContexts("  ")).toEqual([]);
      expect(parsePreferredContexts(", ,")).toEqual([]);
    });

    it("handles single value", () => {
      expect(parsePreferredContexts("deep-work")).toEqual(["deep-work"]);
    });
  });
});
