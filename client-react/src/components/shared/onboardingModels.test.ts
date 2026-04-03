// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  getExampleSeedTasks,
  getTonePreview,
  mergePreferences,
  normalizeSoulProfile,
} from "./onboardingModels";

describe("onboardingModels", () => {
  it("normalizes soul profile lists and keeps defaults", () => {
    expect(
      normalizeSoulProfile({
        lifeAreas: ["work", "work", "health"],
        tone: "direct",
      }),
    ).toEqual({
      lifeAreas: ["work", "health"],
      failureModes: [],
      planningStyle: "both",
      energyPattern: "variable",
      goodDayThemes: [],
      tone: "direct",
      dailyRitual: "neither",
    });
  });

  it("builds example tasks from selected life areas", () => {
    expect(getExampleSeedTasks({ lifeAreas: ["work", "family"] })).toEqual([
      "Email Sarah about the design review",
      "Check in about the family schedule",
      "Clear one small piece of life admin",
    ]);
  });

  it("merges planning preferences and nested soul defaults", () => {
    const merged = mergePreferences({
      waitingFollowUpDays: 3,
      soulProfile: { tone: "focused" },
    });

    expect(merged.waitingFollowUpDays).toBe(3);
    expect(merged.soulProfile?.tone).toBe("focused");
    expect(merged.soulProfile?.planningStyle).toBe("both");
  });

  it("returns the correct tone preview copy", () => {
    expect(getTonePreview("encouraging")).toContain("Warm support");
  });
});
