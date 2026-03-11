import { McpScope } from "../types";
import { ValidationError } from "../validation/validation";

export type McpScopeAlias = "read" | "write";

export const TASK_READ_SCOPE: McpScope = "tasks.read";
export const TASK_WRITE_SCOPE: McpScope = "tasks.write";
export const PROJECT_READ_SCOPE: McpScope = "projects.read";
export const PROJECT_WRITE_SCOPE: McpScope = "projects.write";

export const ALL_MCP_SCOPES: McpScope[] = [
  TASK_READ_SCOPE,
  TASK_WRITE_SCOPE,
  PROJECT_READ_SCOPE,
  PROJECT_WRITE_SCOPE,
];

export const DEFAULT_MCP_SCOPES: McpScope[] = [
  TASK_READ_SCOPE,
  PROJECT_READ_SCOPE,
];

const LEGACY_SCOPE_ALIASES: Record<McpScopeAlias, McpScope[]> = {
  read: [...DEFAULT_MCP_SCOPES],
  write: [...ALL_MCP_SCOPES],
};

function isExplicitMcpScope(value: string): value is McpScope {
  return ALL_MCP_SCOPES.includes(value as McpScope);
}

export function normalizeMcpScopes(
  value: unknown,
  options?: { defaultScopes?: McpScope[]; requireNonEmpty?: boolean },
): McpScope[] {
  if (value === undefined) {
    const defaults = options?.defaultScopes || DEFAULT_MCP_SCOPES;
    return [...defaults];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError("scopes must be an array");
  }

  const expandedScopes = value.flatMap((entry) => {
    if (typeof entry !== "string") {
      throw new ValidationError("scopes entries must be strings");
    }

    const normalized = entry.trim().toLowerCase();
    if (!normalized) {
      throw new ValidationError("scopes entries cannot be empty");
    }

    if (normalized in LEGACY_SCOPE_ALIASES) {
      return LEGACY_SCOPE_ALIASES[normalized as McpScopeAlias];
    }

    if (!isExplicitMcpScope(normalized)) {
      throw new ValidationError(
        `Unsupported scope "${entry}". Use explicit scopes like tasks.read or projects.write.`,
      );
    }

    return [normalized];
  });

  const uniqueScopes = Array.from(new Set(expandedScopes)).sort((left, right) =>
    left.localeCompare(right),
  ) as McpScope[];

  if ((options?.requireNonEmpty ?? true) && uniqueScopes.length === 0) {
    throw new ValidationError("scopes cannot be empty");
  }

  return uniqueScopes;
}

export function hasAllMcpScopes(
  availableScopes: McpScope[],
  requiredScopes: McpScope[],
): boolean {
  return requiredScopes.every((scope) => availableScopes.includes(scope));
}

export function formatMcpScopes(scopes: McpScope[]): string {
  return [...scopes].sort((left, right) => left.localeCompare(right)).join(" ");
}
