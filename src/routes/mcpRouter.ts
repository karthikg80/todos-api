import { randomUUID } from "crypto";
import { Request, Response, Router } from "express";
import packageJson from "../../package.json";
import { AgentActionName, AgentExecutor } from "../agent/agentExecutor";
import { config } from "../config";
import { AuthService, McpTokenPayload } from "../services/authService";
import { McpScope } from "../types";
import {
  getMcpToolDefinition,
  listMcpTools,
  MCP_PROTOCOL_VERSION,
} from "../mcp/mcpToolCatalog";
import { hasMcpScope } from "../validation/mcpValidation";

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface McpRouterDeps {
  agentExecutor: AgentExecutor;
  authService?: AuthService;
}

type McpSession = McpTokenPayload;

function buildMcpRequestId(req: Request, requestId?: JsonRpcId): string {
  const headerId = req.header("x-mcp-request-id");
  if (typeof headerId === "string" && headerId.trim()) {
    return headerId.trim();
  }
  if (typeof requestId === "string" || typeof requestId === "number") {
    return `mcp-${requestId}`;
  }
  return randomUUID();
}

function buildActor(req: Request, session: McpSession): string {
  const assistantHeader = req.header("x-assistant-name");
  if (typeof assistantHeader === "string" && assistantHeader.trim()) {
    return assistantHeader.trim();
  }
  if (session.assistantName) {
    return session.assistantName;
  }
  const userAgent = req.header("user-agent");
  if (typeof userAgent === "string" && userAgent.trim()) {
    return userAgent.trim();
  }
  return "unknown-assistant";
}

function buildStructuredError(input: {
  code: string;
  message: string;
  retryable: boolean;
  hint?: string;
  details?: Record<string, unknown>;
}) {
  return {
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    ...(input.hint ? { hint: input.hint } : {}),
    ...(input.details ? { details: input.details } : {}),
  };
}

function jsonRpcSuccess(id: JsonRpcId, result: Record<string, unknown>) {
  return {
    jsonrpc: "2.0" as const,
    id,
    result,
  };
}

function jsonRpcError(input: {
  id: JsonRpcId;
  code: number;
  message: string;
  data: Record<string, unknown>;
}) {
  return {
    jsonrpc: "2.0" as const,
    id: input.id,
    error: {
      code: input.code,
      message: input.message,
      data: input.data,
    },
  };
}

function parseRequest(body: unknown): JsonRpcRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const request = body as Record<string, unknown>;
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return null;
  }
  if (
    request.id !== undefined &&
    request.id !== null &&
    typeof request.id !== "string" &&
    typeof request.id !== "number"
  ) {
    return null;
  }

  return {
    jsonrpc: "2.0",
    method: request.method,
    id: (request.id as JsonRpcId | undefined) ?? undefined,
    params: request.params,
  };
}

function logMcpRequest(input: {
  requestId: string;
  userId?: string;
  actor?: string;
  scopes?: McpScope[];
  method: string;
  outcome: "success" | "error";
  toolName?: string;
  errorCode?: string;
}) {
  console.info(
    JSON.stringify({
      type: "assistant_mcp_call",
      requestId: input.requestId,
      userId: input.userId,
      actor: input.actor,
      scopes: input.scopes,
      method: input.method,
      toolName: input.toolName,
      outcome: input.outcome,
      errorCode: input.errorCode,
      ts: new Date().toISOString(),
    }),
  );
}

function buildToolErrorResult(message: string, error: Record<string, unknown>) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: error,
    isError: true,
  };
}

function rejectUnexpectedOrigin(req: Request): Record<string, unknown> | null {
  const origin = req.header("origin");
  if (!origin) {
    return null;
  }
  if (config.corsOrigins.includes(origin)) {
    return null;
  }
  return buildStructuredError({
    code: "MCP_ORIGIN_NOT_ALLOWED",
    message: "Origin not allowed for MCP requests",
    retryable: false,
    hint: "Use a non-browser MCP client or configure the origin in CORS_ORIGINS.",
  });
}

