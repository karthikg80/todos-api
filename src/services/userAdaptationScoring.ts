import type {
  UserAdaptationProfile,
  UserBehaviorSignals,
  DerivedSignals,
  PersonalizationEligibility,
  StructureAppetite,
  InsightAffinity,
  DateDiscipline,
  OrganizationStyle,
  GuidanceNeed,
} from "../types";

// ─── Constants ──────────────────────────────────────────────────────────────

const CURRENT_PROFILE_VERSION = 1;
const CURRENT_POLICY_VERSION = 1;

// Insight engagement guardrail: require minimum opportunities before trusting
const MIN_INSIGHT_OPPORTUNITIES = 8;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Clamp a value between min and max. */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Normalize a value from [0, maxRange] to [0, 100]. */
function normalize(value: number, maxRange: number): number {
  if (maxRange <= 0) return 0;
  return clamp((value / maxRange) * 100, 0, 100);
}

/** Weighted average of percentage inputs. */
function weightedScore(
  inputs: { value: number; weight: number }[],
): number {
  const totalWeight = inputs.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = inputs.reduce((sum, i) => sum + i.value * i.weight, 0);
  return clamp(weighted / totalWeight, 0, 100);
}

// ─── Score Computations ─────────────────────────────────────────────────────

/**
 * Structure Usage Score (0-100)
 *
 * Measures how much the user actually structures their work with sections,
 * priorities, and organization.
 */
export function computeStructureUsageScore(
  signals: UserBehaviorSignals,
): number {
  return weightedScore([
    { value: signals.pctProjectsWithSections, weight: 0.35 },
    {
      value: normalize(signals.avgSectionsPerProject, 8),
      weight: 0.20,
    },
    { value: signals.sectionCreationRate, weight: 0.15 },
    { value: signals.sectionReorganizationRate, weight: 0.15 },
    { value: signals.pctTasksWithPriority, weight: 0.15 },
  ]);
}

/**
 * Date Usage Score (0-100)
 *
 * Measures whether dates matter in this user's workflow.
 */
export function computeDateUsageScore(signals: UserBehaviorSignals): number {
  return weightedScore([
    { value: signals.pctProjectsWithDueDates, weight: 0.35 },
    { value: signals.pctTasksWithDueDates, weight: 0.20 },
    { value: signals.pctProjectsWithTargetDates, weight: 0.15 },
    { value: signals.dueDateEditRate, weight: 0.15 },
    { value: signals.overdueResolutionRate, weight: 0.15 },
  ]);
}

/**
 * Insight Engagement Score (0-100)
 *
 * Measures whether insight surfaces deserve prominence.
 * Returns 0 if insightOpportunityCount < MIN_INSIGHT_OPPORTUNITIES.
 */
export function computeInsightEngagementScore(
  signals: UserBehaviorSignals,
): number {
  if (signals.insightOpportunityCount < MIN_INSIGHT_OPPORTUNITIES) {
    return 0;
  }

  return weightedScore([
    { value: signals.insightsOpenRate, weight: 0.45 },
    { value: signals.insightsActionRate, weight: 0.30 },
    { value: signals.expandAdvancedPanelsRate, weight: 0.10 },
    {
      value: 100 - signals.collapseAdvancedPanelsRate,
      weight: 0.15,
    },
  ]);
}

/**
 * Tasks-First Score (0-100)
 *
 * Measures whether the user operates primarily from task lists.
 */
export function computeTasksFirstScore(signals: UserBehaviorSignals): number {
  return weightedScore([
    { value: signals.taskFirstActionRate, weight: 0.45 },
    { value: signals.revisitViaTaskListRate, weight: 0.25 },
    { value: 100 - signals.pctProjectsWithSections, weight: 0.15 },
    {
      value: 100 - signals.revisitViaSectionViewRate,
      weight: 0.15,
    },
  ]);
}

/**
 * Sections-First Score (0-100)
 *
 * Measures whether the user operates primarily through sections.
 */
