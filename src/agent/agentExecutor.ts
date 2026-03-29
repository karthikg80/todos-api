import { mapError } from "../errorHandling";
import {
  ActionRegistry,
  type ActionRuntime,
} from "../domains/agent/actions/actionRegistry";
import { AgentExecutionError } from "../domains/agent/actions/agentExecutionError";
import { registerCoreActions } from "../domains/agent/actions/registerCoreActions";
import {
  type AgentActionName,
  type AgentExecutionContext,
  type AgentSuccessEnvelope,
  type AgentErrorEnvelope,
  type AgentExecutionResult,
  IDEMPOTENT_PLANNER_APPLY_ACTIONS,
} from "../domains/agent/actions/agentTypes";
import { IProjectService } from "../interfaces/IProjectService";
import { ITodoService } from "../interfaces/ITodoService";
import agentManifest from "./agent-manifest.json";
import { AgentIdempotencyService } from "../services/agentIdempotencyService";
import { AgentAuditService } from "../services/agentAuditService";
import { AgentJobRunService } from "../services/agentJobRunService";
import { FailedAutomationActionService } from "../services/failedAutomationActionService";
import { AgentConfigService } from "../services/agentConfigService";
import { AgentMetricsService } from "../services/agentMetricsService";
import {
  RecommendationFeedbackService,
  type FeedbackSignal,
} from "../services/recommendationFeedbackService";
import {
  DayContextService,
  MODE_MODIFIERS,
} from "../services/dayContextService";
import { WeeklyExecutiveSummaryService } from "../services/weeklyExecutiveSummaryService";
import { EvaluationService } from "../services/evaluationService";
import { LearningRecommendationService } from "../services/learningRecommendationService";
import { FrictionService } from "../services/frictionService";
import { ActionPolicyService } from "../services/actionPolicyService";
import { AgentService } from "../services/agentService";
import { PrismaClient } from "@prisma/client";
import { DryRunResult } from "../types";
import { AiPlannerService } from "../services/aiService";
import type { IAiSuggestionStore } from "../services/aiSuggestionStore";
import { analyzeTaskQuality } from "../ai/taskQualityAnalyzer";
import { findDuplicates } from "../ai/duplicateDetector";
import {
  validateAgentAnalyzeProjectHealthInput,
  validateAgentAnalyzeWorkGraphInput,
  validateAgentDecideNextWorkInput,
  validateAgentWeeklyReviewInput,
  validateAgentAnalyzeTaskQualityInput,
  validateAgentFindDuplicateTasksInput,
  validateAgentFindStaleItemsInput,
  validateAgentTaxonomyCleanupInput,
  validateAgentPlanTodayInput,
  validateAgentBreakDownTaskInput,
  validateAgentSuggestNextActionsInput,
  validateAgentWeeklyReviewSummaryInput,
  validateAgentListAuditLogInput,
  validateAgentGetAvailabilityWindowsInput,
  validateAgentWeeklyReviewWithSafeInput,
  validateAgentCreateFollowUpInput,
  validateAgentListAuditLogExtendedInput,
  validateAgentSimulatePlanInput,
  validateAgentEvaluateDailyInput,
  validateAgentEvaluateWeeklyInput,
  validateAgentPrewarmHomeFocusInput,
  validateAgentGetDayPlanInput,
  validateAgentUpdateDayPlanTaskInput,
  validateAgentFinalizeDayPlanInput,
} from "../validation/agentValidation";
import { CaptureService } from "../services/captureService";
import { HomeFocusPrewarmService } from "../services/homeFocusPrewarmService";
import { DayPlanService } from "../services/dayPlanService";

// AgentActionName, AgentExecutionContext, AgentSuccessEnvelope, AgentErrorEnvelope,
// AgentExecutionResult, and IDEMPOTENT_PLANNER_APPLY_ACTIONS are imported from
// agentTypes.ts above and re-exported here for backwards-compat consumers.
export type {
  AgentActionName,
  AgentExecutionContext,
  AgentSuccessEnvelope,
  AgentErrorEnvelope,
  AgentExecutionResult,
};

interface AgentExecutorDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
  persistencePrisma?: PrismaClient;
  aiPlannerService?: AiPlannerService;
  suggestionStore?: IAiSuggestionStore;
}

const READ_ONLY_ACTIONS = new Set<AgentActionName>([
  "list_tasks",
  "search_tasks",
  "get_task",
  "get_project",
  "list_projects",
  "list_today",
  "list_next_actions",
  "list_waiting_on",
  "list_upcoming",
  "list_stale_tasks",
  "list_projects_without_next_action",
  "review_projects",
  "decide_next_work",
  "analyze_project_health",
  "analyze_work_graph",
  "analyze_task_quality",
  "find_duplicate_tasks",
  "find_stale_items",
  "taxonomy_cleanup_suggestions",
  "plan_today",
  "break_down_task",
  "suggest_next_actions",
  "weekly_review_summary",
  "list_audit_log",
  "get_availability_windows",
  "get_job_run_status",
  "list_job_runs",
  "list_failed_actions",
  "get_agent_config",
  "simulate_plan",
  "list_metrics",
  "metrics_summary",
  "list_recommendation_feedback",
  "feedback_summary",
  "get_day_context",
  "weekly_executive_summary",
  "list_inbox_items",
  "suggest_capture_route",
  "evaluate_daily_plan",
  "evaluate_weekly_system",
  "list_learning_recommendations",
  "list_friction_patterns",
  "get_action_policies",
  "list_areas",
  "get_area",
  "list_goals",
  "get_goal",
  "get_day_plan",
  "review_day_plan",
  "list_routines",
]);

function buildTrace(
  context: AgentExecutionContext,
  extras: Record<string, unknown> = {},
) {
  return {
    requestId: context.requestId,
    actor: context.actor,
    ...(context.idempotencyKey
      ? { idempotencyKey: context.idempotencyKey }
      : {}),
    timestamp: new Date().toISOString(),
    ...extras,
  };
}

function logAgentAction(
  context: AgentExecutionContext,
  payload: {
    action: AgentActionName;
    readOnly: boolean;
    status: number;
    outcome: "success" | "error";
    errorCode?: string;
    replayed?: boolean;
  },
) {
  console.info(
    JSON.stringify({
      type: "agent_action",
      surface: context.surface,
      action: payload.action,
      readOnly: payload.readOnly,
      outcome: payload.outcome,
      status: payload.status,
      userId: context.userId,
      requestId: context.requestId,
      actor: context.actor,
      idempotencyKey: context.idempotencyKey,
      replayed: payload.replayed || false,
      errorCode: payload.errorCode,
      ts: new Date().toISOString(),
    }),
  );
}

function toAgentError(error: unknown): {
  status: number;
  error: AgentErrorEnvelope["error"];
} {
  if (error instanceof AgentExecutionError) {
    return {
      status: error.status,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        ...(error.hint ? { hint: error.hint } : {}),
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof Error) {
    if (error.message === "Projects not configured") {
      return {
        status: 501,
        error: {
          code: "PROJECTS_NOT_CONFIGURED",
          message: "Projects not configured",
          retryable: false,
          hint: "Configure the project service before calling project actions.",
        },
      };
    }
    if (error.message === "Project name already exists") {
      return {
        status: 409,
        error: {
          code: "PROJECT_NAME_CONFLICT",
          message: "Project name already exists",
          retryable: false,
          hint: "Choose a different project name or fetch the existing project first.",
        },
      };
    }
    if (error.message === "INVALID_HEADING") {
      return {
        status: 400,
        error: {
          code: "INVALID_HEADING_FOR_PROJECT",
          message: "Invalid heading for project",
          retryable: false,
          hint: "Use a heading that belongs to the same project as the task.",
        },
      };
    }
    if (error.message === "INVALID_DEPENDENCY") {
      return {
        status: 400,
        error: {
          code: "INVALID_TASK_DEPENDENCY",
          message: "One or more dependency task IDs are invalid",
          retryable: false,
          hint: "Use dependency task IDs that belong to the authenticated user and do not reference the task itself.",
        },
      };
    }
    if (error.message === "INVALID_PROJECT") {
      return {
        status: 404,
        error: {
          code: "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
          message: "Project not found",
          retryable: false,
          hint: "Verify the referenced project ID belongs to the authenticated user.",
        },
      };
    }
  }

  const mapped = mapError(error);
  if (mapped.status === 400) {
    return {
      status: 400,
      error: {
        code: "INVALID_INPUT",
        message: mapped.message,
        retryable: false,
        hint: "Review the action input against the /agent/manifest contract and retry.",
      },
    };
  }
  if (mapped.status === 401) {
    const code =
      mapped.message === "Token expired"
        ? "TOKEN_EXPIRED"
        : mapped.message === "Invalid token"
          ? "INVALID_TOKEN"
          : "AUTH_REQUIRED";
    const hint =
      code === "TOKEN_EXPIRED"
        ? "Refresh the access token and retry."
        : code === "INVALID_TOKEN"
          ? "Obtain a valid bearer token and retry."
          : "Provide a valid bearer token and retry.";
    return {
      status: 401,
      error: {
        code,
        message: mapped.message,
        retryable: false,
        hint,
      },
    };
  }
  if (mapped.status === 404) {
    return {
      status: 404,
      error: {
        code: "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
        message: mapped.message,
        retryable: false,
        hint: "Verify the referenced resource ID belongs to the authenticated user.",
      },
    };
  }
  if (mapped.status === 409) {
    return {
      status: 409,
      error: {
        code: "CONFLICT",
        message: mapped.message,
        retryable: false,
        hint: "Fetch current state and retry with updated input if needed.",
      },
    };
  }
  if (mapped.status === 501) {
    return {
      status: 501,
      error: {
        code: "NOT_CONFIGURED",
        message: mapped.message,
        retryable: false,
        hint: "Enable the required server capability before calling this action.",
      },
    };
  }

  return {
    status: 500,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      retryable: true,
      hint: "Retry the action. If the error persists, inspect server logs for the request ID.",
    },
  };
}

