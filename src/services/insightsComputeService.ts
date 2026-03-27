import {
  InsightType,
  InsightPeriodType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { createLogger } from "../infra/logging/logger";

const log = createLogger("insightsComputeService");

const STALE_THRESHOLD_DAYS = 7;

export interface ProjectHealthResult {
  projectId: string;
  projectName: string;
  score: number;
  status: "healthy" | "warning" | "critical";
  breakdown: {
    completionRate: number;
    overdueRatio: number;
    recencyDays: number;
    velocity: number;
  };
}

export class InsightsComputeService {
  constructor(private readonly prisma?: PrismaClient) {}

  /**
   * Tasks completed per day in the given period.
   */
  async computeCompletionVelocity(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    if (!this.prisma) return 0;

    const completed = await this.prisma.todo.count({
      where: {
        userId,
        completed: true,
        updatedAt: { gte: start, lte: end },
      },
    });

    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return Math.round((completed / days) * 100) / 100;
  }

  /**
   * Ratio of tasks created vs tasks completed in the period.
   * A value > 1.5 indicates overcommitment.
   */
  async computeOvercommitmentRatio(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    if (!this.prisma) return 0;

    const [created, completed] = await Promise.all([
      this.prisma.todo.count({
        where: {
          userId,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.todo.count({
        where: {
          userId,
          completed: true,
          updatedAt: { gte: start, lte: end },
        },
      }),
    ]);

    if (completed === 0) return created > 0 ? created : 0;
    return Math.round((created / completed) * 100) / 100;
  }

  /**
   * Count of open tasks not updated in STALE_THRESHOLD_DAYS.
   */
  async computeStaleTasks(userId: string): Promise<number> {
    if (!this.prisma) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_THRESHOLD_DAYS);

    return this.prisma.todo.count({
      where: {
        userId,
        completed: false,
        archived: false,
        updatedAt: { lt: cutoff },
      },
    });
  }

  /**
   * Count consecutive days (ending today or yesterday) with at least 1 task completion.
   */
  async computeStreak(userId: string): Promise<number> {
    if (!this.prisma) return 0;

    // Get completion dates for the last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const completions = await this.prisma.activityEvent.findMany({
      where: {
        userId,
        eventType: "task_completed",
        createdAt: { gte: since },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    if (completions.length === 0) return 0;

    // Group by date string (YYYY-MM-DD)
    const dates = new Set(
      completions.map((c) => c.createdAt.toISOString().split("T")[0]),
    );

    // Walk backwards from today
    let streak = 0;
    const day = new Date();
    day.setHours(0, 0, 0, 0);

    // Allow streak to start from today or yesterday
    const todayStr = day.toISOString().split("T")[0];
    const yesterday = new Date(day);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (!dates.has(todayStr) && !dates.has(yesterdayStr)) return 0;

    const startDate = dates.has(todayStr) ? day : yesterday;

    for (let i = 0; i < 90; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];

      if (dates.has(dateStr)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Distribution of task completions by hour of day.
   * Returns the hour (0-23) with the most completions.
   */
  async computeProductiveHours(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<{ peakHour: number; distribution: Record<number, number> }> {
    if (!this.prisma) return { peakHour: 0, distribution: {} };

    const events = await this.prisma.activityEvent.findMany({
      where: {
        userId,
        eventType: "task_completed",
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true },
    });

    const distribution: Record<number, number> = {};
    for (const e of events) {
      const hour = e.createdAt.getHours();
      distribution[hour] = (distribution[hour] || 0) + 1;
    }

    let peakHour = 0;
    let maxCount = 0;
    for (const [hour, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = Number(hour);
      }
    }

    return { peakHour, distribution };
  }

  /**
   * Composite health score for a project (0-100).
   * Weights: completion rate (0.3), overdue ratio (0.3), recency (0.2), velocity (0.2).
   */
  async computeProjectHealth(
    userId: string,
    projectId: string,
  ): Promise<ProjectHealthResult | null> {
    if (!this.prisma) return null;

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, name: true },
    });
    if (!project) return null;

    const [totalTasks, completedTasks, overdueTasks, recentActivity] =
      await Promise.all([
        this.prisma.todo.count({
          where: { userId, projectId, archived: false },
        }),
        this.prisma.todo.count({
          where: { userId, projectId, completed: true },
        }),
        this.prisma.todo.count({
          where: {
            userId,
            projectId,
            completed: false,
            archived: false,
            dueDate: { lt: new Date() },
          },
        }),
        this.prisma.todo.findFirst({
          where: { userId, projectId },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const velocity = await this.prisma.todo.count({
      where: {
        userId,
        projectId,
        completed: true,
        updatedAt: { gte: sevenDaysAgo },
      },
    });

    // Score components (each 0-100)
    const completionRate =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 50;

    const openTasks = totalTasks - completedTasks;
    const overdueRatio =
      openTasks > 0 ? Math.max(0, 100 - (overdueTasks / openTasks) * 100) : 100;

    const daysSinceActivity = recentActivity
      ? Math.floor(
          (Date.now() - recentActivity.updatedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 30;
    const recencyScore = Math.max(0, 100 - daysSinceActivity * 3.3);

    const velocityScore = Math.min(100, velocity * 20);

    // Weighted composite
    const score = Math.round(
      completionRate * 0.3 +
        overdueRatio * 0.3 +
        recencyScore * 0.2 +
        velocityScore * 0.2,
    );

    const status: "healthy" | "warning" | "critical" =
      score >= 70 ? "healthy" : score >= 40 ? "warning" : "critical";

    return {
      projectId: project.id,
      projectName: project.name,
      score,
      status,
      breakdown: {
        completionRate: Math.round(completionRate),
        overdueRatio: Math.round(overdueRatio),
        recencyDays: daysSinceActivity,
        velocity,
      },
    };
  }

  /**
   * Compute all insights for a user and upsert into UserInsight table.
   */
  async computeAll(userId: string): Promise<void> {
    if (!this.prisma) return;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    try {
      const [velocity, ratio, stale, streak, productive] = await Promise.all([
        this.computeCompletionVelocity(userId, weekAgo, now),
        this.computeOvercommitmentRatio(userId, weekAgo, now),
        this.computeStaleTasks(userId),
        this.computeStreak(userId),
        this.computeProductiveHours(userId, weekAgo, now),
      ]);

      const upserts: Array<{
        insightType: InsightType;
        value: number;
        metadata?: Prisma.InputJsonValue;
      }> = [
        { insightType: "completion_velocity", value: velocity },
        { insightType: "overcommitment_ratio", value: ratio },
        { insightType: "stale_task_count", value: stale },
        { insightType: "streak_days", value: streak },
        {
          insightType: "most_productive_hour",
          value: productive.peakHour,
          metadata: productive.distribution as unknown as Prisma.InputJsonValue,
        },
      ];

      for (const u of upserts) {
        await this.prisma.userInsight.upsert({
          where: {
            userId_insightType_periodType_periodStart: {
              userId,
              insightType: u.insightType,
              periodType: "daily" as InsightPeriodType,
              periodStart: dayStart,
            },
          },
          create: {
            userId,
            insightType: u.insightType,
            periodType: "daily",
            periodStart: dayStart,
            value: u.value,
            metadata: u.metadata,
          },
          update: {
            value: u.value,
            metadata: u.metadata,
            computedAt: now,
          },
        });
      }

      // Compute project health for all active projects
      const projects = await this.prisma.project.findMany({
        where: { userId, archived: false },
        select: { id: true },
      });

      for (const p of projects) {
        const health = await this.computeProjectHealth(userId, p.id);
        if (health) {
          await this.prisma.userInsight.upsert({
            where: {
              userId_insightType_periodType_periodStart: {
                userId,
                insightType: "project_health",
                periodType: "daily",
                periodStart: dayStart,
              },
            },
            create: {
              userId,
              insightType: "project_health",
              periodType: "daily",
              periodStart: dayStart,
              value: health.score,
              metadata: {
                projectId: health.projectId,
                projectName: health.projectName,
                status: health.status,
                breakdown: health.breakdown,
              } as unknown as Prisma.InputJsonValue,
            },
            update: {
              value: health.score,
              metadata: {
                projectId: health.projectId,
                projectName: health.projectName,
                status: health.status,
                breakdown: health.breakdown,
              } as unknown as Prisma.InputJsonValue,
              computedAt: now,
            },
          });
        }
      }

      log.info("Computed all insights", { userId });
    } catch (err) {
      log.error("Failed to compute insights", {
        userId,
        error: (err as Error).message,
      });
    }
  }
}
