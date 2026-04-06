import { Prisma, PrismaClient } from "@prisma/client";
import { RationaleMetadata } from "../ai/decisionSource";

interface AgentAuditRecordInput {
  surface: "agent" | "mcp";
  action: string;
  readOnly: boolean;
  outcome: "success" | "error";
  status: number;
  userId: string;
  requestId: string;
  actor: string;
  idempotencyKey?: string;
  replayed?: boolean;
  errorCode?: string;
  jobName?: string;
  jobPeriodKey?: string;
  triggeredBy?: "user" | "automation" | "agent";
  agentId?: string;
  narration?: string;
}

export class AgentAuditService {
  constructor(private readonly prisma?: PrismaClient) {}

  async logWithRationale(
    ctx: {
      userId: string;
      requestId: string;
      actor: string;
      surface: string;
    },
    action: string,
    outcome: "success" | "error",
    rationaleMetadata: RationaleMetadata,
  ): Promise<void> {
    if (!this.prisma) {
      return;
    }

    const metadata: Prisma.InputJsonValue = {
      ts: new Date().toISOString(),
      rationale: rationaleMetadata as unknown as Prisma.InputJsonObject,
    };

    // Fire and forget to avoid blocking or crashing on high concurrency
    this.prisma.agentActionAudit
      .create({
        data: {
          surface: ctx.surface as "agent" | "mcp",
          action,
          readOnly: false,
          outcome,
          status: outcome === "success" ? 200 : 500,
          userId: ctx.userId,
          requestId: ctx.requestId,
          actor: ctx.actor,
          replayed: false,
          metadata,
        },
      })
      .catch((err) => {
        console.error(
          "Non-fatal error auditing agent action with rationale:",
          err,
        );
      });
  }

  async record(input: AgentAuditRecordInput): Promise<void> {
    if (!this.prisma) {
      return;
    }

    const metadata: Prisma.InputJsonValue = {
      ts: new Date().toISOString(),
    };

    // Fire and forget to avoid blocking or crashing on high concurrency
    this.prisma.agentActionAudit
      .create({
        data: {
          surface: input.surface,
          action: input.action,
          readOnly: input.readOnly,
          outcome: input.outcome,
          status: input.status,
          userId: input.userId,
          requestId: input.requestId,
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
          replayed: input.replayed || false,
          errorCode: input.errorCode,
          jobName: input.jobName,
          jobPeriodKey: input.jobPeriodKey,
          triggeredBy: input.triggeredBy,
          agentId: input.agentId,
          narration: input.narration,
          metadata,
        },
      })
      .catch((err) => {
        console.error("Non-fatal error auditing agent action:", err);
      });
  }
}