function authenticateMcpRequest(
  req: Request,
  authService?: AuthService,
): {
  session?: McpSession;
  error?: Record<string, unknown>;
  httpStatus: number;
} {
  if (!authService) {
    return {
      httpStatus: 501,
      error: buildStructuredError({
        code: "MCP_NOT_CONFIGURED",
        message: "MCP is not configured",
        retryable: false,
        hint: "Enable application authentication before using the remote MCP surface.",
      }),
    };
  }

  const authHeader = req.header("authorization");
  if (!authHeader) {
    return {
      httpStatus: 401,
      error: buildStructuredError({
        code: "MCP_AUTH_REQUIRED",
        message: "Authorization header missing",
        retryable: false,
        hint: "Provide Authorization: Bearer <mcp-token>.",
      }),
    };
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return {
      httpStatus: 401,
      error: buildStructuredError({
        code: "MCP_INVALID_AUTHORIZATION_FORMAT",
        message: "Invalid authorization format. Expected: Bearer <token>",
        retryable: false,
        hint: "Send a bearer MCP token using the Authorization header.",
      }),
    };
  }

  try {
    return {
      httpStatus: 200,
      session: authService.verifyMcpToken(parts[1]),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Token expired") {
      return {
        httpStatus: 401,
        error: buildStructuredError({
          code: "MCP_TOKEN_EXPIRED",
          message: "Token expired",
          retryable: false,
          hint: "Mint a new MCP token via /auth/mcp/token and retry.",
        }),
      };
    }

    return {
      httpStatus: 401,
      error: buildStructuredError({
        code: "MCP_INVALID_TOKEN",
        message: "Invalid MCP token",
        retryable: false,
        hint: "Use a valid MCP token minted via /auth/mcp/token.",
      }),
    };
  }
}

function normalizeToolArguments(params: unknown): {
  name?: string;
  args: Record<string, unknown>;
  error?: Record<string, unknown>;
} {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {
      args: {},
      error: buildStructuredError({
        code: "MCP_INVALID_PARAMS",
        message: "tools/call params must be an object",
        retryable: false,
        hint: 'Provide { "name": string, "arguments": object }.',
      }),
    };
  }

  const rawParams = params as Record<string, unknown>;
  if (typeof rawParams.name !== "string" || !rawParams.name.trim()) {
    return {
      args: {},
      error: buildStructuredError({
        code: "MCP_TOOL_NAME_REQUIRED",
        message: "Tool name is required",
        retryable: false,
        hint: "Provide a valid tool name in params.name.",
      }),
    };
  }

  if (
    rawParams.arguments !== undefined &&
    (typeof rawParams.arguments !== "object" ||
      Array.isArray(rawParams.arguments))
  ) {
    return {
      name: rawParams.name.trim(),
      args: {},
      error: buildStructuredError({
        code: "MCP_INVALID_TOOL_ARGUMENTS",
        message: "Tool arguments must be an object",
        retryable: false,
        hint: "Provide tool arguments as a JSON object.",
      }),
    };
  }

  return {
    name: rawParams.name.trim(),
    args: (rawParams.arguments as Record<string, unknown>) || {},
  };
}

