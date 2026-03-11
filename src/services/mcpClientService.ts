import jwt from "jsonwebtoken";
import { config } from "../config";

const OAUTH_CLIENT_GRANT_AUTHORIZATION_CODE = "authorization_code";
const OAUTH_CLIENT_GRANT_REFRESH_TOKEN = "refresh_token";

export interface McpRegisteredClient {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none";
  clientIdIssuedAt: number;
}

export interface RegisterMcpClientInput {
  redirectUris: string[];
  clientName?: string;
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: "none";
}

interface McpClientPayload {
  tokenType: "mcp_oauth_client";
  redirectUris: string[];
  clientName?: string;
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none";
  iat?: number;
  exp?: number;
}

function normalizeSupportedGrantTypes(grantTypes?: unknown): string[] {
  if (grantTypes !== undefined && !Array.isArray(grantTypes)) {
    throw new Error("Unsupported OAuth client metadata");
  }

  const requestedGrantTypes =
    grantTypes && grantTypes.length > 0
      ? Array.from(
          new Set(
            grantTypes.map((grantType) => {
              if (typeof grantType !== "string" || !grantType.trim()) {
                throw new Error("Unsupported OAuth client metadata");
              }
              return grantType.trim();
            }),
          ),
        )
      : [OAUTH_CLIENT_GRANT_AUTHORIZATION_CODE];

  if (!requestedGrantTypes.includes(OAUTH_CLIENT_GRANT_AUTHORIZATION_CODE)) {
    throw new Error("Unsupported OAuth client metadata");
  }

  const allowedGrantTypes = new Set([
    OAUTH_CLIENT_GRANT_AUTHORIZATION_CODE,
    OAUTH_CLIENT_GRANT_REFRESH_TOKEN,
  ]);
  if (
    requestedGrantTypes.some((grantType) => !allowedGrantTypes.has(grantType))
  ) {
    throw new Error("Unsupported OAuth client metadata");
  }

  return [
    OAUTH_CLIENT_GRANT_AUTHORIZATION_CODE,
    ...(requestedGrantTypes.includes(OAUTH_CLIENT_GRANT_REFRESH_TOKEN)
      ? [OAUTH_CLIENT_GRANT_REFRESH_TOKEN]
      : []),
  ];
}

export class McpClientService {
  private readonly CLIENT_ID_TTL_SECONDS = 365 * 24 * 60 * 60;

  registerClient(input: RegisterMcpClientInput): McpRegisteredClient {
    const grantTypes = normalizeSupportedGrantTypes(input.grantTypes);
    const responseTypes = input.responseTypes?.length
      ? [...input.responseTypes]
      : ["code"];
    const tokenEndpointAuthMethod = input.tokenEndpointAuthMethod || "none";

    if (
      tokenEndpointAuthMethod !== "none" ||
      responseTypes.some((responseType) => responseType !== "code")
    ) {
      throw new Error("Unsupported OAuth client metadata");
    }

    const clientId = jwt.sign(
      {
        tokenType: "mcp_oauth_client",
        redirectUris: [...input.redirectUris],
        ...(input.clientName ? { clientName: input.clientName } : {}),
        grantTypes,
        responseTypes,
        tokenEndpointAuthMethod,
      } satisfies McpClientPayload,
      config.accessJwtSecret,
      {
        expiresIn: this.CLIENT_ID_TTL_SECONDS,
      },
    );

    const decoded = jwt.decode(clientId) as { iat?: number } | null;
    return {
      clientId,
      redirectUris: [...input.redirectUris],
      ...(input.clientName ? { clientName: input.clientName } : {}),
      grantTypes,
      responseTypes,
      tokenEndpointAuthMethod,
      clientIdIssuedAt: decoded?.iat || Math.floor(Date.now() / 1000),
    };
  }

  resolveClient(clientId: string): McpRegisteredClient {
    try {
      const payload = jwt.verify(
        clientId,
        config.accessJwtSecret,
      ) as Partial<McpClientPayload>;
      const normalizedGrantTypes = normalizeSupportedGrantTypes(
        payload.grantTypes,
      );

      if (
        payload.tokenType !== "mcp_oauth_client" ||
        !Array.isArray(payload.redirectUris) ||
        payload.redirectUris.length === 0
      ) {
        throw new Error("Invalid OAuth client");
      }

      if (
        payload.responseTypes?.some((responseType) => responseType !== "code")
      ) {
        throw new Error("Invalid OAuth client");
      }

      if (payload.tokenEndpointAuthMethod !== "none") {
        throw new Error("Invalid OAuth client");
      }

      return {
        clientId,
        redirectUris: [...payload.redirectUris],
        ...(typeof payload.clientName === "string" && payload.clientName.trim()
          ? { clientName: payload.clientName.trim() }
          : {}),
        grantTypes: normalizedGrantTypes,
        responseTypes:
          payload.responseTypes && payload.responseTypes.length > 0
            ? [...payload.responseTypes]
            : ["code"],
        tokenEndpointAuthMethod: "none",
        clientIdIssuedAt:
          typeof payload.iat === "number"
            ? payload.iat
            : Math.floor(Date.now() / 1000),
      };
    } catch (error: any) {
      if (error?.name === "TokenExpiredError") {
        throw new Error("OAuth client expired");
      }
      throw new Error("Invalid OAuth client");
    }
  }

  assertRedirectUri(clientId: string, redirectUri: string) {
    const client = this.resolveClient(clientId);
    if (!client.redirectUris.includes(redirectUri)) {
      throw new Error("OAuth redirect URI mismatch");
    }
    return client;
  }
}
