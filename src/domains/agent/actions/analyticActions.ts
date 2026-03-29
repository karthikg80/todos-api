/**
 * Analytic and read-only action handlers extracted from AgentExecutor (PR 6a).
 *
 * 14 actions registered via ActionRegistry.register() — all return
 * { status, data } and are wrapped by executor.success().
 *
 * Actions: decide_next_work, analyze_project_health, analyze_work_graph,
 *   analyze_task_quality, find_duplicate_tasks, find_stale_items,
 *   taxonomy_cleanup_suggestions, break_down_task, suggest_next_actions,
 *   weekly_review_summary, list_audit_log, evaluate_daily_plan,
 *   evaluate_weekly_system, get_availability_windows
 */

import { Prisma } from "@prisma/client";
import { AgentExecutionError } from "./agentExecutionError";
import type { ActionRegistry } from "./actionRegistry";
import { analyzeTaskQuality } from "../../../ai/taskQualityAnalyzer";
import { findDuplicates } from "../../../ai/duplicateDetector";
import {
  validateAgentDecideNextWorkInput,
  validateAgentAnalyzeProjectHealthInput,
  validateAgentAnalyzeWorkGraphInput,
  validateAgentAnalyzeTaskQualityInput,
  validateAgentFindDuplicateTasksInput,
  validateAgentFindStaleItemsInput,
  validateAgentTaxonomyCleanupInput,
  validateAgentBreakDownTaskInput,
  validateAgentSuggestNextActionsInput,
  validateAgentWeeklyReviewSummaryInput,
  validateAgentListAuditLogExtendedInput,
  validateAgentEvaluateDailyInput,
  validateAgentEvaluateWeeklyInput,
  validateAgentGetAvailabilityWindowsInput,
} from "../../../validation/agentValidation";

