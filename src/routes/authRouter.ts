import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { randomUUID } from "crypto";
import { AuthService } from "../services/authService";
import { McpOAuthService } from "../services/mcpOAuthService";
import { validateRegister, validateLogin } from "../validation/authValidation";
import { HttpError } from "../errorHandling";
import { buildStructuredMcpError, mapAgentFacingError } from "../mcp/mcpErrors";
import {
  validateCreateMcpAuthorizationCodeInput,
  validateCreateMcpTokenInput,
  validateExchangeMcpAuthorizationCodeInput,
} from "../validation/mcpValidation";

interface AuthRouterDeps {
  authService?: AuthService;
  mcpOAuthService: McpOAuthService;
  authLimiter: RequestHandler;
  emailActionLimiter: RequestHandler;
  requireAuthIfConfigured: RequestHandler;
}

function buildLinkRequestId(req: Request): string {
  const headerId =
    req.header("x-mcp-request-id") || req.header("x-agent-request-id");
  return typeof headerId === "string" && headerId.trim()
    ? headerId.trim()
    : randomUUID();
}

function logMcpLinkEvent(input: {
  requestId: string;
  event:
    | "authorize_success"
    | "authorize_error"
    | "token_exchange_success"
    | "token_exchange_error"
    | "legacy_token_success"
    | "legacy_token_error";
  userId?: string;
  clientId?: string;
  assistantName?: string;
  scopes?: string[];
  errorCode?: string;
}) {
  console.info(
    JSON.stringify({
      type: "assistant_mcp_auth",
      requestId: input.requestId,
      event: input.event,
      userId: input.userId,
      clientId: input.clientId,
      assistantName: input.assistantName,
      scopes: input.scopes,
      errorCode: input.errorCode,
      ts: new Date().toISOString(),
    }),
  );
}

function sendStructuredError(
  res: Response,
  status: number,
  error: ReturnType<typeof buildStructuredMcpError>,
) {
  return res.status(status).json({ error });
}

async function resolveAppUserForMcpLink(
  req: Request,
  authService?: AuthService,
): Promise<
  | {
      user: {
        id: string;
        email: string;
        name: string | null;
        isVerified: boolean;
      };
    }
  | { httpStatus: number; error: ReturnType<typeof buildStructuredMcpError> }
