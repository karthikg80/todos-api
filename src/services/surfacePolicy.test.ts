import {
  deriveSurfacePolicy,
  buildProjectContext,
} from "./surfacePolicy";
import type {
  UserAdaptationProfile,
  ProjectContext,
} from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseProfile(): UserAdaptationProfile {
  return {
    structureAppetite: "balanced",
    insightAffinity: "low",
    dateDiscipline: "medium",
    organizationStyle: "mixed",
    guidanceNeed: "medium",
    confidence: 0.5,
    confidenceReason: "5 projects, 10 sessions",
    eligibility: "standard",
    profileVersion: 1,
    policyVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
    signalsWindowDays: 60,
  };
}

function sparseContext(): ProjectContext {
  return {
    taskCount: 1,
    sectionCount: 0,
    hasSections: false,
    hasDates: false,
    hasTargetDate: false,
    hasMeaningfulInsights: false,
    insightOpportunityCount: 0,
    recentActivityCount: 0,
    overdueCount: 0,
    unplacedTaskCount: 1,
    isSparse: true,
    ageDays: 1,
    completionCount: 0,
  };
}

function richContext(): ProjectContext {
  return {
    taskCount: 20,
    sectionCount: 5,
    hasSections: true,
    hasDates: true,
    hasTargetDate: true,
    hasMeaningfulInsights: true,
    insightOpportunityCount: 15,
    recentActivityCount: 10,
    overdueCount: 2,
    unplacedTaskCount: 3,
    isSparse: false,
    ageDays: 30,
    completionCount: 8,
  };
}

function guidedContext(): ProjectContext {
  return {
    taskCount: 8,
    sectionCount: 2,
    hasSections: true,
    hasDates: true,
    hasTargetDate: false,
    hasMeaningfulInsights: true,
    insightOpportunityCount: 5,
    recentActivityCount: 4,
    overdueCount: 1,
    unplacedTaskCount: 2,
    isSparse: false,
    ageDays: 10,
    completionCount: 3,
  };
}

// ─── Cold Start / No Eligibility ────────────────────────────────────────────

describe("deriveSurfacePolicy — cold start", () => {
  it("returns conservative policy for eligibility=none on simple project", () => {
    const profile = baseProfile();
    profile.eligibility = "none";

    const { policy, rationale } = deriveSurfacePolicy(
      profile,
      "simple",
      sparseContext(),
    );

    expect(policy.defaultOverviewMode).toBe("minimal");
    expect(policy.showInsightsDisclosure).toBe(false);
    expect(policy.autoExpandInsights).toBe(false);
    expect(policy.showSetupGuidance).toBe(true);
    expect(policy.personalizationLevel).toBe("none");
    expect(rationale[0]).toContain("eligibility=none");
  });

  it("returns conservative policy for eligibility=none on rich project", () => {
    const profile = baseProfile();
    profile.eligibility = "none";

    const { policy } = deriveSurfacePolicy(
      profile,
      "rich",
      richContext(),
    );

    expect(policy.defaultOverviewMode).toBe("balanced");
    expect(policy.showSectionsPreview).toBe(true);
    expect(policy.showInsightsDisclosure).toBe(false);
    expect(policy.personalizationLevel).toBe("none");
  });
});

// ─── Rule Set A: Simple Projects ────────────────────────────────────────────