export function createMcpRouter({
  agentExecutor,
  authService,
}: McpRouterDeps): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    res.status(405).json({
      error: {
        code: "MCP_GET_NOT_SUPPORTED",
        message:
          "This MCP endpoint currently supports stateless POST requests only.",
      },
    });
  });

  router.post("/", async (req: Request, res: Response) => {
    const parsedRequest = parseRequest(req.body);
    const requestId = buildMcpRequestId(req, parsedRequest?.id);

    if (!parsedRequest) {
      logMcpRequest({
        requestId,
        method: "invalid_request",
        outcome: "error",
        errorCode: "MCP_INVALID_REQUEST",
      });
      res.status(400).json(
        jsonRpcError({
          id: null,
          code: -32600,
          message: "Invalid Request",
          data: buildStructuredError({
            code: "MCP_INVALID_REQUEST",
            message: "Request must be a JSON-RPC 2.0 object",
            retryable: false,
            hint: "Send a single JSON-RPC 2.0 request object to POST /mcp.",
          }),
        }),
      );
      return;
    }

    const originError = rejectUnexpectedOrigin(req);
    if (originError) {
      logMcpRequest({
        requestId,
        method: parsedRequest.method,
        outcome: "error",
        errorCode: originError.code as string,
      });
      res.status(403).json(
        jsonRpcError({
          id: parsedRequest.id ?? null,
          code: -32001,
          message: "Origin not allowed",
          data: originError,
        }),
      );
      return;
    }

    if (parsedRequest.method === "notifications/initialized") {
      logMcpRequest({
        requestId,
        method: parsedRequest.method,
        outcome: "success",
      });
      res.status(202).end();
      return;
    }

    const auth = authenticateMcpRequest(req, authService);
    if (!auth.session || auth.error) {
      logMcpRequest({
        requestId,
        method: parsedRequest.method,
        outcome: "error",
        errorCode: auth.error?.code as string | undefined,
      });
      res.status(auth.httpStatus).json(
        jsonRpcError({
          id: parsedRequest.id ?? null,
          code: -32001,
          message: auth.error?.message as string,
          data:
            auth.error ||
            buildStructuredError({
              code: "MCP_AUTH_FAILED",
              message: "Authentication failed",
              retryable: false,
            }),
        }),
      );
      return;
    }

    const session = auth.session;
    const actor = buildActor(req, session);

    switch (parsedRequest.method) {
      case "initialize": {
        logMcpRequest({
          requestId,
          method: parsedRequest.method,
          outcome: "success",
          userId: session.userId,
          actor,
          scopes: session.scopes,
        });
        res.status(200).json(
          jsonRpcSuccess(parsedRequest.id ?? null, {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: "todos-api-mcp",
              version: packageJson.version,
            },
            instructions:
              "Use tools/list to discover your scoped tools. This server is stateless, user-scoped, and expects a bearer MCP token minted through /auth/mcp/token.",
          }),
        );
        return;
      }
      case "ping": {
        logMcpRequest({
          requestId,
          method: parsedRequest.method,
          outcome: "success",
          userId: session.userId,
          actor,
          scopes: session.scopes,
        });
        res.status(200).json(jsonRpcSuccess(parsedRequest.id ?? null, {}));
        return;
      }
      case "tools/list": {
        const tools = listMcpTools({
          scopes: session.scopes,
          projectServiceEnabled: agentExecutor.hasProjectService(),
        });
        logMcpRequest({
          requestId,
          method: parsedRequest.method,
          outcome: "success",
          userId: session.userId,
          actor,
          scopes: session.scopes,
        });
        res.status(200).json(
          jsonRpcSuccess(parsedRequest.id ?? null, {
            tools,
          }),
        );
        return;
      }
      case "tools/call": {
        const normalized = normalizeToolArguments(parsedRequest.params);
        if (!normalized.name || normalized.error) {
          logMcpRequest({
            requestId,
            method: parsedRequest.method,
            outcome: "error",
            userId: session.userId,
            actor,
            scopes: session.scopes,
            errorCode: normalized.error?.code as string | undefined,
          });
          res.status(400).json(
            jsonRpcError({
              id: parsedRequest.id ?? null,
              code: -32602,
              message: normalized.error?.message as string,
              data:
                normalized.error ||
                buildStructuredError({
                  code: "MCP_INVALID_PARAMS",
                  message: "Invalid tool call params",
                  retryable: false,
                }),
            }),
          );
          return;
        }

        const tool = getMcpToolDefinition(normalized.name);
        if (
          !tool ||
          (tool.requiresProjectService && !agentExecutor.hasProjectService())
        ) {
          const error = buildStructuredError({
            code: "MCP_TOOL_NOT_FOUND",
            message: `Tool "${normalized.name}" is not available`,
            retryable: false,
            hint: "Call tools/list to discover the tools currently available to this token.",
          });
          logMcpRequest({
            requestId,
            method: parsedRequest.method,
            outcome: "error",
            userId: session.userId,
            actor,
            scopes: session.scopes,
            toolName: normalized.name,
            errorCode: error.code,
          });
          res.status(200).json(
            jsonRpcSuccess(
              parsedRequest.id ?? null,
              buildToolErrorResult(error.message, {
                ok: false,
                error,
                trace: {
                  requestId,
                  actor,
                },
              }),
            ),
          );
          return;
        }

        if (!hasMcpScope(session.scopes, tool.requiredScope)) {
          const error = buildStructuredError({
            code: "MCP_SCOPE_REQUIRED",
            message: `Tool "${tool.name}" requires ${tool.requiredScope} scope`,
            retryable: false,
            hint: "Mint a new MCP token with the required scopes via /auth/mcp/token.",
            details: {
              requiredScope: tool.requiredScope,
            },
          });
          logMcpRequest({
            requestId,
            method: parsedRequest.method,
            outcome: "error",
            userId: session.userId,
            actor,
            scopes: session.scopes,
            toolName: normalized.name,
            errorCode: error.code,
          });
          res.status(200).json(
            jsonRpcSuccess(
              parsedRequest.id ?? null,
              buildToolErrorResult(error.message, {
                ok: false,
                error,
                trace: {
                  requestId,
                  actor,
                },
              }),
            ),
          );
          return;
        }

        const toolArguments = { ...normalized.args };
        const idempotencyKey =
          tool.name === "create_task" &&
          typeof toolArguments.idempotencyKey === "string" &&
          toolArguments.idempotencyKey.trim()
            ? toolArguments.idempotencyKey.trim()
            : undefined;
        if ("idempotencyKey" in toolArguments) {
          delete toolArguments.idempotencyKey;
        }

        const result = await agentExecutor.execute(
          tool.name as AgentActionName,
          toolArguments,
          {
            userId: session.userId,
            requestId,
            actor,
            surface: "mcp",
            idempotencyKey,
          },
        );

        if (result.body.ok) {
          logMcpRequest({
            requestId,
            method: parsedRequest.method,
            outcome: "success",
            userId: session.userId,
            actor,
            scopes: session.scopes,
            toolName: normalized.name,
          });
          res.status(200).json(
            jsonRpcSuccess(parsedRequest.id ?? null, {
              content: [
                {
                  type: "text",
                  text: `${tool.name} completed successfully`,
                },
              ],
              structuredContent: result.body,
            }),
          );
          return;
        }

        logMcpRequest({
          requestId,
          method: parsedRequest.method,
          outcome: "error",
          userId: session.userId,
          actor,
          scopes: session.scopes,
          toolName: normalized.name,
          errorCode: result.body.error.code,
        });
        res
          .status(200)
          .json(
            jsonRpcSuccess(
              parsedRequest.id ?? null,
              buildToolErrorResult(result.body.error.message, result.body),
            ),
          );
        return;
      }
      default: {
        const error = buildStructuredError({
          code: "MCP_METHOD_NOT_FOUND",
          message: `Method "${parsedRequest.method}" is not supported`,
          retryable: false,
          hint: "Use initialize, ping, tools/list, or tools/call.",
        });
        logMcpRequest({
          requestId,
          method: parsedRequest.method,
          outcome: "error",
          userId: session.userId,
          actor,
          scopes: session.scopes,
          errorCode: error.code,
        });
        res.status(404).json(
          jsonRpcError({
            id: parsedRequest.id ?? null,
            code: -32601,
            message: "Method not found",
            data: error,
          }),
        );
      }
    }
  });

  return router;
}
