import agentManifest from "../agent/agent-manifest.json";
import { AgentActionName } from "../agent/agentExecutor";
import { McpScope } from "../types";
import {
  PROJECT_READ_SCOPE,
  PROJECT_WRITE_SCOPE,
  TASK_READ_SCOPE,
  TASK_WRITE_SCOPE,
} from "./mcpScopes";
import { hasMcpScope } from "../validation/mcpValidation";

export const MCP_PROTOCOL_VERSION = "2025-11-25";

type ToolCatalogEntry = {
  name: AgentActionName;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  requiredScopes: McpScope[];
  modeScopedRequiredScopes?: Partial<Record<"suggest" | "apply", McpScope[]>>;
  defaultMode?: "suggest";
  requiresProjectService: boolean;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const PLANNER_MODE_SCOPED_ACTIONS = new Set<AgentActionName>([
  "plan_project",
  "ensure_next_action",
  "weekly_review",
]);

const MCP_IDEMPOTENCY_KEY_ACTIONS = new Set<AgentActionName>([
  "create_task",
  "create_project",
  "plan_project",
  "ensure_next_action",
  "weekly_review",
]);

const PLANNER_SUGGEST_SCOPES: McpScope[] = [
  PROJECT_READ_SCOPE,
  TASK_READ_SCOPE,
];

const PLANNER_APPLY_SCOPES: McpScope[] = [
  PROJECT_READ_SCOPE,
  TASK_READ_SCOPE,
  TASK_WRITE_SCOPE,
];

function isPlannerModeScopedAction(
  actionName: AgentActionName,
): actionName is "plan_project" | "ensure_next_action" | "weekly_review" {
  return PLANNER_MODE_SCOPED_ACTIONS.has(actionName);
}

export function supportsMcpIdempotencyKey(
  actionName: AgentActionName,
): boolean {
  return MCP_IDEMPOTENCY_KEY_ACTIONS.has(actionName);
}

function minimumRequiredScopesForAction(
  actionName: AgentActionName,
): McpScope[] {
  switch (actionName) {
    case "list_tasks":
    case "search_tasks":
    case "get_task":
    case "list_today":
    case "list_next_actions":
    case "list_waiting_on":
    case "list_upcoming":
    case "list_stale_tasks":
      return [TASK_READ_SCOPE];
    case "create_task":
    case "update_task":
    case "complete_task":
    case "archive_task":
    case "delete_task":
    case "add_subtask":
    case "update_subtask":
    case "delete_subtask":
    case "move_task_to_project":
      return [TASK_WRITE_SCOPE];
    case "list_projects":
    case "get_project":
    case "review_projects":
      return [PROJECT_READ_SCOPE];
    case "list_projects_without_next_action":
      return [PROJECT_READ_SCOPE, TASK_READ_SCOPE];
    case "plan_project":
    case "ensure_next_action":
    case "weekly_review":
      return [...PLANNER_SUGGEST_SCOPES];
    case "decide_next_work":
    case "analyze_project_health":
    case "analyze_work_graph":
      return [PROJECT_READ_SCOPE, TASK_READ_SCOPE];
    case "create_project":
    case "update_project":
    case "rename_project":
    case "delete_project":
    case "archive_project":
      return [PROJECT_WRITE_SCOPE];
    case "analyze_task_quality":
    case "find_duplicate_tasks":
    case "find_stale_items":
    case "taxonomy_cleanup_suggestions":
    case "weekly_review_summary":
    case "list_audit_log":
    case "get_availability_windows":
      return [TASK_READ_SCOPE];
    case "plan_today":
    case "break_down_task":
    case "suggest_next_actions":
      return [TASK_READ_SCOPE, PROJECT_READ_SCOPE];
    case "triage_capture_item":
    case "triage_inbox":
    case "create_follow_up_for_waiting_task":
    case "capture_inbox_item":
    case "promote_inbox_item":
      return [TASK_WRITE_SCOPE];
    case "claim_job_run":
    case "complete_job_run":
    case "fail_job_run":
    case "record_failed_action":
    case "resolve_failed_action":
    case "update_agent_config":
    case "replay_job_run":
    case "record_metric":
    case "record_recommendation_feedback":
    case "set_day_context":
    case "record_learning_recommendation":
    case "apply_learning_recommendation":
      return [TASK_WRITE_SCOPE];
    case "get_job_run_status":
    case "list_job_runs":
    case "list_failed_actions":
    case "get_agent_config":
    case "simulate_plan":
    case "list_metrics":
    case "metrics_summary":
    case "list_recommendation_feedback":
    case "feedback_summary":
    case "get_day_context":
    case "weekly_executive_summary":
    case "list_inbox_items":
    case "evaluate_daily_plan":
    case "evaluate_weekly_system":
    case "list_learning_recommendations":
      return [TASK_READ_SCOPE];
  }
}

function modeScopedRequiredScopesForAction(
  actionName: AgentActionName,
): Partial<Record<"suggest" | "apply", McpScope[]>> | undefined {
  if (!isPlannerModeScopedAction(actionName)) {
    return undefined;
  }

  return {
    suggest: [...PLANNER_SUGGEST_SCOPES],
    apply: [...PLANNER_APPLY_SCOPES],
  };
}

function isApplyMode(args: Record<string, unknown>): boolean {
  return (
    typeof args.mode === "string" && args.mode.trim().toLowerCase() === "apply"
  );
}

export function requiredScopesForToolCall(
  actionName: AgentActionName,
  args: Record<string, unknown>,
): McpScope[] {
  if (isPlannerModeScopedAction(actionName) && isApplyMode(args)) {
    return [...PLANNER_APPLY_SCOPES];
  }

  return minimumRequiredScopesForAction(actionName);
}

function buildCatalog(): ToolCatalogEntry[] {
  return agentManifest.actions.map((action) => {
    const inputSchema = cloneJson(
      action.inputSchema as Record<string, unknown>,
    );

    if (supportsMcpIdempotencyKey(action.name as AgentActionName)) {
      const properties =
        (inputSchema.properties as Record<string, unknown> | undefined) || {};
      inputSchema.properties = {
        ...properties,
        idempotencyKey: {
          type: "string",
          maxLength: 200,
          description: isPlannerModeScopedAction(action.name as AgentActionName)
            ? `Optional durable retry guard for ${action.name} when mode="apply". Reuse the same key with the same input to replay the original success response.`
            : `Optional durable retry guard for ${action.name}. Reuse the same key with the same input to replay the original success response.`,
        },
      };
    }

    return {
      name: action.name as AgentActionName,
      description: action.description,
      inputSchema,
      readOnly: action.readOnly,
      requiredScopes: minimumRequiredScopesForAction(
        action.name as AgentActionName,
      ),
      modeScopedRequiredScopes: modeScopedRequiredScopesForAction(
        action.name as AgentActionName,
      ),
      defaultMode: isPlannerModeScopedAction(action.name as AgentActionName)
        ? "suggest"
        : undefined,
      requiresProjectService: Boolean(
        action.availability?.requires?.includes("project_service"),
      ),
    };
  });
}

const TOOL_CATALOG = buildCatalog();

export function listMcpTools(input: {
  scopes: McpScope[];
  projectServiceEnabled: boolean;
}) {
  return TOOL_CATALOG.filter((tool) => {
    if (tool.requiresProjectService && !input.projectServiceEnabled) {
      return false;
    }
    return hasMcpScope(input.scopes, tool.requiredScopes);
  }).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: cloneJson(tool.inputSchema),
    annotations: {
      readOnlyHint: tool.readOnly,
      destructiveHint:
        tool.name === "delete_project" || tool.name === "delete_task",
      idempotentHint: supportsMcpIdempotencyKey(tool.name),
      openWorldHint: false,
    },
    auth: {
      required: true,
      requiredScopes: [...tool.requiredScopes],
      ...(tool.modeScopedRequiredScopes
        ? {
            modeScopedRequiredScopes: cloneJson(tool.modeScopedRequiredScopes),
            defaultMode: tool.defaultMode,
          }
        : {}),
      readOnly: tool.readOnly,
      errors: [
        "MCP_UNAUTHENTICATED",
        "MCP_INVALID_TOKEN",
        "MCP_AUTH_EXPIRED",
        "MCP_INSUFFICIENT_SCOPE",
        "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
      ],
    },
  }));
}

export function getMcpToolDefinition(name: string): ToolCatalogEntry | null {
  return TOOL_CATALOG.find((tool) => tool.name === name) || null;
}
