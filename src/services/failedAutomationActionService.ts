import { Prisma, PrismaClient } from "@prisma/client";

export interface FailedActionRecord {
  id: string;
  jobName: string;
  periodKey: string;
  actionType: string;
  entityType: string | null;
  entityId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  payload: unknown;
  retryable: boolean;
  retryCount: number;
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
}

export interface RecordFailedActionInput {
  userId: string;
  jobName: string;
  periodKey: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  errorCode?: string;
  errorMessage?: string;
  payload?: unknown;
  retryable?: boolean;
}

export class FailedAutomationActionService {
  constructor(private readonly prisma?: PrismaClient) {}

  async record(
    input: RecordFailedActionInput,
  ): Promise<FailedActionRecord | null> {
    if (!this.prisma) return null;

    const row = await this.prisma.failedAutomationAction.create({
      data: {
        userId: input.userId,
        jobName: input.jobName,
        periodKey: input.periodKey,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage?.slice(0, 1000),
        payload: input.payload as Prisma.InputJsonValue,
        retryable: input.retryable ?? false,
      },
    });
    return this.toRecord(row);
  }

  async list(
    userId: string,
    filters: {
      jobName?: string;
      periodKey?: string;
      includeResolved?: boolean;
      limit?: number;
    },
  ): Promise<FailedActionRecord[]> {
    if (!this.prisma) return [];

    const rows = await this.prisma.failedAutomationAction.findMany({
      where: {
        userId,
        ...(filters.jobName ? { jobName: filters.jobName } : {}),
        ...(filters.periodKey ? { periodKey: filters.periodKey } : {}),
        ...(filters.includeResolved ? {} : { resolvedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async listByEntity(
    entityType: string,
    entityId: string,
    filters: {
      actionType?: string;
      includeResolved?: boolean;
      limit?: number;
    } = {},
  ): Promise<FailedActionRecord[]> {
    if (!this.prisma) return [];

    const rows = await this.prisma.failedAutomationAction.findMany({
      where: {
        entityType,
        entityId,
        ...(filters.actionType ? { actionType: filters.actionType } : {}),
        ...(filters.includeResolved ? {} : { resolvedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async resolve(
    userId: string,
    id: string,
    resolution: "retried" | "dismissed",
  ): Promise<boolean> {
    if (!this.prisma) return false;

    const result = await this.prisma.failedAutomationAction.updateMany({
      where: { id, userId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolution },
    });
    return result.count > 0;
  }

  async resolveById(
    id: string,
    resolution: "retried" | "dismissed",
  ): Promise<boolean> {
    if (!this.prisma) return false;

    const result = await this.prisma.failedAutomationAction.updateMany({
      where: { id, resolvedAt: null },
      data: { resolvedAt: new Date(), resolution },
    });
    return result.count > 0;
  }

  async incrementRetryCount(userId: string, id: string): Promise<void> {
    if (!this.prisma) return;
    await this.prisma.failedAutomationAction.updateMany({
      where: { id, userId },
      data: { retryCount: { increment: 1 } },
    });
  }

  private toRecord(
    row: import("@prisma/client").FailedAutomationAction,
  ): FailedActionRecord {
    return {
      id: row.id,
      jobName: row.jobName,
      periodKey: row.periodKey,
      actionType: row.actionType,
      entityType: row.entityType,
      entityId: row.entityId,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      payload: row.payload,
      retryable: row.retryable,
      retryCount: row.retryCount,
      resolvedAt: row.resolvedAt,
      resolution: row.resolution,
      createdAt: row.createdAt,
    };
  }
}
