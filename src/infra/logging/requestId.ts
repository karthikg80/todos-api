/**
 * Request ID middleware — generates or propagates a correlation ID
 * for every HTTP request. The ID is available as req.requestId and
 * is set on the response as x-request-id.
 */
import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incomingId =
    req.header("x-request-id") ||
    req.header("x-mcp-request-id") ||
    req.header("x-agent-request-id");

  const requestId =
    typeof incomingId === "string" && incomingId.trim()
      ? incomingId.trim()
      : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
