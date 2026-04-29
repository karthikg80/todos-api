import type { UserAdaptationProfile } from "../types";

import {
  applyKillSwitches,
  getDefaultFlags,
  isUserEligible,
} from "./adaptationFlags";

const baseProfile: UserAdaptationProfile = {
  structureAppetite: "lightweight",
  insightAffinity: "high",
  dateDiscipline: "medium",
  organizationStyle: "tasks_first",
  guidanceNeed: "high",
  confidence: 0.8,
  confidenceReason: "baseline profile",
  eligibility: "full",
  profileVersion: 1,
  policyVersion: 1,
  lastUpdatedAt: "2026-04-29T00:00:00.000Z",
  signalsWindowDays: 30,
};

describe("adaptationFlags", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reads default flags from environment variables", () => {
    process.env.ADAPTATION_ENABLED = "true";
    process.env.ADAPTATION_INSIGHTS_PERSONALIZATION = "0";
    process.env.ADAPTATION_GUIDANCE_PERSONALIZATION = "yes";
    process.env.ADAPTATION_ROLLOUT_PERCENTAGE = "35";
    process.env.ADAPTATION_ELIGIBLE_USER_IDS = " user-1, user-2 ";

    expect(getDefaultFlags()).toEqual({
      enabled: true,
      insightsPersonalization: false,
      guidancePersonalization: true,
      rolloutPercentage: 35,
      eligibleUserIds: ["user-1", "user-2"],
    });
  });

  it("prefers explicit allowlists over rollout percentages", () => {
    const flags = {
      enabled: true,
      insightsPersonalization: true,
      guidancePersonalization: true,
      rolloutPercentage: 100,
      eligibleUserIds: ["allowed-user"],
    };

    expect(isUserEligible("allowed-user", flags)).toBe(true);
    expect(isUserEligible("blocked-user", flags)).toBe(false);
  });

  it("uses deterministic rollout thresholds when no allowlist exists", () => {
    const enabledForAll = {
      enabled: true,
      insightsPersonalization: true,
      guidancePersonalization: true,
      rolloutPercentage: 100,
    };
    const disabledForAll = {
      enabled: true,
      insightsPersonalization: true,
      guidancePersonalization: true,
      rolloutPercentage: 0,
    };

    expect(isUserEligible("any-user", enabledForAll)).toBe(true);
    expect(isUserEligible("any-user", disabledForAll)).toBe(false);
  });

  it("applies the kill switches in priority order", () => {
    expect(
      applyKillSwitches(baseProfile, {
        enabled: false,
        insightsPersonalization: true,
        guidancePersonalization: true,
        rolloutPercentage: 0,
      }),
    ).toMatchObject({
      eligibility: "none",
      confidenceReason: "baseline profile [adaptation disabled]",
    });

    expect(
      applyKillSwitches(baseProfile, {
        enabled: true,
        insightsPersonalization: false,
        guidancePersonalization: true,
        rolloutPercentage: 100,
      }),
    ).toMatchObject({
      insightAffinity: "low",
      confidenceReason: "baseline profile [insights personalization disabled]",
    });

    expect(
      applyKillSwitches(baseProfile, {
        enabled: true,
        insightsPersonalization: true,
        guidancePersonalization: false,
        rolloutPercentage: 100,
      }),
    ).toMatchObject({
      guidanceNeed: "low",
      confidenceReason: "baseline profile [guidance personalization disabled]",
    });
  });
});
