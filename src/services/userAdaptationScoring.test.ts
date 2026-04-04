import {
  computeStructureUsageScore,
  computeDateUsageScore,
  computeInsightEngagementScore,
  computeTasksFirstScore,
  computeSectionsFirstScore,
  computeGuidanceRelianceScore,
  computeDerivedSignals,
  classifyStructureAppetite,
  classifyInsightAffinity,
  classifyDateDiscipline,
  classifyOrganizationStyle,
  classifyGuidanceNeed,
  computeConfidence,
  computeEligibility,
  buildUserProfile,
  getColdStartProfile,
} from "./userAdaptationScoring";
import type { UserBehaviorSignals } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseSignals(): UserBehaviorSignals {
  return {
    projectsCreated: 0,
    projectsCompleted: 0,
    avgTasksPerProject: 0,
    avgSectionsPerProject: 0,
    pctProjectsWithSections: 0,
    pctProjectsWithDueDates: 0,
    pctProjectsWithTargetDates: 0,
    pctTasksWithDueDates: 0,
    pctTasksWithPriority: 0,
    avgDaysToFirstSection: null,
    avgDaysToFirstDueDate: null,
    insightsOpenRate: 0,
    insightsActionRate: 0,
    insightsDismissRate: 0,
    insightOpportunityCount: 0,
    sectionCreationRate: 0,
    sectionReorganizationRate: 0,
    taskFirstActionRate: 0,
    suggestionAcceptRate: 0,
    suggestionDismissRate: 0,
    avgProjectStartSparsity: 0,
    avgTimeToSecondMeaningfulEditHours: null,
    dueDateEditRate: 0,
    overdueResolutionRate: 0,
    collapseAdvancedPanelsRate: 0,
    expandAdvancedPanelsRate: 0,
    projectOpenedCount: 0,
    projectResumedCount: 0,
    projectRevisitedAfterIdleCount: 0,
    revisitViaTaskListRate: 0,
    revisitViaSectionViewRate: 0,
  };
}

// ─── Structure Usage Score ──────────────────────────────────────────────────

describe("computeStructureUsageScore", () => {
  it("returns 0 for empty signals", () => {
    expect(computeStructureUsageScore(baseSignals())).toBe(0);
  });

  it("returns 100 for max structure usage", () => {
    const signals = baseSignals();
    signals.pctProjectsWithSections = 100;
    signals.avgSectionsPerProject = 8;
    signals.sectionCreationRate = 100;
    signals.sectionReorganizationRate = 100;
    signals.pctTasksWithPriority = 100;
    expect(computeStructureUsageScore(signals)).toBe(100);
  });

  it("classifies as lightweight for low scores", () => {
    const signals = baseSignals();
    signals.pctProjectsWithSections = 20;
    const score = computeStructureUsageScore(signals);
    expect(score).toBeLessThan(35);
    expect(classifyStructureAppetite(score)).toBe("lightweight");
  });

  it("classifies as balanced for mid scores", () => {
    const signals = baseSignals();
    signals.pctProjectsWithSections = 60;
    signals.avgSectionsPerProject = 4;
    signals.sectionCreationRate = 50;
    signals.sectionReorganizationRate = 30;
    signals.pctTasksWithPriority = 40;
    const score = computeStructureUsageScore(signals);
    expect(score).toBeGreaterThanOrEqual(35);
    expect(score).toBeLessThan(70);
    expect(classifyStructureAppetite(score)).toBe("balanced");
  });

  it("classifies as planner for high scores", () => {
    const signals = baseSignals();
    signals.pctProjectsWithSections = 90;
    signals.avgSectionsPerProject = 6;
    signals.sectionCreationRate = 80;
    signals.sectionReorganizationRate = 60;
    signals.pctTasksWithPriority = 70;
    const score = computeStructureUsageScore(signals);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(classifyStructureAppetite(score)).toBe("planner");
  });
});

// ─── Date Usage Score ───────────────────────────────────────────────────────

