import { Request, Response, Router } from "express";
import { AuthService } from "../services/authService";
import { agentAuthMiddleware } from "../middleware/agentAuthMiddleware";
import { getAgentRequestContext } from "../agent/agentContext";
import { AgentActionName, AgentExecutor } from "../agent/agentExecutor";

interface AgentRouterDeps {
  agentExecutor: AgentExecutor;
  authService?: AuthService;
}

function getAgentUserId(req: Request): string {
  return req.user?.userId || "default-user";
}

function buildExecutionContext(req: Request) {
  const requestContext = getAgentRequestContext(req);
  return {
    userId: getAgentUserId(req),
    requestId: requestContext.requestId,
    actor: requestContext.actor,
    idempotencyKey: requestContext.idempotencyKey,
    surface: "agent" as const,
  };
}

function createAgentActionHandler(
  agentExecutor: AgentExecutor,
  action: AgentActionName,
) {
  return async (req: Request, res: Response) => {
    const result = await agentExecutor.execute(
      action,
      req.body,
      buildExecutionContext(req),
    );
    res.status(result.status).json(result.body);
  };
}

export function createAgentRouter({
  agentExecutor,
  authService,
}: AgentRouterDeps): Router {
  const router = Router();

  router.get("/manifest", (req: Request, res: Response) => {
    const requestContext = getAgentRequestContext(req);
    res.json({
      ok: true,
      action: "manifest",
      readOnly: true,
      data: {
        manifest: agentExecutor.getRuntimeManifest(Boolean(authService)),
      },
      trace: {
        requestId: requestContext.requestId,
        actor: requestContext.actor,
        ...(requestContext.idempotencyKey
          ? { idempotencyKey: requestContext.idempotencyKey }
          : {}),
        timestamp: new Date().toISOString(),
      },
    });
  });

  if (authService) {
    router.use(agentAuthMiddleware(authService));
  }

  router.post(
    "/read/list_tasks",
    createAgentActionHandler(agentExecutor, "list_tasks"),
  );
  router.post(
    "/read/search_tasks",
    createAgentActionHandler(agentExecutor, "search_tasks"),
  );
  router.post(
    "/read/get_task",
    createAgentActionHandler(agentExecutor, "get_task"),
  );
  router.post(
    "/read/list_projects",
    createAgentActionHandler(agentExecutor, "list_projects"),
  );
  router.post(
    "/write/create_task",
    createAgentActionHandler(agentExecutor, "create_task"),
  );
  router.post(
    "/write/update_task",
    createAgentActionHandler(agentExecutor, "update_task"),
  );
  router.post(
    "/write/complete_task",
    createAgentActionHandler(agentExecutor, "complete_task"),
  );
  router.post(
    "/write/create_project",
    createAgentActionHandler(agentExecutor, "create_project"),
  );
  router.post(
    "/write/update_project",
    createAgentActionHandler(agentExecutor, "update_project"),
  );
  router.post(
    "/write/delete_project",
    createAgentActionHandler(agentExecutor, "delete_project"),
  );
  router.post(
    "/write/move_task_to_project",
    createAgentActionHandler(agentExecutor, "move_task_to_project"),
  );
  router.post(
    "/write/archive_project",
    createAgentActionHandler(agentExecutor, "archive_project"),
  );

  return router;
}