describe("deriveSurfacePolicy — simple projects", () => {
  it("A1: simple + lightweight → minimal, no sections", () => {
    const profile = baseProfile();
    profile.structureAppetite = "lightweight";
    profile.eligibility = "standard";

    const { policy, rationale } = deriveSurfacePolicy(
      profile,
      "simple",
      sparseContext(),
    );

    expect(policy.defaultOverviewMode).toBe("minimal");
    expect(policy.showSectionsPreview).toBe(false);
    expect(policy.showTaskPreview).toBe(true);
    expect(policy.showDatesProminently).toBe(false);
    expect(policy.showInsightsDisclosure).toBe(false);
    expect(policy.emphasizeNextAction).toBe(true);
    expect(policy.emphasizeProjectStats).toBe(false);
    expect(rationale.some((r) => r.includes("lightweight"))).toBe(true);
  });

  it("A1: simple + lightweight + high guidance → shows setup guidance", () => {
    const profile = baseProfile();
    profile.structureAppetite = "lightweight";
    profile.guidanceNeed = "high";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "simple",
      sparseContext(),
    );

    expect(policy.showSetupGuidance).toBe(true);
    expect(policy.setupGuidanceStyle).toBe("light");
  });

  it("A1: simple + lightweight + high date discipline → suggests dates", () => {
    const profile = baseProfile();
    profile.structureAppetite = "lightweight";
    profile.dateDiscipline = "high";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "simple",
      sparseContext(),
    );

    expect(policy.suggestDates).toBe(true);
  });

  it("A2: simple + balanced → minimal, dates if not low", () => {
    const profile = baseProfile();
    profile.structureAppetite = "balanced";
    profile.dateDiscipline = "medium";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "simple",
      sparseContext(),
    );

    expect(policy.defaultOverviewMode).toBe("minimal");
    expect(policy.showDatesProminently).toBe(true);
    expect(policy.emphasizeProjectStats).toBe(true);
  });

  it("A2: simple + balanced + high insight affinity → insights disclosure", () => {
    const profile = baseProfile();
    profile.structureAppetite = "balanced";
    profile.insightAffinity = "high";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "simple",
      sparseContext(),
    );

    expect(policy.showInsightsDisclosure).toBe(true);
  });

  it("A3: simple + planner → balanced overview", () => {
    const profile = baseProfile();
    profile.structureAppetite = "planner";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "simple",
      sparseContext(),
    );

    expect(policy.defaultOverviewMode).toBe("balanced");
    expect(policy.showDatesProminently).toBe(true);
    expect(policy.emphasizeProjectStats).toBe(true);
  });

  it("A3: simple + planner + has sections → sections preview", () => {
    const profile = baseProfile();
    profile.structureAppetite = "planner";
    profile.eligibility = "standard";

    const ctx = sparseContext();
    ctx.hasSections = true;
    ctx.sectionCount = 2;

    const { policy } = deriveSurfacePolicy(profile, "simple", ctx);

    expect(policy.showSectionsPreview).toBe(true);
  });

  it("A3: simple + planner + no sections + ≥5 tasks → suggest sections", () => {
    const profile = baseProfile();
    profile.structureAppetite = "planner";
    profile.eligibility = "standard";

    const ctx = sparseContext();
    ctx.taskCount = 6;
    ctx.isSparse = false;

    const { policy } = deriveSurfacePolicy(profile, "simple", ctx);

    expect(policy.suggestSections).toBe(true);
  });
});

// ─── Rule Set B: Guided Projects ────────────────────────────────────────────

describe("deriveSurfacePolicy — guided projects", () => {
  it("B1: guided + lightweight → balanced, sections if exist", () => {
    const profile = baseProfile();
    profile.structureAppetite = "lightweight";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "guided",
      guidedContext(),
    );

    expect(policy.defaultOverviewMode).toBe("balanced");
    expect(policy.showSectionsPreview).toBe(true);
    expect(policy.emphasizeNextAction).toBe(true);
  });

  it("B1: guided + lightweight + no sections → task preview", () => {
    const profile = baseProfile();
    profile.structureAppetite = "lightweight";
    profile.eligibility = "standard";

    const ctx = guidedContext();
    ctx.hasSections = false;
    ctx.sectionCount = 0;

    const { policy } = deriveSurfacePolicy(profile, "guided", ctx);

    expect(policy.showTaskPreview).toBe(true);
    expect(policy.showSectionsPreview).toBe(false);
  });

  it("B2: guided + balanced → sections preview, no task preview", () => {
    const profile = baseProfile();
    profile.structureAppetite = "balanced";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "guided",
      guidedContext(),
    );

    expect(policy.showSectionsPreview).toBe(true);
    expect(policy.showTaskPreview).toBe(false);
  });

  it("B2: guided + balanced + no sections → suggest sections", () => {
    const profile = baseProfile();
    profile.structureAppetite = "balanced";
    profile.eligibility = "standard";

    const ctx = guidedContext();
    ctx.hasSections = false;
    ctx.sectionCount = 0;

    const { policy } = deriveSurfacePolicy(profile, "guided", ctx);

    expect(policy.suggestSections).toBe(true);
  });

  it("B3: guided + planner → full insights, dates prominent", () => {
    const profile = baseProfile();
    profile.structureAppetite = "planner";
    profile.insightAffinity = "high";
    profile.confidence = 0.75;
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "guided",
      guidedContext(),
    );

    expect(policy.showDatesProminently).toBe(true);
    expect(policy.showInsightsDisclosure).toBe(true);
  });

  it("B3: guided + planner + high insight + high conf → auto-expand insights", () => {
    const profile = baseProfile();
    profile.structureAppetite = "planner";
    profile.insightAffinity = "high";
    profile.confidence = 0.8;
    profile.eligibility = "full";

    const { policy } = deriveSurfacePolicy(
      profile,
      "guided",
      guidedContext(),
    );

    expect(policy.autoExpandInsights).toBe(true);
  });
});

// ─── Rule Set C: Rich Projects ──────────────────────────────────────────────

