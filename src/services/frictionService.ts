import { PrismaClient } from "@prisma/client";

export type FrictionPatternType =
  | "repeated_deferral"
  | "ignored_recommendation"
  | "follow_up_churn"
  | "project_stall";

export interface FrictionPattern {
  type: FrictionPatternType;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  count: number;
  staleDays?: number;
  firstSeenAt?: string;
  insight: string;
}

export interface ListFrictionPatternsResult {
  patterns: FrictionPattern[];
  totalPatterns: number;
}

export class FrictionService {
  constructor(private readonly prisma?: PrismaClient) {}

  async listPatterns(
    userId: string,
    opts: { since?: string; limit?: number },
  ): Promise<ListFrictionPatternsResult> {
    if (!this.prisma) return { patterns: [], totalPatterns: 0 };

    const limit = opts.limit ?? 20;
    const sinceDate = opts.since
      ? new Date(`${opts.since}T00:00:00Z`)
      : new Date(Date.now() - 30 * 86400000);

    const [deferralPatterns, ignoredPatterns, churnPatterns, stallPatterns] =
      await Promise.all([
        this.repeatedDeferralPatterns(userId, sinceDate),
        this.ignoredRecommendationPatterns(userId, sinceDate),
        this.followUpChurnPatterns(userId, sinceDate),
        this.projectStallPatterns(userId, sinceDate),
      ]);

    const all = [
      ...deferralPatterns,
      ...ignoredPatterns,
      ...churnPatterns,
      ...stallPatterns,
    ]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return { patterns: all, totalPatterns: all.length };
  }

  // Tasks recommended by the planner on ≥3 distinct days but never completed.
  private async repeatedDeferralPatterns(
    userId: string,
    since: Date,
  ): Promise<FrictionPattern[]> {
    const rows = await this.prisma!.agentMetricEvent.groupBy({
      by: ["entityId"],
      where: {
        userId,
        metricType: "planner.recommend_task",
        recordedAt: { gte: since },
        entityId: { not: null },
      },
      _count: { entityId: true },
      _min: { recordedAt: true },
      having: { entityId: { _count: { gte: 3 } } },
    });

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.entityId as string);
    const tasks = await this.prisma!.todo.findMany({
      where: {
        userId,
        id: { in: ids },
        status: { notIn: ["done", "cancelled"] },
        archived: false,
      },
      select: { id: true, title: true, doDate: true },
    });
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    return rows
      .filter((r) => taskMap.has(r.entityId as string))
      .map((r) => {
        const task = taskMap.get(r.entityId as string)!;
        const count = r._count.entityId;
        const firstSeenAt = r._min.recordedAt
          ? r._min.recordedAt.toISOString().slice(0, 10)
          : undefined;
        return {
          type: "repeated_deferral" as const,
          taskId: task.id,
          taskTitle: task.title,
          count,
          firstSeenAt,
          insight: `Planned ${count} times since ${firstSeenAt ?? "recently"} without being completed. Consider delegating, breaking it down, or dropping it.`,
        };
      });
  }

  // Tasks with ≥3 "ignored" signals in TaskRecommendationFeedback.
  private async ignoredRecommendationPatterns(
    userId: string,
    since: Date,
  ): Promise<FrictionPattern[]> {
    const rows = await this.prisma!.taskRecommendationFeedback.groupBy({
      by: ["taskId"],
      where: {
        userId,
        signal: "ignored",
        recordedAt: { gte: since },
      },
      _count: { taskId: true },
      _min: { recordedAt: true },
      having: { taskId: { _count: { gte: 3 } } },
    });

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.taskId);
    const tasks = await this.prisma!.todo.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, title: true },
    });
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    return rows
      .filter((r) => taskMap.has(r.taskId))
      .map((r) => {
        const task = taskMap.get(r.taskId)!;
        const count = r._count.taskId;
        return {
          type: "ignored_recommendation" as const,
          taskId: task.id,
          taskTitle: task.title,
          count,
          insight: `Recommended ${count} times and skipped each time. Consider rescheduling, delegating, or archiving.`,
        };
      });
  }

  // Waiting tasks with ≥2 follow-up events that are still not done.
  private async followUpChurnPatterns(
    userId: string,
    since: Date,
  ): Promise<FrictionPattern[]> {
    const rows = await this.prisma!.agentMetricEvent.groupBy({
      by: ["entityId"],
      where: {
        userId,
        metricType: "automation.followup.created",
        recordedAt: { gte: since },
        entityId: { not: null },
      },
      _count: { entityId: true },
      having: { entityId: { _count: { gte: 2 } } },
    });

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.entityId as string);
    const tasks = await this.prisma!.todo.findMany({
      where: {
        userId,
        id: { in: ids },
        status: { notIn: ["done", "cancelled"] },
        archived: false,
      },
      select: { id: true, title: true },
    });
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    return rows
      .filter((r) => taskMap.has(r.entityId as string))
      .map((r) => {
        const task = taskMap.get(r.entityId as string)!;
        const count = r._count.entityId;
        return {
          type: "follow_up_churn" as const,
          taskId: task.id,
          taskTitle: task.title,
          count,
          insight: `${count} follow-ups generated but the task is still waiting. Consider escalating or closing it out.`,
        };
      });
  }

  // Projects with no task completed in the since window and all tasks untouched for 14+ days.
  private async projectStallPatterns(
    userId: string,
    since: Date,
  ): Promise<FrictionPattern[]> {
    const staleThreshold = new Date(Date.now() - 14 * 86400000);

    const stalledProjects = await this.prisma!.project.findMany({
      where: {
        userId,
        archived: false,
        status: { notIn: ["completed", "archived"] },
      },
      select: {
        id: true,
        name: true,
        todos: {
          where: { archived: false, status: { notIn: ["done", "cancelled"] } },
          select: { id: true, updatedAt: true, completedAt: true },
        },
      },
    });

    const patterns: FrictionPattern[] = [];
    for (const project of stalledProjects) {
      const todos = project.todos;
      if (todos.length === 0) continue;
      const allStale = todos.every((t) => t.updatedAt < staleThreshold);
      const anyCompletedRecently = todos.some(
        (t) => t.completedAt && t.completedAt >= since,
      );
      if (!allStale || anyCompletedRecently) continue;

      const oldestUpdated = todos.reduce((min, t) =>
        t.updatedAt < min.updatedAt ? t : min,
      );
      const staleDays = Math.floor(
        (Date.now() - oldestUpdated.updatedAt.getTime()) / 86400000,
      );
      patterns.push({
        type: "project_stall" as const,
        projectId: project.id,
        projectName: project.name,
        count: todos.length,
        staleDays,
        insight: `${todos.length} open task(s) untouched for ${staleDays}+ days with no recent completions. Consider a weekly review to unstick this project.`,
      });
    }

    return patterns;
  }
}
