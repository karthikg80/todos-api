import { Request, Response, Router } from "express";
import { mapError } from "../errorHandling";
import { AuthService } from "../services/authService";
import { ITodoService } from "../interfaces/ITodoService";
import { IProjectService } from "../interfaces/IProjectService";
import { agentAuthMiddleware } from "../middleware/agentAuthMiddleware";
import { getAgentRequestContext } from "../agent/agentContext";
import agentManifest from "../agent/agent-manifest.json";
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

interface AgentRouterDeps {
  todoService: ITodoService;
  authService?: AuthService;
  projectService?: IProjectService;
}

class AgentRouteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly hint?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AgentRouteError";
  }
}

type AgentSuccessResponse = {
  ok: true;
  action: string;
  readOnly: boolean;
  data: Record<string, unknown>;
  trace: Record<string, unknown>;
};

function buildTrace(req: Request, extras: Record<string, unknown> = {}) {
  const context = getAgentRequestContext(req);
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
  req: Request,
  payload: {
    action: string;
    readOnly: boolean;
    status: number;
    outcome: "success" | "error";
    userId?: string;
    errorCode?: string;
    replayed?: boolean;
  },
) {
  const context = getAgentRequestContext(req);
  console.info(
    JSON.stringify({
      type: "agent_action",
      action: payload.action,
      readOnly: payload.readOnly,
      outcome: payload.outcome,
      status: payload.status,
      userId: payload.userId,
      requestId: context.requestId,
      actor: context.actor,
      idempotencyKey: context.idempotencyKey,
      replayed: payload.replayed || false,
      errorCode: payload.errorCode,
      ts: new Date().toISOString(),
    }),
  );
}

function buildSuccessResponse(
  req: Request,
  action: string,
  readOnly: boolean,
  data: Record<string, unknown>,
  traceExtras: Record<string, unknown> = {},
): AgentSuccessResponse {
  return {
    ok: true,
    action,
    readOnly,
    data,
    trace: buildTrace(req, traceExtras),
  };
}

