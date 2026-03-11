import jwt from "jsonwebtoken";
import { config } from "../config";

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

export class McpClientService {
  private readonly CLIENT_ID_TTL_SECONDS = 365 * 24 * 60 * 60;

  registerClient(input: RegisterMcpClientInput): McpRegisteredClient {
    const grantTypes = input.grantTypes?.length
      ? [...input.grantTypes]
      : ["authorization_code"];
    const responseTypes = input.responseTypes?.length
      ? [...input.responseTypes]
      : ["code"];
    const tokenEndpointAuthMethod = input.tokenEndpointAuthMethod || "none";

    if (
      tokenEndpointAuthMethod !== "none" ||
      grantTypes.some((grantType) => grantType !== "authorization_code") ||
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

      if (
        payload.tokenType !== "mcp_oauth_client" ||
        !Array.isArray(payload.redirectUris) ||
        payload.redirectUris.length === 0
      ) {
        throw new Error("Invalid OAuth client");
      }

      if (
        payload.grantTypes?.some(
          (grantType) => grantType !== "authorization_code",
        ) ||
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
        grantTypes:
          payload.grantTypes && payload.grantTypes.length > 0
            ? [...payload.grantTypes]
            : ["authorization_code"],
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
