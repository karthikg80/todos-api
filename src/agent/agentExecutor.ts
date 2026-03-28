import { mapError } from "../errorHandling";
import { getActionHandler } from "../domains/agent/actions/actionRegistry";
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
import * as chrono from "chrono-node";
import { DryRunResult } from "../types";
import { AiPlannerService } from "../services/aiService";
import type { IAiSuggestionStore } from "../services/aiSuggestionStore";
import { analyzeTaskQuality } from "../ai/taskQualityAnalyzer";
import { findDuplicates } from "../ai/duplicateDetector";
import {
  validateAgentAddSubtaskInput,
  validateAgentAnalyzeProjectHealthInput,
  validateAgentAnalyzeWorkGraphInput,
  validateAgentArchiveProjectInput,
  validateAgentArchiveTaskInput,
  validateAgentCompleteTaskInput,
  validateAgentCreateProjectInput,
  validateAgentCreateTaskInput,
  validateAgentDecideNextWorkInput,
  validateAgentDeleteSubtaskInput,
  validateAgentDeleteTaskInput,
  validateAgentDeleteProjectInput,
  validateAgentGetProjectInput,
  validateAgentGetTaskInput,
  validateAgentListNextActionsInput,
  validateAgentListProjectsInput,
  validateAgentListProjectsWithoutNextActionInput,
  validateAgentListTasksInput,
  validateAgentListStaleTasksInput,
  validateAgentListTodayInput,
  validateAgentListUpcomingInput,
  validateAgentListWaitingOnInput,
  validateAgentMoveTaskToProjectInput,
  validateAgentPlanProjectInput,
  validateAgentRenameProjectInput,
  validateAgentReviewProjectsInput,
  validateAgentSearchTasksInput,
  validateAgentEnsureNextActionInput,
  validateAgentUpdateSubtaskInput,
  validateAgentUpdateProjectInput,
  validateAgentUpdateTaskInput,
  validateAgentWeeklyReviewInput,
  validateAgentAnalyzeTaskQualityInput,
  validateAgentFindDuplicateTasksInput,
  validateAgentFindStaleItemsInput,
  validateAgentTaxonomyCleanupInput,
  validateAgentPlanTodayInput,
  validateAgentBreakDownTaskInput,
  validateAgentSuggestNextActionsInput,
  validateAgentWeeklyReviewSummaryInput,
  validateAgentTriageCaptureItemInput,
  validateAgentTriageInboxInput,
  validateAgentListAuditLogInput,
  validateAgentGetAvailabilityWindowsInput,
  validateAgentWeeklyReviewWithSafeInput,
  validateAgentCreateFollowUpInput,
  validateAgentClaimJobRunInput,
  validateAgentCompleteJobRunInput,
  validateAgentFailJobRunInput,
  validateAgentGetJobRunInput,
  validateAgentListJobRunsInput,
  validateAgentListAuditLogExtendedInput,
  validateAgentListFailedActionsInput,
  validateAgentResolveFailedActionInput,
  validateAgentRecordFailedActionInput,
  validateAgentGetAgentConfigInput,
  validateAgentUpdateAgentConfigInput,
  validateAgentReplayJobRunInput,
  validateAgentSimulatePlanInput,
  validateAgentRecordMetricInput,
  validateAgentListMetricsInput,
  validateAgentMetricsSummaryInput,
  validateAgentRecordFeedbackInput,
  validateAgentListFeedbackInput,
  validateAgentFeedbackSummaryInput,
  validateAgentSetDayContextInput,
  validateAgentGetDayContextInput,
  validateAgentWeeklyExecSummaryInput,
  validateAgentCaptureInboxItemInput,
  validateAgentListInboxItemsInput,
  validateAgentPromoteInboxItemInput,
  validateAgentSuggestCaptureRouteInput,
  validateAgentEvaluateDailyInput,
  validateAgentEvaluateWeeklyInput,
  validateAgentRecordLearningRecInput,
  validateAgentListLearningRecsInput,
  validateAgentApplyLearningRecInput,
  validateAgentListFrictionPatternsInput,
  validateAgentGetActionPoliciesInput,
  validateAgentUpdateActionPolicyInput,
  validateAgentPrewarmHomeFocusInput,
} from "../validation/agentValidation";
import { CaptureService } from "../services/captureService";
import { HomeFocusPrewarmService } from "../services/homeFocusPrewarmService";

