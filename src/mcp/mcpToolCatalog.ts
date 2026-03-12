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
  requiresProjectService: boolean;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requiredScopesForAction(actionName: AgentActionName): McpScope[] {
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
      return [PROJECT_READ_SCOPE, TASK_READ_SCOPE, TASK_WRITE_SCOPE];
    case "create_project":
    case "update_project":
    case "rename_project":
    case "delete_project":
    case "archive_project":
      return [PROJECT_WRITE_SCOPE];
  }
}

function buildCatalog(): ToolCatalogEntry[] {
  return agentManifest.actions.map((action) => {
    const inputSchema = cloneJson(
      action.inputSchema as Record<string, unknown>,
    );

    if (action.name === "create_task" || action.name === "create_project") {
      const properties =
        (inputSchema.properties as Record<string, unknown> | undefined) || {};
      inputSchema.properties = {
        ...properties,
        idempotencyKey: {
          type: "string",
          maxLength: 200,
          description: `Optional first-pass retry guard for ${action.name}. Reuse the same key with the same input to replay the original success response.`,
        },
      };
    }

    return {
      name: action.name as AgentActionName,
      description: action.description,
      inputSchema,
      readOnly: action.readOnly,
      requiredScopes: requiredScopesForAction(action.name as AgentActionName),
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
      idempotentHint:
        tool.name === "create_task" || tool.name === "create_project",
      openWorldHint: false,
    },
    auth: {
      required: true,
      requiredScopes: [...tool.requiredScopes],
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
