import { McpScope } from "../types";
import {
  formatMcpScopes,
  hasAllMcpScopes,
  normalizeMcpScopes,
} from "../mcp/mcpScopes";
import { ValidationError } from "./validation";

const MAX_ASSISTANT_NAME_LENGTH = 100;
const MAX_CLIENT_ID_LENGTH = 200;
const MAX_STATE_LENGTH = 200;
const PKCE_MIN_LENGTH = 43;
const PKCE_MAX_LENGTH = 128;

export interface CreateMcpTokenDto {
  scopes: McpScope[];
  assistantName?: string;
  clientId?: string;
}

export interface CreateMcpAuthorizationCodeDto {
  clientId: string;
  redirectUri: string;
  scopes: McpScope[];
  assistantName?: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface ExchangeMcpAuthorizationCodeDto {
  grantType: "authorization_code";
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}

function ensureObject(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Request body must be an object");
  }
  return data as Record<string, unknown>;
}

function normalizeStringField(input: {
  value: unknown;
  field: string;
  maxLength?: number;
  required?: boolean;
}): string | undefined {
  if (input.value === undefined || input.value === null) {
    if (input.required) {
      throw new ValidationError(`${input.field} is required`);
    }
    return undefined;
  }

  if (typeof input.value !== "string") {
    throw new ValidationError(`${input.field} must be a string`);
  }

  const normalized = input.value.trim();
  if (!normalized) {
    throw new ValidationError(`${input.field} cannot be empty`);
  }

  if (input.maxLength && normalized.length > input.maxLength) {
    throw new ValidationError(
      `${input.field} cannot exceed ${input.maxLength} characters`,
    );
  }

  return normalized;
}

function normalizeRedirectUri(value: unknown): string {
  const redirectUri = normalizeStringField({
    value,
    field: "redirectUri",
    required: true,
    maxLength: 1000,
  });

  let parsed: URL;
  try {
    parsed = new URL(redirectUri!);
  } catch (_error) {
    throw new ValidationError("redirectUri must be a valid absolute URL");
  }

  const isLoopbackHttp =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLoopbackHttp) {
    throw new ValidationError(
      "redirectUri must use https or localhost http for development",
    );
  }

  return redirectUri!;
}

function normalizePkceField(input: {
  value: unknown;
  field: "codeChallenge" | "codeVerifier";
}): string {
  const normalized = normalizeStringField({
    value: input.value,
    field: input.field,
    required: true,
    maxLength: PKCE_MAX_LENGTH,
  });

  if (
    normalized!.length < PKCE_MIN_LENGTH ||
    normalized!.length > PKCE_MAX_LENGTH
  ) {
    throw new ValidationError(
      `${input.field} must be between ${PKCE_MIN_LENGTH} and ${PKCE_MAX_LENGTH} characters`,
    );
  }

  if (!/^[A-Za-z0-9\-._~]+$/.test(normalized!)) {
    throw new ValidationError(`${input.field} must use the PKCE character set`);
  }

  return normalized!;
}

function normalizeAssistantName(value: unknown): string | undefined {
  return normalizeStringField({
    value,
    field: "assistantName",
    maxLength: MAX_ASSISTANT_NAME_LENGTH,
  });
}

function normalizeClientId(
  value: unknown,
  required: boolean,
): string | undefined {
  return normalizeStringField({
    value,
    field: "clientId",
    required,
    maxLength: MAX_CLIENT_ID_LENGTH,
  });
}

function normalizeState(value: unknown): string | undefined {
  return normalizeStringField({
    value,
    field: "state",
    maxLength: MAX_STATE_LENGTH,
  });
}

export function validateCreateMcpTokenInput(data: unknown): CreateMcpTokenDto {
  const body = ensureObject(data);
  const allowedKeys = ["scopes", "assistantName", "clientId"];
  const unknownKeys = Object.keys(body).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new ValidationError(
      `Request body contains unsupported field(s): ${unknownKeys.join(", ")}`,
    );
  }

  return {
    scopes: normalizeMcpScopes(body.scopes),
    assistantName: normalizeAssistantName(body.assistantName),
    clientId: normalizeClientId(body.clientId, false),
  };
}

export function validateCreateMcpAuthorizationCodeInput(
  data: unknown,
): CreateMcpAuthorizationCodeDto {
  const body = ensureObject(data);
  const allowedKeys = [
    "clientId",
    "redirectUri",
    "scopes",
    "assistantName",
    "state",
    "codeChallenge",
    "codeChallengeMethod",
  ];
  const unknownKeys = Object.keys(body).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new ValidationError(
      `Request body contains unsupported field(s): ${unknownKeys.join(", ")}`,
    );
  }

  const codeChallengeMethod = normalizeStringField({
    value: body.codeChallengeMethod ?? "S256",
    field: "codeChallengeMethod",
    required: true,
  });
  if (codeChallengeMethod !== "S256") {
    throw new ValidationError("codeChallengeMethod must be S256");
  }

  return {
    clientId: normalizeClientId(body.clientId, true)!,
    redirectUri: normalizeRedirectUri(body.redirectUri),
    scopes: normalizeMcpScopes(body.scopes),
    assistantName: normalizeAssistantName(body.assistantName),
    state: normalizeState(body.state),
    codeChallenge: normalizePkceField({
      value: body.codeChallenge,
      field: "codeChallenge",
    }),
    codeChallengeMethod: "S256",
  };
}

export function validateExchangeMcpAuthorizationCodeInput(
  data: unknown,
): ExchangeMcpAuthorizationCodeDto {
  const body = ensureObject(data);
  const allowedKeys = [
    "grantType",
    "code",
    "clientId",
    "redirectUri",
    "codeVerifier",
  ];
  const unknownKeys = Object.keys(body).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new ValidationError(
      `Request body contains unsupported field(s): ${unknownKeys.join(", ")}`,
    );
  }

  const grantType = normalizeStringField({
    value: body.grantType,
    field: "grantType",
    required: true,
  });
  if (grantType !== "authorization_code") {
    throw new ValidationError('grantType must be "authorization_code"');
  }

  return {
    grantType: "authorization_code",
    code: normalizeStringField({
      value: body.code,
      field: "code",
      required: true,
      maxLength: 200,
    })!,
    clientId: normalizeClientId(body.clientId, true)!,
    redirectUri: normalizeRedirectUri(body.redirectUri),
    codeVerifier: normalizePkceField({
      value: body.codeVerifier,
      field: "codeVerifier",
    }),
  };
}

export function hasMcpScope(
  availableScopes: McpScope[],
  requiredScopes: McpScope | McpScope[],
): boolean {
  return hasAllMcpScopes(
    availableScopes,
    Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes],
  );
}

export function describeMcpScopes(scopes: McpScope[]): string {
  return formatMcpScopes(scopes);
}