export type AgentActionName =
  | "list_tasks"
  | "search_tasks"
  | "get_task"
  | "get_project"
  | "create_task"
  | "update_task"
  | "complete_task"
  | "archive_task"
  | "delete_task"
  | "add_subtask"
  | "update_subtask"
  | "delete_subtask"
  | "list_projects"
  | "create_project"
  | "update_project"
  | "rename_project"
  | "delete_project"
  | "move_task_to_project"
  | "archive_project"
  | "list_today"
  | "list_next_actions"
  | "list_waiting_on"
  | "list_upcoming"
  | "list_stale_tasks"
  | "list_projects_without_next_action"
  | "review_projects"
  | "plan_project"
  | "ensure_next_action"
  | "weekly_review"
  | "decide_next_work"
  | "analyze_project_health"
  | "analyze_work_graph"
  | "analyze_task_quality"
  | "find_duplicate_tasks"
  | "find_stale_items"
  | "taxonomy_cleanup_suggestions"
  | "plan_today"
  | "break_down_task"
  | "suggest_next_actions"
  | "weekly_review_summary"
  | "triage_capture_item"
  | "triage_inbox"
  | "list_audit_log"
  | "get_availability_windows"
  | "create_follow_up_for_waiting_task"
  | "claim_job_run"
  | "complete_job_run"
  | "fail_job_run"
  | "get_job_run_status"
  | "list_job_runs"
  | "list_failed_actions"
  | "record_failed_action"
  | "resolve_failed_action"
  | "get_agent_config"
  | "update_agent_config"
  | "replay_job_run"
  | "simulate_plan"
  | "record_metric"
  | "list_metrics"
  | "metrics_summary"
  | "record_recommendation_feedback"
  | "list_recommendation_feedback"
  | "feedback_summary"
  | "set_day_context"
  | "get_day_context"
  | "weekly_executive_summary"
  | "capture_inbox_item"
  | "list_inbox_items"
  | "suggest_capture_route"
  | "promote_inbox_item"
  | "evaluate_daily_plan"
  | "evaluate_weekly_system"
  | "record_learning_recommendation"
  | "list_learning_recommendations"
  | "apply_learning_recommendation"
  | "list_friction_patterns"
  | "get_action_policies"
  | "update_action_policy"
  | "prewarm_home_focus"
  | "send_task_reminder"
  | "run_data_retention"
  | "list_areas"
  | "get_area"
  | "create_area"
  | "update_area"
  | "list_goals"
  | "get_goal"
  | "create_goal"
  | "update_goal"
  | "list_routines"
  | "generate_morning_brief"
  | "project_health_intervention";

interface AgentExecutorDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
  persistencePrisma?: PrismaClient;
  aiPlannerService?: AiPlannerService;
  suggestionStore?: IAiSuggestionStore;
}

export interface AgentExecutionContext {
  userId: string;
  requestId: string;
  actor: string;
  surface: "agent" | "mcp";
  idempotencyKey?: string;
}

export type AgentSuccessEnvelope = {
  ok: true;
  action: AgentActionName | "manifest";
  readOnly: boolean;
  data: Record<string, unknown>;
  trace: Record<string, unknown>;
};

export type AgentErrorEnvelope = {
  ok: false;
  action: AgentActionName;
  readOnly: boolean;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    hint?: string;
    details?: Record<string, unknown>;
  };
  trace: Record<string, unknown>;
};

export type AgentExecutionResult = {
  status: number;
  body: AgentSuccessEnvelope | AgentErrorEnvelope;
};

class AgentExecutionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly hint?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AgentExecutionError";
  }
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
  "list_routines",
]);

