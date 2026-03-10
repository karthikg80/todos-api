import { randomUUID } from "crypto";
import { Request } from "express";

export interface AgentRequestContext {
  requestId: string;
  actor: string;
  idempotencyKey?: string;
}

declare global {
  namespace Express {
    interface Request {
      agentContext?: AgentRequestContext;
    }
  }
}

function readOptionalHeader(req: Request, name: string): string | undefined {
  const raw = req.header(name);
  if (typeof raw !== "string") {
    return undefined;
  }
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function getAgentRequestContext(req: Request): AgentRequestContext {
  if (req.agentContext) {
    return req.agentContext;
  }

  const actor =
    readOptionalHeader(req, "x-agent-name") ||
    readOptionalHeader(req, "user-agent") ||
    "unknown-agent";
  const requestId =
    readOptionalHeader(req, "x-agent-request-id") || randomUUID();
  const idempotencyKey = readOptionalHeader(req, "idempotency-key");

  req.agentContext = {
    requestId,
    actor,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };

  return req.agentContext;
}
