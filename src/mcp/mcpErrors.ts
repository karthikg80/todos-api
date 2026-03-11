import { mapError } from "../errorHandling";

export interface StructuredMcpError {
  code: string;
  message: string;
  retryable: boolean;
  hint?: string;
  details?: Record<string, unknown>;
}

export function buildStructuredMcpError(input: StructuredMcpError) {
  return {
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    ...(input.hint ? { hint: input.hint } : {}),
    ...(input.details ? { details: input.details } : {}),
  };
}

export function mapAgentFacingError(error: unknown): {
  status: number;
  error: StructuredMcpError;
} {
  const mapped = mapError(error);

  if (mapped.status === 400) {
    return {
      status: 400,
      error: buildStructuredMcpError({
        code: "MCP_INVALID_REQUEST",
        message: mapped.message,
        retryable: false,
        hint: "Review the request payload against the documented MCP auth or tool contract and retry.",
      }),
    };
  }

  if (mapped.status === 401) {
    const code =
      mapped.message === "Token expired"
        ? "MCP_AUTH_EXPIRED"
        : mapped.message === "Invalid token"
          ? "MCP_INVALID_TOKEN"
          : "MCP_UNAUTHENTICATED";
    const hint =
      code === "MCP_AUTH_EXPIRED"
        ? "Repeat the account-link flow to mint a fresh MCP access token."
        : code === "MCP_INVALID_TOKEN"
          ? "Use a valid assistant token minted through the MCP OAuth exchange."
          : "Authenticate the user account and retry.";
    return {
      status: 401,
      error: buildStructuredMcpError({
        code,
        message: mapped.message,
        retryable: false,
        hint,
      }),
    };
  }

  if (mapped.status === 403) {
    return {
      status: 403,
      error: buildStructuredMcpError({
        code: "MCP_FORBIDDEN",
        message: mapped.message,
        retryable: false,
        hint: "Use a token that was granted access to the requested action or resource.",
      }),
    };
  }

  if (mapped.status === 404) {
    return {
      status: 404,
      error: buildStructuredMcpError({
        code: "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
        message: mapped.message,
        retryable: false,
        hint: "Verify the resource ID belongs to the authenticated user and is still available.",
      }),
    };
  }

  if (mapped.status === 409) {
    return {
      status: 409,
      error: buildStructuredMcpError({
        code: "MCP_CONFLICT",
        message: mapped.message,
        retryable: false,
        hint: "Fetch current state and retry with updated input if needed.",
      }),
    };
  }

  if (mapped.status === 501) {
    return {
      status: 501,
      error: buildStructuredMcpError({
        code: "MCP_NOT_CONFIGURED",
        message: mapped.message,
        retryable: false,
        hint: "Enable the required server capability before calling this surface.",
      }),
    };
  }

  return {
    status: 500,
    error: buildStructuredMcpError({
      code: "MCP_INTERNAL_ERROR",
      message: "Internal server error",
      retryable: true,
      hint: "Retry the request. If it keeps failing, inspect the server logs using the request ID.",
    }),
  };
}