export function computeSectionsFirstScore(
  signals: UserBehaviorSignals,
): number {
  return weightedScore([
    { value: signals.pctProjectsWithSections, weight: 0.40 },
    { value: signals.revisitViaSectionViewRate, weight: 0.25 },
    { value: signals.sectionCreationRate, weight: 0.20 },
    { value: signals.sectionReorganizationRate, weight: 0.15 },
  ]);
}

/**
 * Guidance Reliance Score (0-100)
 *
 * Measures whether the user benefits from coaching/setup help.
 * Advisory only in v1 — never drives major surface changes.
 */
export function computeGuidanceRelianceScore(
  signals: UserBehaviorSignals,
): number {
  return weightedScore([
    { value: signals.avgProjectStartSparsity, weight: 0.30 },
    { value: signals.suggestionAcceptRate, weight: 0.20 },
    {
      value: signals.avgTimeToSecondMeaningfulEditHours !== null
        ? normalize(signals.avgTimeToSecondMeaningfulEditHours, 72)
        : 50,
      weight: 0.15,
    },
    { value: 100 - signals.sectionCreationRate, weight: 0.20 },
    { value: 100 - signals.pctProjectsWithDueDates, weight: 0.15 },
  ]);
}

// ─── Classification Thresholds ──────────────────────────────────────────────

export function classifyStructureAppetite(score: number): StructureAppetite {
  if (score < 35) return "lightweight";
  if (score < 70) return "balanced";
  return "planner";
}

export function classifyInsightAffinity(score: number): InsightAffinity {
  if (score < 25) return "low";
  if (score < 60) return "medium";
  return "high";
}

export function classifyDateDiscipline(score: number): DateDiscipline {
  if (score < 30) return "low";
  if (score < 65) return "medium";
  return "high";
}

export function classifyOrganizationStyle(
  tasksFirstScore: number,
  sectionsFirstScore: number,
): OrganizationStyle {
  if (Math.abs(tasksFirstScore - sectionsFirstScore) < 10) return "mixed";
  return tasksFirstScore > sectionsFirstScore ? "tasks_first" : "sections_first";
}

export function classifyGuidanceNeed(score: number): GuidanceNeed {
  if (score < 30) return "low";
  if (score < 65) return "medium";
  return "high";
}

// ─── Derived Signals ────────────────────────────────────────────────────────

/**
 * Compute all derived scores from behavioral signals.
 */
export function computeDerivedSignals(
  signals: UserBehaviorSignals,
): DerivedSignals {
  const structureUsageScore = computeStructureUsageScore(signals);
  const dateUsageScore = computeDateUsageScore(signals);
  const insightEngagementScore = computeInsightEngagementScore(signals);
  const tasksFirstScore = computeTasksFirstScore(signals);
  const sectionsFirstScore = computeSectionsFirstScore(signals);
  const guidanceRelianceScore = computeGuidanceRelianceScore(signals);

  return {
    structureUsageScore: Math.round(structureUsageScore),
    planningBehaviorScore: Math.round(structureUsageScore), // alias for now
    insightEngagementScore: Math.round(insightEngagementScore),
    dateUsageScore: Math.round(dateUsageScore),
    guidanceRelianceScore: Math.round(guidanceRelianceScore),
    tasksFirstScore: Math.round(tasksFirstScore),
    sectionsFirstScore: Math.round(sectionsFirstScore),
  };
}

// ─── Confidence ─────────────────────────────────────────────────────────────

export interface ConfidenceResult {
  confidence: number;
  reason: string;
}

/**
 * Compute confidence score (0.0 - 1.0) based on data sufficiency.
 */
export function computeConfidence(
  projectsCreated: number,
  totalMeaningfulSessions: number,
  signalsWithSufficientData: number,
): ConfidenceResult {
  const projectsNorm = normalize(projectsCreated, 12);
  const sessionsNorm = normalize(totalMeaningfulSessions, 20);
  const signalsNorm = normalize(signalsWithSufficientData, 5);

  const confidence = clamp(
    0.4 * projectsNorm + 0.3 * sessionsNorm + 0.3 * signalsNorm,
    0,
    100,
  ) / 100;

  const roundedConfidence = Math.round(confidence * 100) / 100;

  const reason = `${projectsCreated} projects, ${totalMeaningfulSessions} sessions, ${signalsWithSufficientData}/5 signals`;

  return { confidence: roundedConfidence, reason };
}