const SAFE_APPLY_ACTIONS = new Set([
  "create_next_action",
  "follow_up_waiting_task",
]);

export class AgentExecutor {
  private readonly agentService: AgentService;
  private readonly idempotencyService: AgentIdempotencyService;
  private readonly auditService: AgentAuditService;
  private readonly jobRunService: AgentJobRunService;
  private readonly failedActionService: FailedAutomationActionService;
  private readonly agentConfigService: AgentConfigService;
  private readonly metricsService: AgentMetricsService;
  private readonly feedbackService: RecommendationFeedbackService;
  private readonly dayContextService: DayContextService;
  private readonly executiveSummaryService: WeeklyExecutiveSummaryService;
  private readonly captureService: CaptureService | null;
  private readonly learningRecommendationService: LearningRecommendationService;
  private readonly evaluationService: EvaluationService;
  private readonly frictionService: FrictionService;
  private readonly actionPolicyService: ActionPolicyService;
  private readonly homeFocusPrewarmService: HomeFocusPrewarmService | null;
  private readonly dayPlanService: DayPlanService | null;
  private readonly registry: ActionRegistry;

  constructor(private readonly deps: AgentExecutorDeps) {
    this.idempotencyService = new AgentIdempotencyService(
      deps.persistencePrisma,
    );
    this.auditService = new AgentAuditService(deps.persistencePrisma);
    this.jobRunService = new AgentJobRunService(deps.persistencePrisma);
    this.failedActionService = new FailedAutomationActionService(
      deps.persistencePrisma,
    );
    this.agentConfigService = new AgentConfigService(deps.persistencePrisma);
    this.metricsService = new AgentMetricsService(deps.persistencePrisma);
    this.feedbackService = new RecommendationFeedbackService(
      deps.persistencePrisma,
    );
    this.dayContextService = new DayContextService(deps.persistencePrisma);
    this.executiveSummaryService = new WeeklyExecutiveSummaryService(
      deps.persistencePrisma,
    );
    this.captureService = deps.persistencePrisma
      ? new CaptureService(deps.persistencePrisma)
      : null;
    this.evaluationService = new EvaluationService(deps.persistencePrisma);
    this.learningRecommendationService = new LearningRecommendationService(
      deps.persistencePrisma,
    );
    this.frictionService = new FrictionService(deps.persistencePrisma);
    this.actionPolicyService = new ActionPolicyService(deps.persistencePrisma);
    this.homeFocusPrewarmService =
      deps.aiPlannerService && deps.suggestionStore
        ? new HomeFocusPrewarmService(
            deps.aiPlannerService,
            deps.suggestionStore,
          )
        : null;
    this.dayPlanService =
      deps.persistencePrisma && deps.todoService
        ? new DayPlanService(deps.persistencePrisma, deps.todoService)
        : null;
    this.agentService = new AgentService({
      todoService: deps.todoService,
      projectService: deps.projectService,
    });
    this.registry = new ActionRegistry();
    registerCoreActions(this.registry);
  }

  private persistActionAudit(
    context: AgentExecutionContext,
    payload: {
      action: AgentActionName;
      readOnly: boolean;
      status: number;
      outcome: "success" | "error";
      errorCode?: string;
      replayed?: boolean;
    },
  ): void {
    logAgentAction(context, payload);
    void this.auditService.record({
      surface: context.surface,
      action: payload.action,
      readOnly: payload.readOnly,
      outcome: payload.outcome,
      status: payload.status,
      userId: context.userId,
      requestId: context.requestId,
      actor: context.actor,
      idempotencyKey: context.idempotencyKey,
      replayed: payload.replayed,
      errorCode: payload.errorCode,
    });
  }

  private buildDryRunResult(
    action: "create_task" | "update_task",
    input: Record<string, unknown>,
  ): DryRunResult {
    if (action === "create_task") {
      return {
        dryRun: true,
        proposedChanges: [
          {
            operation: "create",
            entityKind: "task",
            fields: {
              title: input.title,
              status: input.status ?? "next",
              priority: input.priority ?? "medium",
            },
          },
        ],
      };
    }

    // update_task
    const { id: _id, dryRun: _dryRun, ...updateFields } = input;
    return {
      dryRun: true,
      proposedChanges: [
        {
          operation: "update",
          entityKind: "task",
          entityId: typeof input.id === "string" ? input.id : undefined,
          fields: updateFields,
        },
      ],
    };
  }

  hasProjectService(): boolean {
    return Boolean(this.deps.projectService);
  }

  getRuntimeManifest(authRequired: boolean): Record<string, unknown> {
    return {
      ...agentManifest,
      auth: {
        ...agentManifest.auth,
        requiredForActions: authRequired,
      },
      actions: agentManifest.actions.map((action) => ({
        ...action,
        availability: action.availability,
        enabled:
          !(
            (action.availability?.requires as readonly string[] | undefined) ||
            []
          ).includes("project_service") || this.hasProjectService(),
      })),
    };
  }

