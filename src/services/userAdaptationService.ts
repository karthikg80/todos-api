import { PrismaClient, ActivityEventType, Prisma } from "@prisma/client";
import type {
  UserAdaptationProfile,
  UserBehaviorSignals,
  DerivedSignals,
} from "../types";
import {
  computeDerivedSignals,
  buildUserProfile,
  getColdStartProfile,
} from "./userAdaptationScoring";
import { ActivityEventService } from "./activityEventService";
import { createLogger } from "../infra/logging/logger";

const log = createLogger("userAdaptationService");

// ─── Constants ──────────────────────────────────────────────────────────────

const SIGNALS_WINDOW_DAYS = 60;
const RECENT_ACTIVITY_DAYS = 30;
const PROFILE_STALE_HOURS = 24;

// Decay weights: recent signals weighted more heavily
const DECAY_RECENT_DAYS = 30;
const DECAY_RECENT_WEIGHT = 1.0;
const DECAY_OLDER_WEIGHT = 0.5;

// Profile decay: if profile hasn't been recomputed in this many days,
// decay confidence and eligibility toward neutral to prevent fossilization.
// Must be shorter than PROFILE_STALE_HOURS so decay applies before recomputation.
const PROFILE_DECAY_HOURS = 12;
const PROFILE_DECAY_FACTOR = 0.3; // decay confidence by 30% after PROFILE_DECAY_HOURS

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProfileWithMetadata {
  profile: UserAdaptationProfile;
  scores: DerivedSignals;
  signals: UserBehaviorSignals;
  storedAt?: Date;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class UserAdaptationService {
  constructor(
    private readonly prisma?: PrismaClient,
    private readonly eventService?: ActivityEventService,
  ) {}

  /**
   * Get the stored profile for a user, or return cold-start defaults.
   * Recomputes lazily if the stored profile is older than PROFILE_STALE_HOURS.
   */
  async getOrCreateProfile(userId: string): Promise<ProfileWithMetadata> {
    if (!this.prisma) {
      return this._coldStartResult();
    }

    const stored = await this.prisma.userAdaptationProfile.findUnique({
      where: { userId },
    });

    if (!stored) {
      return this._computeAndStoreProfile(userId);
    }

    // Lazy recomputation if stale
    const hoursSinceCompute =
      (Date.now() - stored.computedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCompute > PROFILE_STALE_HOURS) {
      return this._computeAndStoreProfile(userId);
    }

    return this._mapStoredToProfile(stored);
  }

  /**
   * Force recomputation of the user's adaptation profile.
   */
  async computeProfile(userId: string): Promise<ProfileWithMetadata> {
    return this._computeAndStoreProfile(userId);
  }

  /**
   * Collect behavioral signals for a user over the rolling window.
   * Applies time-weighted decay: recent (30d) = 1.0, older (31-60d) = 0.5.
   */
  async collectBehaviorSignals(
    userId: string,
    windowDays = SIGNALS_WINDOW_DAYS,
  ): Promise<UserBehaviorSignals> {
    if (!this.prisma) {
      return this._emptySignals();
    }

    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - windowDays);
    const recentCutoff = new Date(now);
    recentCutoff.setDate(recentCutoff.getDate() - DECAY_RECENT_DAYS);

    // Fetch all activity events in the window
    const events = await this.prisma.activityEvent.findMany({
      where: {
        userId,
        createdAt: { gte: windowStart },
      },
      select: {
        eventType: true,
        createdAt: true,
        entityType: true,
        entityId: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch project-level aggregates
    const [
      projectsCreated,
      projectsCompleted,
      allProjects,
    ] = await Promise.all([
      this.prisma.project.count({
        where: { userId, createdAt: { gte: windowStart } },
      }),
      this.prisma.project.count({
        where: {
          userId,
          status: "completed",
          updatedAt: { gte: windowStart },
        },
      }),
      this.prisma.project.findMany({
        where: { userId, archived: false },
        select: {
          id: true,
          targetDate: true,
          createdAt: true,
          _count: { select: { todos: true, headings: true } },
        },
      }),
    ]);

    // Fetch task-level aggregates across all projects
    const allTodos = await this.prisma.todo.findMany({
      where: { userId, archived: false },
      select: {
        dueDate: true,
        priority: true,
        headingId: true,
        completed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Apply decay weight to each event
    const weightedEventCount = (
      type: ActivityEventType,
    ): number => {
      const matching = events.filter((e) => e.eventType === type);
      return matching.reduce((sum, e) => {
        const age = (now.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const weight = age <= DECAY_RECENT_DAYS ? DECAY_RECENT_WEIGHT : DECAY_OLDER_WEIGHT;
        return sum + weight;
      }, 0);
    };

    // Project-level percentages
    const projectCount = allProjects.length || 1;
    const projectsWithSections = allProjects.filter(
      (p) => p._count.headings > 0,
    ).length;
    const projectsWithDueDates = allProjects.filter((p) =>
      allTodos.some(
        (t) => t.dueDate != null,
      ),
    ).length;
    const projectsWithTargetDates = allProjects.filter(
      (p) => p.targetDate != null,
    ).length;

    // Task-level percentages
    const taskCount = allTodos.length || 1;
    const tasksWithDueDates = allTodos.filter((t) => t.dueDate != null).length;
    const tasksWithPriority = allTodos.filter((t) => t.priority != null && t.priority !== "medium").length;

    // Sections per project average
    const totalSections = allProjects.reduce(
      (sum, p) => sum + p._count.headings,
      0,
    );
    const avgSectionsPerProject = totalSections / projectCount;

    // Days to first section / due date (approximate from events)
    const sectionCreatedEvents = events
      .filter((e) => e.eventType === "section_created")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const avgDaysToFirstSection = sectionCreatedEvents.length > 0
      ? (sectionCreatedEvents[0].createdAt.getTime() -
          new Date(Math.min(...allProjects.map((p) => p.createdAt.getTime())))
            .getTime()) /
        (1000 * 60 * 60 * 24)
      : null;

    // Insight engagement metrics
    const insightsOpenCount = weightedEventCount("insights_open");
    const insightOpportunityCount = weightedEventCount("insight_opportunity_shown");
    const insightsDismissCount = weightedEventCount("insights_dismissed");

    const insightsOpenRate = insightOpportunityCount > 0
      ? (insightsOpenCount / insightOpportunityCount) * 100
      : 0;
    const insightsDismissRate = insightOpportunityCount > 0
      ? (insightsDismissCount / insightOpportunityCount) * 100
      : 0;
    // Action rate: opens that led to some subsequent task edit within the session
    // Approximated as open rate * 0.5 for now (refined when task-level session data available)
    const insightsActionRate = insightsOpenRate * 0.5;

    // Section creation / reorganization rates (per project)
    const sectionCreationRate = projectCount > 0
      ? (weightedEventCount("section_created") / projectCount) * 100
      : 0;
    const sectionReorganizationRate = projectCount > 0
      ? (weightedEventCount("section_reorganized") / projectCount) * 100
      : 0;

    // Task first action rate: tasks edited before sections created
    const taskFirstActionRate = taskCount > 0
      ? ((weightedEventCount("task_created") + weightedEventCount("task_updated")) /
          (weightedEventCount("task_created") +
            weightedEventCount("task_updated") +
            weightedEventCount("section_created") +
            1)) *
        100
      : 0;

    // Suggestion rates
    const suggestionAcceptCount = weightedEventCount("suggestion_accepted");
    const suggestionDismissCount = weightedEventCount("suggestion_dismissed");
    const totalSuggestions = suggestionAcceptCount + suggestionDismissCount;
    const suggestionAcceptRate = totalSuggestions > 0
      ? (suggestionAcceptCount / totalSuggestions) * 100
      : 0;
    const suggestionDismissRate = totalSuggestions > 0
      ? (suggestionDismissCount / totalSuggestions) * 100
      : 0;

    // Panel expand/collapse rates
    const panelExpandCount = weightedEventCount("panel_expanded");
    const panelCollapseCount = weightedEventCount("panel_collapsed");
    const totalPanelActions = panelExpandCount + panelCollapseCount;
    const expandAdvancedPanelsRate = totalPanelActions > 0
      ? (panelExpandCount / totalPanelActions) * 100
      : 0;
    const collapseAdvancedPanelsRate = totalPanelActions > 0
      ? (panelCollapseCount / totalPanelActions) * 100
      : 0;

    // Project revisit metrics
    const projectOpenedCount = weightedEventCount("project_opened");
    const projectResumedCount = weightedEventCount("project_resumed");
    const projectRevisitedAfterIdleCount = weightedEventCount(
      "project_revisited_after_idle",
    );

    const revisitViaTaskListRate = projectOpenedCount > 0
      ? ((weightedEventCount("task_updated") + weightedEventCount("task_completed")) /
          (projectOpenedCount + 1)) *
        50
      : 0;
    const revisitViaSectionViewRate = projectOpenedCount > 0
      ? (weightedEventCount("section_reorganized") / (projectOpenedCount + 1)) *
        100
      : 0;

    // Due date edit rate (approximate from task updates on dated tasks)
    const dueDateEditRate = tasksWithDueDates > 0
      ? (weightedEventCount("task_updated") / tasksWithDueDates) * 50
      : 0;

    // Overdue resolution rate (approximate)
    const overdueTasks = allTodos.filter(
      (t) =>
        t.dueDate != null &&
        !t.completed &&
        new Date(t.dueDate) < now,
    ).length;
    const overdueResolutionRate = overdueTasks > 0
      ? ((weightedEventCount("task_completed") / overdueTasks) * 100)
      : 100;

    // Project start sparsity: projects with <= 2 tasks in first week
    const sparseProjects = allProjects.filter((p) => {
      const weekAfter = new Date(p.createdAt);
      weekAfter.setDate(weekAfter.getDate() + 7);
      const tasksInFirstWeek = allTodos.filter(
        (t) => t.createdAt >= p.createdAt && t.createdAt <= weekAfter,
      ).length;
      return tasksInFirstWeek <= 2;
    }).length;
    const avgProjectStartSparsity = projectCount > 0
      ? (sparseProjects / projectCount) * 100
      : 0;

    // Avg time to second meaningful edit (approximate)
    const avgTimeToSecondMeaningfulEditHours = null; // Requires session-level tracking

    return {
      projectsCreated,
      projectsCompleted,
      avgTasksPerProject: taskCount / projectCount,
      avgSectionsPerProject,
      pctProjectsWithSections: (projectsWithSections / projectCount) * 100,
      pctProjectsWithDueDates: (projectsWithDueDates / projectCount) * 100,
      pctProjectsWithTargetDates:
        (projectsWithTargetDates / projectCount) * 100,
      pctTasksWithDueDates: (tasksWithDueDates / taskCount) * 100,
      pctTasksWithPriority: (tasksWithPriority / taskCount) * 100,
      avgDaysToFirstSection:
        avgDaysToFirstSection !== null
          ? Math.round(avgDaysToFirstSection * 10) / 10
          : null,
      avgDaysToFirstDueDate: null, // Requires per-project first-date tracking
      insightsOpenRate: Math.min(insightsOpenRate, 100),
      insightsActionRate: Math.min(insightsActionRate, 100),
      insightsDismissRate: Math.min(insightsDismissRate, 100),
      insightOpportunityCount: Math.round(insightOpportunityCount),
      sectionCreationRate: Math.min(sectionCreationRate, 100),
      sectionReorganizationRate: Math.min(sectionReorganizationRate, 100),
      taskFirstActionRate: Math.min(taskFirstActionRate, 100),
      suggestionAcceptRate: Math.min(suggestionAcceptRate, 100),
      suggestionDismissRate: Math.min(suggestionDismissRate, 100),
      avgProjectStartSparsity: Math.min(avgProjectStartSparsity, 100),
      avgTimeToSecondMeaningfulEditHours,
      dueDateEditRate: Math.min(dueDateEditRate, 100),
      overdueResolutionRate: Math.min(overdueResolutionRate, 100),
      collapseAdvancedPanelsRate: Math.min(collapseAdvancedPanelsRate, 100),
      expandAdvancedPanelsRate: Math.min(expandAdvancedPanelsRate, 100),
      projectOpenedCount: Math.round(projectOpenedCount),
      projectResumedCount: Math.round(projectResumedCount),
      projectRevisitedAfterIdleCount: Math.round(projectRevisitedAfterIdleCount),
      revisitViaTaskListRate: Math.min(revisitViaTaskListRate, 100),
      revisitViaSectionViewRate: Math.min(revisitViaSectionViewRate, 100),
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private async _computeAndStoreProfile(
    userId: string,
  ): Promise<ProfileWithMetadata> {
    if (!this.prisma) {
      return this._coldStartResult();
    }

    try {
      const signals = await this.collectBehaviorSignals(userId);
      const scores = computeDerivedSignals(signals);

      // Determine metadata for confidence computation
      const projectsCreated = signals.projectsCreated;
      const meaningfulSessions = signals.projectOpenedCount;
      const daysActive = SIGNALS_WINDOW_DAYS;
      const hasRecentActivity = signals.projectOpenedCount > 0;

      const profile = buildUserProfile({
        signals,
        scores,
        projectsCreated,
        meaningfulSessions,
        daysActive,
        hasRecentActivity,
      });

      // Upsert into database
      const stored = await this.prisma.userAdaptationProfile.upsert({
        where: { userId },
        create: {
          userId,
          profileVersion: profile.profileVersion,
          policyVersion: profile.policyVersion,
          eligibility: profile.eligibility,
          structureAppetite: profile.structureAppetite,
          insightAffinity: profile.insightAffinity,
          dateDiscipline: profile.dateDiscipline,
          organizationStyle: profile.organizationStyle,
          guidanceNeed: profile.guidanceNeed,
          confidence: profile.confidence,
          confidenceReason: profile.confidenceReason,
          signalsSnapshot: signals as unknown as Prisma.InputJsonValue,
          scoresSnapshot: scores as unknown as Prisma.InputJsonValue,
          signalsWindowDays: profile.signalsWindowDays,
        },
        update: {
          profileVersion: profile.profileVersion,
          policyVersion: profile.policyVersion,
          eligibility: profile.eligibility,
          structureAppetite: profile.structureAppetite,
          insightAffinity: profile.insightAffinity,
          dateDiscipline: profile.dateDiscipline,
          organizationStyle: profile.organizationStyle,
          guidanceNeed: profile.guidanceNeed,
          confidence: profile.confidence,
          confidenceReason: profile.confidenceReason,
          signalsSnapshot: signals as unknown as Prisma.InputJsonValue,
          scoresSnapshot: scores as unknown as Prisma.InputJsonValue,
          signalsWindowDays: profile.signalsWindowDays,
          computedAt: new Date(),
        },
      });

      log.info("Computed and stored adaptation profile", {
        userId,
        confidence: profile.confidence,
        eligibility: profile.eligibility,
        structureAppetite: profile.structureAppetite,
      });

      // Emit observability event
      this.eventService?.recordEvent(userId, "session_start", {
        entityType: "adaptation_profile",
        entityId: userId,
        metadata: {
          event: "adaptation_profile_computed",
          confidence: profile.confidence,
          eligibility: profile.eligibility,
          structureAppetite: profile.structureAppetite,
          insightAffinity: profile.insightAffinity,
          dateDiscipline: profile.dateDiscipline,
          scores: {
            structureUsageScore: scores.structureUsageScore,
            dateUsageScore: scores.dateUsageScore,
            insightEngagementScore: scores.insightEngagementScore,
          },
          signalWindow: SIGNALS_WINDOW_DAYS,
          projectsInWindow: signals.projectsCreated,
          sessionsInWindow: signals.projectOpenedCount,
        },
      });

      return {
        profile,
        scores,
        signals,
        storedAt: stored.computedAt,
      };
    } catch (err) {
      log.error("Failed to compute adaptation profile", {
        userId,
        error: (err as Error).message,
      });
      return this._coldStartResult();
    }
  }

  private _mapStoredToProfile(
    stored: {
      id: string;
      userId: string;
      profileVersion: number;
      policyVersion: number;
      eligibility: string;
      structureAppetite: string;
      insightAffinity: string;
      dateDiscipline: string;
      organizationStyle: string;
      guidanceNeed: string;
      confidence: number;
      confidenceReason: string | null;
      signalsSnapshot: unknown;
      scoresSnapshot: unknown;
      signalsWindowDays: number;
      computedAt: Date;
      updatedAt: Date;
    },
  ): ProfileWithMetadata {
    let profile: UserAdaptationProfile = {
      structureAppetite: stored.structureAppetite as UserAdaptationProfile["structureAppetite"],
      insightAffinity: stored.insightAffinity as UserAdaptationProfile["insightAffinity"],
      dateDiscipline: stored.dateDiscipline as UserAdaptationProfile["dateDiscipline"],
      organizationStyle: stored.organizationStyle as UserAdaptationProfile["organizationStyle"],
      guidanceNeed: stored.guidanceNeed as UserAdaptationProfile["guidanceNeed"],
      confidence: stored.confidence,
      confidenceReason: stored.confidenceReason ?? "",
      eligibility: stored.eligibility as UserAdaptationProfile["eligibility"],
      profileVersion: stored.profileVersion,
      policyVersion: stored.policyVersion,
      lastUpdatedAt: stored.computedAt.toISOString(),
      signalsWindowDays: stored.signalsWindowDays,
    };

    // Apply decay toward neutral if profile is stale
    profile = this._applyProfileDecay(profile, stored.computedAt);

    return {
      profile,
      scores: (stored.scoresSnapshot ?? {}) as DerivedSignals,
      signals: (stored.signalsSnapshot ?? {}) as UserBehaviorSignals,
      storedAt: stored.computedAt,
    };
  }

  /**
   * Apply decay toward neutral for stale profiles.
   * Prevents fossilization when user behavior changes.
   */
  private _applyProfileDecay(
    profile: UserAdaptationProfile,
    computedAt: Date,
  ): UserAdaptationProfile {
    const hoursSinceCompute =
      (Date.now() - computedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCompute < PROFILE_DECAY_HOURS) {
      return profile;
    }

    // Scale decay factor by how long since compute (caps at 2x the base factor)
    const decayMultiplier = Math.min(2, hoursSinceCompute / PROFILE_DECAY_HOURS);
    const effectiveDecay = PROFILE_DECAY_FACTOR * decayMultiplier;

    // Decay confidence toward zero
    const decayedConfidence = Math.max(
      0,
      profile.confidence * (1 - effectiveDecay),
    );

    // Downgrade eligibility if confidence drops below thresholds
    let decayedEligibility = profile.eligibility;
    if (decayedConfidence < 0.2) {
      decayedEligibility = "none";
    } else if (decayedConfidence < 0.4 && profile.eligibility === "full") {
      decayedEligibility = "standard";
    } else if (decayedConfidence < 0.3 && profile.eligibility === "standard") {
      decayedEligibility = "light";
    }

    return {
      ...profile,
      confidence: Math.round(decayedConfidence * 100) / 100,
      eligibility: decayedEligibility,
      confidenceReason: `${profile.confidenceReason} [decayed: ${Math.round(hoursSinceCompute)}h inactive]`,
    };
  }

  private _coldStartResult(): ProfileWithMetadata {
    const profile = getColdStartProfile();
    return {
      profile,
      scores: {
        structureUsageScore: 0,
        planningBehaviorScore: 0,
        insightEngagementScore: 0,
        dateUsageScore: 0,
        guidanceRelianceScore: 0,
        tasksFirstScore: 0,
        sectionsFirstScore: 0,
      },
      signals: this._emptySignals(),
    };
  }

  private _emptySignals(): UserBehaviorSignals {
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
}