const IDEMPOTENT_PLANNER_APPLY_ACTIONS = new Set<AgentActionName>([
  "plan_project",
  "ensure_next_action",
  "weekly_review",
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

const ACTION_VERB_RE =
  /^(buy|call|send|write|read|review|schedule|book|fix|update|check|draft|prepare|submit|complete|finish|create|build|test|deploy|refactor|add|remove|delete|merge|close|open|contact|email|research|investigate|plan|organize|clean|sort|discuss|confirm|follow|set|get|make|find|move|copy|install|configure|document|upload|download|publish|cancel|archive|approve|reject|invite|register|verify|report|analyze|design|implement|request|order|pay|sign|file|print|record|backup|restore|monitor|notify|present|remind|track|coordinate|attend|join)\b/i;

function triageCaptureText(text: string): {
  kind: "create_task" | "discard" | "convert_to_note";
  confidence: number;
  why: string;
  proposedAction: { title: string; status: string } | null;
} {
  const trimmed = text.trim();
  // URL / reference — check before word count
  if (/^https?:\/\//.test(trimmed)) {
    return {
      kind: "convert_to_note",
      confidence: 0.8,
      why: "Looks like a URL reference, better stored as a note",
      proposedAction: {
        title: `Review: ${trimmed.slice(0, 60)}`,
        status: "inbox",
      },
    };
  }
  // Very short, no verb → discard candidate
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 3 && !ACTION_VERB_RE.test(trimmed)) {
    return {
      kind: "discard",
      confidence: 0.6,
      why: "Very short text with no action verb — likely noise or incomplete thought",
      proposedAction: null,
    };
  }
  // Starts with action verb → create task
  if (ACTION_VERB_RE.test(trimmed)) {
    return {
      kind: "create_task",
      confidence: 0.85,
      why: "Starts with a clear action verb — actionable task",
      proposedAction: { title: trimmed, status: "inbox" },
    };
  }
  // Ambiguous — suggest as task but lower confidence
  return {
    kind: "create_task",
    confidence: 0.5,
    why: "No clear action verb but text may be actionable — review before adding",
    proposedAction: { title: trimmed, status: "inbox" },
  };
}

function removeMatchedDatePhrase(
  text: string,
  matchText: string,
  index: number,
): string {
  const rawText = String(text || "");
  const start = Math.max(0, index);
  const end = Math.min(rawText.length, start + String(matchText || "").length);
  if (start >= end) {
    return rawText.trim();
  }
  return `${rawText.slice(0, start)} ${rawText.slice(end)}`
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function suggestCaptureRoute(input: {
  text: string;
  project?: string;
  workspaceView?: string;
}): {
  route: "task" | "triage";
  confidence: number;
  why: string;
  cleanedTitle: string;
  extractedFields: {
    dueDate?: string;
    project?: string;
    priority?: "low" | "medium" | "high" | "urgent";
  };
} {
  const trimmed = input.text.trim();
  const project = String(input.project || "").trim();
  const workspaceView = String(input.workspaceView || "").trim();
  const chronoResults = chrono.parse(trimmed, new Date(), {
    forwardDate: true,
  });
  const chronoMatch = chronoResults.find((entry) => {
    const textValue = String(entry?.text || "").trim();
    return textValue.length >= 2 && /[a-zA-Z]|\/|:/.test(textValue);
  });
  const dueDate = chronoMatch?.start?.date?.();
  const hasDueDate =
    dueDate instanceof Date &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() >= Date.now() - 60_000;
  const cleanedTitle =
    chronoMatch && hasDueDate
      ? removeMatchedDatePhrase(
          trimmed,
          String(chronoMatch.text || ""),
          Number(chronoMatch.index) || 0,
        ) || trimmed
      : trimmed;
  const multiline = /\n/.test(trimmed);
  const looksReference =
    /^https?:\/\//.test(trimmed) ||
    /\b(reference|note|notes|idea|someday|bookmark)\b/i.test(trimmed);
  const actionVerb = ACTION_VERB_RE.test(trimmed);

  if (project) {
    return {
      route: "task",
      confidence: 0.94,
      why: "You are already inside a project, so this is likely ready to become a task.",
      cleanedTitle,
      extractedFields: {
        ...(hasDueDate ? { dueDate: dueDate.toISOString() } : {}),
        project,
      },
    };
  }

  if (actionVerb || hasDueDate) {
    return {
      route: "task",
      confidence: hasDueDate ? 0.88 : 0.84,
      why: hasDueDate
        ? "The text includes a concrete date, which usually indicates a ready-to-create task."
        : "The text starts with a clear action, which usually indicates a ready-to-create task.",
      cleanedTitle,
      extractedFields: {
        ...(hasDueDate ? { dueDate: dueDate.toISOString() } : {}),
      },
    };
  }

  if (multiline || looksReference || trimmed.length > 140) {
    return {
      route: "triage",
      confidence: multiline ? 0.82 : 0.74,
      why: multiline
        ? "This looks like a rough capture with multiple ideas and is better reviewed in triage."
        : "This looks more like reference material or a rough note than a ready task.",
      cleanedTitle,
      extractedFields: {},
    };
  }

  if (workspaceView === "triage") {
    return {
      route: "triage",
      confidence: 0.62,
      why: "You are already triaging work, so saving this for review is the safer default.",
      cleanedTitle,
      extractedFields: {},
    };
  }

  return {
    route: "triage",
    confidence: 0.52,
    why: "The text is still ambiguous, so triage is the safer default until it is clarified.",
    cleanedTitle,
    extractedFields: {},
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
    this.agentService = new AgentService({
      todoService: deps.todoService,
      projectService: deps.projectService,
    });
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

    // Check the action registry first — registered handlers take priority
    // over the inline switch/case. This enables incremental extraction.
    const registeredHandler = getActionHandler(action);
    if (registeredHandler) {
      try {
        const result = await registeredHandler(
          (input as Record<string, unknown>) ?? {},
          context,
        );
        return result as AgentExecutionResult;
      } catch (error) {
        return this.failure(action, readOnly, context, error);
      }
    }

    try {
      switch (action) {
        case "list_tasks": {
          const query = validateAgentListTasksInput(input);
          const tasks = await this.agentService.listTasks(
            context.userId,
            query,
          );
          return this.success(action, readOnly, context, 200, { tasks });
        }
        case "search_tasks": {
          const query = validateAgentSearchTasksInput(input);
          const tasks = await this.agentService.searchTasks(
            context.userId,
            query,
          );
          return this.success(action, readOnly, context, 200, { tasks });
        }
        case "get_task": {
          const { id } = validateAgentGetTaskInput(input);
          const task = await this.agentService.getTask(context.userId, id);
          if (!task) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task not found",
              false,
              "Verify the task ID belongs to the authenticated user.",
            );
          }
          return this.success(action, readOnly, context, 200, { task });
        }
        case "get_project": {
          const { id } = validateAgentGetProjectInput(input);
          const project = await this.agentService.getProject(
            context.userId,
            id,
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
          return this.success(action, readOnly, context, 200, { project });
        }
        case "create_task": {
          const createInput = validateAgentCreateTaskInput(input);
          if (createInput.dryRun === true) {
            const rawInput = (input as Record<string, unknown>) ?? {};
            const dryRunResult = this.buildDryRunResult(
              "create_task",
              rawInput,
            );
            return this.success(
              action,
              readOnly,
              context,
              200,
              dryRunResult as unknown as Record<string, unknown>,
            );
          }
          const { dryRun: _createDryRun, ...createFields } = createInput;
          return await this.handleCreateTask(action, context, createFields);
        }
        case "update_task": {
          const {
            id,
            changes,
            dryRun: updateDryRun,
          } = validateAgentUpdateTaskInput(input);
          if (updateDryRun === true) {
            const rawInput = (input as Record<string, unknown>) ?? {};
            const dryRunResult = this.buildDryRunResult("update_task", {
              ...rawInput,
              id,
            });
            return this.success(
              action,
              readOnly,
              context,
              200,
              dryRunResult as unknown as Record<string, unknown>,
            );
          }
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const task = await this.agentService.updateTask(
                context.userId,
                id,
                changes,
              );
              if (!task) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task not found",
                  false,
                  "Verify the task ID belongs to the authenticated user.",
                );
              }
              return { task };
            },
          );
        }
        case "complete_task": {
          const { id, completed } = validateAgentCompleteTaskInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const task = await this.agentService.completeTask(
                context.userId,
                id,
                completed,
              );
              if (!task) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task not found",
                  false,
                  "Verify the task ID belongs to the authenticated user.",
                );
              }
              return { task };
            },
          );
        }
        case "archive_task": {
          const { id, archived } = validateAgentArchiveTaskInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const task = await this.agentService.archiveTask(
                context.userId,
                id,
                archived,
              );
              if (!task) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task not found",
                  false,
                  "Verify the task ID belongs to the authenticated user.",
                );
              }
              return { task };
            },
          );
        }
        case "delete_task": {
          const { id, hardDelete } = validateAgentDeleteTaskInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const result = await this.agentService.deleteTask(
                context.userId,
                id,
                hardDelete,
              );
              if (!result) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task not found",
                  false,
                  "Verify the task ID belongs to the authenticated user.",
                );
              }
              return {
                deleted: hardDelete === true,
                archived: hardDelete === true ? false : true,
                task: typeof result === "boolean" ? null : result,
                taskId: id,
              };
            },
          );
        }
        case "add_subtask": {
          const { taskId, changes } = validateAgentAddSubtaskInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const subtask = await this.agentService.addSubtask(
                context.userId,
                taskId,
                changes,
              );
              if (!subtask) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task not found",
                  false,
                  "Verify the parent task ID belongs to the authenticated user.",
                );
              }
              return { subtask };
            },
            201,
          );
        }
        case "update_subtask": {
          const { taskId, subtaskId, changes } =
            validateAgentUpdateSubtaskInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const subtask = await this.agentService.updateSubtask(
                context.userId,
                taskId,
                subtaskId,
                changes,
              );
              if (!subtask) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task or subtask not found",
                  false,
                  "Verify the task ID and subtask ID belong to the authenticated user.",
                );
              }
              return { subtask };
            },
          );
        }
        case "delete_subtask": {
          const { taskId, subtaskId } = validateAgentDeleteSubtaskInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const deleted = await this.agentService.deleteSubtask(
                context.userId,
                taskId,
                subtaskId,
              );
              if (!deleted) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task or subtask not found",
                  false,
                  "Verify the task ID and subtask ID belong to the authenticated user.",
                );
              }
              return { deleted: true, taskId, subtaskId };
            },
          );
        }
        case "list_projects": {
          const filters = validateAgentListProjectsInput(input);
          const projects = await this.agentService.listProjects(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, { projects });
        }
        case "create_project": {
          const createInput = validateAgentCreateProjectInput(input);
          return await this.handleCreateProject(action, context, createInput);
        }
        case "update_project": {
          const { id, changes } = validateAgentUpdateProjectInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const project = await this.agentService.updateProject(
                context.userId,
                id,
                changes,
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
              return { project };
            },
          );
        }
        case "rename_project": {
          const { id, name } = validateAgentRenameProjectInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const project = await this.agentService.renameProject(
                context.userId,
                id,
                name,
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
              return { project };
            },
          );
        }
        case "delete_project": {
          const { id, moveTasksToProjectId, archiveInstead } =
            validateAgentDeleteProjectInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              if (archiveInstead) {
                const project = await this.agentService.archiveProject(
                  context.userId,
                  id,
                  true,
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
                return { deleted: false, archived: true, project };
              }
              const deleted = await this.agentService.deleteProject(
                context.userId,
                id,
                moveTasksToProjectId,
              );
              if (!deleted) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Project not found",
                  false,
                  "Verify the source and target project IDs belong to the authenticated user.",
                );
              }
              return {
                deleted: true,
                projectId: id,
                movedTasksToProjectId: moveTasksToProjectId,
                taskDisposition: moveTasksToProjectId
                  ? "reassigned"
                  : "unassigned",
              };
            },
          );
        }
        case "move_task_to_project": {
          const { taskId, projectId } =
            validateAgentMoveTaskToProjectInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const task = await this.agentService.moveTaskToProject(
                context.userId,
                taskId,
                projectId,
              );
              if (!task) {
                throw new AgentExecutionError(
                  404,
                  "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                  "Task or project not found",
                  false,
                  "Verify the task ID and target project ID belong to the authenticated user.",
                );
              }
              return { task };
            },
          );
        }
        case "archive_project": {
          const { id, archived } = validateAgentArchiveProjectInput(input);
          return await this.handleIdempotentWriteAction(
            action,
            context,
            input,
            async () => {
              const project = await this.agentService.archiveProject(
                context.userId,
                id,
                archived,
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
              return { project };
            },
          );
        }
        case "list_today": {
          const filters = validateAgentListTodayInput(input);
          const tasks = await this.agentService.listToday(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, { tasks });
        }
        case "list_next_actions": {
          const filters = validateAgentListNextActionsInput(input);
          const tasks = await this.agentService.listNextActions(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, { tasks });
        }
        case "list_waiting_on": {
          const filters = validateAgentListWaitingOnInput(input);
          const tasks = await this.agentService.listWaitingOn(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, { tasks });
        }
        case "list_upcoming": {
          const filters = validateAgentListUpcomingInput(input);
          const tasks = await this.agentService.listUpcoming(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, { tasks });
        }
        case "list_stale_tasks": {
          const filters = validateAgentListStaleTasksInput(input);
          const tasks = await this.agentService.listStaleTasks(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, { tasks });
        }
        case "list_projects_without_next_action": {
          const filters =
            validateAgentListProjectsWithoutNextActionInput(input);
          const projects =
            await this.agentService.listProjectsWithoutNextAction(
              context.userId,
              filters,
            );
          return this.success(action, readOnly, context, 200, { projects });
        }
        case "review_projects": {
          const filters = validateAgentReviewProjectsInput(input);
          const projects = await this.agentService.reviewProjects(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, { projects });
        }
        case "plan_project": {
          const plannerInput = validateAgentPlanProjectInput(input);
          const executePlanProject = async () => {
            const plan = await this.agentService.planProjectForUser(
              context.userId,
              plannerInput,
            );
            if (!plan) {
              throw new AgentExecutionError(
                404,
                "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                "Project not found",
                false,
                "Verify the project ID belongs to the authenticated user.",
              );
            }
            return { plan };
          };
          if (
            IDEMPOTENT_PLANNER_APPLY_ACTIONS.has(action) &&
            plannerInput.mode === "apply"
          ) {
            return await this.handleIdempotentWriteAction(
              action,
              context,
              plannerInput,
              executePlanProject,
            );
          }
          return this.success(
            action,
            readOnly,
            context,
            200,
            await executePlanProject(),
          );
        }
        case "ensure_next_action": {
          const plannerInput = validateAgentEnsureNextActionInput(input);
          const enaPolicies = await this.actionPolicyService.getPolicies(
            context.userId,
          );
          const enaActionMeta = this.actionPolicyService.buildActionMeta(
            "ensure_next_action",
            enaPolicies,
          );
          const executeEnsureNextAction = async () => {
            const result = await this.agentService.ensureNextActionForUser(
              context.userId,
              plannerInput,
            );
            if (!result) {
              throw new AgentExecutionError(
                404,
                "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                "Project not found",
                false,
                "Verify the project ID belongs to the authenticated user.",
              );
            }
            return { result, actionMeta: enaActionMeta };
          };
          if (
            IDEMPOTENT_PLANNER_APPLY_ACTIONS.has(action) &&
            plannerInput.mode === "apply"
          ) {
            return await this.handleIdempotentWriteAction(
              action,
              context,
              plannerInput,
              executeEnsureNextAction,
            );
          }
          return this.success(
            action,
            readOnly,
            context,
            200,
            await executeEnsureNextAction(),
          );
        }
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

          return this.success(action, readOnly, context, 200, {
            plan: {
              date: today,
              timezone: null,
              mode: dayCtx?.mode ?? "normal",
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
        case "triage_capture_item": {
          const { captureItemId, mode } =
            validateAgentTriageCaptureItemInput(input);
          if (!this.deps.persistencePrisma) {
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Persistence layer not available",
              false,
            );
          }
          const item = await this.deps.persistencePrisma.captureItem.findFirst({
            where: { id: captureItemId, userId: context.userId },
          });
          if (!item) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Capture item not found",
              false,
              "Verify the capture item ID belongs to the authenticated user.",
            );
          }
          const recommendation = triageCaptureText(item.text);
          let applied = false;
          if (mode === "apply") {
            await this.deps.persistencePrisma.captureItem.updateMany({
              where: { id: captureItemId, userId: context.userId },
              data: {
                lifecycle: "triaged",
                triageResult:
                  recommendation as unknown as import("@prisma/client").Prisma.JsonObject,
              },
            });
            applied = true;
          }
          const triagePolicies = await this.actionPolicyService.getPolicies(
            context.userId,
          );
          return this.success(action, readOnly, context, 200, {
            captureItemId,
            recommendation,
            applied,
            actionMeta: this.actionPolicyService.buildActionMeta(
              "triage_capture_item",
              triagePolicies,
            ),
          });
        }
        case "triage_inbox": {
          const { limit, mode } = validateAgentTriageInboxInput(input);
          if (!this.deps.persistencePrisma) {
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Persistence layer not available",
              false,
            );
          }
          const items = await this.deps.persistencePrisma.captureItem.findMany({
            where: { userId: context.userId, lifecycle: "new" },
            orderBy: { capturedAt: "asc" },
            take: limit ?? 20,
          });
          const triaged = items.map((item) => ({
            captureItemId: item.id,
            recommendation: triageCaptureText(item.text),
          }));
          if (mode === "apply" && items.length > 0) {
            for (const item of items) {
              const rec = triaged.find((t) => t.captureItemId === item.id);
              await this.deps.persistencePrisma.captureItem.updateMany({
                where: { id: item.id, userId: context.userId },
                data: {
                  lifecycle: "triaged",
                  triageResult:
                    rec?.recommendation as unknown as import("@prisma/client").Prisma.JsonObject,
                },
              });
            }
          }
          return this.success(
            action,
            readOnly,
            context,
            mode === "apply" ? 200 : 200,
            {
              triaged,
              totalProcessed: items.length,
              mode: mode ?? "suggest",
            },
          );
        }
        case "capture_inbox_item": {
          const { text, source } = validateAgentCaptureInboxItemInput(input);
          if (!this.captureService) {
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Persistence layer not available",
              false,
            );
          }
          const captured = await this.captureService.create(
            context.userId,
            text,
            source,
          );
          return this.success(action, readOnly, context, 201, {
            item: captured,
          });
        }
        case "list_inbox_items": {
          const { lifecycle, source, limit, since } =
            validateAgentListInboxItemsInput(input);
          if (!this.captureService) {
            return this.success(action, readOnly, context, 200, { items: [] });
          }
          let items = await this.captureService.findAll(
            context.userId,
            lifecycle,
          );
          if (source) {
            items = items.filter((i) => i.source === source);
          }
          if (since) {
            const sinceDate = new Date(since);
            items = items.filter((i) => new Date(i.capturedAt) >= sinceDate);
          }
          if (limit) {
            items = items.slice(0, limit);
          }
          return this.success(action, readOnly, context, 200, {
            items,
            total: items.length,
          });
        }
        case "suggest_capture_route": {
          const suggestion = suggestCaptureRoute(
            validateAgentSuggestCaptureRouteInput(input),
          );
          return this.success(action, readOnly, context, 200, suggestion);
        }
        case "promote_inbox_item": {
          const {
            captureItemId,
            type,
            projectId,
            title: titleOverride,
          } = validateAgentPromoteInboxItemInput(input);
          if (!this.captureService || !this.deps.persistencePrisma) {
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Persistence layer not available",
              false,
            );
          }
          const captureItem = await this.captureService.findById(
            context.userId,
            captureItemId,
          );
          if (!captureItem) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Capture item not found",
              false,
              "Verify the capture item ID belongs to the authenticated user.",
            );
          }
          const derivedTitle = titleOverride ?? captureItem.text.slice(0, 200);
          let promoted: Record<string, unknown>;
          if (type === "task") {
            const task = await this.agentService.createTask(context.userId, {
              title: derivedTitle,
              status: "inbox",
              ...(projectId ? { projectId } : {}),
            });
            promoted = { type: "task", task };
          } else {
            if (!this.deps.projectService) {
              throw new AgentExecutionError(
                501,
                "NOT_CONFIGURED",
                "Project service not available",
                false,
              );
            }
            const project = await this.agentService.createProject(
              context.userId,
              { name: derivedTitle },
            );
            promoted = { type: "project", project };
          }
          await this.captureService.updateLifecycle(
            context.userId,
            captureItemId,
            "triaged",
            {
              promotedAs: type,
              promotedId: (promoted[type] as { id: string }).id,
            },
          );
          return this.success(action, readOnly, context, 201, promoted);
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
        case "list_areas": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Areas not configured",
              false,
            );
          const { AreaService } = await import("../services/areaService");
          const svc = new AreaService(this.deps.persistencePrisma);
          const areas = await svc.findAll(context.userId);
          return this.success(action, readOnly, context, 200, { areas });
        }
        case "get_area": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Areas not configured",
              false,
            );
          const { AreaService } = await import("../services/areaService");
          const svc = new AreaService(this.deps.persistencePrisma);
          const id = String((input as Record<string, unknown>).id ?? "");
          const area = await svc.findById(context.userId, id);
          if (!area)
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND",
              "Area not found",
              false,
            );
          return this.success(action, readOnly, context, 200, { area });
        }
        case "create_area": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Areas not configured",
              false,
            );
          const { AreaService } = await import("../services/areaService");
          const svc = new AreaService(this.deps.persistencePrisma);
          const inp = input as Record<string, unknown>;
          const area = await svc.create(context.userId, {
            name: String(inp.name ?? ""),
            description:
              inp.description != null ? String(inp.description) : null,
          });
          return this.success(action, readOnly, context, 201, { area });
        }
        case "update_area": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Areas not configured",
              false,
            );
          const { AreaService } = await import("../services/areaService");
          const svc = new AreaService(this.deps.persistencePrisma);
          const inp = input as Record<string, unknown>;
          const area = await svc.update(context.userId, String(inp.id ?? ""), {
            ...(inp.name !== undefined ? { name: String(inp.name) } : {}),
            ...(inp.description !== undefined
              ? {
                  description:
                    inp.description != null ? String(inp.description) : null,
                }
              : {}),
            ...(inp.archived !== undefined
              ? { archived: Boolean(inp.archived) }
              : {}),
          });
          if (!area)
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND",
              "Area not found",
              false,
            );
          return this.success(action, readOnly, context, 200, { area });
        }
        case "list_goals": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Goals not configured",
              false,
            );
          const { GoalService } = await import("../services/goalService");
          const svc = new GoalService(this.deps.persistencePrisma);
          const goals = await svc.findAll(context.userId);
          return this.success(action, readOnly, context, 200, { goals });
        }
        case "get_goal": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Goals not configured",
              false,
            );
          const { GoalService } = await import("../services/goalService");
          const svc = new GoalService(this.deps.persistencePrisma);
          const id = String((input as Record<string, unknown>).id ?? "");
          const goal = await svc.findById(context.userId, id);
          if (!goal)
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND",
              "Goal not found",
              false,
            );
          return this.success(action, readOnly, context, 200, { goal });
        }
        case "create_goal": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Goals not configured",
              false,
            );
          const { GoalService } = await import("../services/goalService");
          const svc = new GoalService(this.deps.persistencePrisma);
          const inp = input as Record<string, unknown>;
          const goal = await svc.create(context.userId, {
            name: String(inp.name ?? ""),
            description:
              inp.description != null ? String(inp.description) : null,
            targetDate: inp.targetDate != null ? String(inp.targetDate) : null,
          });
          return this.success(action, readOnly, context, 201, { goal });
        }
        case "update_goal": {
          if (!this.deps.persistencePrisma)
            throw new AgentExecutionError(
              501,
              "NOT_CONFIGURED",
              "Goals not configured",
              false,
            );
          const { GoalService } = await import("../services/goalService");
          const svc = new GoalService(this.deps.persistencePrisma);
          const inp = input as Record<string, unknown>;
          const goal = await svc.update(context.userId, String(inp.id ?? ""), {
            ...(inp.name !== undefined ? { name: String(inp.name) } : {}),
            ...(inp.description !== undefined
              ? {
                  description:
                    inp.description != null ? String(inp.description) : null,
                }
              : {}),
            ...(inp.targetDate !== undefined
              ? {
                  targetDate:
                    inp.targetDate != null ? String(inp.targetDate) : null,
                }
              : {}),
            ...(inp.archived !== undefined
              ? { archived: Boolean(inp.archived) }
              : {}),
          });
          if (!goal)
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND",
              "Goal not found",
              false,
            );
          return this.success(action, readOnly, context, 200, { goal });
        }

        // ── H3: Routines ───────────────────────────────────────────────────────
        case "list_routines": {
          const { detectRoutines } =
            await import("../services/routineDetectionService");
          const tasks = await this.agentService.listTasks(context.userId, {
            archived: false,
            limit: 500,
          });
          const routines = detectRoutines(tasks);
          return this.success(action, readOnly, context, 200, { routines });
        }

        // ── H3: Data retention ─────────────────────────────────────────────────
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
        case "claim_job_run": {
          const { jobName, periodKey } = validateAgentClaimJobRunInput(input);
          const { claimed, run } = await this.jobRunService.claimRun(
            context.userId,
            jobName,
            periodKey,
          );
          return this.success(action, readOnly, context, 200, {
            claimed,
            run,
          });
        }
        case "complete_job_run": {
          const { jobName, periodKey, metadata } =
            validateAgentCompleteJobRunInput(input);
          const completed = await this.jobRunService.completeRun(
            context.userId,
            jobName,
            periodKey,
            metadata,
          );
          if (!completed) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND",
              `No running job run found for jobName=${jobName} periodKey=${periodKey}`,
              false,
              "Ensure claim_job_run was called first for this job/period combination.",
            );
          }
          return this.success(action, readOnly, context, 200, {
            completed: true,
            jobName,
            periodKey,
          });
        }
        case "fail_job_run": {
          const { jobName, periodKey, errorMessage } =
            validateAgentFailJobRunInput(input);
          const failed = await this.jobRunService.failRun(
            context.userId,
            jobName,
            periodKey,
            errorMessage,
          );
          if (!failed) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND",
              `No running job run found for jobName=${jobName} periodKey=${periodKey}`,
              false,
              "Ensure claim_job_run was called first for this job/period combination.",
            );
          }
          return this.success(action, readOnly, context, 200, {
            failed: true,
            jobName,
            periodKey,
          });
        }
        case "get_job_run_status": {
          const { jobName, periodKey } = validateAgentGetJobRunInput(input);
          const run = await this.jobRunService.getRunStatus(
            context.userId,
            jobName,
            periodKey,
          );
          return this.success(action, readOnly, context, 200, { run });
        }
        case "list_job_runs": {
          const filters = validateAgentListJobRunsInput(input);
          const runs = await this.jobRunService.listRuns(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, {
            runs,
            total: runs.length,
          });
        }

        // ── Issue #320: dead-letter store ──────────────────────────────────────
        case "record_failed_action": {
          const recordInput = validateAgentRecordFailedActionInput(input);
          const record = await this.failedActionService.record({
            ...recordInput,
            userId: context.userId,
          });
          return this.success(action, readOnly, context, 201, {
            record,
          });
        }
        case "list_failed_actions": {
          const filters = validateAgentListFailedActionsInput(input);
          const actions = await this.failedActionService.list(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, {
            actions,
            total: actions.length,
          });
        }
        case "resolve_failed_action": {
          const { id, resolution } =
            validateAgentResolveFailedActionInput(input);
          const resolved = await this.failedActionService.resolve(
            context.userId,
            id,
            resolution,
          );
          if (!resolved) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Failed action not found or already resolved",
              false,
              "Verify the ID belongs to the authenticated user and the action is unresolved.",
            );
          }
          return this.success(action, readOnly, context, 200, {
            resolved: true,
            id,
            resolution,
          });
        }

        // ── Issue #329: agent control plane ───────────────────────────────────
        case "get_agent_config": {
          validateAgentGetAgentConfigInput(input);
          const config = await this.agentConfigService.getConfig(
            context.userId,
          );
          return this.success(action, readOnly, context, 200, { config });
        }
        case "update_agent_config": {
          const update = validateAgentUpdateAgentConfigInput(input);
          const config = await this.agentConfigService.updateConfig(
            context.userId,
            update,
          );
          return this.success(action, readOnly, context, 200, { config });
        }

        // ── Issue #330: replay_job_run ─────────────────────────────────────────
        case "replay_job_run": {
          const { jobName, periodKey } = validateAgentReplayJobRunInput(input);
          const result = await this.jobRunService.replayRun(
            context.userId,
            jobName,
            periodKey,
          );
          if (!result.replayed) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND",
              `No job run found for jobName=${jobName} periodKey=${periodKey}`,
              false,
              "Verify the job name and period key are correct.",
            );
          }
          return this.success(action, readOnly, context, 200, {
            replayed: true,
            run: result.run,
          });
        }

        // ── Issue #331: simulate_plan ──────────────────────────────────────────
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
        case "record_metric": {
          const metricInput = validateAgentRecordMetricInput(input);
          const event = await this.metricsService.record(
            context.userId,
            metricInput,
          );
          return this.success(action, readOnly, context, 201, { event });
        }
        case "list_metrics": {
          const filters = validateAgentListMetricsInput(input);
          const events = await this.metricsService.list(
            context.userId,
            filters,
          );
          return this.success(action, readOnly, context, 200, {
            events,
            total: events.length,
          });
        }
        case "metrics_summary": {
          const summaryFilters = validateAgentMetricsSummaryInput(input);
          const summary = await this.metricsService.summary(
            context.userId,
            summaryFilters,
          );
          return this.success(action, readOnly, context, 200, { summary });
        }

        // ── Issue #334: recommendation feedback ────────────────────────────────
        case "record_recommendation_feedback": {
          const fbInput = validateAgentRecordFeedbackInput(input);
          const feedback = await this.feedbackService.record(
            context.userId,
            fbInput,
          );
          return this.success(action, readOnly, context, 201, { feedback });
        }
        case "list_recommendation_feedback": {
          const fbFilters = validateAgentListFeedbackInput(input);
          const items = await this.feedbackService.list(
            context.userId,
            fbFilters,
          );
          return this.success(action, readOnly, context, 200, {
            items,
            total: items.length,
          });
        }
        case "feedback_summary": {
          const fbSummaryFilters = validateAgentFeedbackSummaryInput(input);
          const summaries = await this.feedbackService.summary(
            context.userId,
            fbSummaryFilters,
          );
          return this.success(action, readOnly, context, 200, {
            summaries,
            total: summaries.length,
          });
        }

        // ── Issue #336: life state / day context ───────────────────────────────
        case "set_day_context": {
          const ctxInput = validateAgentSetDayContextInput(input);
          const dayCtxResult = await this.dayContextService.setContext(
            context.userId,
            ctxInput,
          );
          return this.success(action, readOnly, context, 200, {
            context: dayCtxResult,
          });
        }
        case "get_day_context": {
          const { contextDate } = validateAgentGetDayContextInput(input);
          const today = contextDate ?? new Date().toISOString().slice(0, 10);
          const dayCtxResult = await this.dayContextService.getContext(
            context.userId,
            today,
          );
          return this.success(action, readOnly, context, 200, {
            context: dayCtxResult,
          });
        }

        // ── Issue #337: weekly executive summary ───────────────────────────────
        case "weekly_executive_summary": {
          const { weekOffset } = validateAgentWeeklyExecSummaryInput(input);
          const execSummary = await this.executiveSummaryService.getSummary(
            context.userId,
            weekOffset ?? 0,
          );
          return this.success(action, readOnly, context, 200, {
            summary: execSummary,
          });
        }

        case "record_learning_recommendation": {
          const recInput = validateAgentRecordLearningRecInput(input);
          const rec = await this.learningRecommendationService.record(
            context.userId,
            recInput,
          );
          return this.success(action, readOnly, context, 201, {
            recommendation: rec,
          });
        }

        case "list_learning_recommendations": {
          const { status, limit } = validateAgentListLearningRecsInput(input);
          const recs = await this.learningRecommendationService.list(
            context.userId,
            { status, limit },
          );
          return this.success(action, readOnly, context, 200, {
            recommendations: recs,
            total: recs.length,
          });
        }

        case "apply_learning_recommendation": {
          const { id } = validateAgentApplyLearningRecInput(input);
          try {
            const { recommendation, configUpdated } =
              await this.learningRecommendationService.apply(
                context.userId,
                id,
              );
            return this.success(action, readOnly, context, 200, {
              recommendation,
              configUpdated,
            });
          } catch (err) {
            if (err instanceof Error) {
              throw new AgentExecutionError(
                err.message.includes("not found") ? 404 : 400,
                err.message.includes("not found")
                  ? "RESOURCE_NOT_FOUND_OR_FORBIDDEN"
                  : "INVALID_OPERATION",
                err.message,
                false,
              );
            }
            throw err;
          }
        }

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

        // ── Issue #338: list_friction_patterns ────────────────────────────────
        case "list_friction_patterns": {
          const { since, limit } =
            validateAgentListFrictionPatternsInput(input);
          const result = await this.frictionService.listPatterns(
            context.userId,
            { since, limit },
          );
          return this.success(
            action,
            readOnly,
            context,
            200,
            result as unknown as Record<string, unknown>,
          );
        }

        // ── Issue #339: action policies ───────────────────────────────────────
        case "get_action_policies": {
          validateAgentGetActionPoliciesInput(input);
          const policies = await this.actionPolicyService.getPolicies(
            context.userId,
          );
          return this.success(action, readOnly, context, 200, { policies });
        }

        case "update_action_policy": {
          const { actionName, autoApply, minConfidence } =
            validateAgentUpdateActionPolicyInput(input);
          const policies = await this.actionPolicyService.updatePolicy(
            context.userId,
            actionName,
            { autoApply, minConfidence },
          );
          return this.success(action, readOnly, context, 200, { policies });
        }
      }
    } catch (error) {
      return this.failure(action, readOnly, context, error);
    }
  }

  private async handleCreateTask(
    action: AgentActionName,
    context: AgentExecutionContext,
    input: unknown,
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

    const task = await this.agentService.createTask(
      context.userId,
      input as Parameters<AgentService["createTask"]>[1],
    );
    const response = this.buildSuccessBody(action, readOnly, context, { task });
    if (idempotencyKey) {
      await this.idempotencyService.store(
        action,
        context.userId,
        idempotencyKey,
        input,
        201,
        response,
      );
    }
    this.persistActionAudit(context, {
      action,
      readOnly,
      status: 201,
      outcome: "success",
    });
    return {
      status: 201,
      body: response,
    };
  }

  private async handleCreateProject(
    action: AgentActionName,
    context: AgentExecutionContext,
    input: unknown,
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

    const project = await this.agentService.createProject(
      context.userId,
      input as Parameters<AgentService["createProject"]>[1],
    );
    const response = this.buildSuccessBody(action, readOnly, context, {
      project,
    });
    if (idempotencyKey) {
      await this.idempotencyService.store(
        action,
        context.userId,
        idempotencyKey,
        input,
        201,
        response,
      );
    }
    this.persistActionAudit(context, {
      action,
      readOnly,
      status: 201,
      outcome: "success",
    });
    return {
      status: 201,
      body: response,
    };
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