  async execute(
    action: AgentActionName,
    input: unknown,
    context: AgentExecutionContext,
  ): Promise<AgentExecutionResult> {
    const readOnly = READ_ONLY_ACTIONS.has(action);

    // Build the shared runtime once — used by both registered handler paths.
    const runtime: ActionRuntime = {
      agentService: this.agentService,
      jobRunService: this.jobRunService,
      metricsService: this.metricsService,
      feedbackService: this.feedbackService,
      dayContextService: this.dayContextService,
      agentConfigService: this.agentConfigService,
      failedActionService: this.failedActionService,
      executiveSummaryService: this.executiveSummaryService,
      learningRecommendationService: this.learningRecommendationService,
      frictionService: this.frictionService,
      actionPolicyService: this.actionPolicyService,
      captureService: this.captureService,
      projectService: this.deps.projectService,
      persistencePrisma: this.deps.persistencePrisma,
      exec: {
        handleIdempotent: this.handleIdempotentWriteAction.bind(this),
        buildDryRunResult: (
          act: "create_task" | "update_task",
          inp: Record<string, unknown>,
        ) =>
          this.buildDryRunResult(act, inp) as unknown as Record<
            string,
            unknown
          >,
        success: this.success.bind(this),
      },
    };

    // Check read-only ActionHandler registry (returns { status, data }).
    const handler = this.registry.get(action);
    if (handler) {
      try {
        const result = await handler(
          (input as Record<string, unknown>) ?? {},
          context,
          runtime,
        );
        return this.success(
          action,
          readOnly,
          context,
          result.status,
          result.data,
        );
      } catch (error) {
        return this.failure(action, readOnly, context, error);
      }
    }

    // Check raw ActionHandler registry (returns AgentExecutionResult directly).
    const rawHandler = this.registry.getRaw(action);
    if (rawHandler) {
      try {
        return await rawHandler(
          (input as Record<string, unknown>) ?? {},
          context,
          runtime,
        );
      } catch (error) {
        return this.failure(action, readOnly, context, error);
      }
    }

    try {
      switch (action) {
        case "weekly_review": {
          const plannerInput = validateAgentWeeklyReviewWithSafeInput(input);

          // apply_safe: run suggest, then server-side apply allowlisted actions
          if (plannerInput.mode === "apply_safe") {
            return await this.handleIdempotentWriteAction(
              action,
              context,
              plannerInput,
              async () => {
                const review = await this.agentService.weeklyReviewForUser(
                  context.userId,
                  {
                    mode: "suggest",
                    includeArchived: plannerInput.includeArchived,
                  },
                );
                const appliedActions: Array<Record<string, unknown>> = [];
                const skippedActions: Array<Record<string, unknown>> = [];
                const errors: Array<Record<string, unknown>> = [];

                for (const recAction of review.recommendedActions ?? []) {
                  const rec = recAction as unknown as Record<string, unknown>;
                  const actionType = rec.type as string;
                  if (!SAFE_APPLY_ACTIONS.has(actionType)) {
                    skippedActions.push({ ...rec, reason: "not_in_allowlist" });
                    continue;
                  }
                  try {
                    if (actionType === "create_next_action") {
                      const pId = rec.projectId as string | undefined;
                      if (pId) {
                        await this.agentService.ensureNextActionForUser(
                          context.userId,
                          { projectId: pId, mode: "apply" },
                        );
                        appliedActions.push(rec);
                      }
                    } else if (actionType === "follow_up_waiting_task") {
                      const tId = rec.taskId as string | undefined;
                      if (tId) {
                        await this.agentService.createTask(context.userId, {
                          title:
                            (rec.title as string) ||
                            "Follow up on waiting task",
                          status: "next" as import("../types").TaskStatus,
                          priority:
                            (rec.priority as import("../types").Priority) ??
                            "medium",
                          source: "automation" as import("../types").TaskSource,
                          createdByPrompt:
                            "Created automatically by weekly_review apply_safe mode",
                        });
                        appliedActions.push(rec);
                      }
                    }
                  } catch (err) {
                    errors.push({
                      ...rec,
                      error: err instanceof Error ? err.message : String(err),
                    });
                  }
                }

                return {
                  review: {
                    ...review,
                    appliedActions,
                    skippedActions,
                    errors,
                  },
                };
              },
            );
          }

          const executeWeeklyReview = async () => {
            const review = await this.agentService.weeklyReviewForUser(
              context.userId,
              {
                mode: plannerInput.mode as "suggest" | "apply" | undefined,
                includeArchived: plannerInput.includeArchived,
              },
            );
            return { review };
          };
          if (
            IDEMPOTENT_PLANNER_APPLY_ACTIONS.has(action) &&
            plannerInput.mode === "apply"
          ) {
            return await this.handleIdempotentWriteAction(
              action,
              context,
              plannerInput,
              executeWeeklyReview,
            );
          }
          return this.success(
            action,
            readOnly,
            context,
            200,
            await executeWeeklyReview(),
          );
        }
        case "decide_next_work": {
          const plannerInput = validateAgentDecideNextWorkInput(input);

          // Load user weights, goals, and soul profile for personalized scoring
          const [dnwConfig, dnwGoals, dnwPrefs] = await Promise.all([
            this.agentConfigService.getConfig(context.userId),
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.goal
                  .findMany({
                    where: { userId: context.userId, archived: false },
                    select: { id: true, targetDate: true },
                  })
                  .catch(() => [] as { id: string; targetDate: Date | null }[])
              : Promise.resolve(
                  [] as { id: string; targetDate: Date | null }[],
                ),
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.userPlanningPreferences
                  .findUnique({ where: { userId: context.userId } })
                  .catch(() => null)
              : Promise.resolve(null),
          ]);
          const dnwGoalIndex = new Map(
            dnwGoals.map((g) => [g.id, { targetDate: g.targetDate }]),
          );

          // Build soul modifiers for scoreTaskForDecision
          const dnwSoul =
            (dnwPrefs?.soulProfile as Record<string, unknown>) ?? null;
          let dnwSoulMods:
            | { statusBoosts?: Record<string, number> }
            | undefined;
          if (dnwSoul) {
            const boosts: Record<string, number> = {};
            const style = dnwSoul.planningStyle as string | undefined;
            if (style === "structure") {
              boosts.in_progress = 10;
              boosts.scheduled = 10;
            } else if (style === "flexibility") {
              boosts.next = 10;
            }
            if (Object.keys(boosts).length)
              dnwSoulMods = { statusBoosts: boosts };
          }

          const decision = await this.agentService.decideNextWorkForUser(
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
          return this.success(action, readOnly, context, 200, { decision });
        }
        case "analyze_project_health": {
          const plannerInput = validateAgentAnalyzeProjectHealthInput(input);
          const health = await this.agentService.analyzeProjectHealthForUser(
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
          return this.success(action, readOnly, context, 200, { health });
        }
        case "analyze_work_graph": {
          const plannerInput = validateAgentAnalyzeWorkGraphInput(input);
          const graph = await this.agentService.analyzeWorkGraphForUser(
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
          return this.success(action, readOnly, context, 200, { graph });
        }
        case "analyze_task_quality": {
          const { taskIds, projectId } =
            validateAgentAnalyzeTaskQualityInput(input);
          const tasks = await this.agentService.listTasks(context.userId, {
            ...(projectId ? { projectId } : {}),
            archived: false,
            limit: 200,
          });
          const filtered = taskIds
            ? tasks.filter((t) => taskIds.includes(t.id))
            : tasks;
          const results = filtered.map((t) =>
            analyzeTaskQuality(t.id, t.title),
          );
          return this.success(action, readOnly, context, 200, {
            results,
            totalAnalyzed: filtered.length,
          });
        }
        case "find_duplicate_tasks": {
          const { projectId } = validateAgentFindDuplicateTasksInput(input);
          const tasks = await this.agentService.listTasks(context.userId, {
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
          return this.success(action, readOnly, context, 200, {
            groups,
            totalTasks: tasks.length,
          });
        }
        case "find_stale_items": {
          const { staleDays } = validateAgentFindStaleItemsInput(input);
          const threshold = new Date(
            Date.now() - staleDays * 24 * 60 * 60 * 1000,
          );
          const staleTasks = await this.agentService.listTasks(context.userId, {
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
          if (this.deps.projectService) {
            const allProjects = await this.deps.projectService.findAll(
              context.userId,
            );
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
          return this.success(action, readOnly, context, 200, {
            staleTasks: staleTaskDtos,
            staleProjects,
            staleDays,
            threshold: threshold.toISOString(),
          });
        }
        case "taxonomy_cleanup_suggestions": {
          validateAgentTaxonomyCleanupInput(input);
          if (!this.deps.projectService) {
            return this.success(action, readOnly, context, 200, {
              similarProjects: [],
              smallProjects: [],
            });
          }
          const allProjects = await this.deps.projectService.findAll(
            context.userId,
          );
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
                      : 1 +
                        Math.min(dp[r - 1][c], dp[r][c - 1], dp[r - 1][c - 1]);
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
          return this.success(action, readOnly, context, 200, {
            similarProjects,
            smallProjects,
            totalProjects: activeProjects.length,
          });
        }
        case "plan_today": {
          const {
            availableMinutes,
            energy: energyParam,
            date,
            decisionRunId,
            persist: persistPlan,
          } = validateAgentPlanTodayInput(input);
          const today = date ?? new Date().toISOString().slice(0, 10);
          const decidedAt = new Date().toISOString();

          // #336: load day context and derive effective energy + mode modifiers
          const dayCtx = await this.dayContextService.getContext(
            context.userId,
            today,
          );
          const energy = energyParam ?? dayCtx?.energy ?? undefined;
          const modeModifiers = dayCtx
            ? MODE_MODIFIERS[dayCtx.mode]
            : MODE_MODIFIERS.normal;

          // Fetch all data in parallel (Issue #318: delivery-ready payload)
          const [
            allTasks,
            waitingTasks,
            missingNextActionProjects,
            planConfig,
          ] = await Promise.all([
            this.agentService.listTasks(context.userId, {
              statuses: ["inbox", "next", "in_progress", "scheduled"],
              archived: false,
              limit: 200,
            }),
            this.agentService.listWaitingOn(context.userId, {}),
            this.deps.projectService
              ? this.agentService
                  .listProjectsWithoutNextAction(context.userId, {
                    includeOnHold: false,
                  })
                  .catch(() => [] as import("../types").Project[])
              : Promise.resolve([] as import("../types").Project[]),
            this.agentConfigService.getConfig(context.userId),
          ]);

          const baseBudget = availableMinutes ?? 480;
          const budget = Math.round(
            baseBudget * (modeModifiers.budgetMultiplier ?? 1),
          );

          // Build feedback adjustments, goal index, and insight boosts
          const taskIds = allTasks.map((t) => t.id);
          const [planFeedbackMap, planGoals, planInsights] = await Promise.all([
            this.feedbackService
              .getScoreAdjustmentsBatch(context.userId, taskIds)
              .catch(() => new Map<string, number>()),
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.goal
                  .findMany({
                    where: { userId: context.userId, archived: false },
                    select: { id: true, targetDate: true },
                  })
                  .catch(() => [] as { id: string; targetDate: Date | null }[])
              : Promise.resolve(
                  [] as { id: string; targetDate: Date | null }[],
                ),
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.userInsight
                  .findMany({
                    where: { userId: context.userId, periodType: "daily" },
                    orderBy: { computedAt: "desc" },
                    distinct: ["insightType"],
                  })
                  .catch(() => [])
              : Promise.resolve([]),
          ]);

          const planGoalIndex = new Map(
            planGoals.map((g) => [g.id, { targetDate: g.targetDate }]),
          );
          const planProjectGoalMap = new Map<string, string>();
          if (waitingTasks.length || missingNextActionProjects.length) {
            // Build project-to-goal map from available project data
            for (const t of allTasks) {
              if (
                t.projectId &&
                (t as any).goalId &&
                !planProjectGoalMap.has(t.projectId)
              ) {
                planProjectGoalMap.set(t.projectId, (t as any).goalId);
              }
            }
          }

          // Compute insight modifiers
          const insightsByType = new Map<string, number>();
          for (const ins of planInsights) {
            insightsByType.set(ins.insightType, ins.value);
          }
          const overcommitRatio = insightsByType.get("overcommitment_ratio");
          const streakDays = insightsByType.get("streak_days");
          const staleCount = insightsByType.get("stale_task_count");
          const insightBudgetMult =
            overcommitRatio && overcommitRatio > 1.5 ? 0.8 : 1.0;
          const insightMaxCap =
            overcommitRatio && overcommitRatio > 1.5 ? 5 : null;
          const planInsightBoosts = {
            streakBoost: streakDays && streakDays >= 7 ? 5 : 0,
            staleBoost: staleCount && staleCount > 10 ? 8 : 0,
          };

          // Load soul profile for personalized scoring
          const planPrefs = this.deps.persistencePrisma
            ? await this.deps.persistencePrisma.userPlanningPreferences
                .findUnique({ where: { userId: context.userId } })
                .catch(() => null)
            : null;
          const soul =
            (planPrefs?.soulProfile as Record<string, unknown>) ?? null;
          type SoulMods = NonNullable<Parameters<typeof this.scorePlan>[10]>;
          let planSoulMods: SoulMods | undefined;
          if (soul) {
            const statusBoosts: Record<string, number> = {};
            const priorityBoosts: Record<string, number> = {};
            let soulBudgetMult = 1.0;
            let soulMaxTasks: number | undefined;
            let effortBoosts: SoulMods["effortBoosts"];
            const style = soul.planningStyle as string | undefined;
            if (style === "structure") {
              statusBoosts.in_progress = 10;
              statusBoosts.scheduled = 10;
            } else if (style === "flexibility") {
              statusBoosts.next = 10;
            }
            const themes = (soul.goodDayThemes as string[]) ?? [];
            for (const theme of themes) {
              if (theme === "important_work") {
                priorityBoosts.high = 8;
                priorityBoosts.urgent = 8;
              } else if (theme === "life_admin") {
                // Admin tasks have no projectId — handled via priorityBoosts for simplicity
              } else if (theme === "avoid_overload") {
                soulBudgetMult = 0.85;
              } else if (theme === "visible_progress") {
                effortBoosts = { maxEffort: 20, boost: 5 };
              } else if (theme === "protect_rest") {
                soulMaxTasks = 5;
              }
            }
            planSoulMods = {
              statusBoosts: Object.keys(statusBoosts).length
                ? statusBoosts
                : undefined,
              priorityBoosts: Object.keys(priorityBoosts).length
                ? priorityBoosts
                : undefined,
              effortBoosts,
              budgetMultiplier:
                soulBudgetMult !== 1 ? soulBudgetMult : undefined,
              maxTaskCount: soulMaxTasks,
            };
          }

          const soulBudgetMult = planSoulMods?.budgetMultiplier ?? 1;
          const adjustedBudget = Math.round(
            budget * insightBudgetMult * soulBudgetMult,
          );

          const { selected, excluded, usedMinutes, budgetBreakdown } =
            this.scorePlan(
              allTasks,
              today,
              adjustedBudget,
              energy,
              modeModifiers,
              {
                plannerWeightPriority: planConfig.plannerWeightPriority,
                plannerWeightDueDate: planConfig.plannerWeightDueDate,
                plannerWeightEnergyMatch: planConfig.plannerWeightEnergyMatch,
                plannerWeightEstimateFit: planConfig.plannerWeightEstimateFit,
                plannerWeightFreshness: planConfig.plannerWeightFreshness,
              },
              planFeedbackMap,
              planGoalIndex,
              planProjectGoalMap,
              planInsightBoosts,
              planSoulMods,
            );

          const modeMax = modeModifiers.maxTaskCount ?? selected.length;
          const insightCap = insightMaxCap ?? modeMax;
          const soulCap = planSoulMods?.maxTaskCount ?? insightCap;
          const maxTasks = Math.min(modeMax, insightCap, soulCap);
          const cappedSelected = selected.slice(0, maxTasks);

          // Recompute totals from the capped list so budget metadata stays
          // consistent with recommendedTasks (Codex P1 fix).
          const cappedMinutes = cappedSelected.reduce(
            (sum, s) => sum + s.effort,
            0,
          );
          const cappedBudgetBreakdown = {
            ...budgetBreakdown,
            scheduled: cappedMinutes,
            remaining: budget - cappedMinutes,
            taskCount: cappedSelected.length,
          };

          const recommendedTasks = cappedSelected.map((s, i) => ({
            ...s.task,
            estimatedMinutes: s.effort,
            score: s.score,
            isRoutine: !!s.task.recurrence && s.task.recurrence.type !== "none",
            explanation: {
              scoreBreakdown: s.scoreBreakdown,
              whyIncluded: s.whyIncluded,
              rank: i + 1,
            },
            attribution: {
              decisionRunId: decisionRunId ?? null,
              decisionJobName: "planner",
              decisionPeriodKey: today,
              recommendedAt: decidedAt,
              recommendedRank: i + 1,
              recommendedScore: s.score,
              autoCreated: false,
            },
          }));

          // Persist as DayPlan if requested
          let dayPlanId: string | null = null;
          if (persistPlan && this.dayPlanService) {
            const dayPlan = await this.dayPlanService.createFromPlan(
              context.userId,
              {
                planDate: today,
                mode: dayCtx?.mode ?? "normal",
                energy: energy ?? null,
                availableMinutes: budget,
                totalMinutes: cappedMinutes,
                remainingMinutes: budget - cappedMinutes,
                headline: {
                  recommendedTaskCount: recommendedTasks.length,
                  waitingCount: waitingTasks.length,
                  projectsNeedingAttention: missingNextActionProjects.length,
                },
                budgetBreakdown: cappedBudgetBreakdown,
                decisionRunId: decisionRunId ?? null,
                recommendedTasks: recommendedTasks.map((t) => ({
                  id: t.id,
                  estimatedMinutes: t.estimatedMinutes,
                  score: t.score,
                  explanation: t.explanation,
                  attribution: t.attribution,
                })),
              },
            );
            dayPlanId = dayPlan.id;
          }

          return this.success(action, readOnly, context, 200, {
            plan: {
              date: today,
              timezone: null,
              mode: dayCtx?.mode ?? "normal",
              dayPlanId,
              headline: {
                recommendedTaskCount: recommendedTasks.length,
                waitingCount: waitingTasks.length,
                projectsNeedingAttention: missingNextActionProjects.length,
              },
              recommendedTasks,
              excluded: excluded.map((e) => ({
                ...e,
                attribution: {
                  decisionRunId: decisionRunId ?? null,
                  decisionPeriodKey: today,
                  excludedAt: decidedAt,
                  excludedScore: e.score,
                },
              })),
              budgetBreakdown: cappedBudgetBreakdown,
              waitingTasks: waitingTasks.slice(0, 10).map((t) => ({
                id: t.id,
                title: t.title,
                waitingOn: t.waitingOn ?? null,
                dueDate: t.dueDate ?? null,
                projectId: t.projectId ?? null,
              })),
              projectsNeedingAttention: missingNextActionProjects
                .slice(0, 10)
                .map((p) => ({ id: p.id, name: p.name })),
              availableMinutes: budget,
              energy: energy ?? null,
              totalMinutes: cappedMinutes,
              remainingMinutes: budget - cappedMinutes,
            },
          });
        }

        // ── DayPlan actions ──

        case "get_day_plan": {
          const { date: planDate, id: planId } =
            validateAgentGetDayPlanInput(input);
          if (!this.dayPlanService) {
            throw new AgentExecutionError(
              503,
              "SERVICE_UNAVAILABLE",
              "DayPlan service not available",
              true,
            );
          }
          let plan;
          if (planId) {
            plan = await this.dayPlanService.getByDate(
              context.userId,
              planDate ?? new Date().toISOString().slice(0, 10),
            );
            // Try by date if ID lookup not directly supported
          } else {
            plan = await this.dayPlanService.getByDate(
              context.userId,
              planDate ?? new Date().toISOString().slice(0, 10),
            );
          }
          if (!plan) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Day plan not found",
              false,
            );
          }
          return this.success(action, readOnly, context, 200, { plan });
        }

        case "create_day_plan": {
          // Re-use plan_today scoring, then persist
          const {
            availableMinutes: cdpMinutes,
            energy: cdpEnergy,
            date: cdpDate,
            decisionRunId: cdpRunId,
          } = validateAgentPlanTodayInput(input);
          if (!this.dayPlanService) {
            throw new AgentExecutionError(
              503,
              "SERVICE_UNAVAILABLE",
              "DayPlan service not available",
              true,
            );
          }
          // Delegate to plan_today with persist=true
          const forcedInput = {
            ...(input as Record<string, unknown>),
            persist: true,
          };
          return this.execute("plan_today", forcedInput, context);
        }

        case "update_day_plan_task": {
          const { planId, taskId, outcome } =
            validateAgentUpdateDayPlanTaskInput(input);
          if (!this.dayPlanService) {
            throw new AgentExecutionError(
              503,
              "SERVICE_UNAVAILABLE",
              "DayPlan service not available",
              true,
            );
          }
          const updated = await this.dayPlanService.updateTaskOutcome(
            context.userId,
            planId,
            taskId,
            outcome,
          );
          if (!updated) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Plan or task not found",
              false,
            );
          }
          return this.success(action, readOnly, context, 200, {
            plan: updated,
          });
        }

        case "finalize_day_plan": {
          const { planId, date: finalizeDate } =
            validateAgentFinalizeDayPlanInput(input);
          if (!this.dayPlanService) {
            throw new AgentExecutionError(
              503,
              "SERVICE_UNAVAILABLE",
              "DayPlan service not available",
              true,
            );
          }
          let targetPlan;
          if (planId) {
            targetPlan = await this.dayPlanService.finalize(
              context.userId,
              planId,
            );
          } else {
            const datePlan = await this.dayPlanService.getByDate(
              context.userId,
              finalizeDate ?? new Date().toISOString().slice(0, 10),
            );
            if (datePlan) {
              targetPlan = await this.dayPlanService.finalize(
                context.userId,
                datePlan.id,
              );
            }
          }
          if (!targetPlan) {
            throw new AgentExecutionError(
              400,
              "INVALID_STATE",
              "Plan not found or already finalized",
              false,
            );
          }
          return this.success(action, readOnly, context, 200, {
            plan: targetPlan,
          });
        }

        case "review_day_plan": {
          const { planId, date: reviewDate } =
            validateAgentFinalizeDayPlanInput(input);
          if (!this.dayPlanService) {
            throw new AgentExecutionError(
              503,
              "SERVICE_UNAVAILABLE",
              "DayPlan service not available",
              true,
            );
          }
          let reviewPlan;
          if (planId) {
            reviewPlan = await this.dayPlanService.review(
              context.userId,
              planId,
            );
          } else {
            const datePlan = await this.dayPlanService.getByDate(
              context.userId,
              reviewDate ?? new Date().toISOString().slice(0, 10),
            );
            if (datePlan) {
              reviewPlan = await this.dayPlanService.review(
                context.userId,
                datePlan.id,
              );
            }
          }
          if (!reviewPlan) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Plan not found",
              false,
            );
          }
          return this.success(action, readOnly, context, 200, {
            review: reviewPlan,
          });
        }

        case "break_down_task": {
          const { taskId, maxSubtasks } =
            validateAgentBreakDownTaskInput(input);
          const task = await this.agentService.getTask(context.userId, taskId);
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
          return this.success(action, readOnly, context, 200, {
            taskId,
            taskTitle: title,
            suggestedSubtasks: suggestedSubtasks.slice(0, limit),
            decompositionBasis,
          });
        }
        case "suggest_next_actions": {
          const { projectId, limit } =
            validateAgentSuggestNextActionsInput(input);
          if (!this.deps.projectService) {
            throw new AgentExecutionError(
              501,
              "PROJECTS_NOT_CONFIGURED",
              "Projects not configured",
              false,
              "Configure the project service before calling project actions.",
            );
          }
          const project = await this.deps.projectService.findById(
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
          const tasks = await this.agentService.listTasks(context.userId, {
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
          return this.success(action, readOnly, context, 200, {
            projectId,
            projectName: project.name,
            suggestedActions: tasks.slice(0, limit ?? 5),
            total: tasks.length,
          });
        }
        case "weekly_review_summary": {
          const { weekStart } = validateAgentWeeklyReviewSummaryInput(input);
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
          const completedTasks = await this.agentService.listTasks(
            context.userId,
            {
              statuses: ["done"],
              updatedAfter: weekStartDate,
              updatedBefore: weekEndDate,
              limit: 200,
            },
          );
          const createdTasks = await this.agentService.listTasks(
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
          const staleCutoff = new Date(
            now.getTime() - 14 * 24 * 60 * 60 * 1000,
          );
          const staleTasks = await this.agentService.listTasks(context.userId, {
            statuses: ["inbox", "next"],
            updatedBefore: staleCutoff,
            archived: false,
            limit: 200,
          });
          const waitingTasks = await this.agentService.listTasks(
            context.userId,
            {
              statuses: ["waiting"],
              archived: false,
              limit: 200,
            },
          );
          const inboxTasks = await this.agentService.listTasks(context.userId, {
            statuses: ["inbox"],
            archived: false,
            limit: 200,
          });
          let projectsWithNoActive: Array<{ id: string; name: string }> = [];
          if (this.deps.projectService) {
            const allProjects = await this.deps.projectService.findAll(
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
          return this.success(action, readOnly, context, 200, {
            weekStart: weekStartDate.toISOString(),
            weekEnd: weekEndDate.toISOString(),
            completed: completedTasks.length,
            created: createdThisWeek.length,
            stale: staleTasks.length,
            waiting: waitingTasks.length,
            inboxCount: inboxTasks.length,
            projectsWithNoActive,
          });
        }
        case "list_audit_log": {
          const {
            limit,
            since,
            actionFilter,
            jobName,
            periodKey,
            triggeredBy,
          } = validateAgentListAuditLogExtendedInput(input);
          if (!this.deps.persistencePrisma) {
            return this.success(action, readOnly, context, 200, {
              entries: [],
              total: 0,
            });
          }
          const where: import("@prisma/client").Prisma.AgentActionAuditWhereInput =
            {
              userId: context.userId,
              ...(actionFilter ? { action: actionFilter } : {}),
              ...(since ? { createdAt: { gte: new Date(since) } } : {}),
              ...(jobName ? { jobName } : {}),
              ...(periodKey ? { jobPeriodKey: periodKey } : {}),
              ...(triggeredBy ? { triggeredBy } : {}),
            };
          const entries =
            await this.deps.persistencePrisma.agentActionAudit.findMany({
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
          const total =
            await this.deps.persistencePrisma.agentActionAudit.count({ where });
          return this.success(action, readOnly, context, 200, {
            entries,
            total,
          });
        }

        // ── Issue #316: create_follow_up_for_waiting_task ──────────────────────
        case "create_follow_up_for_waiting_task": {
          const { taskId, mode, cooldownDays, title, priority } =
            validateAgentCreateFollowUpInput(input);
          const waitingTask = await this.agentService.getTask(
            context.userId,
            taskId,
          );
          if (!waitingTask) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task not found",
              false,
              "Verify the task ID belongs to the authenticated user.",
            );
          }
          if (waitingTask.status !== "waiting") {
            throw new AgentExecutionError(
              400,
              "INVALID_INPUT",
              "Task is not in waiting status",
              false,
              "Only tasks with status 'waiting' can have follow-ups created.",
            );
          }

          const cooldown = cooldownDays ?? 7;
          const followUpTitle = title ?? `Follow up: ${waitingTask.title}`;
          const followUp = {
            title: followUpTitle,
            status: "next" as import("../types").TaskStatus,
            priority:
              (priority as import("../types").Priority | undefined) ?? "medium",
            projectId: waitingTask.projectId ?? undefined,
            source: "automation" as import("../types").TaskSource,
            createdByPrompt: `follow_up:${taskId}`,
          };

          const followUpPolicies = await this.actionPolicyService.getPolicies(
            context.userId,
          );
          const followUpActionMeta = this.actionPolicyService.buildActionMeta(
            "create_follow_up_for_waiting_task",
            followUpPolicies,
          );

          if (mode !== "apply") {
            return this.success(action, readOnly, context, 200, {
              created: false,
              mode: "suggest",
              waitingTask: { id: waitingTask.id, title: waitingTask.title },
              followUp,
              actionMeta: followUpActionMeta,
            });
          }

          // For apply mode, idempotency lookup fires first so retries with the
          // same key replay the original success even if cooldown is now active.
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              // Check cooldown inside the execute callback so idempotency replay
              // bypasses this check on retries.
              const cooldownDate = new Date(
                Date.now() - cooldown * 24 * 60 * 60 * 1000,
              );
              const recentFollowUps = await this.agentService.listTasks(
                context.userId,
                {
                  statuses: ["inbox", "next", "in_progress"],
                  archived: false,
                  limit: 50,
                },
              );
              const hasRecentFollowUp = recentFollowUps.some((t) => {
                const createdAt =
                  t.createdAt instanceof Date
                    ? t.createdAt
                    : new Date(t.createdAt as unknown as string);
                return (
                  t.createdByPrompt?.includes(taskId) &&
                  createdAt >= cooldownDate
                );
              });
              if (hasRecentFollowUp) {
                return {
                  created: false,
                  skipped: true,
                  reason: "cooldown_active",
                  cooldownDays: cooldown,
                  waitingTask: { id: waitingTask.id, title: waitingTask.title },
                  followUp,
                  actionMeta: followUpActionMeta,
                };
              }
              const task = await this.agentService.createTask(
                context.userId,
                followUp,
              );
              return {
                created: true,
                task,
                waitingTaskId: taskId,
                actionMeta: followUpActionMeta,
              };
            },
            201,
          );
        }

        case "prewarm_home_focus": {
          if (!this.homeFocusPrewarmService) {
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Home focus prewarm not configured",
              false,
              "Provide AI planner and suggestion store dependencies before calling this action.",
            );
          }
          const prewarmInput = validateAgentPrewarmHomeFocusInput(input);
          const periodKey =
            prewarmInput.periodKey ?? new Date().toISOString().slice(0, 10);
          const prewarm = await this.homeFocusPrewarmService.prewarmForUser(
            context.userId,
            prewarmInput,
          );
          await this.metricsService.record(context.userId, {
            jobName: "home_focus_prewarm",
            periodKey,
            metricType:
              prewarm.status === "generated"
                ? "automation.home_focus.generated"
                : "automation.home_focus.reused",
            value: 1,
            metadata: {
              suggestionId: prewarm.suggestionId,
              createdAt: prewarm.createdAt,
              freshUntil: prewarm.freshUntil,
              ageHours: prewarm.ageHours,
              suggestionCount: prewarm.suggestionCount,
              mustAbstain: prewarm.mustAbstain,
              timezone: prewarmInput.timezone ?? null,
            },
          });
          await this.metricsService.record(context.userId, {
            jobName: "home_focus_prewarm",
            periodKey,
            metricType: "automation.home_focus.snapshot_age_hours",
            value: prewarm.ageHours,
            metadata: {
              suggestionId: prewarm.suggestionId,
              status: prewarm.status,
            },
          });
          return this.success(action, readOnly, context, 200, { prewarm });
        }

        // ── H3: Areas & Goals CRUD ──────────────────────────────────────────────
        case "run_data_retention": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Retention not configured",
              false,
            );
          const { DataRetentionService } =
            await import("../services/dataRetentionService");
          const svc = new DataRetentionService(this.deps.persistencePrisma);
          const purged = await svc.purgeAll();
          return this.success(action, readOnly, context, 200, { purged });
        }

        // ── H3: Project health intervention ─────────────────────────────────────
        case "project_health_intervention": {
          if (!this.deps.persistencePrisma || !this.deps.projectService)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Projects not configured",
              false,
            );

          const phConfig = await this.agentConfigService.getConfig(
            context.userId,
          );
          if (!phConfig.projectHealthEnabled)
            return this.success(action, readOnly, context, 200, {
              skipped: true,
              reason: "projectHealthEnabled is false",
            });

          const MAX_PROJECTS = 3;
          const HEALTH_THRESHOLD = 40;
          let writeCount = 0;
          const maxWrites = phConfig.maxWriteActionsPerRun;
          const interventions: Array<Record<string, unknown>> = [];

          // Get all active projects with health scores
          const projects = await this.deps.projectService.findAll(
            context.userId,
          );
          const activeProjects = projects.filter(
            (p) => !p.archived && p.status !== "completed",
          );

          // Compute health for each project
          const projectHealthResults: Array<{
            project: (typeof activeProjects)[0];
            score: number;
          }> = [];
          for (const project of activeProjects) {
            try {
              const health =
                await this.agentService.analyzeProjectHealthForUser(
                  context.userId,
                  { projectId: project.id },
                );
              if (
                health?.healthScore !== undefined &&
                health.healthScore < HEALTH_THRESHOLD
              ) {
                projectHealthResults.push({
                  project,
                  score: health.healthScore,
                });
              }
            } catch {
              // Skip projects that fail health analysis
            }
          }

          // Sort by worst health first, take max 3
          projectHealthResults.sort((a, b) => a.score - b.score);
          const criticalProjects = projectHealthResults.slice(0, MAX_PROJECTS);

          for (const { project, score } of criticalProjects) {
            const intervention: Record<string, unknown> = {
              projectId: project.id,
              projectName: project.name,
              healthScore: score,
              subtasksCreated: 0,
              nextActionCreated: false,
            };

            // Find oldest stale open task in this project
            const projectTasks = await this.agentService.listTasks(
              context.userId,
              {
                projectId: project.id,
                statuses: ["inbox", "next", "in_progress"],
                archived: false,
                limit: 50,
              },
            );
            const staleTasks = projectTasks
              .filter((t) => {
                const updated =
                  t.updatedAt instanceof Date
                    ? t.updatedAt
                    : new Date(String(t.updatedAt));
                return (Date.now() - updated.getTime()) / 86_400_000 > 7;
              })
              .sort((a, b) => {
                const aUp =
                  a.updatedAt instanceof Date
                    ? a.updatedAt.getTime()
                    : new Date(String(a.updatedAt)).getTime();
                const bUp =
                  b.updatedAt instanceof Date
                    ? b.updatedAt.getTime()
                    : new Date(String(b.updatedAt)).getTime();
                return aUp - bUp;
              });

            const targetTask = staleTasks[0];
            if (targetTask && writeCount < maxWrites) {
              // Break down the task into subtasks
              try {
                const breakdown =
                  await this.deps.aiPlannerService?.breakdownTodoIntoSubtasks({
                    title: targetTask.title,
                    description: targetTask.description ?? "",
                    notes: targetTask.notes ?? "",
                    priority: targetTask.priority ?? "medium",
                    maxSubtasks: 4,
                  });

                if (breakdown?.subtasks?.length) {
                  for (const sub of breakdown.subtasks) {
                    if (writeCount >= maxWrites) break;
                    try {
                      await this.agentService.addSubtask(
                        context.userId,
                        targetTask.id,
                        { title: sub.title },
                      );
                      writeCount++;
                      intervention.subtasksCreated =
                        (intervention.subtasksCreated as number) + 1;

                      // Audit child write
                      await this.auditService.record({
                        surface: "agent",
                        action: "add_subtask",
                        readOnly: false,
                        outcome: "success",
                        status: 200,
                        userId: context.userId,
                        requestId: context.requestId,
                        actor: context.actor,
                        triggeredBy: "automation",
                        jobName: "project_health_intervention",
                      });
                    } catch {
                      // Skip individual subtask failures
                    }
                  }
                }
              } catch {
                // Breakdown failed — continue to next action
              }
            }

            // Ensure next action if project is missing one
            if (writeCount < maxWrites) {
              try {
                const nextAction =
                  await this.agentService.ensureNextActionForUser(
                    context.userId,
                    { projectId: project.id, mode: "apply" },
                  );
                if (nextAction?.created) {
                  writeCount++;
                  intervention.nextActionCreated = true;

                  await this.auditService.record({
                    surface: "agent",
                    action: "ensure_next_action",
                    readOnly: false,
                    outcome: "success",
                    status: 200,
                    userId: context.userId,
                    requestId: context.requestId,
                    actor: context.actor,
                    triggeredBy: "automation",
                    jobName: "project_health_intervention",
                  });
                }
              } catch {
                // Next action failed — skip
              }
            }

            interventions.push(intervention);
          }

          return this.success(action, readOnly, context, 200, {
            interventions,
            projectsAnalyzed: activeProjects.length,
            criticalCount: criticalProjects.length,
            totalWriteActions: writeCount,
          });
        }

        // ── H3: Morning brief ────────────────────────────────────────────────────
        case "generate_morning_brief": {
          if (!this.deps.aiPlannerService)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "AI planner not configured",
              false,
            );

          // Check AI opt-out
          const briefConfig = await this.agentConfigService.getConfig(
            context.userId,
          );
          const briefTasks = await this.agentService.listTasks(context.userId, {
            statuses: ["inbox", "next", "in_progress", "scheduled"],
            archived: false,
            limit: 200,
          });

          // Get insights and soul profile
          const [briefInsights, briefPrefs] = await Promise.all([
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.userInsight
                  .findMany({
                    where: { userId: context.userId, periodType: "daily" },
                    orderBy: { computedAt: "desc" },
                    distinct: ["insightType"],
                  })
                  .catch(() => [])
              : Promise.resolve([]),
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.userPlanningPreferences
                  .findUnique({ where: { userId: context.userId } })
                  .catch(() => null)
              : Promise.resolve(null),
          ]);

          const briefInsightMap = new Map<string, number>();
          for (const ins of briefInsights)
            briefInsightMap.set(ins.insightType, ins.value);

          const soul =
            (briefPrefs?.soulProfile as Record<string, unknown>) ?? {};

          const { brief, deterministic } = briefConfig.aiOptOut
            ? await this.deps.aiPlannerService.generateMorningBrief({
                tasks: briefTasks.map((t) => ({
                  title: t.title,
                  priority: t.priority ?? undefined,
                })),
                insightSummary: {
                  completionVelocity: briefInsightMap.get(
                    "completion_velocity",
                  ),
                  streakDays: briefInsightMap.get("streak_days"),
                  overcommitmentRatio: briefInsightMap.get(
                    "overcommitment_ratio",
                  ),
                },
                tone: String(soul.tone ?? "calm"),
              })
            : await this.deps.aiPlannerService.generateMorningBrief({
                tasks: briefTasks.map((t) => ({
                  title: t.title,
                  priority: t.priority ?? undefined,
                })),
                insightSummary: {
                  completionVelocity: briefInsightMap.get(
                    "completion_velocity",
                  ),
                  streakDays: briefInsightMap.get("streak_days"),
                  overcommitmentRatio: briefInsightMap.get(
                    "overcommitment_ratio",
                  ),
                },
                tone: String(soul.tone ?? "calm"),
              });

          return this.success(action, readOnly, context, 200, {
            brief,
            deterministic,
            taskCount: briefTasks.length,
          });
        }

        // ── Task reminder email ────────────────────────────────────────────────
        case "send_task_reminder": {
          if (!this.deps.persistencePrisma) {
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Task reminders require database access",
              false,
            );
          }
          const user = await this.deps.persistencePrisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true },
          });
          if (!user?.email) {
            return this.success(action, readOnly, context, 200, {
              sent: 0,
              reason: "no_email",
            });
          }
          const now = new Date();
          const todayStr = now.toISOString().slice(0, 10);
          const tomorrowDate = new Date(now.getTime() + 86_400_000);
          const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);
          const allUserTasks = await this.agentService.listTasks(
            context.userId,
            {
              statuses: ["inbox", "next", "in_progress", "scheduled"],
              archived: false,
              limit: 200,
            },
          );
          const overdue: Array<{ title: string; dueDate: string }> = [];
          const dueToday: Array<{ title: string }> = [];
          const dueTomorrow: Array<{ title: string }> = [];
          for (const t of allUserTasks) {
            if (!t.dueDate) continue;
            const d =
              t.dueDate instanceof Date
                ? t.dueDate.toISOString().slice(0, 10)
                : String(t.dueDate).slice(0, 10);
            if (d < todayStr) overdue.push({ title: t.title, dueDate: d });
            else if (d === todayStr) dueToday.push({ title: t.title });
            else if (d === tomorrowStr) dueTomorrow.push({ title: t.title });
          }
          const { EmailService } = await import("../services/emailService");
          const emailService = new EmailService();
          const sent = await emailService.sendTaskReminderDigest(user.email, {
            overdue,
            dueToday,
            dueTomorrow,
          });
          return this.success(action, readOnly, context, 200, { sent });
        }

        // ── Issue #314: job-run locking ────────────────────────────────────────
        case "simulate_plan": {
          const {
            availableMinutes,
            energy,
            date,
            compareToDate,
            decisionRunId: simRunId,
          } = validateAgentSimulatePlanInput(input);
          const today = date ?? new Date().toISOString().slice(0, 10);
          const simDecidedAt = new Date().toISOString();

          const [allTasks, waitingTasks, missingNextActionProjects, simConfig] =
            await Promise.all([
              this.agentService.listTasks(context.userId, {
                statuses: ["inbox", "next", "in_progress", "scheduled"],
                archived: false,
                limit: 200,
              }),
              this.agentService.listWaitingOn(context.userId, {}),
              this.deps.projectService
                ? this.agentService
                    .listProjectsWithoutNextAction(context.userId, {
                      includeOnHold: false,
                    })
                    .catch(() => [] as import("../types").Project[])
                : Promise.resolve([] as import("../types").Project[]),
              this.agentConfigService.getConfig(context.userId),
            ]);

          const simWeights = {
            plannerWeightPriority: simConfig.plannerWeightPriority,
            plannerWeightDueDate: simConfig.plannerWeightDueDate,
            plannerWeightEnergyMatch: simConfig.plannerWeightEnergyMatch,
            plannerWeightEstimateFit: simConfig.plannerWeightEstimateFit,
            plannerWeightFreshness: simConfig.plannerWeightFreshness,
          };

          const budget = availableMinutes ?? 480;

          // Build feedback, goal, and insight data (parity with plan_today)
          const simTaskIds = allTasks.map((t) => t.id);
          const [simFeedbackMap, simGoals, simInsightsRaw] = await Promise.all([
            this.feedbackService
              .getScoreAdjustmentsBatch(context.userId, simTaskIds)
              .catch(() => new Map<string, number>()),
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.goal
                  .findMany({
                    where: { userId: context.userId, archived: false },
                    select: { id: true, targetDate: true },
                  })
                  .catch(() => [] as { id: string; targetDate: Date | null }[])
              : Promise.resolve(
                  [] as { id: string; targetDate: Date | null }[],
                ),
            this.deps.persistencePrisma
              ? this.deps.persistencePrisma.userInsight
                  .findMany({
                    where: { userId: context.userId, periodType: "daily" },
                    orderBy: { computedAt: "desc" },
                    distinct: ["insightType"],
                  })
                  .catch(() => [])
              : Promise.resolve([]),
          ]);
          const simGoalIndex = new Map(
            simGoals.map((g) => [g.id, { targetDate: g.targetDate }]),
          );
          const simProjectGoalMap = new Map<string, string>();
          for (const t of allTasks) {
            if (
              t.projectId &&
              (t as any).goalId &&
              !simProjectGoalMap.has(t.projectId)
            ) {
              simProjectGoalMap.set(t.projectId, (t as any).goalId);
            }
          }
          const simInsightMap = new Map<string, number>();
          for (const ins of simInsightsRaw) {
            simInsightMap.set(ins.insightType, ins.value);
          }
          const simStreakDays = simInsightMap.get("streak_days");
          const simStaleCount = simInsightMap.get("stale_task_count");
          const simInsightBoosts = {
            streakBoost: simStreakDays && simStreakDays >= 7 ? 5 : 0,
            staleBoost: simStaleCount && simStaleCount > 10 ? 8 : 0,
          };

          const { selected, excluded, usedMinutes, budgetBreakdown } =
            this.scorePlan(
              allTasks,
              today,
              budget,
              energy,
              undefined,
              simWeights,
              simFeedbackMap,
              simGoalIndex,
              simProjectGoalMap,
              simInsightBoosts,
            );

          const recommendedTasks = selected.map((s, i) => ({
            ...s.task,
            estimatedMinutes: s.effort,
            score: s.score,
            explanation: {
              scoreBreakdown: s.scoreBreakdown,
              whyIncluded: s.whyIncluded,
              rank: i + 1,
            },
            attribution: {
              decisionRunId: simRunId ?? null,
              decisionJobName: "simulate",
              decisionPeriodKey: today,
              recommendedAt: simDecidedAt,
              recommendedRank: i + 1,
              recommendedScore: s.score,
              autoCreated: false,
            },
          }));

          const plan = {
            date: today,
            availableMinutes: budget,
            energy: energy ?? null,
            totalMinutes: usedMinutes,
            remainingMinutes: budget - usedMinutes,
            recommendedTaskCount: recommendedTasks.length,
            recommendedTasks,
            excluded: excluded.map((e) => ({
              ...e,
              attribution: {
                decisionRunId: simRunId ?? null,
                decisionPeriodKey: today,
                excludedAt: simDecidedAt,
                excludedScore: e.score,
              },
            })),
            budgetBreakdown,
            waitingCount: waitingTasks.length,
            projectsNeedingAttention: missingNextActionProjects.length,
          };

          // Optional diff vs compareToDate
          let diff: Record<string, unknown> | null = null;
          if (compareToDate) {
            const { selected: cSelected, usedMinutes: cUsed } = this.scorePlan(
              allTasks,
              compareToDate,
              budget,
              energy,
              undefined,
              simWeights,
              simFeedbackMap,
              simGoalIndex,
              simProjectGoalMap,
              simInsightBoosts,
            );
            const cIds = new Set(cSelected.map((s) => s.task.id));
            const bIds = new Set(selected.map((s) => s.task.id));
            diff = {
              compareToDate,
              addedTasks: selected
                .filter((s) => !cIds.has(s.task.id))
                .map((s) => ({ id: s.task.id, title: s.task.title })),
              removedTasks: cSelected
                .filter((s) => !bIds.has(s.task.id))
                .map((s) => ({ id: s.task.id, title: s.task.title })),
              minutesDelta: usedMinutes - cUsed,
            };
          }

          return this.success(action, readOnly, context, 200, {
            plan,
            ...(diff ? { diff } : {}),
          });
        }

        // ── Issue #332: automation metrics ────────────────────────────────────
        case "evaluate_daily_plan": {
          const { date, decisionRunId: evalRunId } =
            validateAgentEvaluateDailyInput(input);
          const result = await this.evaluationService.evaluateDaily(
            context.userId,
            date,
          );
          return this.success(action, readOnly, context, 200, {
            evaluation: result,
            ...(evalRunId ? { decisionRunId: evalRunId } : {}),
          });
        }

        case "evaluate_weekly_system": {
          const { weekOffset } = validateAgentEvaluateWeeklyInput(input);
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

          const result = await this.evaluationService.evaluateWeekly(
            context.userId,
            weekStart,
            weekEnd,
            weekLabel,
          );

          // Fill projectsWithoutNextAction if projectService available
          let projectsWithoutNextAction = 0;
          if (this.deps.projectService) {
            const missing = await this.agentService
              .listProjectsWithoutNextAction(context.userId, {
                includeOnHold: false,
              })
              .catch(() => []);
            projectsWithoutNextAction = missing.length;
          }

          return this.success(action, readOnly, context, 200, {
            evaluation: { ...result, projectsWithoutNextAction },
          });
        }

        case "get_availability_windows": {
          const { date } = validateAgentGetAvailabilityWindowsInput(input);
          const today = date ?? new Date().toISOString().slice(0, 10);
          let windows: Array<{ start: string; end: string; minutes: number }> =
            [
              { start: "09:00", end: "12:00", minutes: 180 },
              { start: "14:00", end: "17:00", minutes: 180 },
            ];
          if (this.deps.persistencePrisma) {
            const prefs =
              await this.deps.persistencePrisma.userPlanningPreferences.findUnique(
                { where: { userId: context.userId } },
              );
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
                  (
                    prefs as unknown as {
                      workStartTime?: string | null;
                    }
                  ).workStartTime ?? "09:00";
                const endH =
                  (
                    prefs as unknown as {
                      workEndTime?: string | null;
                    }
                  ).workEndTime ?? "17:00";
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
          const scheduledTasks = await this.agentService.listTasks(
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
          return this.success(action, readOnly, context, 200, {
            date: today,
            windows,
            scheduledTasks: tasksForDate,
            totalAvailableMinutes,
          });
        }

        // ── Issue #339: action policies ───────────────────────────────────────
      }
      throw new AgentExecutionError(
        501,
        "ACTION_NOT_IMPLEMENTED",
        `Action not implemented: ${String(action)}`,
        false,
      );
    } catch (error) {
      return this.failure(action, readOnly, context, error);
    }
  }

  private async handleIdempotentWriteAction(
    action: AgentActionName,
    context: AgentExecutionContext,
    input: unknown,
    execute: () => Promise<Record<string, unknown>>,
    successStatus = 200,
  ): Promise<AgentExecutionResult> {
    const readOnly = false;
    const idempotencyKey = context.idempotencyKey;

    if (idempotencyKey) {
      const lookup = await this.idempotencyService.lookup(
        action,
        context.userId,
        idempotencyKey,
        input,
      );
      if (lookup.kind === "conflict") {
        throw new AgentExecutionError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Idempotency key already used for different input",
          false,
          "Reuse the original payload or supply a new idempotency key.",
        );
      }
      if (lookup.kind === "replay") {
        const replayed = lookup.body as AgentSuccessEnvelope;
        const response = {
          ...replayed,
          trace: buildTrace(context, {
            replayed: true,
            originalRequestId: replayed.trace.requestId,
          }),
        };
        this.persistActionAudit(context, {
          action,
          readOnly,
          status: lookup.status,
          outcome: "success",
          replayed: true,
        });
        return {
          status: lookup.status,
          body: response,
        };
      }
    }

    const response = this.buildSuccessBody(
      action,
      readOnly,
      context,
      await execute(),
    );
    if (idempotencyKey) {
      await this.idempotencyService.store(
        action,
        context.userId,
        idempotencyKey,
        input,
        successStatus,
        response,
      );
    }
    this.persistActionAudit(context, {
      action,
      readOnly,
      status: successStatus,
      outcome: "success",
    });
    return {
      status: successStatus,
      body: response,
    };
  }

  private success(
    action: AgentActionName,
    readOnly: boolean,
    context: AgentExecutionContext,
    status: number,
    data: Record<string, unknown>,
  ): AgentExecutionResult {
    this.persistActionAudit(context, {
      action,
      readOnly,
      status,
      outcome: "success",
    });
    return {
      status,
      body: this.buildSuccessBody(action, readOnly, context, data),
    };
  }

  private buildSuccessBody(
    action: AgentActionName,
    readOnly: boolean,
    context: AgentExecutionContext,
    data: Record<string, unknown>,
  ): AgentSuccessEnvelope {
    return {
      ok: true,
      action,
      readOnly,
      data,
      trace: buildTrace(context),
    };
  }

  private failure(
    action: AgentActionName,
    readOnly: boolean,
    context: AgentExecutionContext,
    error: unknown,
  ): AgentExecutionResult {
    const payload = toAgentError(error);
    this.persistActionAudit(context, {
      action,
      readOnly,
      status: payload.status,
      outcome: "error",
      errorCode: payload.error.code,
    });

    if (payload.status >= 500) {
      console.error(error);
    }

    return {
      status: payload.status,
      body: {
        ok: false,
        action,
        readOnly,
        error: payload.error,
        trace: buildTrace(context),
      },
    };
  }

  // ── Shared plan scoring helper (#335) ───────────────────────────────────────
  private scorePlan(
    allTasks: import("../types").Todo[],
    forDate: string,
    budgetMin: number,
    energy?: string,
    modeModifiers?: import("../services/dayContextService").ModeModifiers,
    weights?: {
      plannerWeightPriority?: number;
      plannerWeightDueDate?: number;
      plannerWeightEnergyMatch?: number;
      plannerWeightEstimateFit?: number;
      plannerWeightFreshness?: number;
    },
    feedbackAdjustments?: Map<string, number>,
    goalIndex?: Map<string, { targetDate: Date | null }>,
    projectGoalMap?: Map<string, string>,
    insightBoosts?: { streakBoost: number; staleBoost: number },
    soulModifiers?: {
      statusBoosts?: Record<string, number>;
      priorityBoosts?: Record<string, number>;
      effortBoosts?: { maxEffort: number; boost: number };
      budgetMultiplier?: number;
      maxTaskCount?: number;
    },
  ): {
    selected: Array<{
      task: import("../types").Todo;
      score: number;
      effort: number;
      scoreBreakdown: Record<string, number>;
      whyIncluded: string;
    }>;
    excluded: Array<{
      task: import("../types").Todo;
      score: number;
      effort: number;
      whyExcluded: string;
    }>;
    usedMinutes: number;
    budgetBreakdown: {
      totalBudget: number;
      scheduled: number;
      remaining: number;
      taskCount: number;
    };
  } {
    const PRIORITY_SCORE: Record<string, number> = {
      urgent: 40,
      high: 20,
      medium: 10,
      low: 0,
    };

    const wPriority = weights?.plannerWeightPriority ?? 1.0;
    const wDueDate = weights?.plannerWeightDueDate ?? 1.0;
    const wEnergyMatch = weights?.plannerWeightEnergyMatch ?? 1.0;
    const wEstimateFit = weights?.plannerWeightEstimateFit ?? 1.0;
    const wFreshness = weights?.plannerWeightFreshness ?? 1.0;

    const scored = allTasks.map((t) => {
      const breakdown: Record<string, number> = {};
      const rawPriority = PRIORITY_SCORE[t.priority ?? "medium"] ?? 10;
      const weightedPriority = Math.round(rawPriority * wPriority);
      let score = weightedPriority;
      breakdown.priority = weightedPriority;

      if (t.doDate) {
        const d =
          t.doDate instanceof Date
            ? t.doDate.toISOString().slice(0, 10)
            : String(t.doDate).slice(0, 10);
        if (d < forDate) {
          score += 50;
          breakdown.doDateBoost = 50;
        } else if (d === forDate) {
          score += 30;
          breakdown.doDateBoost = 30;
        }
      }
      if (t.dueDate) {
        const d =
          t.dueDate instanceof Date
            ? t.dueDate.toISOString().slice(0, 10)
            : String(t.dueDate).slice(0, 10);
        const rawDueDateBoost = d < forDate ? 40 : d === forDate ? 20 : 0;
        if (rawDueDateBoost > 0) {
          const weightedDueDateBoost = Math.round(rawDueDateBoost * wDueDate);
          score += weightedDueDateBoost;
          breakdown.dueDateBoost = weightedDueDateBoost;
        }
      }
      const effort = t.effortScore ?? 30;
      if (energy === "low" && effort > 60) {
        const penalty = Math.round(20 * wEnergyMatch);
        score -= penalty;
        breakdown.energyPenalty = -penalty;
      }
      if (energy === "high" && effort < 15) {
        const penalty = Math.round(5 * wEnergyMatch);
        score -= penalty;
        breakdown.energyPenalty = -penalty;
      }

      // Mode-based boosts (#336)
      if (modeModifiers) {
        const { scoreBoosts } = modeModifiers;
        if (scoreBoosts.shortTask && effort <= 20) {
          score += scoreBoosts.shortTask;
          breakdown.modeBoost =
            (breakdown.modeBoost ?? 0) + scoreBoosts.shortTask;
        }
        if (scoreBoosts.adminTask && !t.projectId) {
          score += scoreBoosts.adminTask;
          breakdown.modeBoost =
            (breakdown.modeBoost ?? 0) + scoreBoosts.adminTask;
        }
        if (scoreBoosts.projectTask && t.projectId) {
          score += scoreBoosts.projectTask;
          breakdown.modeBoost =
            (breakdown.modeBoost ?? 0) + scoreBoosts.projectTask;
        }
        if (scoreBoosts.waitingTask && t.status === "waiting") {
          score += scoreBoosts.waitingTask;
          breakdown.modeBoost =
            (breakdown.modeBoost ?? 0) + scoreBoosts.waitingTask;
        }
      }

      // Feedback adjustment from accepted/ignored history
      const fbAdj = feedbackAdjustments?.get(t.id) ?? 0;
      if (fbAdj !== 0) {
        score += fbAdj;
        breakdown.feedbackAdjustment = fbAdj;
      }

      // Goal alignment boost
      const taskGoalId =
        (t as any).goalId ||
        (t.projectId ? projectGoalMap?.get(t.projectId) : undefined);
      if (taskGoalId && goalIndex?.has(taskGoalId)) {
        const goal = goalIndex.get(taskGoalId)!;
        const directGoal = !!(t as any).goalId;
        const baseBoost = directGoal ? 12 : 9;
        score += baseBoost;
        breakdown.goalAlignment = baseBoost;
        if (goal.targetDate) {
          const daysToGoal =
            (goal.targetDate.getTime() - Date.now()) / 86_400_000;
          if (daysToGoal >= 0 && daysToGoal <= 14) {
            const urgencyBoost = directGoal ? 8 : 6;
            score += urgencyBoost;
            breakdown.goalAlignment += urgencyBoost;
          }
        }
      }

      // Insight-driven boosts (streak momentum, stale nudge)
      if (insightBoosts) {
        if (insightBoosts.streakBoost && t.status === "in_progress") {
          score += insightBoosts.streakBoost;
          breakdown.insightBoost =
            (breakdown.insightBoost ?? 0) + insightBoosts.streakBoost;
        }
        if (insightBoosts.staleBoost && t.updatedAt) {
          const updMs =
            t.updatedAt instanceof Date
              ? t.updatedAt.getTime()
              : new Date(String(t.updatedAt)).getTime();
          if ((Date.now() - updMs) / 86_400_000 > 7) {
            score += insightBoosts.staleBoost;
            breakdown.insightBoost =
              (breakdown.insightBoost ?? 0) + insightBoosts.staleBoost;
          }
        }
      }

      // Soul profile modifiers
      if (soulModifiers) {
        const statusKey = t.status ?? "";
        if (soulModifiers.statusBoosts?.[statusKey]) {
          const boost = soulModifiers.statusBoosts[statusKey];
          score += boost;
          breakdown.soulBoost = (breakdown.soulBoost ?? 0) + boost;
        }
        const prioKey = t.priority ?? "medium";
        if (soulModifiers.priorityBoosts?.[prioKey]) {
          const boost = soulModifiers.priorityBoosts[prioKey];
          score += boost;
          breakdown.soulBoost = (breakdown.soulBoost ?? 0) + boost;
        }
        if (
          soulModifiers.effortBoosts &&
          effort <= soulModifiers.effortBoosts.maxEffort
        ) {
          score += soulModifiers.effortBoosts.boost;
          breakdown.soulBoost =
            (breakdown.soulBoost ?? 0) + soulModifiers.effortBoosts.boost;
        }
      }

      // Estimate fit: score against total budget proportions
      if (budgetMin > 0) {
        if (effort <= budgetMin * 0.25) {
          const boost = Math.round(8 * wEstimateFit);
          score += boost;
          breakdown.estimateFit = boost;
        } else if (effort > budgetMin * 0.6) {
          const penalty = Math.round(12 * wEstimateFit);
          score -= penalty;
          breakdown.estimateFit = -penalty;
        }
      }

      // Freshness: recently touched tasks get a boost, stale ones get penalized
      if (t.updatedAt) {
        const updatedMs =
          t.updatedAt instanceof Date
            ? t.updatedAt.getTime()
            : new Date(String(t.updatedAt)).getTime();
        const daysSinceUpdate = (Date.now() - updatedMs) / 86_400_000;
        if (daysSinceUpdate < 2) {
          const boost = Math.round(10 * wFreshness);
          score += boost;
          breakdown.freshness = boost;
        } else if (daysSinceUpdate > 14) {
          const penalty = Math.round(10 * wFreshness);
          score -= penalty;
          breakdown.freshness = -penalty;
        }
      }

      return { task: t, score, effort, scoreBreakdown: breakdown };
    });

    scored.sort((a, b) => b.score - a.score);

    const selected: (typeof scored)[number][] = [];
    const excludedBudget: (typeof scored)[number][] = [];
    let usedMinutes = 0;

    for (const item of scored) {
      if (usedMinutes + item.effort <= budgetMin) {
        selected.push(item);
        usedMinutes += item.effort;
      } else {
        excludedBudget.push(item);
      }
    }

    const selectedIds = new Set(selected.map((s) => s.task.id));

    return {
      selected: selected.map((s) => ({
        ...s,
        whyIncluded: this.buildInclusionReason(
          s.scoreBreakdown,
          s.effort,
          s.task.priority,
        ),
      })),
      excluded: excludedBudget.slice(0, 5).map((s) => ({
        task: s.task,
        score: s.score,
        effort: s.effort,
        whyExcluded: selectedIds.has(s.task.id)
          ? "low_score"
          : energy && s.scoreBreakdown.energyPenalty !== undefined
            ? "energy_mismatch"
            : "budget_exceeded",
      })),
      usedMinutes,
      budgetBreakdown: {
        totalBudget: budgetMin,
        scheduled: usedMinutes,
        remaining: budgetMin - usedMinutes,
        taskCount: selected.length,
      },
    };
  }

  private buildInclusionReason(
    breakdown: Record<string, number>,
    effort: number,
    priority?: string | null,
  ): string {
    const parts: string[] = [];
    if (priority === "urgent") parts.push("urgent priority");
    else if (priority === "high") parts.push("high priority");
    if (breakdown.doDateBoost === 50) parts.push("scheduled date is overdue");
    else if (breakdown.doDateBoost === 30) parts.push("scheduled for today");
    if (breakdown.dueDateBoost === 40) parts.push("due date is overdue");
    else if (breakdown.dueDateBoost === 20) parts.push("due today");
    if (effort <= 15) parts.push(`quick win (${effort} min)`);
    else if (effort <= 30) parts.push(`fits ${effort}-min slot`);
    if (parts.length === 0) parts.push("ranked within time budget");
    return parts.join(", ");
  }
}
