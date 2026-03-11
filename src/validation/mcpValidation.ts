import { McpScope } from "../types";
import { ValidationError } from "./validation";

const VALID_MCP_SCOPES: McpScope[] = ["read", "write"];
const MAX_ASSISTANT_NAME_LENGTH = 100;

export interface CreateMcpTokenDto {
  scopes: McpScope[];
  assistantName?: string;
}

function ensureObject(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Request body must be an object");
  }
  return data as Record<string, unknown>;
}

function normalizeScopes(value: unknown): McpScope[] {
  if (value === undefined) {
    return ["read"];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError("scopes must be an array");
  }

  const uniqueScopes = Array.from(
    new Set(
      value.map((entry) => {
        if (typeof entry !== "string") {
          throw new ValidationError("scopes entries must be strings");
        }
        const scope = entry.trim().toLowerCase() as McpScope;
        if (!VALID_MCP_SCOPES.includes(scope)) {
          throw new ValidationError(
            'scopes must only include "read" or "write"',
          );
        }
        return scope;
      }),
    ),
  );

  if (uniqueScopes.length === 0) {
    throw new ValidationError("scopes cannot be empty");
  }

  if (uniqueScopes.includes("write") && !uniqueScopes.includes("read")) {
    return ["read", "write"];
  }

  return uniqueScopes.sort((left, right) =>
    left.localeCompare(right),
  ) as McpScope[];
}

function normalizeAssistantName(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("assistantName must be a string");
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new ValidationError("assistantName cannot be empty");
  }
  if (normalized.length > MAX_ASSISTANT_NAME_LENGTH) {
    throw new ValidationError(
      `assistantName cannot exceed ${MAX_ASSISTANT_NAME_LENGTH} characters`,
    );
  }
  return normalized;
}

export function validateCreateMcpTokenInput(data: unknown): CreateMcpTokenDto {
  const body = ensureObject(data);
  const allowedKeys = ["scopes", "assistantName"];
  const unknownKeys = Object.keys(body).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new ValidationError(
      `Request body contains unsupported field(s): ${unknownKeys.join(", ")}`,
    );
  }

  return {
    scopes: normalizeScopes(body.scopes),
    assistantName: normalizeAssistantName(body.assistantName),
  };
}

export function hasMcpScope(
  availableScopes: McpScope[],
  requiredScope: McpScope,
): boolean {
  return availableScopes.includes(requiredScope);
}
