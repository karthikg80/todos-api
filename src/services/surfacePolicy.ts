import type {
  UserAdaptationProfile,
  ProjectSurfacePolicy,
  ProjectContext,
  PersonalizationEligibility,
} from "../types";

// ─── Constants ──────────────────────────────────────────────────────────────

const CURRENT_PROJECT_COMPLEXITY_VERSION = 1;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProjectComplexity = "simple" | "guided" | "rich";

export interface DerivePolicyResult {
  policy: ProjectSurfacePolicy;
  rationale: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function capByEligibility<T extends string>(value: T, allowed: T[]): T {
  return allowed.includes(value) ? value : allowed[allowed.length - 1];
}

function hasMeaningfulInsights(context: ProjectContext): boolean {
  return context.hasMeaningfulInsights;
}

// ─── Rule Set A: Simple Projects ────────────────────────────────────────────

function deriveSimplePolicy(
  profile: UserAdaptationProfile,
  context: ProjectContext,
): DerivePolicyResult {
  const rationale: string[] = [];
  const {
    structureAppetite,
    insightAffinity,
    dateDiscipline,
    organizationStyle,
    guidanceNeed,
    eligibility,
  } = profile;

  // Base: simple projects stay minimal
  let defaultOverviewMode: ProjectSurfacePolicy["defaultOverviewMode"] =
    "minimal";
  let showSectionsPreview = false;
  let showTaskPreview = true;
  let showDatesProminently = false;
  let showInsightsDisclosure = false;
  let autoExpandInsights = false;
  let showInsightsBadge = false;
  let showSetupGuidance = false;
  let setupGuidanceStyle: ProjectSurfacePolicy["setupGuidanceStyle"] = "none";
  let suggestSections = false;
  let suggestDates = false;
  let emphasizeNextAction = true;
  let emphasizeProjectStats = false;

  if (structureAppetite === "lightweight") {
    // A1: Simple + lightweight — calmest experience
    rationale.push("simple + lightweight → minimal overview, no sections");
    showSetupGuidance = guidanceNeed !== "low";
    if (showSetupGuidance) {
      setupGuidanceStyle = "light";
      rationale.push(`guidanceNeed=${guidanceNeed} → showSetupGuidance`);
    }
    if (dateDiscipline === "high") {
      suggestDates = true;
      rationale.push("dateDiscipline=high → suggestDates");
    }
  } else if (structureAppetite === "balanced") {
    // A2: Simple + balanced — still simple, allow light structure
    rationale.push("simple + balanced → minimal overview, light structure");
    if (dateDiscipline !== "low") {
      showDatesProminently = true;
      rationale.push("dateDiscipline≠low → showDatesProminently");
    }
    if (insightAffinity === "high") {
      showInsightsDisclosure = true;
      rationale.push("insightAffinity=high → showInsightsDisclosure");
    }
    if (guidanceNeed === "high") {
      showSetupGuidance = true;
      setupGuidanceStyle = "light";
      rationale.push("guidanceNeed=high → showSetupGuidance");
    }
    if (dateDiscipline === "high") {
      suggestDates = true;
      rationale.push("dateDiscipline=high → suggestDates");
    }
    emphasizeProjectStats = true;
  } else {
    // A3: Simple + planner — respect style, don't overcomplicate
    defaultOverviewMode = "balanced";
    rationale.push("simple + planner → balanced overview");
    if (organizationStyle !== "tasks_first" && context.hasSections) {
      showSectionsPreview = true;
      rationale.push("planner + hasSections → showSectionsPreview");
    }
    showDatesProminently = true;
    rationale.push("planner → showDatesProminently");
    if (hasMeaningfulInsights(context)) {
      showInsightsDisclosure = true;
      rationale.push("hasMeaningfulInsights → showInsightsDisclosure");
    }
    if (!context.hasSections && context.taskCount >= 5) {
      suggestSections = true;
      rationale.push("no sections + ≥5 tasks → suggestSections");
    }
    if (!context.hasDates) {
      suggestDates = true;
      rationale.push("no dates → suggestDates");
    }
    emphasizeProjectStats = true;
  }

  return {
    policy: {
      defaultOverviewMode,
      personalizationLevel: "none", // capped by simple project
      showSectionsPreview,
      showTaskPreview,
      showDatesProminently,
      showInsightsDisclosure,
      autoExpandInsights,
      showInsightsBadge,
      showSetupGuidance,
      setupGuidanceStyle,
      suggestSections,
      suggestDates,
      emphasizeNextAction,
      emphasizeProjectStats,
    },
    rationale,
  };
}

// ─── Rule Set B: Guided Projects ────────────────────────────────────────────

function deriveGuidedPolicy(
  profile: UserAdaptationProfile,
  context: ProjectContext,
): DerivePolicyResult {
  const rationale: string[] = [];
  const {
    structureAppetite,
    insightAffinity,
    dateDiscipline,
    guidanceNeed,
    confidence,
    eligibility,
  } = profile;

  let defaultOverviewMode: ProjectSurfacePolicy["defaultOverviewMode"] =
    "balanced";
  let showSectionsPreview = false;
  let showTaskPreview = false;
  let showDatesProminently = false;
  let showInsightsDisclosure = false;
  let autoExpandInsights = false;
  let showInsightsBadge = false;
  let showSetupGuidance = false;
  let setupGuidanceStyle: ProjectSurfacePolicy["setupGuidanceStyle"] = "none";
  let suggestSections = false;
  let suggestDates = false;
  let emphasizeNextAction = true;
  let emphasizeProjectStats = true;

  if (structureAppetite === "lightweight") {
    // B1: Guided + lightweight — structure available but not dominant
    rationale.push("guided + lightweight → balanced, sections if exist");
    if (context.hasSections) {
      showSectionsPreview = true;
      showTaskPreview = false;
      rationale.push("hasSections → showSectionsPreview");
    } else {
      showTaskPreview = true;
      rationale.push("no sections → showTaskPreview");
    }
    if (dateDiscipline !== "low") {
      showDatesProminently = true;
      rationale.push("dateDiscipline≠low → showDatesProminently");
    }
    if (hasMeaningfulInsights(context)) {
      showInsightsDisclosure = true;
      rationale.push("hasMeaningfulInsights → showInsightsDisclosure");
    }
    if (guidanceNeed === "high") {
      showSetupGuidance = true;
      setupGuidanceStyle = "light";
      rationale.push("guidanceNeed=high → showSetupGuidance");
    }
    if (!context.hasSections && context.taskCount >= 6) {
      suggestSections = true;
      rationale.push("no sections + ≥6 tasks → suggestSections");
    }
    if (!context.hasDates && dateDiscipline !== "low") {
      suggestDates = true;
      rationale.push("no dates + dateDiscipline≠low → suggestDates");
    }
  } else if (structureAppetite === "balanced") {
    // B2: Guided + balanced — baseline consumer experience
    rationale.push("guided + balanced → baseline experience");
    showSectionsPreview = true;
    showTaskPreview = false;
    if (dateDiscipline !== "low") {
      showDatesProminently = true;
      rationale.push("dateDiscipline≠low → showDatesProminently");
    }
    if (hasMeaningfulInsights(context)) {
      showInsightsDisclosure = true;
      rationale.push("hasMeaningfulInsights → showInsightsDisclosure");
    }
    if (guidanceNeed === "high") {
      showSetupGuidance = true;
      setupGuidanceStyle = "light";
      rationale.push("guidanceNeed=high → showSetupGuidance");
    }
    if (!context.hasSections) {
      suggestSections = true;
      rationale.push("no sections → suggestSections");
    }
    if (!context.hasDates && dateDiscipline === "high") {
      suggestDates = true;
      rationale.push("no dates + dateDiscipline=high → suggestDates");
    }
  } else {
    // B3: Guided + planner — more planning cues, preserve calmness
    rationale.push("guided + planner → balanced with full cues");
    showSectionsPreview = true;
    showTaskPreview = false;
    showDatesProminently = true;
    showInsightsDisclosure = true;
    if (insightAffinity === "high" && confidence >= 0.7) {
      autoExpandInsights = true;
      rationale.push("insightAffinity=high + conf≥0.7 → autoExpandInsights");
    }
    if (!context.hasSections) {
      suggestSections = true;
      rationale.push("no sections → suggestSections");
    }
    if (!context.hasDates) {
      suggestDates = true;
      rationale.push("no dates → suggestDates");
    }
  }

  return {
    policy: {
      defaultOverviewMode,
      personalizationLevel: "none",
      showSectionsPreview,
      showTaskPreview,
      showDatesProminently,
      showInsightsDisclosure,
      autoExpandInsights,
      showInsightsBadge,
      showSetupGuidance,
      setupGuidanceStyle,
      suggestSections,
      suggestDates,
      emphasizeNextAction,
      emphasizeProjectStats,
    },
    rationale,
  };
}

// ─── Rule Set C: Rich Projects ──────────────────────────────────────────────

function deriveRichPolicy(
  profile: UserAdaptationProfile,
  context: ProjectContext,
): DerivePolicyResult {
  const rationale: string[] = [];
  const {
    structureAppetite,
    insightAffinity,
    dateDiscipline,
    confidence,
    eligibility,
  } = profile;

  let defaultOverviewMode: ProjectSurfacePolicy["defaultOverviewMode"] =
    "balanced";
  let showSectionsPreview = true;
  let showTaskPreview = false;
  let showDatesProminently = true;
  let showInsightsDisclosure = true;
  let autoExpandInsights = false;
  let showInsightsBadge = false;
  let showSetupGuidance = false;
  let setupGuidanceStyle: ProjectSurfacePolicy["setupGuidanceStyle"] = "none";
  let suggestSections = false;
  let suggestDates = false;
  let emphasizeNextAction = true;
  let emphasizeProjectStats = true;

  if (structureAppetite === "lightweight") {
    // C1: Rich + lightweight — complex project, user prefers simplicity
    rationale.push("rich + lightweight → balanced, no suggestions");
    defaultOverviewMode = "balanced";
  } else if (structureAppetite === "balanced") {
    // C2: Rich + balanced — standard rich-project consumer surface
    rationale.push("rich + balanced → detailed overview");
    defaultOverviewMode = "detailed";
    if (insightAffinity === "high" && confidence >= 0.7) {
      autoExpandInsights = true;
      rationale.push("insightAffinity=high + conf≥0.7 → autoExpandInsights");
    }
  } else {
    // C3: Rich + planner — most powerful default allowed
    rationale.push("rich + planner → detailed, full insights");
    defaultOverviewMode = "detailed";
    if (confidence >= 0.6 && insightAffinity !== "low") {
      autoExpandInsights = true;
      rationale.push("conf≥0.6 + insightAffinity≠low → autoExpandInsights");
    }
  }

  return {
    policy: {
      defaultOverviewMode,
      personalizationLevel: "none",
      showSectionsPreview,
      showTaskPreview,
      showDatesProminently,
      showInsightsDisclosure,
      autoExpandInsights,
      showInsightsBadge,
      showSetupGuidance,
      setupGuidanceStyle,
      suggestSections,
      suggestDates,
      emphasizeNextAction,
      emphasizeProjectStats,
    },
    rationale,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Derive the surface policy for a project given the user's adaptation profile
 * and the project's context.
 *
 * This is the single derivation site for policy. The React client consumes
 * the resolved policy and does not recompute or combine policy locally.
 */
export function deriveSurfacePolicy(
  profile: UserAdaptationProfile,
  projectComplexity: ProjectComplexity,
  context: ProjectContext,
): DerivePolicyResult {
  // Cold start / no eligibility → conservative defaults
  if (profile.eligibility === "none") {
    return {
      policy: {
        defaultOverviewMode:
          projectComplexity === "rich" ? "balanced" : "minimal",
        personalizationLevel: "none",
        showSectionsPreview: projectComplexity !== "simple",
        showTaskPreview: projectComplexity === "simple",
        showDatesProminently: false,
        showInsightsDisclosure: false,
        autoExpandInsights: false,
        showInsightsBadge: false,
        showSetupGuidance: context.isSparse,
        setupGuidanceStyle: context.isSparse ? "light" : "none",
        suggestSections: false,
        suggestDates: false,
        emphasizeNextAction: true,
        emphasizeProjectStats: false,
      },
      rationale: ["eligibility=none → cold-start conservative policy"],
    };
  }

  let result: DerivePolicyResult;

  switch (projectComplexity) {
    case "simple":
      result = deriveSimplePolicy(profile, context);
      break;
    case "guided":
      result = deriveGuidedPolicy(profile, context);
      break;
    case "rich":
      result = deriveRichPolicy(profile, context);
      break;
  }

  // Cap personalization level by eligibility
  const personalizationLevel = capPersonalizationLevel(
    profile.eligibility,
    result.policy.autoExpandInsights || result.policy.suggestSections,
  );
  result.policy.personalizationLevel = personalizationLevel;

  // Add eligibility cap rationale
  if (profile.eligibility === "light") {
    result.rationale.push("eligibility=light → capped personalization");
  }

  return result;
}

/**
 * Determine the effective personalization level based on eligibility
 * and whether the policy would trigger advanced features.
 */
function capPersonalizationLevel(
  eligibility: PersonalizationEligibility,
  hasAdvancedFeatures: boolean,
): ProjectSurfacePolicy["personalizationLevel"] {
  switch (eligibility) {
    case "none":
      return "none";
    case "light":
      return hasAdvancedFeatures ? "light" : "light";
    case "standard":
      return "standard";
    case "full":
      return "full";
  }
}

/**
 * Build a ProjectContext from raw project data.
 * This is the contract between the project classifier and the policy engine.
 */
export function buildProjectContext(input: {
  taskCount: number;
  sectionCount: number;
  hasTargetDate: boolean;
  hasMeaningfulInsights: boolean;
  insightOpportunityCount: number;
  recentActivityCount: number;
  overdueCount: number;
  unplacedTaskCount: number;
  completionCount: number;
  ageDays: number;
  tasksWithDates: number;
}): ProjectContext {
  const hasSections = input.sectionCount > 0;
  const hasDates = input.tasksWithDates > 0;

  return {
    taskCount: input.taskCount,
    sectionCount: input.sectionCount,
    hasSections,
    hasDates,
    hasTargetDate: input.hasTargetDate,
    hasMeaningfulInsights: input.hasMeaningfulInsights,
    insightOpportunityCount: input.insightOpportunityCount,
    recentActivityCount: input.recentActivityCount,
    overdueCount: input.overdueCount,
    unplacedTaskCount: input.unplacedTaskCount,
    isSparse: input.taskCount <= 2 && !hasSections,
    ageDays: input.ageDays,
    completionCount: input.completionCount,
  };
}
