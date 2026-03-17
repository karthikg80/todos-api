import { PrismaClient } from "@prisma/client";

export interface ConfigRecommendation {
  target: string;
  currentValue: number;
  suggestedValue: number;
  confidence: number;
  why: string;
  evidence?: Record<string, unknown>;
}

export interface DailyEvaluationResult {
  date: string;
  recommendedCount: number;
  completedRecommended: number;
  completedNotRecommended: number;
  excludedCompletedWithin24h: number;
  plannedMinutes: number;
  completedMinutes: number;
  acceptanceRate: number;
  exclusionRegret: number;
  budgetFitScore: number;
  configRecommendations: ConfigRecommendation[];
}

export interface WeeklyEvaluationResult {
  week: string;
  weekStart: string;
  weekEnd: string;
  automationSuccessRate: number;
  followupUsefulnessRate: number;
  staleTaskCount: number;
  staleTaskDelta: number;
  waitingTaskCount: number;
  inboxBacklogCount: number;
  projectsWithoutNextAction: number;
  avgPlannerAcceptanceRate: number;
  avgExclusionRegret: number;
  configRecommendations: ConfigRecommendation[];
}

export class EvaluationService {
  constructor(private readonly prisma?: PrismaClient) {}

  async evaluateDaily(
    userId: string,
    date: string,
  ): Promise<DailyEvaluationResult> {
    const empty: DailyEvaluationResult = {
      date,
      recommendedCount: 0,
      completedRecommended: 0,
      completedNotRecommended: 0,
      excludedCompletedWithin24h: 0,
      plannedMinutes: 0,
      completedMinutes: 0,
      acceptanceRate: 0,
      exclusionRegret: 0,
      budgetFitScore: 0,
      configRecommendations: [],
    };

    if (!this.prisma) return empty;

    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59Z`);
    const next24h = new Date(dayStart.getTime() + 86400000);

    // Load recommendation and exclusion events for this date
    const [recEvents, excEvents, budgetEvents, completedTasks, config] =
      await Promise.all([
        this.prisma.agentMetricEvent.findMany({
          where: {
            userId,
            metricType: "planner.recommend_task",
            periodKey: date,
          },
          select: { entityId: true, value: true, metadata: true },
        }),
        this.prisma.agentMetricEvent.findMany({
          where: {
            userId,
            metricType: "planner.exclude_task",
            periodKey: date,
          },
          select: { entityId: true, value: true },
        }),
        this.prisma.agentMetricEvent.findMany({
          where: {
            userId,
            metricType: "planner.plan.budget_minutes",
            periodKey: date,
          },
          select: { value: true },
        }),
        this.prisma.todo.findMany({
          where: { userId, completedAt: { gte: dayStart, lte: dayEnd } },
          select: { id: true, estimateMinutes: true },
        }),
        this.prisma.agentConfig.findFirst({ where: { userId } }),
      ]);

    const recommendedIds = new Set(
      recEvents.map((e) => e.entityId).filter(Boolean) as string[],
    );
    const excludedIds = new Set(
      excEvents.map((e) => e.entityId).filter(Boolean) as string[],
    );
    const completedIds = new Set(completedTasks.map((t) => t.id));

    const completedRecommended = completedTasks.filter((t) =>
      recommendedIds.has(t.id),
    ).length;
    const completedNotRecommended = completedTasks.filter(
      (t) => !recommendedIds.has(t.id),
    ).length;

    // Excluded tasks completed within 24h of the plan date
    const excludedCompleted = await this.prisma.todo.findMany({
      where: {
        userId,
        id: { in: [...excludedIds] },
        completedAt: { gte: dayStart, lte: next24h },
      },
      select: { id: true },
    });
    const excludedCompletedWithin24h = excludedCompleted.length;

    const plannedMinutes = budgetEvents.reduce((s, e) => s + e.value, 0);
    const completedMinutes = completedTasks
      .filter((t) => recommendedIds.has(t.id))
      .reduce((s, t) => s + (t.estimateMinutes ?? 0), 0);

    const acceptanceRate =
      recommendedIds.size > 0 ? completedRecommended / recommendedIds.size : 0;
    const exclusionRegret =
      excludedIds.size > 0 ? excludedCompletedWithin24h / excludedIds.size : 0;
    const budgetFitScore =
      plannedMinutes > 0 ? Math.abs(plannedMinutes - completedMinutes) : 0;

    const configRecommendations = this.generateDailyConfigRecs(
      {
        acceptanceRate,
        exclusionRegret,
        plannedMinutes,
        completedMinutes,
        recommendedCount: recommendedIds.size,
      },
      config,
    );

    return {
      date,
      recommendedCount: recommendedIds.size,
      completedRecommended,
      completedNotRecommended,
      excludedCompletedWithin24h,
      plannedMinutes,
      completedMinutes,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      exclusionRegret: Math.round(exclusionRegret * 100) / 100,
      budgetFitScore,
      configRecommendations,
    };
  }

  async evaluateWeekly(
    userId: string,
    weekStart: string,
    weekEnd: string,
    weekLabel: string,
  ): Promise<WeeklyEvaluationResult> {
    const empty: WeeklyEvaluationResult = {
      week: weekLabel,
      weekStart,
      weekEnd,
      automationSuccessRate: 0,
      followupUsefulnessRate: 0,
      staleTaskCount: 0,
      staleTaskDelta: 0,
      waitingTaskCount: 0,
      inboxBacklogCount: 0,
      projectsWithoutNextAction: 0,
      avgPlannerAcceptanceRate: 0,
      avgExclusionRegret: 0,
      configRecommendations: [],
    };

    if (!this.prisma) return empty;

    const start = new Date(`${weekStart}T00:00:00Z`);
    const end = new Date(`${weekEnd}T23:59:59Z`);
    const prevWeekStart = new Date(start.getTime() - 7 * 86400000);

    const [
      jobRuns,
      followupCreated,
      followupCompleted7d,
      staleTasks,
      prevStaleTasks,
      waitingTasks,
      inboxItems,
      dailyAcceptanceEvents,
      dailyRegretEvents,
      config,
    ] = await Promise.all([
      this.prisma.agentJobRun.findMany({
        where: { userId, claimedAt: { gte: start, lte: end } },
        select: { status: true },
      }),
      this.prisma.agentMetricEvent.findMany({
        where: {
          userId,
          metricType: "automation.followup.created",
          recordedAt: { gte: start, lte: end },
        },
        select: { entityId: true },
      }),
      this.prisma.agentMetricEvent.findMany({
        where: {
          userId,
          metricType: "automation.followup.completed_7d",
          recordedAt: { gte: start, lte: end },
        },
        select: { entityId: true },
      }),
      this.prisma.todo.count({
        where: {
          userId,
          archived: false,
          updatedAt: {
            lte: new Date(Date.now() - 14 * 86400000),
          },
          status: { notIn: ["done", "cancelled"] },
        },
      }),
      this.prisma.todo.count({
        where: {
          userId,
          archived: false,
          updatedAt: {
            lte: new Date(prevWeekStart.getTime() - 14 * 86400000),
          },
          status: { notIn: ["done", "cancelled"] },
        },
      }),
      this.prisma.todo.count({
        where: { userId, archived: false, status: "waiting" },
      }),
      this.prisma.captureItem
        .count({ where: { userId, lifecycle: "new" } })
        .catch(() => 0),
      this.prisma.agentMetricEvent.findMany({
        where: {
          userId,
          metricType: "planner.acceptance_rate",
          recordedAt: { gte: start, lte: end },
        },
        select: { value: true },
      }),
      this.prisma.agentMetricEvent.findMany({
        where: {
          userId,
          metricType: "planner.exclusion_regret",
          recordedAt: { gte: start, lte: end },
        },
        select: { value: true },
      }),
      this.prisma.agentConfig.findFirst({ where: { userId } }),
    ]);

    const completedJobs = jobRuns.filter(
      (r) => r.status === "completed",
    ).length;
    const automationSuccessRate =
      jobRuns.length > 0 ? completedJobs / jobRuns.length : 0;

    const followupUsefulnessRate =
      followupCreated.length > 0
        ? followupCompleted7d.length / followupCreated.length
        : 0;

    const avgPlannerAcceptanceRate =
      dailyAcceptanceEvents.length > 0
        ? dailyAcceptanceEvents.reduce((s, e) => s + e.value, 0) /
          dailyAcceptanceEvents.length
        : 0;

    const avgExclusionRegret =
      dailyRegretEvents.length > 0
        ? dailyRegretEvents.reduce((s, e) => s + e.value, 0) /
          dailyRegretEvents.length
        : 0;

    const configRecommendations = this.generateWeeklyConfigRecs(
      {
        automationSuccessRate,
        followupUsefulnessRate,
        avgPlannerAcceptanceRate,
        staleTasks,
        waitingTasks,
      },
      config,
    );

    return {
      week: weekLabel,
      weekStart,
      weekEnd,
      automationSuccessRate: Math.round(automationSuccessRate * 100) / 100,
      followupUsefulnessRate: Math.round(followupUsefulnessRate * 100) / 100,
      staleTaskCount: staleTasks,
      staleTaskDelta: staleTasks - prevStaleTasks,
      waitingTaskCount: waitingTasks,
      inboxBacklogCount: inboxItems,
      projectsWithoutNextAction: 0, // filled by caller if projectService available
      avgPlannerAcceptanceRate:
        Math.round(avgPlannerAcceptanceRate * 100) / 100,
      avgExclusionRegret: Math.round(avgExclusionRegret * 100) / 100,
      configRecommendations,
    };
  }

  private generateDailyConfigRecs(
    metrics: {
      acceptanceRate: number;
      exclusionRegret: number;
      plannedMinutes: number;
      completedMinutes: number;
      recommendedCount: number;
    },
    config: {
      maxWriteActionsPerRun: number;
      waitingFollowUpDays: number;
    } | null,
  ): ConfigRecommendation[] {
    const recs: ConfigRecommendation[] = [];
    if (metrics.recommendedCount === 0) return recs;

    // Suggest reducing planned budget if consistently overplanned
    if (
      metrics.plannedMinutes > 0 &&
      metrics.completedMinutes < metrics.plannedMinutes * 0.6
    ) {
      const suggestedMinutes = Math.round(metrics.plannedMinutes * 0.8);
      recs.push({
        target: "availableMinutes",
        currentValue: metrics.plannedMinutes,
        suggestedValue: suggestedMinutes,
        confidence: 0.65,
        why: "Completed minutes were below 60% of planned. Consider a tighter daily budget.",
        evidence: {
          plannedMinutes: metrics.plannedMinutes,
          completedMinutes: metrics.completedMinutes,
          utilizationRate: Math.round(
            (metrics.completedMinutes / metrics.plannedMinutes) * 100,
          ),
        },
      });
    }

    // High exclusion regret → planner is being too selective
    if (metrics.exclusionRegret > 0.3 && metrics.recommendedCount >= 3) {
      recs.push({
        target: "plannerBudgetBuffer",
        currentValue: 0,
        suggestedValue: 15,
        confidence: 0.7,
        why: `${Math.round(metrics.exclusionRegret * 100)}% of excluded tasks were completed anyway. The planner may be cutting too aggressively.`,
        evidence: {
          exclusionRegret: metrics.exclusionRegret,
          recommendedCount: metrics.recommendedCount,
        },
      });
    }

    return recs;
  }

  private generateWeeklyConfigRecs(
    metrics: {
      automationSuccessRate: number;
      followupUsefulnessRate: number;
      avgPlannerAcceptanceRate: number;
      staleTasks: number;
      waitingTasks: number;
    },
    config: {
      maxWriteActionsPerRun: number;
      waitingFollowUpDays: number;
      inboxConfidenceThreshold: number;
    } | null,
  ): ConfigRecommendation[] {
    const recs: ConfigRecommendation[] = [];

    // Low automation success → reduce write actions
    if (
      metrics.automationSuccessRate < 0.6 &&
      config &&
      config.maxWriteActionsPerRun > 3
    ) {
      recs.push({
        target: "maxWriteActionsPerRun",
        currentValue: config.maxWriteActionsPerRun,
        suggestedValue: Math.max(3, config.maxWriteActionsPerRun - 2),
        confidence: 0.72,
        why: `Automation success rate was ${Math.round(metrics.automationSuccessRate * 100)}%. Fewer write actions per run may improve reliability.`,
        evidence: { automationSuccessRate: metrics.automationSuccessRate },
      });
    }

    // Good followup usefulness → can tighten followup cadence
    if (
      metrics.followupUsefulnessRate > 0.5 &&
      config &&
      config.waitingFollowUpDays > 5
    ) {
      recs.push({
        target: "waitingFollowUpDays",
        currentValue: config.waitingFollowUpDays,
        suggestedValue: config.waitingFollowUpDays - 1,
        confidence: 0.68,
        why: `Follow-up tasks had ${Math.round(metrics.followupUsefulnessRate * 100)}% completion rate. Earlier follow-ups may help more.`,
        evidence: { followupUsefulnessRate: metrics.followupUsefulnessRate },
      });
    }

    // Low planner acceptance → plan quality needs work
    if (
      metrics.avgPlannerAcceptanceRate < 0.35 &&
      metrics.avgPlannerAcceptanceRate > 0
    ) {
      recs.push({
        target: "plannerWeightPriority",
        currentValue: 1.0,
        suggestedValue: 1.3,
        confidence: 0.6,
        why: `Average planner acceptance rate was ${Math.round(metrics.avgPlannerAcceptanceRate * 100)}%. Boosting priority weight may surface higher-relevance tasks.`,
        evidence: {
          avgPlannerAcceptanceRate: metrics.avgPlannerAcceptanceRate,
        },
      });
    }

    return recs;
  }
}
