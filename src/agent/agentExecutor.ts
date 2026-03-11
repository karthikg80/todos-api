import { mapError } from "../errorHandling";
import { IProjectService } from "../interfaces/IProjectService";
import { ITodoService } from "../interfaces/ITodoService";
import agentManifest from "./agent-manifest.json";
import { AgentIdempotencyService } from "../services/agentIdempotencyService";
import { AgentService } from "../services/agentService";
import {
  validateAgentCompleteTaskInput,
  validateAgentCreateProjectInput,
  validateAgentCreateTaskInput,
  validateAgentGetTaskInput,
  validateAgentListProjectsInput,
  validateAgentListTasksInput,
  validateAgentSearchTasksInput,
  validateAgentUpdateTaskInput,
} from "../validation/agentValidation";

export type AgentActionName =
  | "list_tasks"
  | "search_tasks"
  | "get_task"
  | "create_task"
  | "update_task"
  | "complete_task"
  | "list_projects"
  | "create_project";

interface AgentExecutorDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
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
  "list_projects",
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
  private readonly idempotencyService = new AgentIdempotencyService();

  constructor(private readonly deps: AgentExecutorDeps) {
    this.agentService = new AgentService({
      todoService: deps.todoService,
      projectService: deps.projectService,
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
        case "list_projects": {
          validateAgentListProjectsInput(input);
          const projects = await this.agentService.listProjects(context.userId);
          return this.success(action, readOnly, context, 200, { projects });
        }
        case "create_project": {
          const createInput = validateAgentCreateProjectInput(input);
          return await this.handleCreateProject(action, context, createInput);
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
      const lookup = this.idempotencyService.lookup(
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
        logAgentAction(context, {
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
      this.idempotencyService.store(
        action,
        context.userId,
        idempotencyKey,
        input,
        201,
        response,
      );
    }
    logAgentAction(context, {
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
      const lookup = this.idempotencyService.lookup(
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
        logAgentAction(context, {
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
      this.idempotencyService.store(
        action,
        context.userId,
        idempotencyKey,
        input,
        201,
        response,
      );
    }
    logAgentAction(context, {
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
    logAgentAction(context, {
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
    logAgentAction(context, {
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
