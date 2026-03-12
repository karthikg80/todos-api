import { Prisma, PrismaClient } from "@prisma/client";

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
}

export class AgentAuditService {
  constructor(private readonly prisma?: PrismaClient) {}

  async record(input: AgentAuditRecordInput): Promise<void> {
    if (!this.prisma) {
      return;
    }

    const metadata: Prisma.InputJsonValue = {
      ts: new Date().toISOString(),
    };

    await this.prisma.agentActionAudit.create({
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
        metadata,
      },
    });
  }
}