describe("computeDateUsageScore", () => {
  it("returns 0 for empty signals", () => {
    expect(computeDateUsageScore(baseSignals())).toBe(0);
  });

  it("returns 100 for max date usage", () => {
    const signals = baseSignals();
    signals.pctProjectsWithDueDates = 100;
    signals.pctTasksWithDueDates = 100;
    signals.pctProjectsWithTargetDates = 100;
    signals.dueDateEditRate = 100;
    signals.overdueResolutionRate = 100;
    expect(computeDateUsageScore(signals)).toBe(100);
  });

  it("classifies as low for low scores", () => {
    const signals = baseSignals();
    signals.pctProjectsWithDueDates = 10;
    const score = computeDateUsageScore(signals);
    expect(score).toBeLessThan(30);
    expect(classifyDateDiscipline(score)).toBe("low");
  });

  it("classifies as medium for mid scores", () => {
    const signals = baseSignals();
    signals.pctProjectsWithDueDates = 60;
    signals.pctTasksWithDueDates = 50;
    signals.pctProjectsWithTargetDates = 40;
    signals.dueDateEditRate = 30;
    const score = computeDateUsageScore(signals);
    expect(score).toBeGreaterThanOrEqual(30);
    expect(score).toBeLessThan(65);
    expect(classifyDateDiscipline(score)).toBe("medium");
  });

  it("classifies as high for high scores", () => {
    const signals = baseSignals();
    signals.pctProjectsWithDueDates = 80;
    signals.pctTasksWithDueDates = 70;
    signals.pctProjectsWithTargetDates = 60;
    signals.dueDateEditRate = 70;
    signals.overdueResolutionRate = 80;
    const score = computeDateUsageScore(signals);
    expect(score).toBeGreaterThanOrEqual(65);
    expect(classifyDateDiscipline(score)).toBe("high");
  });
});

// ─── Insight Engagement Score ───────────────────────────────────────────────