describe("deriveSurfacePolicy — rich projects", () => {
  it("C1: rich + lightweight → balanced, no suggestions", () => {
    const profile = baseProfile();
    profile.structureAppetite = "lightweight";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "rich",
      richContext(),
    );

    expect(policy.defaultOverviewMode).toBe("balanced");
    expect(policy.suggestSections).toBe(false);
    expect(policy.suggestDates).toBe(false);
    expect(policy.showSectionsPreview).toBe(true);
    expect(policy.showDatesProminently).toBe(true);
  });

  it("C2: rich + balanced → detailed overview", () => {
    const profile = baseProfile();
    profile.structureAppetite = "balanced";
    profile.eligibility = "standard";

    const { policy } = deriveSurfacePolicy(
      profile,
      "rich",
      richContext(),
    );

    expect(policy.defaultOverviewMode).toBe("detailed");
    expect(policy.showInsightsDisclosure).toBe(true);
  });

  it("C2: rich + balanced + high insight + high conf → auto-expand", () => {
    const profile = baseProfile();
    profile.structureAppetite = "balanced";
    profile.insightAffinity = "high";
    profile.confidence = 0.75;
    profile.eligibility = "full";

    const { policy } = deriveSurfacePolicy(
      profile,
      "rich",
      richContext(),
    );

    expect(policy.autoExpandInsights).toBe(true);
  });

  it("C3: rich + planner → detailed, auto-expand if conf≥0.6", () => {
    const profile = baseProfile();
    profile.structureAppetite = "planner";
    profile.confidence = 0.7;
    profile.insightAffinity = "medium";
    profile.eligibility = "full";

    const { policy } = deriveSurfacePolicy(
      profile,
      "rich",
      richContext(),
    );

    expect(policy.defaultOverviewMode).toBe("detailed");
    expect(policy.autoExpandInsights).toBe(true);
  });

  it("C3: rich + planner + low insight affinity → no auto-expand", () => {
    const profile = baseProfile();
    profile.structureAppetite = "planner";
    profile.confidence = 0.7;
    profile.insightAffinity = "low";
    profile.eligibility = "full";

    const { policy } = deriveSurfacePolicy(
      profile,
      "rich",
      richContext(),
    );

    expect(policy.autoExpandInsights).toBe(false);
  });
});

// ─── buildProjectContext ────────────────────────────────────────────────────

describe("buildProjectContext", () => {
  it("marks sparse project correctly", () => {
    const ctx = buildProjectContext({
      taskCount: 1,
      sectionCount: 0,
      hasTargetDate: false,
      hasMeaningfulInsights: false,
      insightOpportunityCount: 0,
      recentActivityCount: 0,
      overdueCount: 0,
      unplacedTaskCount: 1,
      completionCount: 0,
      ageDays: 1,
      tasksWithDates: 0,
    });

    expect(ctx.isSparse).toBe(true);
    expect(ctx.hasSections).toBe(false);
    expect(ctx.hasDates).toBe(false);
  });

  it("marks rich project correctly", () => {
    const ctx = buildProjectContext({
      taskCount: 20,
      sectionCount: 5,
      hasTargetDate: true,
      hasMeaningfulInsights: true,
      insightOpportunityCount: 15,
      recentActivityCount: 10,
      overdueCount: 2,
      unplacedTaskCount: 3,
      completionCount: 8,
      ageDays: 30,
      tasksWithDates: 12,
    });

    expect(ctx.isSparse).toBe(false);
    expect(ctx.hasSections).toBe(true);
    expect(ctx.hasDates).toBe(true);
  });
});

// ─── Guardrails ─────────────────────────────────────────────────────────────

describe("policy guardrails", () => {
  it("always emphasizes next action", () => {
    const profile = baseProfile();
    const contexts = [sparseContext(), guidedContext(), richContext()];
    const complexities: Array<"simple" | "guided" | "rich"> = [
      "simple",
      "guided",
      "rich",
    ];

    for (const complexity of complexities) {
      for (const ctx of contexts) {
        const { policy } = deriveSurfacePolicy(profile, complexity, ctx);
        expect(policy.emphasizeNextAction).toBe(true);
      }
    }
  });

  it("never hides task list completely (showTaskPreview or showSectionsPreview)", () => {
    const profile = baseProfile();
    const contexts = [sparseContext(), guidedContext(), richContext()];
    const complexities: Array<"simple" | "guided" | "rich"> = [
      "simple",
      "guided",
      "rich",
    ];

    for (const complexity of complexities) {
      for (const ctx of contexts) {
        const { policy } = deriveSurfacePolicy(profile, complexity, ctx);
        expect(
          policy.showTaskPreview || policy.showSectionsPreview,
        ).toBe(true);
      }
    }
  });

  it("never auto-expands insights for low eligibility", () => {
    const profile = baseProfile();
    profile.eligibility = "none";
    profile.insightAffinity = "high";
    profile.confidence = 0.9;

    const { policy } = deriveSurfacePolicy(profile, "rich", richContext());

    expect(policy.autoExpandInsights).toBe(false);
  });
});
