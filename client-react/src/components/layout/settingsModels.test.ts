// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_PREFERENCES,
  mergePlanningPreferences,
  parsePreferredContexts,
} from "./settingsModels";

describe("settingsModels", () => {
  it("merges planning preferences with nested soul defaults", () => {
    const merged = mergePlanningPreferences({
      maxDailyTasks: 4,
      soulProfile: { tone: "direct" },
    });

    expect(merged.maxDailyTasks).toBe(4);
    expect(merged.waitingFollowUpDays).toBe(
      DEFAULT_USER_PREFERENCES.waitingFollowUpDays,
    );
    expect(merged.soulProfile?.tone).toBe("direct");
    expect(merged.soulProfile?.planningStyle).toBe("both");
  });

  it("parses preferred contexts as a trimmed unique list", () => {
    expect(parsePreferredContexts("Home, Errands, home, Deep work")).toEqual([
      "Home",
      "Errands",
      "Deep work",
    ]);
  });
});
