import agentManifest from "../agent/agent-manifest.json";
import { AgentActionName } from "../agent/agentExecutor";
import { McpScope } from "../types";
import { hasMcpScope } from "../validation/mcpValidation";

export const MCP_PROTOCOL_VERSION = "2025-11-25";

type ToolCatalogEntry = {
  name: AgentActionName;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  requiredScope: McpScope;
  requiresProjectService: boolean;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildCatalog(): ToolCatalogEntry[] {
  return agentManifest.actions.map((action) => {
    const inputSchema = cloneJson(
      action.inputSchema as Record<string, unknown>,
    );

    if (action.name === "create_task") {
      const properties =
        (inputSchema.properties as Record<string, unknown> | undefined) || {};
      inputSchema.properties = {
        ...properties,
        idempotencyKey: {
          type: "string",
          maxLength: 200,
          description:
            "Optional first-pass retry guard for create_task. Reuse the same key with the same input to replay the original success response.",
        },
      };
    }

    return {
      name: action.name as AgentActionName,
      description: action.description,
      inputSchema,
      readOnly: action.readOnly,
      requiredScope: action.readOnly ? "read" : "write",
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
    return hasMcpScope(input.scopes, tool.requiredScope);
  }).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: cloneJson(tool.inputSchema),
    annotations: {
      readOnlyHint: tool.readOnly,
      destructiveHint: false,
      idempotentHint: tool.name === "create_task",
      openWorldHint: false,
    },
  }));
}

export function getMcpToolDefinition(name: string): ToolCatalogEntry | null {
  return TOOL_CATALOG.find((tool) => tool.name === name) || null;
}
