import { randomUUID } from "crypto";
import { Request, Response, Router } from "express";
import { AuthService } from "../services/authService";
import { McpOAuthService } from "../services/mcpOAuthService";
import { McpClientService } from "../services/mcpClientService";
import {
  renderOAuthConsentPage,
  renderOAuthErrorPage,
  renderOAuthLoginPage,
  renderOAuthRedirectPage,
} from "../mcp/mcpOAuthPages";
import {
  describeMcpScopes,
  validateExchangeMcpAuthorizationCodeInput,
  validateOAuthAuthorizeRequest,
  validateRegisterMcpClientInput,
  validateRevokeMcpOAuthTokenInput,
} from "../validation/mcpValidation";
import { config } from "../config";

interface McpPublicRouterDeps {
  authService?: AuthService;
  mcpOAuthService: McpOAuthService;
  mcpClientService: McpClientService;
}

interface LinkSession {
  token: string;
  userId: string;
  email: string;
}

function buildRequestId(req: Request): string {
  const headerId =
    req.header("x-request-id") ||
    req.header("x-mcp-request-id") ||
    req.header("x-agent-request-id");
  return typeof headerId === "string" && headerId.trim()
    ? headerId.trim()
    : randomUUID();
}

function readCookies(req: Request): Record<string, string> {
  const rawCookie = req.header("cookie");
  if (!rawCookie) {
    return {};
  }

  return rawCookie
    .split(";")
    .reduce<Record<string, string>>((cookies, part) => {
      const [name, ...rest] = part.split("=");
      if (!name || rest.length === 0) {
        return cookies;
      }
      cookies[name.trim()] = decodeURIComponent(rest.join("=").trim());
      return cookies;
    }, {});
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAgeSeconds?: number;
    expires?: string;
  } = {},
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/oauth",
    "HttpOnly",
    "SameSite=Lax",
    config.nodeEnv === "production" ? "Secure" : "",
  ].filter(Boolean);

  if (typeof options.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires}`);
  }

  return parts.join("; ");
}

function appendQuery(url: string, params: Record<string, string | undefined>) {
  const nextUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      nextUrl.searchParams.set(key, value);
    }
  }
  return nextUrl.toString();
}

function buildAuthorizeSearchParams(input: {
  clientId: string;
  redirectUri: string;
  responseType: "code";
  scope: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: input.responseType,
    scope: input.scope,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
  });
  if (input.state) {
    params.set("state", input.state);
  }
  return params.toString();
}

function setRequestId(res: Response, requestId: string) {
  res.setHeader("x-request-id", requestId);
}

function setNoStoreHeaders(res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function resolveLinkSession(
  req: Request,
  authService?: AuthService,
): LinkSession | null {
  if (!authService) {
    return null;
  }

  const cookieToken = readCookies(req)[config.mcpOauthSessionCookieName];
  if (!cookieToken) {
    return null;
  }

  try {
    const payload = authService.verifyToken(cookieToken);
    return {
      token: cookieToken,
      userId: payload.userId,
      email: payload.email,
    };
  } catch (_error) {
    return null;
  }
}

function clearLinkSession(res: Response) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(config.mcpOauthSessionCookieName, "", {
      expires: new Date(0).toUTCString(),
      maxAgeSeconds: 0,
    }),
  );
}

function setLinkSession(res: Response, token: string) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(config.mcpOauthSessionCookieName, token, {
      maxAgeSeconds: Math.floor(config.mcpOauthSessionMaxAgeMs / 1000),
    }),
  );
}

function logMcpOauthEvent(input: {
  requestId: string;
  event:
    | "registration_success"
    | "registration_error"
    | "authorize_view"
    | "authorize_error"
    | "login_success"
    | "login_error"
    | "approve_success"
    | "approve_error"
    | "deny"
    | "token_success"
    | "token_error"
    | "revoke_success"
    | "revoke_error";
  userId?: string;
  clientId?: string;
  clientName?: string;
  scopes?: string[];
  errorCode?: string;
}) {
  console.info(
    JSON.stringify({
      type: "assistant_mcp_oauth",
      requestId: input.requestId,
      event: input.event,
      userId: input.userId,
      clientId: input.clientId,
      clientName: input.clientName,
      scopes: input.scopes,
      errorCode: input.errorCode,
      ts: new Date().toISOString(),
    }),
  );
}

function sendOAuthTokenError(
  res: Response,
  status: number,
  input: {
    error: string;
    description: string;
    code: string;
    hint?: string;
  },
) {
  setNoStoreHeaders(res);
  return res.status(status).json({
    error: input.error,
    error_description: input.description,
    error_details: {
      code: input.code,
      message: input.description,
      retryable: false,
      ...(input.hint ? { hint: input.hint } : {}),
    },
  });
}

function mapTokenExchangeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  switch (message) {
    case "Invalid authorization code":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Authorization code is invalid",
        code: "MCP_AUTH_CODE_INVALID",
        hint: "Restart the connector auth flow and try again.",
      };
    case "Authorization code expired":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Authorization code expired",
        code: "MCP_AUTH_CODE_EXPIRED",
        hint: "Restart the connector auth flow and exchange the new code promptly.",
      };
    case "Authorization code already used":
      return {
        status: 409,
        error: "invalid_grant",
        description: "Authorization code already used",
        code: "MCP_AUTH_CODE_ALREADY_USED",
        hint: "Start a new auth flow to mint a fresh code.",
      };
    case "Authorization code binding mismatch":
    case "OAuth redirect URI mismatch":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Authorization code binding mismatch",
        code: "MCP_AUTH_CODE_BINDING_MISMATCH",
        hint: "Retry with the same client_id and redirect_uri used during authorization.",
      };
    case "Invalid code verifier":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Code verifier did not match the PKCE challenge",
        code: "MCP_INVALID_CODE_VERIFIER",
        hint: "Use the original PKCE verifier from the authorization request.",
      };
    case "Invalid refresh token":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Refresh token is invalid",
        code: "MCP_REFRESH_TOKEN_INVALID",
        hint: "Start a new auth flow or use the latest refresh token.",
      };
    case "Refresh token expired":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Refresh token expired",
        code: "MCP_REFRESH_TOKEN_EXPIRED",
        hint: "Restart the connector auth flow to mint a fresh token set.",
      };
    case "Refresh token already rotated":
      return {
        status: 409,
        error: "invalid_grant",
        description: "Refresh token already used",
        code: "MCP_REFRESH_TOKEN_REUSED",
        hint: "Retry with the newest refresh token returned by the prior exchange.",
      };
    case "Refresh token client mismatch":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Refresh token client binding mismatch",
        code: "MCP_REFRESH_TOKEN_CLIENT_MISMATCH",
        hint: "Use the same client_id that originally received the refresh token.",
      };
    case "Assistant session revoked":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Assistant session has been revoked",
        code: "MCP_ASSISTANT_SESSION_REVOKED",
        hint: "Reconnect the assistant to mint a fresh token set.",
      };
    case "Invalid OAuth client":
    case "OAuth client expired":
      return {
        status: 401,
        error: "invalid_client",
        description: "OAuth client is invalid",
        code: "MCP_INVALID_CLIENT",
        hint: "Register the client again and retry.",
      };
    case "Linked user account no longer exists":
      return {
        status: 401,
        error: "invalid_grant",
        description: "Linked user account no longer exists",
        code: "MCP_INVALID_SESSION",
        hint: "Have the user sign in again and reconnect the assistant.",
      };
    default:
      return {
        status: 500,
        error: "server_error",
        description: "OAuth token exchange failed",
        code: "MCP_OAUTH_TOKEN_EXCHANGE_FAILED",
        hint: "Retry the exchange. If it persists, inspect the server logs using the request ID.",
      };
  }
}

function mapAuthorizeError(message: string): {
  title: string;
  description: string;
  code: string;
} {
  switch (message) {
    case "Invalid OAuth client":
    case "OAuth client expired":
      return {
        title: "Invalid Client",
        description: "This assistant client is not registered or has expired.",
        code: "MCP_INVALID_CLIENT",
      };
    case "OAuth redirect URI mismatch":
      return {
        title: "Redirect URI Mismatch",
        description:
          "The redirect URI does not match the assistant client registration.",
        code: "MCP_REDIRECT_URI_MISMATCH",
      };
    default:
      return {
        title: "Authorization Error",
        description:
          message || "The assistant authorization request is invalid.",
        code: "MCP_OAUTH_AUTHORIZE_INVALID",
      };
  }
}

export function createMcpPublicRouter({
  authService,
  mcpOAuthService,
  mcpClientService,
}: McpPublicRouterDeps): Router {
  const router = Router();

  router.get("/oauth/logout", (_req, res) => {
    clearLinkSession(res);
    res.status(200).send(
      renderOAuthErrorPage({
        title: "Signed Out",
        message:
          "The local MCP linking session has been cleared on this device.",
        hint: "Disconnect active assistant sessions from the app or call POST /oauth/revoke to revoke issued MCP tokens.",
      }),
    );
  });

  router.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.status(200).json({
      resource: `${config.baseUrl}/mcp`,
      authorization_servers: [config.baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: [
        "tasks.read",
        "tasks.write",
        "projects.read",
        "projects.write",
      ],
    });
  });

  router.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.status(200).json({
      issuer: config.baseUrl,
      authorization_endpoint: `${config.baseUrl}/oauth/authorize`,
      token_endpoint: `${config.baseUrl}/oauth/token`,
      revocation_endpoint: `${config.baseUrl}/oauth/revoke`,
      registration_endpoint: `${config.baseUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [
        "tasks.read",
        "tasks.write",
        "projects.read",
        "projects.write",
      ],
    });
  });

  router.post("/oauth/register", (req, res) => {
    const requestId = buildRequestId(req);
    setRequestId(res, requestId);
    setNoStoreHeaders(res);

    try {
      const input = validateRegisterMcpClientInput(req.body);
      const registeredClient = mcpClientService.registerClient(input);

      logMcpOauthEvent({
        requestId,
        event: "registration_success",
        clientId: registeredClient.clientId,
        clientName: registeredClient.clientName,
      });

      res.status(201).json({
        client_id: registeredClient.clientId,
        client_id_issued_at: registeredClient.clientIdIssuedAt,
        redirect_uris: registeredClient.redirectUris,
        grant_types: registeredClient.grantTypes,
        response_types: registeredClient.responseTypes,
        token_endpoint_auth_method: registeredClient.tokenEndpointAuthMethod,
        ...(registeredClient.clientName
          ? { client_name: registeredClient.clientName }
          : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid client";
      const mapped = mapAuthorizeError(message);
      logMcpOauthEvent({
        requestId,
        event: "registration_error",
        errorCode: mapped.code,
      });
      sendOAuthTokenError(res, 400, {
        error: "invalid_client_metadata",
        description: mapped.description,
        code: mapped.code,
      });
    }
  });

  router.get("/oauth/authorize", async (req, res) => {
    const requestId = buildRequestId(req);
    setRequestId(res, requestId);
    setNoStoreHeaders(res);

    try {
      if (!authService) {
        logMcpOauthEvent({
          requestId,
          event: "authorize_error",
          errorCode: "MCP_NOT_CONFIGURED",
        });
        return res.status(501).send(
          renderOAuthErrorPage({
            title: "MCP Not Configured",
            message: "Authentication is not configured on this server.",
          }),
        );
      }

      const authorize = validateOAuthAuthorizeRequest(req.query);
      const client = mcpClientService.assertRedirectUri(
        authorize.clientId,
        authorize.redirectUri,
      );
      const scopeString = describeMcpScopes(authorize.scopes);
      const hiddenFields = {
        client_id: authorize.clientId,
        redirect_uri: authorize.redirectUri,
        response_type: authorize.responseType,
        scope: scopeString,
        state: authorize.state,
        code_challenge: authorize.codeChallenge,
        code_challenge_method: authorize.codeChallengeMethod,
      };

      const linkSession = resolveLinkSession(req, authService);
      if (!linkSession) {
        logMcpOauthEvent({
          requestId,
          event: "authorize_view",
          clientId: authorize.clientId,
          clientName: client.clientName,
          scopes: authorize.scopes,
        });
        return res.status(200).send(
          renderOAuthLoginPage({
            formAction: "/oauth/authorize/login",
            hiddenFields,
            clientName: client.clientName,
          }),
        );
      }

      logMcpOauthEvent({
        requestId,
        event: "authorize_view",
        userId: linkSession.userId,
        clientId: authorize.clientId,
        clientName: client.clientName,
        scopes: authorize.scopes,
      });
      res.status(200).send(
        renderOAuthConsentPage({
          clientName: client.clientName,
          userEmail: linkSession.email,
          scopes: authorize.scopes,
          formAction: "/oauth/authorize/decision",
          hiddenFields,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const mapped = mapAuthorizeError(message);
      logMcpOauthEvent({
        requestId,
        event: "authorize_error",
        errorCode: mapped.code,
      });
      res.status(400).send(
        renderOAuthErrorPage({
          title: mapped.title,
          message: mapped.description,
        }),
      );
    }
  });

  router.post("/oauth/authorize/login", async (req, res) => {
    const requestId = buildRequestId(req);
    setRequestId(res, requestId);
    setNoStoreHeaders(res);

    try {
      if (!authService) {
        throw new Error("Authentication not configured");
      }

      const authorize = validateOAuthAuthorizeRequest(req.body);
      const client = mcpClientService.assertRedirectUri(
        authorize.clientId,
        authorize.redirectUri,
      );
      const login = await authService.login({
        email: String(req.body.email || "")
          .trim()
          .toLowerCase(),
        password: String(req.body.password || ""),
      });

      setLinkSession(res, login.token);
      logMcpOauthEvent({
        requestId,
        event: "login_success",
        userId: login.user.id,
        clientId: authorize.clientId,
        clientName: client.clientName,
        scopes: authorize.scopes,
      });

      res.redirect(
        303,
        `/oauth/authorize?${buildAuthorizeSearchParams({
          clientId: authorize.clientId,
          redirectUri: authorize.redirectUri,
          responseType: authorize.responseType,
          scope: describeMcpScopes(authorize.scopes),
          state: authorize.state,
          codeChallenge: authorize.codeChallenge,
          codeChallengeMethod: authorize.codeChallengeMethod,
        })}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in";
      let mappedMessage = "Unable to sign in";
      if (
        message === "Invalid credentials" ||
        message === "Invalid token" ||
        message === "Token expired"
      ) {
        mappedMessage = "Email or password was incorrect.";
      } else if (message === "Authentication not configured") {
        mappedMessage = "Authentication is not configured on this server.";
      }

      const clientName =
        typeof req.body.client_id === "string"
          ? (() => {
              try {
                return mcpClientService.resolveClient(req.body.client_id)
                  .clientName;
              } catch (_error) {
                return undefined;
              }
            })()
          : undefined;

      logMcpOauthEvent({
        requestId,
        event: "login_error",
        clientId:
          typeof req.body.client_id === "string"
            ? req.body.client_id
            : undefined,
        clientName,
        errorCode: "MCP_OAUTH_LOGIN_FAILED",
      });

      res.status(401).send(
        renderOAuthLoginPage({
          error: mappedMessage,
          formAction: "/oauth/authorize/login",
          hiddenFields: {
            client_id:
              typeof req.body.client_id === "string"
                ? req.body.client_id
                : undefined,
            redirect_uri:
              typeof req.body.redirect_uri === "string"
                ? req.body.redirect_uri
                : undefined,
            response_type:
              typeof req.body.response_type === "string"
                ? req.body.response_type
                : undefined,
            scope:
              typeof req.body.scope === "string" ? req.body.scope : undefined,
            state:
              typeof req.body.state === "string" ? req.body.state : undefined,
            code_challenge:
              typeof req.body.code_challenge === "string"
                ? req.body.code_challenge
                : undefined,
            code_challenge_method:
              typeof req.body.code_challenge_method === "string"
                ? req.body.code_challenge_method
                : undefined,
          },
          clientName,
        }),
      );
    }
  });

  router.post("/oauth/authorize/decision", async (req, res) => {
    const requestId = buildRequestId(req);
    setRequestId(res, requestId);
    setNoStoreHeaders(res);

    try {
      if (!authService) {
        throw new Error("Authentication not configured");
      }

      const authorize = validateOAuthAuthorizeRequest(req.body);
      const client = mcpClientService.assertRedirectUri(
        authorize.clientId,
        authorize.redirectUri,
      );
      const linkSession = resolveLinkSession(req, authService);
      if (!linkSession) {
        throw new Error("Authorization session missing");
      }

      if (String(req.body.decision || "") !== "approve") {
        clearLinkSession(res);
        logMcpOauthEvent({
          requestId,
          event: "deny",
          userId: linkSession.userId,
          clientId: authorize.clientId,
          clientName: client.clientName,
          scopes: authorize.scopes,
        });
        return res.redirect(
          303,
          appendQuery(authorize.redirectUri, {
            error: "access_denied",
            state: authorize.state,
          }),
        );
      }

      const authCode = await mcpOAuthService.createAuthorizationCode({
        userId: linkSession.userId,
        email: linkSession.email,
        clientId: authorize.clientId,
        redirectUri: authorize.redirectUri,
        scopes: authorize.scopes,
        assistantName: client.clientName,
        state: authorize.state,
        codeChallenge: authorize.codeChallenge,
        codeChallengeMethod: authorize.codeChallengeMethod,
      });

      logMcpOauthEvent({
        requestId,
        event: "approve_success",
        userId: linkSession.userId,
        clientId: authorize.clientId,
        clientName: client.clientName,
        scopes: authorize.scopes,
      });

      const finalRedirectUri = appendQuery(authorize.redirectUri, {
        code: authCode.code,
        state: authorize.state,
      });
      // Use 303 + Location for server-side OAuth clients, but also send a
      // rich HTML body so embedded webviews / in-app browsers (e.g. ChatGPT)
      // can redirect via meta-refresh or JS when the Location header is not
      // automatically followed.
      res
        .status(303)
        .setHeader("Location", finalRedirectUri)
        .send(renderOAuthRedirectPage({ redirectUri: finalRedirectUri }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const mapped = mapAuthorizeError(message);
      logMcpOauthEvent({
        requestId,
        event: "approve_error",
        errorCode: mapped.code,
      });
      res.status(400).send(
        renderOAuthErrorPage({
          title: mapped.title,
          message: mapped.description,
        }),
      );
    }
  });

  router.post("/oauth/token", async (req, res) => {
    const requestId = buildRequestId(req);
    setRequestId(res, requestId);

    try {
      if (!authService) {
        logMcpOauthEvent({
          requestId,
          event: "token_error",
          errorCode: "MCP_NOT_CONFIGURED",
        });
        return sendOAuthTokenError(res, 501, {
          error: "server_error",
          description: "Authentication not configured",
          code: "MCP_NOT_CONFIGURED",
        });
      }

      const input = validateExchangeMcpAuthorizationCodeInput({
        grantType: req.body.grant_type || req.body.grantType,
        code: req.body.code,
        clientId: req.body.client_id || req.body.clientId,
        redirectUri: req.body.redirect_uri || req.body.redirectUri,
        codeVerifier: req.body.code_verifier || req.body.codeVerifier,
        refreshToken: req.body.refresh_token || req.body.refreshToken,
      });
      const client =
        input.grantType === "authorization_code"
          ? mcpClientService.assertRedirectUri(
              input.clientId,
              input.redirectUri,
            )
          : mcpClientService.resolveClient(input.clientId);
      const exchange =
        input.grantType === "authorization_code"
          ? await mcpOAuthService.exchangeAuthorizationCode({
              code: input.code,
              clientId: input.clientId,
              redirectUri: input.redirectUri,
              codeVerifier: input.codeVerifier,
            })
          : null;
      const refreshExchange =
        input.grantType === "refresh_token"
          ? await mcpOAuthService.exchangeRefreshToken({
              refreshToken: input.refreshToken,
              clientId: input.clientId,
            })
          : null;
      const linkedSession = exchange || refreshExchange!;
      const user = await authService.getUserById(linkedSession.userId);
      if (!user) {
        throw new Error("Linked user account no longer exists");
      }

      const existingSessionId =
        "sessionId" in linkedSession ? linkedSession.sessionId : undefined;
      const session = existingSessionId
        ? { id: existingSessionId }
        : await mcpOAuthService.createAssistantSession({
            userId: linkedSession.userId,
            scopes: linkedSession.scopes,
            assistantName: linkedSession.assistantName || client.clientName,
            clientId: linkedSession.clientId,
            source: "oauth",
          });
      const token = authService.createMcpToken({
        userId: linkedSession.userId,
        email: linkedSession.email,
        scopes: linkedSession.scopes,
        assistantName: linkedSession.assistantName || client.clientName,
        clientId: linkedSession.clientId,
        sessionId: session.id,
      });
      await mcpOAuthService.recordAccessTokenIssued(session.id);
      const shouldIssueRefreshToken =
        client.grantTypes.includes("refresh_token") ||
        input.grantType === "refresh_token";
      const issuedRefreshToken =
        shouldIssueRefreshToken && input.grantType === "authorization_code"
          ? await mcpOAuthService.createRefreshToken({
              userId: linkedSession.userId,
              email: linkedSession.email,
              scopes: linkedSession.scopes,
              assistantName: linkedSession.assistantName || client.clientName,
              clientId: linkedSession.clientId,
              sessionId: session.id,
            })
          : null;
      const rotatedRefreshToken =
        shouldIssueRefreshToken && refreshExchange
          ? {
              refreshToken: refreshExchange.refreshToken,
              expiresAt: refreshExchange.refreshTokenExpiresAt,
              expiresIn: refreshExchange.refreshTokenExpiresIn,
            }
          : null;
      const refreshTokenPayload = issuedRefreshToken || rotatedRefreshToken;

      logMcpOauthEvent({
        requestId,
        event: "token_success",
        userId: linkedSession.userId,
        clientId: linkedSession.clientId,
        clientName: client.clientName,
        scopes: linkedSession.scopes,
      });

      setNoStoreHeaders(res);
      res.status(200).json({
        access_token: token.token,
        token_type: token.tokenType,
        expires_in: token.expiresIn,
        scope: token.scope,
        ...(token.expiresAt ? { expires_at: token.expiresAt } : {}),
        session_id: session.id,
        ...(refreshTokenPayload
          ? {
              refresh_token: refreshTokenPayload.refreshToken,
              refresh_token_expires_at: refreshTokenPayload.expiresAt,
              refresh_token_expires_in: refreshTokenPayload.expiresIn,
            }
          : {}),
      });
    } catch (error) {
      const mapped = mapTokenExchangeError(error);
      logMcpOauthEvent({
        requestId,
        event: "token_error",
        errorCode: mapped.code,
      });
      sendOAuthTokenError(res, mapped.status, {
        error: mapped.error,
        description: mapped.description,
        code: mapped.code,
        hint: mapped.hint,
      });
    }
  });

  router.post("/oauth/revoke", async (req, res) => {
    const requestId = buildRequestId(req);
    setRequestId(res, requestId);
    setNoStoreHeaders(res);

    try {
      if (!authService) {
        logMcpOauthEvent({
          requestId,
          event: "revoke_error",
          errorCode: "MCP_NOT_CONFIGURED",
        });
        return sendOAuthTokenError(res, 501, {
          error: "server_error",
          description: "Authentication not configured",
          code: "MCP_NOT_CONFIGURED",
        });
      }

      const input = validateRevokeMcpOAuthTokenInput({
        token: req.body.token,
        clientId: req.body.client_id || req.body.clientId,
        tokenTypeHint: req.body.token_type_hint || req.body.tokenTypeHint,
      });

      let userId: string | undefined;
      if (input.tokenTypeHint !== "access_token") {
        const revokedRefreshToken = await mcpOAuthService.revokeRefreshToken({
          refreshToken: input.token,
          clientId: input.clientId,
        });
        if (revokedRefreshToken.userId) {
          userId = revokedRefreshToken.userId;
        }
      }

      if (!userId && input.tokenTypeHint !== "refresh_token") {
        try {
          const decoded = authService.decodeMcpToken(input.token);
          userId = decoded.userId;
          if (decoded.sessionId) {
            await mcpOAuthService.revokeAssistantSession({
              userId: decoded.userId,
              sessionId: decoded.sessionId,
            });
          } else {
            await authService.revokeAllMcpTokensForUser(decoded.userId);
            await mcpOAuthService.revokeAllAssistantSessions(decoded.userId);
          }
        } catch (_error) {
          // OAuth revocation is intentionally idempotent for invalid or expired tokens.
        }
      }

      logMcpOauthEvent({
        requestId,
        event: "revoke_success",
        userId,
        clientId: input.clientId,
      });
      return res.status(200).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Refresh token client mismatch") {
        logMcpOauthEvent({
          requestId,
          event: "revoke_error",
          errorCode: "MCP_REFRESH_TOKEN_CLIENT_MISMATCH",
        });
        return sendOAuthTokenError(res, 401, {
          error: "invalid_client",
          description: "Refresh token client binding mismatch",
          code: "MCP_REFRESH_TOKEN_CLIENT_MISMATCH",
          hint: "Use the same client_id that originally received the refresh token.",
        });
      }

      logMcpOauthEvent({
        requestId,
        event: "revoke_error",
        errorCode: "MCP_OAUTH_REVOKE_FAILED",
      });
      return sendOAuthTokenError(res, 500, {
        error: "server_error",
        description: "OAuth revocation failed",
        code: "MCP_OAUTH_REVOKE_FAILED",
        hint: "Retry the revoke request. If it persists, inspect the server logs using the request ID.",
      });
    }
  });

  return router;
}