export function registerAnalyticActions(registry: ActionRegistry): void {
  // ── decide_next_work ────────────────────────────────────────────────────────

  registry.register("decide_next_work", async (params, context, runtime) => {
    const plannerInput = validateAgentDecideNextWorkInput(params);

    // Load user weights, goals, and soul profile for personalized scoring
    const [dnwConfig, dnwGoals, dnwPrefs] = await Promise.all([
      runtime.agentConfigService.getConfig(context.userId),
      runtime.persistencePrisma
        ? runtime.persistencePrisma.goal
            .findMany({
              where: { userId: context.userId, archived: false },
              select: { id: true, targetDate: true },
            })
            .catch(() => [] as { id: string; targetDate: Date | null }[])
        : Promise.resolve([] as { id: string; targetDate: Date | null }[]),
      runtime.persistencePrisma
        ? runtime.persistencePrisma.userPlanningPreferences
            .findUnique({ where: { userId: context.userId } })
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    const dnwGoalIndex = new Map(
      dnwGoals.map((g) => [g.id, { targetDate: g.targetDate }]),
    );

    // Build soul modifiers for scoreTaskForDecision
    const dnwSoul = (dnwPrefs?.soulProfile as Record<string, unknown>) ?? null;
    let dnwSoulMods: { statusBoosts?: Record<string, number> } | undefined;
    if (dnwSoul) {
      const boosts: Record<string, number> = {};
      const style = dnwSoul.planningStyle as string | undefined;
      if (style === "structure") {
        boosts.in_progress = 10;
        boosts.scheduled = 10;
      } else if (style === "flexibility") {
        boosts.next = 10;
      }
      if (Object.keys(boosts).length) dnwSoulMods = { statusBoosts: boosts };
    }

    const decision = await runtime.agentService.decideNextWorkForUser(
      context.userId,
      {
        ...plannerInput,
        weights: {
          priority: dnwConfig.plannerWeightPriority,
          dueDate: dnwConfig.plannerWeightDueDate,
          energyMatch: dnwConfig.plannerWeightEnergyMatch,
        },
        goalIndex: dnwGoalIndex,
        soulModifiers: dnwSoulMods,
      },
    );
    return { status: 200, data: { decision } };
  });

  // ── analyze_project_health ──────────────────────────────────────────────────

  registry.register(
    "analyze_project_health",
    async (params, context, runtime) => {
      const plannerInput = validateAgentAnalyzeProjectHealthInput(params);
      const health = await runtime.agentService.analyzeProjectHealthForUser(
        context.userId,
        plannerInput,
      );
      if (!health) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
          "Project not found",
          false,
          "Verify the project ID belongs to the authenticated user.",
        );
      }
      return { status: 200, data: { health } };
    },
  );

  // ── analyze_work_graph ──────────────────────────────────────────────────────

  registry.register("analyze_work_graph", async (params, context, runtime) => {
    const plannerInput = validateAgentAnalyzeWorkGraphInput(params);
    const graph = await runtime.agentService.analyzeWorkGraphForUser(
      context.userId,
      plannerInput,
    );
    if (!graph) {
      throw new AgentExecutionError(
        404,
        "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
        "Project not found",
        false,
        "Verify the project ID belongs to the authenticated user.",
      );
    }
    return { status: 200, data: { graph } };
  });

  // ── analyze_task_quality ────────────────────────────────────────────────────

  registry.register(
    "analyze_task_quality",
    async (params, context, runtime) => {
      const { taskIds, projectId } =
        validateAgentAnalyzeTaskQualityInput(params);
      const tasks = await runtime.agentService.listTasks(context.userId, {
        ...(projectId ? { projectId } : {}),
        archived: false,
        limit: 200,
      });
      const filtered = taskIds
        ? tasks.filter((t) => taskIds.includes(t.id))
        : tasks;
      const results = filtered.map((t) => analyzeTaskQuality(t.id, t.title));
      return {
        status: 200,
        data: { results, totalAnalyzed: filtered.length },
      };
    },
  );

  // ── find_duplicate_tasks ────────────────────────────────────────────────────

  registry.register(
    "find_duplicate_tasks",
    async (params, context, runtime) => {
      const { projectId } = validateAgentFindDuplicateTasksInput(params);
      const tasks = await runtime.agentService.listTasks(context.userId, {
        ...(projectId ? { projectId } : {}),
        archived: false,
        limit: 500,
      });
      const groups = findDuplicates(
        tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status ?? "inbox",
          projectId: t.projectId ?? null,
        })),
      );
      return { status: 200, data: { groups, totalTasks: tasks.length } };
    },
  );

  // ── find_stale_items ────────────────────────────────────────────────────────

  registry.register("find_stale_items", async (params, context, runtime) => {
    const { staleDays } = validateAgentFindStaleItemsInput(params);
    const threshold = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const staleTasks = await runtime.agentService.listTasks(context.userId, {
      statuses: ["inbox", "next", "someday"],
      updatedBefore: threshold,
      archived: false,
      limit: 200,
    });
    const staleTaskDtos = staleTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      lastUpdated: t.updatedAt,
      projectId: t.projectId ?? null,
    }));
    let staleProjects: Array<{
      id: string;
      name: string;
      lastUpdated: Date;
    }> = [];
    if (runtime.projectService) {
      const allProjects = await runtime.projectService.findAll(context.userId);
      staleProjects = allProjects
        .filter(
          (p) =>
            !p.archived &&
            p.status === "active" &&
            new Date(p.updatedAt) < threshold,
        )
        .map((p) => ({
          id: p.id,
          name: p.name,
          lastUpdated: p.updatedAt,
        }));
    }
    return {
      status: 200,
      data: {
        staleTasks: staleTaskDtos,
        staleProjects,
        staleDays,
        threshold: threshold.toISOString(),
      },
    };
  });

  // ── taxonomy_cleanup_suggestions ────────────────────────────────────────────

  registry.register(
    "taxonomy_cleanup_suggestions",
    async (params, context, runtime) => {
      validateAgentTaxonomyCleanupInput(params);
      if (!runtime.projectService) {
        return {
          status: 200,
          data: { similarProjects: [], smallProjects: [] },
        };
      }
      const allProjects = await runtime.projectService.findAll(context.userId);
      const activeProjects = allProjects.filter((p) => !p.archived);

      // Find projects with 0–1 open tasks
      const smallProjects = activeProjects
        .filter((p) => (p.openTaskCount ?? p.openTodoCount ?? 0) <= 1)
        .map((p) => ({
          id: p.id,
          name: p.name,
          taskCount: p.openTaskCount ?? p.openTodoCount ?? 0,
        }));

      // Find pairs with similar names via Levenshtein
      const similarProjects: Array<{
        projectAId: string;
        projectAName: string;
        projectBId: string;
        projectBName: string;
        editDistance: number;
      }> = [];
      for (let i = 0; i < activeProjects.length; i++) {
        for (let j = i + 1; j < activeProjects.length; j++) {
          const a = activeProjects[i].name.toLowerCase();
          const b = activeProjects[j].name.toLowerCase();
          if (Math.abs(a.length - b.length) > 5) continue;
          const m = a.length,
            n = b.length;
          const dp = Array.from({ length: m + 1 }, (_, r) =>
            Array.from({ length: n + 1 }, (_, c) =>
              r === 0 ? c : c === 0 ? r : 0,
            ),
          );
          for (let r = 1; r <= m; r++) {
            for (let c = 1; c <= n; c++) {
              dp[r][c] =
                a[r - 1] === b[c - 1]
                  ? dp[r - 1][c - 1]
                  : 1 + Math.min(dp[r - 1][c], dp[r][c - 1], dp[r - 1][c - 1]);
            }
          }
          const dist = dp[m][n];
          if (dist <= 3 && Math.max(m, n) >= 4) {
            similarProjects.push({
              projectAId: activeProjects[i].id,
              projectAName: activeProjects[i].name,
              projectBId: activeProjects[j].id,
              projectBName: activeProjects[j].name,
              editDistance: dist,
            });
          }
        }
      }
      return {
        status: 200,
        data: {
          similarProjects,
          smallProjects,
          totalProjects: activeProjects.length,
        },
      };
    },
  );

  // ── break_down_task ─────────────────────────────────────────────────────────

  registry.register("break_down_task", async (params, context, runtime) => {
    const { taskId, maxSubtasks } = validateAgentBreakDownTaskInput(params);
    const task = await runtime.agentService.getTask(context.userId, taskId);
    if (!task) {
      throw new AgentExecutionError(
        404,
        "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
        "Task not found",
        false,
        "Verify the task ID belongs to the authenticated user.",
      );
    }
    const title = task.title;
    const lower = title.toLowerCase();
    const limit = maxSubtasks ?? 5;
    let suggestedSubtasks: Array<{ title: string; order: number }> = [];
    let decompositionBasis = "generic";
    if (/\bwrite\b/.test(lower)) {
      suggestedSubtasks = [
        { title: `Draft outline for: ${title}`, order: 1 },
        { title: `Write first draft: ${title}`, order: 2 },
        { title: `Review and edit: ${title}`, order: 3 },
      ];
      decompositionBasis = "write-workflow";
    } else if (/\breview\b/.test(lower)) {
      suggestedSubtasks = [
        { title: `Read through: ${title}`, order: 1 },
        { title: `Note issues in: ${title}`, order: 2 },
        { title: `Write review summary: ${title}`, order: 3 },
      ];
      decompositionBasis = "review-workflow";
    } else if (/\bsetup|configure|install\b/.test(lower)) {
      suggestedSubtasks = [
        { title: `Research options for: ${title}`, order: 1 },
        { title: `Install and configure: ${title}`, order: 2 },
        { title: `Test setup: ${title}`, order: 3 },
        { title: `Document configuration: ${title}`, order: 4 },
      ];
      decompositionBasis = "setup-workflow";
    } else if (/\bfix\b/.test(lower)) {
      suggestedSubtasks = [
        { title: `Reproduce issue: ${title}`, order: 1 },
        { title: `Identify root cause: ${title}`, order: 2 },
        { title: `Implement fix: ${title}`, order: 3 },
        { title: `Add test for: ${title}`, order: 4 },
      ];
      decompositionBasis = "bugfix-workflow";
    } else if (/ and /.test(lower) || title.includes(",")) {
      const parts = title.split(/, | and /i).filter(Boolean);
      suggestedSubtasks = parts
        .slice(0, limit)
        .map((p, i) => ({ title: p.trim(), order: i + 1 }));
      decompositionBasis = "split-compound";
    } else {
      suggestedSubtasks = [
        { title: `Plan: ${title}`, order: 1 },
        { title: `Execute: ${title}`, order: 2 },
        { title: `Review and complete: ${title}`, order: 3 },
      ];
      decompositionBasis = "generic";
    }
    return {
      status: 200,
      data: {
        taskId,
        taskTitle: title,
        suggestedSubtasks: suggestedSubtasks.slice(0, limit),
        decompositionBasis,
      },
    };
  });

  // ── suggest_next_actions ────────────────────────────────────────────────────

  registry.register(
    "suggest_next_actions",
    async (params, context, runtime) => {
      const { projectId, limit } = validateAgentSuggestNextActionsInput(params);
      if (!runtime.projectService) {
        throw new AgentExecutionError(
          501,
          "PROJECTS_NOT_CONFIGURED",
          "Projects not configured",
          false,
          "Configure the project service before calling project actions.",
        );
      }
      const project = await runtime.projectService.findById(
        context.userId,
        projectId,
      );
      if (!project) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
          "Project not found",
          false,
          "Verify the project ID belongs to the authenticated user.",
        );
      }
      const tasks = await runtime.agentService.listTasks(context.userId, {
        projectId,
        statuses: ["in_progress", "next", "inbox"],
        archived: false,
        limit: 100,
      });
      const STATUS_ORDER: Record<string, number> = {
        in_progress: 0,
        next: 1,
        inbox: 2,
      };
      const PRIORITY_ORDER: Record<string, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      tasks.sort((a, b) => {
        const sA = STATUS_ORDER[a.status ?? "inbox"] ?? 2;
        const sB = STATUS_ORDER[b.status ?? "inbox"] ?? 2;
        if (sA !== sB) return sA - sB;
        const pA = PRIORITY_ORDER[a.priority ?? "medium"] ?? 2;
        const pB = PRIORITY_ORDER[b.priority ?? "medium"] ?? 2;
        return pA - pB;
      });
      return {
        status: 200,
        data: {
          projectId,
          projectName: project.name,
          suggestedActions: tasks.slice(0, limit ?? 5),
          total: tasks.length,
        },
      };
    },
  );

  // ── weekly_review_summary ───────────────────────────────────────────────────

  registry.register(
    "weekly_review_summary",
    async (params, context, runtime) => {
      const { weekStart } = validateAgentWeeklyReviewSummaryInput(params);
      const now = new Date();
      let weekStartDate: Date;
      if (weekStart) {
        weekStartDate = new Date(weekStart);
      } else {
        // Start of current week (Monday)
        weekStartDate = new Date(now);
        const day = weekStartDate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        weekStartDate.setDate(weekStartDate.getDate() + diff);
        weekStartDate.setHours(0, 0, 0, 0);
      }
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 7);
      const completedTasks = await runtime.agentService.listTasks(
        context.userId,
        {
          statuses: ["done"],
          updatedAfter: weekStartDate,
          updatedBefore: weekEndDate,
          limit: 200,
        },
      );
      const createdTasks = await runtime.agentService.listTasks(
        context.userId,
        {
          archived: false,
          limit: 200,
        },
      );
      const createdThisWeek = createdTasks.filter((t) => {
        const created =
          t.createdAt instanceof Date
            ? t.createdAt
            : new Date(t.createdAt as unknown as string);
        return created >= weekStartDate && created < weekEndDate;
      });
      const staleCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const staleTasks = await runtime.agentService.listTasks(context.userId, {
        statuses: ["inbox", "next"],
        updatedBefore: staleCutoff,
        archived: false,
        limit: 200,
      });
      const waitingTasks = await runtime.agentService.listTasks(
        context.userId,
        {
          statuses: ["waiting"],
          archived: false,
          limit: 200,
        },
      );
      const inboxTasks = await runtime.agentService.listTasks(context.userId, {
        statuses: ["inbox"],
        archived: false,
        limit: 200,
      });
      let projectsWithNoActive: Array<{ id: string; name: string }> = [];
      if (runtime.projectService) {
        const allProjects = await runtime.projectService.findAll(
          context.userId,
        );
        projectsWithNoActive = allProjects
          .filter(
            (p) =>
              !p.archived &&
              p.status === "active" &&
              (p.openTaskCount ?? p.openTodoCount ?? 0) === 0,
          )
          .map((p) => ({ id: p.id, name: p.name }));
      }
      return {
        status: 200,
        data: {
          weekStart: weekStartDate.toISOString(),
          weekEnd: weekEndDate.toISOString(),
          completed: completedTasks.length,
          created: createdThisWeek.length,
          stale: staleTasks.length,
          waiting: waitingTasks.length,
          inboxCount: inboxTasks.length,
          projectsWithNoActive,
        },
      };
    },
  );

  // ── list_audit_log ──────────────────────────────────────────────────────────

  registry.register("list_audit_log", async (params, context, runtime) => {
    const { limit, since, actionFilter, jobName, periodKey, triggeredBy } =
      validateAgentListAuditLogExtendedInput(params);
    if (!runtime.persistencePrisma) {
      return { status: 200, data: { entries: [], total: 0 } };
    }
    const where: Prisma.AgentActionAuditWhereInput = {
      userId: context.userId,
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(since ? { createdAt: { gte: new Date(since) } } : {}),
      ...(jobName ? { jobName } : {}),
      ...(periodKey ? { jobPeriodKey: periodKey } : {}),
      ...(triggeredBy ? { triggeredBy } : {}),
    };
    const entries = await runtime.persistencePrisma.agentActionAudit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit ?? 50,
      select: {
        id: true,
        action: true,
        outcome: true,
        readOnly: true,
        status: true,
        createdAt: true,
        surface: true,
        jobName: true,
        jobPeriodKey: true,
        triggeredBy: true,
      },
    });
    const total = await runtime.persistencePrisma.agentActionAudit.count({
      where,
    });
    return { status: 200, data: { entries, total } };
  });

  // ── evaluate_daily_plan ─────────────────────────────────────────────────────

  registry.register("evaluate_daily_plan", async (params, context, runtime) => {
    const { date, decisionRunId: evalRunId } =
      validateAgentEvaluateDailyInput(params);
    const result = await runtime.evaluationService.evaluateDaily(
      context.userId,
      date,
    );
    return {
      status: 200,
      data: {
        evaluation: result,
        ...(evalRunId ? { decisionRunId: evalRunId } : {}),
      },
    };
  });

  // ── evaluate_weekly_system ──────────────────────────────────────────────────

  registry.register(
    "evaluate_weekly_system",
    async (params, context, runtime) => {
      const { weekOffset } = validateAgentEvaluateWeeklyInput(params);
      // Compute ISO week bounds (same logic as weeklyExecutiveSummaryService)
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setUTCDate(
        now.getUTCDate() + mondayOffset + (weekOffset ?? 0) * 7,
      );
      monday.setUTCHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      sunday.setUTCHours(23, 59, 59, 999);
      const thursday = new Date(monday);
      thursday.setUTCDate(monday.getUTCDate() + 3);
      const isoYear = thursday.getUTCFullYear();
      const jan4 = new Date(Date.UTC(isoYear, 0, 4));
      const jan4Day = jan4.getUTCDay();
      const week1Monday = new Date(jan4);
      week1Monday.setUTCDate(
        jan4.getUTCDate() - (jan4Day === 0 ? 6 : jan4Day - 1),
      );
      const wn =
        Math.floor(
          (monday.getTime() - week1Monday.getTime()) / (7 * 86400000),
        ) + 1;
      const weekLabel = `${isoYear}-W${String(wn).padStart(2, "0")}`;
      const weekStart = monday.toISOString().slice(0, 10);
      const weekEnd = sunday.toISOString().slice(0, 10);

      const result = await runtime.evaluationService.evaluateWeekly(
        context.userId,
        weekStart,
        weekEnd,
        weekLabel,
      );

      // Fill projectsWithoutNextAction if projectService available
      let projectsWithoutNextAction = 0;
      if (runtime.projectService) {
        const missing = await runtime.agentService
          .listProjectsWithoutNextAction(context.userId, {
            includeOnHold: false,
          })
          .catch(() => []);
        projectsWithoutNextAction = missing.length;
      }

      return {
        status: 200,
        data: {
          evaluation: { ...result, projectsWithoutNextAction },
        },
      };
    },
  );

  // ── get_availability_windows ────────────────────────────────────────────────

  registry.register(
    "get_availability_windows",
    async (params, context, runtime) => {
      const { date } = validateAgentGetAvailabilityWindowsInput(params);
      const today = date ?? new Date().toISOString().slice(0, 10);
      let windows: Array<{ start: string; end: string; minutes: number }> = [
        { start: "09:00", end: "12:00", minutes: 180 },
        { start: "14:00", end: "17:00", minutes: 180 },
      ];
      if (runtime.persistencePrisma) {
        const prefs =
          await runtime.persistencePrisma.userPlanningPreferences.findUnique({
            where: { userId: context.userId },
          });
        if (prefs) {
          // Check workWindowsJson first (H3: per-day work windows)
          const workWindowsRaw = prefs.workWindowsJson as {
            windows?: Array<{ day: number; start: string; end: string }>;
          } | null;
          const requestedDate = new Date(today + "T12:00:00");
          const dayOfWeek = requestedDate.getDay(); // 0=Sun, 6=Sat

          const matchingWindows = workWindowsRaw?.windows?.filter(
            (w) =>
              typeof w.day === "number" &&
              w.day === dayOfWeek &&
              typeof w.start === "string" &&
              typeof w.end === "string" &&
              /^\d{2}:\d{2}$/.test(w.start) &&
              /^\d{2}:\d{2}$/.test(w.end),
          );

          if (matchingWindows && matchingWindows.length > 0) {
            // Use per-day work windows from workWindowsJson
            windows = matchingWindows.map((w) => {
              const [sh, sm] = w.start.split(":").map(Number);
              const [eh, em] = w.end.split(":").map(Number);
              return {
                start: w.start,
                end: w.end,
                minutes: eh * 60 + em - (sh * 60 + sm),
              };
            });
          } else {
            // Fall back to workStartTime/workEndTime
            const startH =
              (prefs as unknown as { workStartTime?: string | null })
                .workStartTime ?? "09:00";
            const endH =
              (prefs as unknown as { workEndTime?: string | null })
                .workEndTime ?? "17:00";
            const [sh, sm] = startH.split(":").map(Number);
            const [eh, em] = endH.split(":").map(Number);
            const totalMin = eh * 60 + em - (sh * 60 + sm);
            const midMin = Math.floor(totalMin / 2);
            const midH = sh * 60 + sm + midMin;
            const midHH = String(Math.floor(midH / 60)).padStart(2, "0");
            const midMM = String(midH % 60).padStart(2, "0");
            windows = [
              {
                start: startH,
                end: `${midHH}:${midMM}`,
                minutes: midMin,
              },
              {
                start: `${midHH}:${midMM}`,
                end: endH,
                minutes: totalMin - midMin,
              },
            ];
          }
        }
      }
      const scheduledTasks = await runtime.agentService.listTasks(
        context.userId,
        {
          archived: false,
          limit: 100,
        },
      );
      const tasksForDate = scheduledTasks.filter((t) => {
        if (!t.doDate) return false;
        const d =
          t.doDate instanceof Date
            ? t.doDate.toISOString().slice(0, 10)
            : String(t.doDate).slice(0, 10);
        return d === today;
      });
      const totalAvailableMinutes = windows.reduce(
        (sum, w) => sum + w.minutes,
        0,
      );
      return {
        status: 200,
        data: {
          date: today,
          windows,
          scheduledTasks: tasksForDate,
          totalAvailableMinutes,
        },
      };
    },
  );
}