function toAgentError(error: unknown): {
  status: number;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    hint?: string;
    details?: Record<string, unknown>;
  };
} {
  if (error instanceof AgentRouteError) {
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
        code: "NOT_FOUND",
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

function sendAgentError(
  req: Request,
  res: Response,
  action: string,
  readOnly: boolean,
  error: unknown,
  userId?: string,
): void {
  const payload = toAgentError(error);
  logAgentAction(req, {
    action,
    readOnly,
    status: payload.status,
    outcome: "error",
    userId,
    errorCode: payload.error.code,
  });

  if (payload.status >= 500) {
    console.error(error);
  }

  res.status(payload.status).json({
    ok: false,
    action,
    error: payload.error,
    trace: buildTrace(req),
  });
}

function ensureProjectsConfigured(projectService?: IProjectService) {
  if (!projectService) {
    throw new AgentRouteError(
      501,
      "PROJECTS_NOT_CONFIGURED",
      "Projects not configured",
      false,
      "Configure the project service before calling project actions.",
    );
  }
}

function getAgentUserId(req: Request): string {
  return req.user?.userId || "default-user";
}

export function createAgentRouter({
  todoService,
  authService,
  projectService,
}: AgentRouterDeps): Router {
  const router = Router();
  const agentService = new AgentService({ todoService, projectService });
  const idempotencyService = new AgentIdempotencyService();

  router.get("/manifest", (req: Request, res: Response) => {
    const manifest = {
      ...agentManifest,
      auth: {
        ...agentManifest.auth,
        requiredForActions: Boolean(authService),
      },
      actions: agentManifest.actions.map((action) => ({
        ...action,
        enabled:
          !action.availability?.requires?.includes("project_service") ||
          Boolean(projectService),
      })),
    };

    res.json({
      ok: true,
      action: "manifest",
      readOnly: true,
      data: { manifest },
      trace: buildTrace(req),
    });
  });

  if (authService) {
    router.use(agentAuthMiddleware(authService));
  }

  router.post("/read/list_tasks", async (req: Request, res: Response) => {
    const action = "list_tasks";
    const readOnly = true;
    const userId = getAgentUserId(req);

    try {
      const query = validateAgentListTasksInput(req.body);
      const tasks = await agentService.listTasks(userId, query);
      const response = buildSuccessResponse(req, action, readOnly, { tasks });
      logAgentAction(req, {
        action,
        readOnly,
        status: 200,
        outcome: "success",
        userId,
      });
      res.status(200).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  router.post("/read/search_tasks", async (req: Request, res: Response) => {
    const action = "search_tasks";
    const readOnly = true;
    const userId = getAgentUserId(req);

    try {
      const query = validateAgentSearchTasksInput(req.body);
      const tasks = await agentService.searchTasks(userId, query);
      const response = buildSuccessResponse(req, action, readOnly, { tasks });
      logAgentAction(req, {
        action,
        readOnly,
        status: 200,
        outcome: "success",
        userId,
      });
      res.status(200).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  router.post("/read/get_task", async (req: Request, res: Response) => {
    const action = "get_task";
    const readOnly = true;
    const userId = getAgentUserId(req);

    try {
      const { id } = validateAgentGetTaskInput(req.body);
      const task = await agentService.getTask(userId, id);
      if (!task) {
        throw new AgentRouteError(
          404,
          "TASK_NOT_FOUND",
          "Task not found",
          false,
          "Verify the task ID belongs to the authenticated user.",
        );
      }

      const response = buildSuccessResponse(req, action, readOnly, { task });
      logAgentAction(req, {
        action,
        readOnly,
        status: 200,
        outcome: "success",
        userId,
      });
      res.status(200).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  router.post("/read/list_projects", async (req: Request, res: Response) => {
    const action = "list_projects";
    const readOnly = true;
    const userId = getAgentUserId(req);

    try {
      validateAgentListProjectsInput(req.body);
      ensureProjectsConfigured(projectService);
      const projects = await agentService.listProjects(userId);
      const response = buildSuccessResponse(req, action, readOnly, {
        projects,
      });
      logAgentAction(req, {
        action,
        readOnly,
        status: 200,
        outcome: "success",
        userId,
      });
      res.status(200).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  router.post("/write/create_task", async (req: Request, res: Response) => {
    const action = "create_task";
    const readOnly = false;
    const userId = getAgentUserId(req);

    try {
      const input = validateAgentCreateTaskInput(req.body);
      const idempotencyKey = getAgentRequestContext(req).idempotencyKey;
      if (idempotencyKey) {
        const lookup = idempotencyService.lookup(
          action,
          userId,
          idempotencyKey,
          input,
        );
        if (lookup.kind === "conflict") {
          throw new AgentRouteError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key already used for different input",
            false,
            "Reuse the original payload or supply a new Idempotency-Key.",
          );
        }
        if (lookup.kind === "replay") {
          const replayed = lookup.body as AgentSuccessResponse;
          const response = {
            ...replayed,
            trace: buildTrace(req, {
              replayed: true,
              originalRequestId: replayed.trace.requestId,
            }),
          };
          logAgentAction(req, {
            action,
            readOnly,
            status: lookup.status,
            outcome: "success",
            userId,
            replayed: true,
          });
          res.status(lookup.status).json(response);
          return;
        }
      }

      const task = await agentService.createTask(userId, input);
      const response = buildSuccessResponse(req, action, readOnly, { task });
      if (idempotencyKey) {
        idempotencyService.store(
          action,
          userId,
          idempotencyKey,
          input,
          201,
          response,
        );
      }
      logAgentAction(req, {
        action,
        readOnly,
        status: 201,
        outcome: "success",
        userId,
      });
      res.status(201).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  router.post("/write/update_task", async (req: Request, res: Response) => {
    const action = "update_task";
    const readOnly = false;
    const userId = getAgentUserId(req);

    try {
      const { id, changes } = validateAgentUpdateTaskInput(req.body);
      const task = await agentService.updateTask(userId, id, changes);
      if (!task) {
        throw new AgentRouteError(
          404,
          "TASK_NOT_FOUND",
          "Task not found",
          false,
          "Verify the task ID belongs to the authenticated user.",
        );
      }
      const response = buildSuccessResponse(req, action, readOnly, { task });
      logAgentAction(req, {
        action,
        readOnly,
        status: 200,
        outcome: "success",
        userId,
      });
      res.status(200).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  router.post("/write/complete_task", async (req: Request, res: Response) => {
    const action = "complete_task";
    const readOnly = false;
    const userId = getAgentUserId(req);

    try {
      const { id, completed } = validateAgentCompleteTaskInput(req.body);
      const task = await agentService.completeTask(userId, id, completed);
      if (!task) {
        throw new AgentRouteError(
          404,
          "TASK_NOT_FOUND",
          "Task not found",
          false,
          "Verify the task ID belongs to the authenticated user.",
        );
      }
      const response = buildSuccessResponse(req, action, readOnly, { task });
      logAgentAction(req, {
        action,
        readOnly,
        status: 200,
        outcome: "success",
        userId,
      });
      res.status(200).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  router.post("/write/create_project", async (req: Request, res: Response) => {
    const action = "create_project";
    const readOnly = false;
    const userId = getAgentUserId(req);

    try {
      ensureProjectsConfigured(projectService);
      const input = validateAgentCreateProjectInput(req.body);
      const idempotencyKey = getAgentRequestContext(req).idempotencyKey;
      if (idempotencyKey) {
        const lookup = idempotencyService.lookup(
          action,
          userId,
          idempotencyKey,
          input,
        );
        if (lookup.kind === "conflict") {
          throw new AgentRouteError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key already used for different input",
            false,
            "Reuse the original payload or supply a new Idempotency-Key.",
          );
        }
        if (lookup.kind === "replay") {
          const replayed = lookup.body as AgentSuccessResponse;
          const response = {
            ...replayed,
            trace: buildTrace(req, {
              replayed: true,
              originalRequestId: replayed.trace.requestId,
            }),
          };
          logAgentAction(req, {
            action,
            readOnly,
            status: lookup.status,
            outcome: "success",
            userId,
            replayed: true,
          });
          res.status(lookup.status).json(response);
          return;
        }
      }

      const project = await agentService.createProject(userId, input);
      const response = buildSuccessResponse(req, action, readOnly, {
        project,
      });
      if (idempotencyKey) {
        idempotencyService.store(
          action,
          userId,
          idempotencyKey,
          input,
          201,
          response,
        );
      }
      logAgentAction(req, {
        action,
        readOnly,
        status: 201,
        outcome: "success",
        userId,
      });
      res.status(201).json(response);
    } catch (error) {
      sendAgentError(req, res, action, readOnly, error, userId);
    }
  });

  return router;
}