// ─── Eligibility ────────────────────────────────────────────────────────────

export interface EligibilityInput {
  projectsCreated: number;
  meaningfulSessions: number;
  daysActive: number;
  confidence: number;
  hasRecentActivity: boolean;
}

/**
 * Determine personalization eligibility, separate from confidence.
 *
 * - "none": cold start, not enough data for any adaptation
 * - "light": minimal adaptation (insights, date prominence)
 * - "standard": full surface emphasis tuning
 * - "full": maximum personalization with auto-expand insights
 */
export function computeEligibility(input: EligibilityInput): PersonalizationEligibility {
  const { projectsCreated, meaningfulSessions, daysActive, confidence, hasRecentActivity } = input;

  if (confidence >= 0.7 && hasRecentActivity) return "full";
  if (projectsCreated >= 5 || meaningfulSessions >= 20) return "standard";
  if (projectsCreated < 3 && meaningfulSessions < 10 && daysActive < 14) return "none";
  return "light";
}

// ─── Profile Assembly ───────────────────────────────────────────────────────

export interface BuildProfileInput {
  signals: UserBehaviorSignals;
  scores: DerivedSignals;
  projectsCreated: number;
  meaningfulSessions: number;
  daysActive: number;
  hasRecentActivity: boolean;
}

/**
 * Build a complete UserAdaptationProfile from signals and metadata.
 */
export function buildUserProfile(
  input: BuildProfileInput,
): UserAdaptationProfile {
  const { signals, scores, projectsCreated, meaningfulSessions, daysActive, hasRecentActivity } = input;

  const { confidence, reason: confidenceReason } = computeConfidence(
    projectsCreated,
    meaningfulSessions,
    // Count how many score dimensions have sufficient signal
    [
      scores.structureUsageScore,
      scores.dateUsageScore,
      scores.insightEngagementScore,
      scores.tasksFirstScore,
      scores.sectionsFirstScore,
    ].filter((s) => s > 0).length,
  );

  const eligibility = computeEligibility({
    projectsCreated,
    meaningfulSessions,
    daysActive,
    confidence,
    hasRecentActivity,
  });

  const now = new Date().toISOString();

  return {
    structureAppetite: classifyStructureAppetite(scores.structureUsageScore),
    insightAffinity: classifyInsightAffinity(scores.insightEngagementScore),
    dateDiscipline: classifyDateDiscipline(scores.dateUsageScore),
    organizationStyle: classifyOrganizationStyle(
      scores.tasksFirstScore,
      scores.sectionsFirstScore,
    ),
    guidanceNeed: classifyGuidanceNeed(scores.guidanceRelianceScore),
    confidence,
    confidenceReason,
    eligibility,
    profileVersion: CURRENT_PROFILE_VERSION,
    policyVersion: CURRENT_POLICY_VERSION,
    lastUpdatedAt: now,
    signalsWindowDays: 60,
  };
}

// ─── Cold Start ─────────────────────────────────────────────────────────────

/**
 * Return a conservative default profile for users with insufficient data.
 */
export function getColdStartProfile(): UserAdaptationProfile {
  const now = new Date().toISOString();

  return {
    structureAppetite: "balanced",
    insightAffinity: "low",
    dateDiscipline: "medium",
    organizationStyle: "mixed",
    guidanceNeed: "medium",
    confidence: 0.2,
    confidenceReason: "cold start — insufficient behavioral data",
    eligibility: "none",
    profileVersion: CURRENT_PROFILE_VERSION,
    policyVersion: CURRENT_POLICY_VERSION,
    lastUpdatedAt: now,
    signalsWindowDays: 60,
  };
}
