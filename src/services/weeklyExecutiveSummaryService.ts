import { PrismaClient } from "@prisma/client";

export interface WeeklyExecutiveSummary {
  week: string;
  weekStart: string;
  weekEnd: string;
  completedCount: number;
  newTasksCreated: number;
  reactiveRatio: number;
  blockedProjects: Array<{ id: string; name: string; staleDays: number }>;
  attentionDiffusion: {
    projectCount: number;
    avgTasksPerProject: number;
    insight: string;
  };
  waitingResolved: number;
  waitingStillOpen: number;
  agentActionsApplied: number;
  agentActionsSuggested: number;
  automationAcceptanceRate: number;
  topInsights: string[];
}

function isoWeekBounds(weekOffset: number): {
  week: string;
  start: Date;
  end: Date;
} {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + mondayOffset + weekOffset * 7);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  // ISO 8601: the week belongs to the year that contains its Thursday.
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  // Week 1 is the week containing Jan 4th of the ISO year; find that week's Monday.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay(); // 0 = Sun
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day === 0 ? 6 : jan4Day - 1));
  const wn = Math.floor((monday.getTime() - week1Monday.getTime()) / (7 * 86400000)) + 1;
  const week = `${isoYear}-W${String(wn).padStart(2, "0")}`;

  return { week, start: monday, end: sunday };
}

export class WeeklyExecutiveSummaryService {
  constructor(private readonly prisma?: PrismaClient) {}