describe("computeInsightEngagementScore", () => {
  it("returns 0 when below minimum opportunities", () => {
    const signals = baseSignals();
    signals.insightOpportunityCount = 5;
    signals.insightsOpenRate = 80;
    expect(computeInsightEngagementScore(signals)).toBe(0);
  });

  it("returns 0 for empty signals", () => {
    expect(computeInsightEngagementScore(baseSignals())).toBe(0);
  });

  it("computes score when opportunities >= 8", () => {
    const signals = baseSignals();
    signals.insightOpportunityCount = 10;
    signals.insightsOpenRate = 60;
    signals.insightsActionRate = 40;
    signals.expandAdvancedPanelsRate = 30;
    signals.collapseAdvancedPanelsRate = 20;
    const score = computeInsightEngagementScore(signals);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("classifies as low for low scores", () => {
    const signals = baseSignals();
    signals.insightOpportunityCount = 10;
    signals.insightsOpenRate = 10;
    const score = computeInsightEngagementScore(signals);
    expect(score).toBeLessThan(25);
    expect(classifyInsightAffinity(score)).toBe("low");
  });

  it("classifies as high for high scores", () => {
    const signals = baseSignals();
    signals.insightOpportunityCount = 20;
    signals.insightsOpenRate = 90;
    signals.insightsActionRate = 70;
    signals.expandAdvancedPanelsRate = 60;
    signals.collapseAdvancedPanelsRate = 10;
    const score = computeInsightEngagementScore(signals);
    expect(score).toBeGreaterThanOrEqual(60);
    expect(classifyInsightAffinity(score)).toBe("high");
  });
});

// ─── Organization Style ─────────────────────────────────────────────────────

describe("computeTasksFirstScore", () => {
  it("returns baseline score for empty signals due to inverse terms", () => {
    // Empty signals means 0% sections → inverse terms push score up
    const score = computeTasksFirstScore(baseSignals());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns high for tasks-first behavior", () => {
    const signals = baseSignals();
    signals.taskFirstActionRate = 90;
    signals.revisitViaTaskListRate = 80;
    signals.pctProjectsWithSections = 10;
    signals.revisitViaSectionViewRate = 5;
    const score = computeTasksFirstScore(signals);
    expect(score).toBeGreaterThan(60);
  });
});

describe("computeSectionsFirstScore", () => {
  it("returns 0 for empty signals", () => {
    expect(computeSectionsFirstScore(baseSignals())).toBe(0);
  });

  it("returns high for sections-first behavior", () => {
    const signals = baseSignals();
    signals.pctProjectsWithSections = 90;
    signals.revisitViaSectionViewRate = 80;
    signals.sectionCreationRate = 70;
    signals.sectionReorganizationRate = 60;
    const score = computeSectionsFirstScore(signals);
    expect(score).toBeGreaterThan(60);
  });
});

describe("classifyOrganizationStyle", () => {
  it("returns mixed when scores are close", () => {
    expect(classifyOrganizationStyle(50, 55)).toBe("mixed");
    expect(classifyOrganizationStyle(55, 50)).toBe("mixed");
  });

  it("returns tasks_first when tasks score is higher", () => {
    expect(classifyOrganizationStyle(70, 30)).toBe("tasks_first");
  });

  it("returns sections_first when sections score is higher", () => {
    expect(classifyOrganizationStyle(30, 70)).toBe("sections_first");
  });
});

// ─── Guidance Reliance Score ────────────────────────────────────────────────

describe("computeGuidanceRelianceScore", () => {
  it("returns baseline score for empty signals due to inverse terms", () => {
    // Inverse terms (100 - sectionCreationRate, 100 - pctProjectsWithDueDates)
    // push score up when signals are zero
    const score = computeGuidanceRelianceScore(baseSignals());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns high for high guidance need", () => {
    const signals = baseSignals();
    signals.avgProjectStartSparsity = 90;
    signals.suggestionAcceptRate = 80;
    signals.avgTimeToSecondMeaningfulEditHours = 60;
    signals.sectionCreationRate = 10;
    signals.pctProjectsWithDueDates = 10;
    const score = computeGuidanceRelianceScore(signals);
    expect(score).toBeGreaterThanOrEqual(65);
    expect(classifyGuidanceNeed(score)).toBe("high");
  });

  it("returns low for low guidance need", () => {
    const signals = baseSignals();
    signals.avgProjectStartSparsity = 10;
    signals.suggestionAcceptRate = 5;
    signals.avgTimeToSecondMeaningfulEditHours = 2;
    signals.sectionCreationRate = 80;
    signals.pctProjectsWithDueDates = 90;
    const score = computeGuidanceRelianceScore(signals);
    expect(score).toBeLessThan(30);
    expect(classifyGuidanceNeed(score)).toBe("low");
  });
});

// ─── Derived Signals ────────────────────────────────────────────────────────

describe("computeDerivedSignals", () => {
  it("returns zero for direct scores, baseline for inverse scores", () => {
    const derived = computeDerivedSignals(baseSignals());
    expect(derived.structureUsageScore).toBe(0);
    expect(derived.dateUsageScore).toBe(0);
    expect(derived.insightEngagementScore).toBe(0);
    // guidanceRelianceScore has inverse terms → non-zero baseline
    expect(derived.guidanceRelianceScore).toBeGreaterThan(0);
    // tasksFirstScore has inverse terms → non-zero baseline
    expect(derived.tasksFirstScore).toBeGreaterThan(0);
    expect(derived.sectionsFirstScore).toBe(0);
  });

  it("returns rounded integer scores", () => {
    const signals = baseSignals();
    signals.pctProjectsWithSections = 50;
    signals.pctProjectsWithDueDates = 60;
    const derived = computeDerivedSignals(signals);
    expect(Number.isInteger(derived.structureUsageScore)).toBe(true);
    expect(Number.isInteger(derived.dateUsageScore)).toBe(true);
  });
});

// ─── Confidence ─────────────────────────────────────────────────────────────

describe("computeConfidence", () => {
  it("returns low confidence for minimal data", () => {
    const { confidence } = computeConfidence(1, 2, 1);
    expect(confidence).toBeLessThan(0.4);
  });

  it("returns medium confidence for moderate data", () => {
    const { confidence } = computeConfidence(6, 12, 3);
    expect(confidence).toBeGreaterThanOrEqual(0.4);
    expect(confidence).toBeLessThan(0.7);
  });

  it("returns high confidence for strong data", () => {
    const { confidence } = computeConfidence(12, 25, 5);
    expect(confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("caps at 1.0", () => {
    const { confidence } = computeConfidence(100, 100, 10);
    expect(confidence).toBeLessThanOrEqual(1.0);
  });

  it("includes a reason string", () => {
    const { reason } = computeConfidence(5, 10, 3);
    expect(reason).toContain("5 projects");
    expect(reason).toContain("10 sessions");
  });
});

// ─── Eligibility ────────────────────────────────────────────────────────────

describe("computeEligibility", () => {
  it("returns none for cold start", () => {
    expect(
      computeEligibility({
        projectsCreated: 1,
        meaningfulSessions: 3,
        daysActive: 5,
        confidence: 0.1,
        hasRecentActivity: false,
      }),
    ).toBe("none");
  });

  it("returns light for minimal data", () => {
    expect(
      computeEligibility({
        projectsCreated: 3,
        meaningfulSessions: 12,
        daysActive: 20,
        confidence: 0.3,
        hasRecentActivity: true,
      }),
    ).toBe("light");
  });

  it("returns standard for 5+ projects", () => {
    expect(
      computeEligibility({
        projectsCreated: 5,
        meaningfulSessions: 10,
        daysActive: 30,
        confidence: 0.5,
        hasRecentActivity: true,
      }),
    ).toBe("standard");
  });

  it("returns standard for 20+ sessions", () => {
    expect(
      computeEligibility({
        projectsCreated: 3,
        meaningfulSessions: 25,
        daysActive: 30,
        confidence: 0.5,
        hasRecentActivity: true,
      }),
    ).toBe("standard");
  });

  it("returns full for high confidence with recent activity", () => {
    expect(
      computeEligibility({
        projectsCreated: 10,
        meaningfulSessions: 20,
        daysActive: 45,
        confidence: 0.75,
        hasRecentActivity: true,
      }),
    ).toBe("full");
  });
});

// ─── Build User Profile ─────────────────────────────────────────────────────

describe("buildUserProfile", () => {
  it("returns a complete profile from signals", () => {
    const signals = baseSignals();
    signals.pctProjectsWithSections = 60;
    signals.avgSectionsPerProject = 3;
    signals.sectionCreationRate = 50;
    signals.pctProjectsWithDueDates = 40;
    signals.pctTasksWithDueDates = 30;

    const profile = buildUserProfile({
      signals,
      scores: computeDerivedSignals(signals),
      projectsCreated: 5,
      meaningfulSessions: 10,
      daysActive: 30,
      hasRecentActivity: true,
    });

    expect(profile.structureAppetite).toBeDefined();
    expect(profile.insightAffinity).toBeDefined();
    expect(profile.dateDiscipline).toBeDefined();
    expect(profile.organizationStyle).toBeDefined();
    expect(profile.guidanceNeed).toBeDefined();
    expect(profile.confidence).toBeGreaterThanOrEqual(0);
    expect(profile.confidence).toBeLessThanOrEqual(1);
    expect(profile.eligibility).toBeDefined();
    expect(profile.profileVersion).toBe(1);
    expect(profile.policyVersion).toBe(1);
  });

  it("returns cold-start-like profile for empty signals", () => {
    const signals = baseSignals();
    const profile = buildUserProfile({
      signals,
      scores: computeDerivedSignals(signals),
      projectsCreated: 0,
      meaningfulSessions: 0,
      daysActive: 1,
      hasRecentActivity: false,
    });

    expect(profile.confidence).toBeLessThan(0.4);
    expect(profile.eligibility).toBe("none");
  });
});

// ─── Cold Start Profile ─────────────────────────────────────────────────────

describe("getColdStartProfile", () => {
  it("returns conservative defaults", () => {
    const profile = getColdStartProfile();

    expect(profile.structureAppetite).toBe("balanced");
    expect(profile.insightAffinity).toBe("low");
    expect(profile.dateDiscipline).toBe("medium");
    expect(profile.organizationStyle).toBe("mixed");
    expect(profile.guidanceNeed).toBe("medium");
    expect(profile.confidence).toBe(0.2);
    expect(profile.eligibility).toBe("none");
    expect(profile.profileVersion).toBe(1);
    expect(profile.policyVersion).toBe(1);
    expect(profile.signalsWindowDays).toBe(60);
  });

  it("returns a fresh timestamp each call", async () => {
    const p1 = getColdStartProfile();
    await new Promise((r) => setTimeout(r, 2));
    const p2 = getColdStartProfile();
    expect(p2.lastUpdatedAt).not.toBe(p1.lastUpdatedAt);
  });
});