> {
  if (!authService) {
    return {
      httpStatus: 501,
      error: buildStructuredMcpError({
        code: "MCP_NOT_CONFIGURED",
        message: "Authentication not configured",
        retryable: false,
        hint: "Enable application authentication before linking an assistant.",
      }),
    };
  }

  const authHeader = req.header("authorization");
  if (!authHeader) {
    return {
      httpStatus: 401,
      error: buildStructuredMcpError({
        code: "MCP_LINK_UNAUTHENTICATED",
        message: "Authorization header missing",
        retryable: false,
        hint: "Sign in to the app and send the app bearer token when starting account linking.",
      }),
    };
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return {
      httpStatus: 401,
      error: buildStructuredMcpError({
        code: "MCP_LINK_INVALID_AUTHORIZATION",
        message: "Invalid authorization format. Expected: Bearer <token>",
        retryable: false,
        hint: "Send the app access token as a bearer token.",
      }),
    };
  }

  try {
    const payload = authService.verifyToken(parts[1]);
    const user = await authService.getUserById(payload.userId);
    if (!user) {
      return {
        httpStatus: 401,
        error: buildStructuredMcpError({
          code: "MCP_LINK_INVALID_SESSION",
          message: "App session no longer maps to a valid user",
          retryable: false,
          hint: "Sign in again before linking an assistant.",
        }),
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const mapped =
      message === "Token expired"
        ? buildStructuredMcpError({
            code: "MCP_LINK_AUTH_EXPIRED",
            message: "App access token expired",
            retryable: false,
            hint: "Refresh the app session or sign in again before linking an assistant.",
          })
        : buildStructuredMcpError({
            code: "MCP_LINK_INVALID_TOKEN",
            message: "Invalid app access token",
            retryable: false,
            hint: "Use a valid app access token when starting the account-link flow.",
          });
    return {
      httpStatus: 401,
      error: mapped,
    };
  }
}

function mapAuthorizationCodeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  switch (message) {
    case "Invalid authorization code":
      return {
        status: 401,
        error: buildStructuredMcpError({
          code: "MCP_AUTH_CODE_INVALID",
          message: "Authorization code is invalid",
          retryable: false,
          hint: "Restart the assistant linking flow to mint a fresh code.",
        }),
      };
    case "Authorization code expired":
      return {
        status: 401,
        error: buildStructuredMcpError({
          code: "MCP_AUTH_CODE_EXPIRED",
          message: "Authorization code expired",
          retryable: false,
          hint: "Restart the assistant linking flow and exchange the new code promptly.",
        }),
      };
    case "Authorization code already used":
      return {
        status: 409,
        error: buildStructuredMcpError({
          code: "MCP_AUTH_CODE_ALREADY_USED",
          message: "Authorization code already used",
          retryable: false,
          hint: "Start a new assistant linking flow to mint a fresh code.",
        }),
      };
    case "Authorization code binding mismatch":
      return {
        status: 401,
        error: buildStructuredMcpError({
          code: "MCP_AUTH_CODE_BINDING_MISMATCH",
          message: "Authorization code client binding mismatch",
          retryable: false,
          hint: "Retry the exchange with the same clientId and redirectUri used during authorization.",
        }),
      };
    case "Invalid code verifier":
      return {
        status: 401,
        error: buildStructuredMcpError({
          code: "MCP_INVALID_CODE_VERIFIER",
          message: "Code verifier did not match the authorization challenge",
          retryable: false,
          hint: "Use the original PKCE verifier that matches the code challenge.",
        }),
      };
    case "Invalid refresh token":
      return {
        status: 401,
        error: buildStructuredMcpError({
          code: "MCP_REFRESH_TOKEN_INVALID",
          message: "Refresh token is invalid",
          retryable: false,
          hint: "Start a new assistant link flow or use the newest refresh token.",
        }),
      };
    case "Refresh token expired":
      return {
        status: 401,
        error: buildStructuredMcpError({
          code: "MCP_REFRESH_TOKEN_EXPIRED",
          message: "Refresh token expired",
          retryable: false,
          hint: "Repeat the assistant link flow to mint a fresh token set.",
        }),
      };
    case "Refresh token already rotated":
      return {
        status: 409,
        error: buildStructuredMcpError({
          code: "MCP_REFRESH_TOKEN_REUSED",
          message: "Refresh token already rotated",
          retryable: false,
          hint: "Retry with the newest refresh token returned by the previous exchange.",
        }),
      };
    case "Refresh token client mismatch":
      return {
        status: 401,
        error: buildStructuredMcpError({
          code: "MCP_REFRESH_TOKEN_CLIENT_MISMATCH",
          message: "Refresh token client binding mismatch",
          retryable: false,
          hint: "Use the same clientId that originally received the refresh token.",
        }),
      };
    default:
      return mapAgentFacingError(error);
  }
}

export function createAuthRouter({
  authService,
  mcpOAuthService,
  authLimiter,
  emailActionLimiter,
  requireAuthIfConfigured,
}: AuthRouterDeps): Router {
  const router = Router();

  router.post(
    "/register",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const validation = validateRegister(req.body);

        if (!validation.valid) {
          return res.status(400).json({
            error: "Validation failed",
            errors: validation.errors,
          });
        }

        const result = await authService.register(validation.dto!);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/login",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const validation = validateLogin(req.body);

        if (!validation.valid) {
          return res.status(400).json({
            error: "Validation failed",
            errors: validation.errors,
          });
        }

        const result = await authService.login(validation.dto!);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/refresh",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          throw new HttpError(400, "Refresh token required");
        }

        const result = await authService.refreshAccessToken(refreshToken);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/logout",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const { refreshToken } = req.body;

        if (refreshToken) {
          await authService.revokeRefreshToken(refreshToken);
        }

        res.json({ message: "Logged out successfully" });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/verify",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      const wantsHtml = (req.get("accept") || "").includes("text/html");

      try {
        const token = req.query.token as string;

        if (!token || typeof token !== "string") {
          throw new HttpError(400, "Verification token required");
        }

        await authService.verifyEmail(token);
        if (wantsHtml) {
          return res.redirect(303, "/?verified=1");
        }
        res.json({ message: "Email verified successfully" });
      } catch (error) {
        if (wantsHtml) {
          return res.redirect(303, "/?verified=0");
        }
        next(error);
      }
    },
  );

  router.post(
    "/resend-verification",
    emailActionLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const { email } = req.body;
        const normalizedEmail =
          typeof email === "string" ? email.trim().toLowerCase() : "";

        if (!normalizedEmail) {
          return res.status(400).json({ error: "Email required" });
        }

        const user = await authService.getUserByEmail(normalizedEmail);

        if (user && !user.isVerified) {
          authService.dispatchVerificationEmail(
            user.id,
            "Failed to send verification email after resend request:",
          );
        }

        res.json({
          message:
            "If the email exists and is not verified, a verification link has been sent",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/mcp/token",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestId = buildLinkRequestId(req);
        const resolvedUser = await resolveAppUserForMcpLink(req, authService);
        if ("error" in resolvedUser) {
          logMcpLinkEvent({
            requestId,
            event: "legacy_token_error",
            errorCode: resolvedUser.error.code,
          });
          return sendStructuredError(
            res,
            resolvedUser.httpStatus,
            resolvedUser.error,
          );
        }

        const input = validateCreateMcpTokenInput(req.body);
        const token = authService!.createMcpToken({
          userId: resolvedUser.user.id,
          email: resolvedUser.user.email,
          scopes: input.scopes,
          assistantName: input.assistantName,
          clientId: input.clientId,
        });

        logMcpLinkEvent({
          requestId,
          event: "legacy_token_success",
          userId: resolvedUser.user.id,
          clientId: input.clientId,
          assistantName: input.assistantName,
          scopes: input.scopes,
        });
        res.status(201).json(token);
      } catch (error) {
        const requestId = buildLinkRequestId(req);
        const mapped = mapAgentFacingError(error);
        logMcpLinkEvent({
          requestId,
          event: "legacy_token_error",
          errorCode: mapped.error.code,
        });
        sendStructuredError(res, mapped.status, mapped.error);
      }
    },
  );

  router.post(
    "/mcp/oauth/authorize",
    authLimiter,
    async (req: Request, res: Response) => {
      const requestId = buildLinkRequestId(req);

      try {
        const resolvedUser = await resolveAppUserForMcpLink(req, authService);
        if ("error" in resolvedUser) {
          logMcpLinkEvent({
            requestId,
            event: "authorize_error",
            errorCode: resolvedUser.error.code,
          });
          return sendStructuredError(
            res,
            resolvedUser.httpStatus,
            resolvedUser.error,
          );
        }

        const input = validateCreateMcpAuthorizationCodeInput(req.body);
        const authCode = await mcpOAuthService.createAuthorizationCode({
          userId: resolvedUser.user.id,
          email: resolvedUser.user.email,
          clientId: input.clientId,
          redirectUri: input.redirectUri,
          scopes: input.scopes,
          assistantName: input.assistantName,
          state: input.state,
          codeChallenge: input.codeChallenge,
          codeChallengeMethod: input.codeChallengeMethod,
        });

        logMcpLinkEvent({
          requestId,
          event: "authorize_success",
          userId: resolvedUser.user.id,
          clientId: input.clientId,
          assistantName: input.assistantName,
          scopes: input.scopes,
        });
        res.status(201).json({
          authorizationCode: authCode.code,
          expiresAt: authCode.expiresAt,
          redirectUri: authCode.redirectUri,
          scopes: authCode.scopes,
          ...(authCode.assistantName
            ? { assistantName: authCode.assistantName }
            : {}),
          ...(authCode.state ? { state: authCode.state } : {}),
          tokenEndpoint: "/auth/mcp/oauth/token",
        });
      } catch (error) {
        const mapped = mapAgentFacingError(error);
        logMcpLinkEvent({
          requestId,
          event: "authorize_error",
          errorCode: mapped.error.code,
        });
        sendStructuredError(res, mapped.status, mapped.error);
      }
    },
  );

  router.post(
    "/mcp/oauth/token",
    authLimiter,
    async (req: Request, res: Response) => {
      const requestId = buildLinkRequestId(req);

      try {
        if (!authService) {
          const error = buildStructuredMcpError({
            code: "MCP_NOT_CONFIGURED",
            message: "Authentication not configured",
            retryable: false,
            hint: "Enable application authentication before linking an assistant.",
          });
          logMcpLinkEvent({
            requestId,
            event: "token_exchange_error",
            errorCode: error.code,
          });
          return sendStructuredError(res, 501, error);
        }

        const input = validateExchangeMcpAuthorizationCodeInput(req.body);
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
          const error = buildStructuredMcpError({
            code: "MCP_INVALID_SESSION",
            message: "Linked user account no longer exists",
            retryable: false,
            hint: "Link the assistant again from an active app user account.",
          });
          logMcpLinkEvent({
            requestId,
            event: "token_exchange_error",
            clientId: input.clientId,
            errorCode: error.code,
          });
          return sendStructuredError(res, 401, error);
        }

        const token = authService.createMcpToken({
          userId: linkedSession.userId,
          email: linkedSession.email,
          scopes: linkedSession.scopes,
          assistantName: linkedSession.assistantName,
          clientId: linkedSession.clientId,
        });
        const refreshToken =
          input.grantType === "authorization_code"
            ? await mcpOAuthService.createRefreshToken({
                userId: linkedSession.userId,
                email: linkedSession.email,
                scopes: linkedSession.scopes,
                assistantName: linkedSession.assistantName,
                clientId: linkedSession.clientId,
              })
            : null;
        const refreshTokenPayload = refreshExchange
          ? {
              refreshToken: refreshExchange.refreshToken,
              expiresAt: refreshExchange.refreshTokenExpiresAt,
              expiresIn: refreshExchange.refreshTokenExpiresIn,
            }
          : refreshToken;

        logMcpLinkEvent({
          requestId,
          event: "token_exchange_success",
          userId: linkedSession.userId,
          clientId: linkedSession.clientId,
          assistantName: linkedSession.assistantName,
          scopes: linkedSession.scopes,
        });
        res.status(200).json({
          accessToken: token.token,
          tokenType: token.tokenType,
          expiresAt: token.expiresAt,
          expiresIn: token.expiresIn,
          scope: token.scope,
          scopes: token.scopes,
          ...(token.assistantName
            ? { assistantName: token.assistantName }
            : {}),
          ...(token.clientId ? { clientId: token.clientId } : {}),
          refreshToken: refreshTokenPayload!.refreshToken,
          refreshTokenExpiresAt: refreshTokenPayload!.expiresAt,
          refreshTokenExpiresIn: refreshTokenPayload!.expiresIn,
        });
      } catch (error) {
        const mapped = mapAuthorizationCodeError(error);
        logMcpLinkEvent({
          requestId,
          event: "token_exchange_error",
          errorCode: mapped.error.code,
        });
        sendStructuredError(res, mapped.status, mapped.error);
      }
    },
  );

  router.post(
    "/forgot-password",
    emailActionLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const email = req.body.email as string;
        const normalizedEmail =
          typeof email === "string" ? email.trim().toLowerCase() : "";

        if (!normalizedEmail) {
          return res.status(400).json({ error: "Email required" });
        }

        await authService.requestPasswordReset(normalizedEmail);
        res.json({
          message: "If the email exists, a reset link has been sent",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/reset-password",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const token = req.body.token as string;
        const password = req.body.password as string;

        if (!token || !password) {
          return res.status(400).json({ error: "Token and password required" });
        }

        if (password.length < 8) {
          return res
            .status(400)
            .json({ error: "Password must be at least 8 characters" });
        }

        if (password.length > 72) {
          return res
            .status(400)
            .json({ error: "Password cannot exceed 72 characters" });
        }

        await authService.resetPassword(token, password);
        res.json({ message: "Password reset successfully" });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/bootstrap-admin/status",
    requireAuthIfConfigured,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const status = await authService.getAdminBootstrapStatus(userId);
        res.json(status);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/bootstrap-admin",
    authLimiter,
    requireAuthIfConfigured,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const secret =
          typeof req.body.secret === "string" ? req.body.secret.trim() : "";
        if (!secret) {
          return res.status(400).json({ error: "Bootstrap secret required" });
        }

        const user = await authService.bootstrapAdmin(userId, secret);
        res.json({ message: "Admin access granted", user });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