  async getSummary(
    userId: string,
    weekOffset: number,
  ): Promise<WeeklyExecutiveSummary> {
    const { week, start, end } = isoWeekBounds(weekOffset);
    const weekStart = start.toISOString().slice(0, 10);
    const weekEnd = end.toISOString().slice(0, 10);

    if (!this.prisma) {
      return this.emptyResult(week, weekStart, weekEnd);
    }

    // Run all queries in parallel
    const [
      completedTasks,
      createdTasks,
      allTasks,
      allProjects,
      metricEvents,
      jobRuns,
    ] = await Promise.all([
      // Tasks completed this week
      this.prisma.todo.findMany({
        where: {
          userId,
          completedAt: { gte: start, lte: end },
        },
        select: { id: true, projectId: true, source: true },
      }),
      // Tasks created this week
      this.prisma.todo.findMany({
        where: {
          userId,
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          projectId: true,
          source: true,
        },
      }),
      // All active tasks (for waiting status check)
      this.prisma.todo.findMany({
        where: { userId, archived: false },
        select: {
          id: true,
          status: true,
          projectId: true,
          updatedAt: true,
          completedAt: true,
        },
      }),
      // All active projects
      this.prisma.project.findMany({
        where: { userId, archived: false },
        select: { id: true, name: true, updatedAt: true },
      }),
      // Agent metric events this week
      this.prisma.agentMetricEvent.findMany({
        where: { userId, recordedAt: { gte: start, lte: end } },
        select: { metricType: true, value: true },
      }),
      // Job runs this week
      this.prisma.agentJobRun.findMany({
        where: { userId, claimedAt: { gte: start, lte: end } },
        select: { status: true, metadata: true },
      }),
    ]);

    // Reactive ratio: tasks that originated from inbox/automation (not manually created)
    const reactiveTasks = createdTasks.filter(
      (t) => t.source !== null && t.source !== "manual",
    );
    const reactiveRatio =
      createdTasks.length > 0 ? reactiveTasks.length / createdTasks.length : 0;

    // Blocked projects: projects with no completed task this week
    const completedProjectIds = new Set<string>(
      completedTasks
        .filter((t) => t.projectId !== null)
        .map((t) => t.projectId as string),
    );
    const now = new Date();
    const blockedProjects = allProjects
      .filter((p) => !completedProjectIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        staleDays: Math.floor(
          (now.getTime() - p.updatedAt.getTime()) / 86400000,
        ),
      }))
      .filter((p) => p.staleDays >= 7)
      .sort((a, b) => b.staleDays - a.staleDays)
      .slice(0, 5);

    // Attention diffusion: distinct projects touched this week
    const touchedProjectIds = new Set<string>(
      completedTasks
        .concat(createdTasks)
        .filter((t) => t.projectId !== null)
        .map((t) => t.projectId as string),
    );
    const projectCount = touchedProjectIds.size;
    const totalProjectTasks = completedTasks.length + createdTasks.length;
    const avgTasksPerProject =
      projectCount > 0 ? totalProjectTasks / projectCount : 0;
    const attentionInsight =
      projectCount >= 5 && avgTasksPerProject < 2
        ? `Attention spread thin across ${projectCount} projects with <2 tasks each`
        : projectCount === 0
          ? "No project work this week"
          : `Work concentrated in ${projectCount} project(s), ~${avgTasksPerProject.toFixed(1)} tasks each`;

    // Waiting tasks
    const waitingTasks = allTasks.filter((t) => t.status === "waiting");
    const waitingResolvedThisWeek = allTasks.filter(
      (t) =>
        t.status !== "waiting" &&
        t.completedAt &&
        t.completedAt >= start &&
        t.completedAt <= end,
    ).length;

    // Agent stats from metrics
    const applied = metricEvents
      .filter((e) => e.metricType.includes("applied"))
      .reduce((s, e) => s + e.value, 0);
    const suggested = metricEvents
      .filter((e) => e.metricType.includes("suggested"))
      .reduce((s, e) => s + e.value, 0);
    const totalAutomation = applied + suggested;
    const acceptanceRate = totalAutomation > 0 ? applied / totalAutomation : 0;

    // Derive insights
    const insights: string[] = [];
    if (completedTasks.length === 0) {
      insights.push("No tasks were completed this week.");
    } else {
      insights.push(
        `${completedTasks.length} tasks completed, ${createdTasks.length} new tasks added.`,
      );
    }
    if (reactiveRatio > 0.5) {
      insights.push(
        `${Math.round(reactiveRatio * 100)}% of new work was reactive (inbox-sourced).`,
      );
    }
    if (blockedProjects.length >= 3) {
      insights.push(
        `${blockedProjects.length} projects had no completed tasks this week.`,
      );
    }
    if (waitingTasks.length > 5) {
      insights.push(
        `${waitingTasks.length} tasks are currently waiting on others — consider follow-ups.`,
      );
    }
    if (jobRuns.length > 0) {
      const successRuns = jobRuns.filter(
        (r) => r.status === "completed",
      ).length;
      insights.push(
        `Agent ran ${jobRuns.length} job(s) this week, ${successRuns} completed successfully.`,
      );
    }

    return {
      week,
      weekStart,
      weekEnd,
      completedCount: completedTasks.length,
      newTasksCreated: createdTasks.length,
      reactiveRatio: Math.round(reactiveRatio * 100) / 100,
      blockedProjects,
      attentionDiffusion: {
        projectCount,
        avgTasksPerProject: Math.round(avgTasksPerProject * 10) / 10,
        insight: attentionInsight,
      },
      waitingResolved: waitingResolvedThisWeek,
      waitingStillOpen: waitingTasks.length,
      agentActionsApplied: Math.round(applied),
      agentActionsSuggested: Math.round(suggested),
      automationAcceptanceRate: Math.round(acceptanceRate * 100) / 100,
      topInsights: insights.slice(0, 4),
    };
  }

  private emptyResult(
    week: string,
    weekStart: string,
    weekEnd: string,
  ): WeeklyExecutiveSummary {
    return {
      week,
      weekStart,
      weekEnd,
      completedCount: 0,
      newTasksCreated: 0,
      reactiveRatio: 0,
      blockedProjects: [],
      attentionDiffusion: {
        projectCount: 0,
        avgTasksPerProject: 0,
        insight: "",
      },
      waitingResolved: 0,
      waitingStillOpen: 0,
      agentActionsApplied: 0,
      agentActionsSuggested: 0,
      automationAcceptanceRate: 0,
      topInsights: [],
    };
  }
}
