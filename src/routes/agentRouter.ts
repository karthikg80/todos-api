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
    "/read/get_project",
    createAgentActionHandler(agentExecutor, "get_project"),
  );
  router.post(
    "/read/list_projects",
    createAgentActionHandler(agentExecutor, "list_projects"),
  );
  router.post(
    "/read/list_today",
    createAgentActionHandler(agentExecutor, "list_today"),
  );
  router.post(
    "/read/list_next_actions",
    createAgentActionHandler(agentExecutor, "list_next_actions"),
  );
  router.post(
    "/read/list_waiting_on",
    createAgentActionHandler(agentExecutor, "list_waiting_on"),
  );
  router.post(
    "/read/list_upcoming",
    createAgentActionHandler(agentExecutor, "list_upcoming"),
  );
  router.post(
    "/read/list_stale_tasks",
    createAgentActionHandler(agentExecutor, "list_stale_tasks"),
  );
  router.post(
    "/read/list_projects_without_next_action",
    createAgentActionHandler(
      agentExecutor,
      "list_projects_without_next_action",
    ),
  );
  router.post(
    "/read/review_projects",
    createAgentActionHandler(agentExecutor, "review_projects"),
  );
  router.post(
    "/read/decide_next_work",
    createAgentActionHandler(agentExecutor, "decide_next_work"),
  );
  router.post(
    "/read/analyze_project_health",
    createAgentActionHandler(agentExecutor, "analyze_project_health"),
  );
  router.post(
    "/read/analyze_work_graph",
    createAgentActionHandler(agentExecutor, "analyze_work_graph"),
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
    "/write/archive_task",
    createAgentActionHandler(agentExecutor, "archive_task"),
  );
  router.post(
    "/write/delete_task",
    createAgentActionHandler(agentExecutor, "delete_task"),
  );
  router.post(
    "/write/add_subtask",
    createAgentActionHandler(agentExecutor, "add_subtask"),
  );
  router.post(
    "/write/update_subtask",
    createAgentActionHandler(agentExecutor, "update_subtask"),
  );
  router.post(
    "/write/delete_subtask",
    createAgentActionHandler(agentExecutor, "delete_subtask"),
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
    "/write/rename_project",
    createAgentActionHandler(agentExecutor, "rename_project"),
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
  router.post(
    "/write/plan_project",
    createAgentActionHandler(agentExecutor, "plan_project"),
  );
  router.post(
    "/write/ensure_next_action",
    createAgentActionHandler(agentExecutor, "ensure_next_action"),
  );
  router.post(
    "/write/weekly_review",
    createAgentActionHandler(agentExecutor, "weekly_review"),
  );

  // Anti-entropy
  router.post(
    "/read/analyze_task_quality",
    createAgentActionHandler(agentExecutor, "analyze_task_quality"),
  );
  router.post(
    "/read/find_duplicate_tasks",
    createAgentActionHandler(agentExecutor, "find_duplicate_tasks"),
  );
  router.post(
    "/read/find_stale_items",
    createAgentActionHandler(agentExecutor, "find_stale_items"),
  );
  router.post(
    "/read/taxonomy_cleanup_suggestions",
    createAgentActionHandler(agentExecutor, "taxonomy_cleanup_suggestions"),
  );

  // Planning
  router.post(
    "/read/plan_today",
    createAgentActionHandler(agentExecutor, "plan_today"),
  );
  router.post(
    "/read/break_down_task",
    createAgentActionHandler(agentExecutor, "break_down_task"),
  );
  router.post(
    "/read/suggest_next_actions",
    createAgentActionHandler(agentExecutor, "suggest_next_actions"),
  );
  router.post(
    "/read/weekly_review_summary",
    createAgentActionHandler(agentExecutor, "weekly_review_summary"),
  );

  // Triage / audit / availability
  router.post(
    "/write/triage_capture_item",
    createAgentActionHandler(agentExecutor, "triage_capture_item"),
  );
  router.post(
    "/write/triage_inbox",
    createAgentActionHandler(agentExecutor, "triage_inbox"),
  );
  router.post(
    "/read/list_audit_log",
    createAgentActionHandler(agentExecutor, "list_audit_log"),
  );
  router.post(
    "/read/get_availability_windows",
    createAgentActionHandler(agentExecutor, "get_availability_windows"),
  );

  return router;
}
