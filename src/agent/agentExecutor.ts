import { mapError } from "../errorHandling";
import { IProjectService } from "../interfaces/IProjectService";
import { ITodoService } from "../interfaces/ITodoService";
import agentManifest from "./agent-manifest.json";
import { AgentIdempotencyService } from "../services/agentIdempotencyService";
import { AgentAuditService } from "../services/agentAuditService";
import { AgentService } from "../services/agentService";
import { PrismaClient } from "@prisma/client";
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
} from "../validation/agentValidation";

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
  | "analyze_work_graph";

interface AgentExecutorDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
  persistencePrisma?: PrismaClient;
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

export class AgentExecutor {
  private readonly agentService: AgentService;
  private readonly idempotencyService: AgentIdempotencyService;
  private readonly auditService: AgentAuditService;

  constructor(private readonly deps: AgentExecutorDeps) {
    this.idempotencyService = new AgentIdempotencyService(
      deps.persistencePrisma,
    );
    this.auditService = new AgentAuditService(deps.persistencePrisma);
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
        enabled:
          !action.availability?.requires?.includes("project_service") ||
          this.hasProjectService(),
      })),
    };
  }

  async execute(
    action: AgentActionName,
    input: unknown,
    context: AgentExecutionContext,
  ): Promise<AgentExecutionResult> {
    const readOnly = READ_ONLY_ACTIONS.has(action);

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
          return await this.handleCreateTask(action, context, createInput);
        }
        case "update_task": {
          const { id, changes } = validateAgentUpdateTaskInput(input);
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
          return this.success(action, readOnly, context, 200, { task });
        }
        case "complete_task": {
          const { id, completed } = validateAgentCompleteTaskInput(input);
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
          return this.success(action, readOnly, context, 200, { task });
        }
        case "archive_task": {
          const { id, archived } = validateAgentArchiveTaskInput(input);
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
          return this.success(action, readOnly, context, 200, { task });
        }
        case "delete_task": {
          const { id, hardDelete } = validateAgentDeleteTaskInput(input);
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
          return this.success(action, readOnly, context, 200, {
            deleted: hardDelete === true,
            archived: hardDelete === true ? false : true,
            task: typeof result === "boolean" ? null : result,
            taskId: id,
          });
        }
        case "add_subtask": {
          const { taskId, changes } = validateAgentAddSubtaskInput(input);
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
          return this.success(action, readOnly, context, 201, { subtask });
        }
        case "update_subtask": {
          const { taskId, subtaskId, changes } =
            validateAgentUpdateSubtaskInput(input);
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
          return this.success(action, readOnly, context, 200, { subtask });
        }
        case "delete_subtask": {
          const { taskId, subtaskId } = validateAgentDeleteSubtaskInput(input);
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
          return this.success(action, readOnly, context, 200, {
            deleted: true,
            taskId,
            subtaskId,
          });
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
          return this.success(action, readOnly, context, 200, { project });
        }
        case "rename_project": {
          const { id, name } = validateAgentRenameProjectInput(input);
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
          return this.success(action, readOnly, context, 200, { project });
        }
        case "delete_project": {
          const { id, moveTasksToProjectId, archiveInstead } =
            validateAgentDeleteProjectInput(input);
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
            return this.success(action, readOnly, context, 200, {
              deleted: false,
              archived: true,
              project,
            });
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
          return this.success(action, readOnly, context, 200, {
            deleted: true,
            projectId: id,
            movedTasksToProjectId: moveTasksToProjectId,
            taskDisposition: moveTasksToProjectId ? "reassigned" : "unassigned",
          });
        }
        case "move_task_to_project": {
          const { taskId, projectId } =
            validateAgentMoveTaskToProjectInput(input);
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
          return this.success(action, readOnly, context, 200, { task });
        }
        case "archive_project": {
          const { id, archived } = validateAgentArchiveProjectInput(input);
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
          return this.success(action, readOnly, context, 200, { project });
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
          return this.success(action, readOnly, context, 200, { plan });
        }
        case "ensure_next_action": {
          const plannerInput = validateAgentEnsureNextActionInput(input);
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
          return this.success(action, readOnly, context, 200, { result });
        }
        case "weekly_review": {
          const plannerInput = validateAgentWeeklyReviewInput(input);
          const review = await this.agentService.weeklyReviewForUser(
            context.userId,
            plannerInput,
          );
          return this.success(action, readOnly, context, 200, { review });
        }
        case "decide_next_work": {
          const plannerInput = validateAgentDecideNextWorkInput(input);
          const decision = await this.agentService.decideNextWorkForUser(
            context.userId,
            plannerInput,
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
}
