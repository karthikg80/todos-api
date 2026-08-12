import { McpScope } from "../types";
import { ValidationError } from "../validation/validation";

export type McpScopeAlias = "read" | "write";
export type McpIdentityScope = "openid" | "email";
export type McpOAuthScope = McpScope | McpIdentityScope;

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

export const ALL_MCP_IDENTITY_SCOPES: McpIdentityScope[] = ["openid", "email"];

export const ALL_MCP_OAUTH_SCOPES: McpOAuthScope[] = [
  ...ALL_MCP_IDENTITY_SCOPES,
  ...ALL_MCP_SCOPES,
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

function isMcpIdentityScope(value: string): value is McpIdentityScope {
  return ALL_MCP_IDENTITY_SCOPES.includes(value as McpIdentityScope);
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

export function normalizeMcpOAuthScopes(
  value: unknown,
  options?: { defaultScopes?: McpOAuthScope[]; requireNonEmpty?: boolean },
): McpOAuthScope[] {
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

    if (isExplicitMcpScope(normalized) || isMcpIdentityScope(normalized)) {
      return [normalized];
    }

    throw new ValidationError(
      `Unsupported scope "${entry}". Use openid, email, or explicit scopes like tasks.read or projects.write.`,
    );
  });

  const uniqueScopes = Array.from(new Set(expandedScopes)).sort((left, right) =>
    left.localeCompare(right),
  ) as McpOAuthScope[];

  if ((options?.requireNonEmpty ?? true) && uniqueScopes.length === 0) {
    throw new ValidationError("scopes cannot be empty");
  }

  if (uniqueScopes.includes("email") && !uniqueScopes.includes("openid")) {
    throw new ValidationError('scope "email" requires scope "openid"');
  }

  return uniqueScopes;
}

export function getMcpApplicationScopes(
  scopes: readonly McpOAuthScope[],
): McpScope[] {
  return scopes.filter(isExplicitMcpScope);
}

export function hasAllMcpScopes(
  availableScopes: readonly McpOAuthScope[],
  requiredScopes: readonly McpScope[],
): boolean {
  return requiredScopes.every((scope) => availableScopes.includes(scope));
}

export function formatMcpScopes(scopes: McpScope[]): string {
  return [...scopes].sort((left, right) => left.localeCompare(right)).join(" ");
}

export function formatMcpOAuthScopes(scopes: McpOAuthScope[]): string {
  return [...scopes].sort((left, right) => left.localeCompare(right)).join(" ");
}
