import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

export type AiSuggestionType = "task_critic" | "plan_from_goal";
export type AiSuggestionStatus = "pending" | "accepted" | "rejected";

export interface AiSuggestionRecord {
  id: string;
  userId: string;
  type: AiSuggestionType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  feedback?: Record<string, unknown>;
  appliedAt?: Date;
  appliedTodoIds?: string[];
  status: AiSuggestionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAiSuggestionStore {
  create(record: {
    userId: string;
    type: AiSuggestionType;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }): Promise<AiSuggestionRecord>;
  listByUser(userId: string, limit: number): Promise<AiSuggestionRecord[]>;
  getById(userId: string, id: string): Promise<AiSuggestionRecord | null>;
  countByUserSince(userId: string, since: Date): Promise<number>;
  markApplied(
    userId: string,
    id: string,
    appliedTodoIds: string[],
    feedback?: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null>;
  updateStatus(
    userId: string,
    id: string,
    status: AiSuggestionStatus,
    feedback?: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null>;
}

export class InMemoryAiSuggestionStore implements IAiSuggestionStore {
  private records: AiSuggestionRecord[] = [];

  async create(record: {
    userId: string;
    type: AiSuggestionType;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }): Promise<AiSuggestionRecord> {
    const now = new Date();
    const created: AiSuggestionRecord = {
      id: randomUUID(),
      userId: record.userId,
      type: record.type,
      input: record.input,
      output: record.output,
      feedback: undefined,
      appliedAt: undefined,
      appliedTodoIds: undefined,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.records.unshift(created);
    return created;
  }

  async listByUser(
    userId: string,
    limit: number,
  ): Promise<AiSuggestionRecord[]> {
    return this.records
      .filter((record) => record.userId === userId)
      .slice(0, limit);
  }

  async getById(
    userId: string,
    id: string,
  ): Promise<AiSuggestionRecord | null> {
    const record = this.records.find(
      (item) => item.id === id && item.userId === userId,
    );
    return record || null;
  }

  async countByUserSince(userId: string, since: Date): Promise<number> {
    return this.records.filter(
      (record) => record.userId === userId && record.createdAt >= since,
    ).length;
  }

  async markApplied(
    userId: string,
    id: string,
    appliedTodoIds: string[],
    feedback?: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null> {
    const index = this.records.findIndex(
      (record) => record.id === id && record.userId === userId,
    );
    if (index === -1) {
      return null;
    }

    const existing = this.records[index];
    if (existing.status === "rejected") {
      return existing;
    }
    if (existing.status === "accepted" && existing.appliedTodoIds?.length) {
      return existing;
    }

    const updated = {
      ...existing,
      status: "accepted" as const,
      feedback,
      appliedAt: new Date(),
      appliedTodoIds,
      updatedAt: new Date(),
    };
    this.records[index] = updated;
    return updated;
  }

  async updateStatus(
    userId: string,
    id: string,
    status: AiSuggestionStatus,
    feedback?: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null> {
    const index = this.records.findIndex(
      (record) => record.id === id && record.userId === userId,
    );
    if (index === -1) {
      return null;
    }
    const updated = {
      ...this.records[index],
      status,
      feedback,
      updatedAt: new Date(),
    };
    this.records[index] = updated;
    return updated;
  }
}

export class PrismaAiSuggestionStore implements IAiSuggestionStore {
  constructor(private prisma: PrismaClient) {}

  async create(record: {
    userId: string;
    type: AiSuggestionType;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }): Promise<AiSuggestionRecord> {
    const created = await this.prisma.aiSuggestion.create({
      data: {
        userId: record.userId,
        type: record.type,
        input: record.input as Prisma.InputJsonValue,
        output: record.output as Prisma.InputJsonValue,
        status: "pending",
      },
    });

    return {
      id: created.id,
      userId: created.userId,
      type: created.type as AiSuggestionType,
      input: created.input as Record<string, unknown>,
      output: created.output as Record<string, unknown>,
      feedback: (created.feedback as Record<string, unknown>) || undefined,
      appliedAt: created.appliedAt || undefined,
      appliedTodoIds:
        (created.appliedTodoIds as string[] | null | undefined) || undefined,
      status: created.status as AiSuggestionStatus,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async listByUser(
    userId: string,
    limit: number,
  ): Promise<AiSuggestionRecord[]> {
    const records = await this.prisma.aiSuggestion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return records.map((record) => ({
      id: record.id,
      userId: record.userId,
      type: record.type as AiSuggestionType,
      input: record.input as Record<string, unknown>,
      output: record.output as Record<string, unknown>,
      feedback: (record.feedback as Record<string, unknown>) || undefined,
      appliedAt: record.appliedAt || undefined,
      appliedTodoIds:
        (record.appliedTodoIds as string[] | null | undefined) || undefined,
      status: record.status as AiSuggestionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async getById(
    userId: string,
    id: string,
  ): Promise<AiSuggestionRecord | null> {
    const record = await this.prisma.aiSuggestion.findUnique({
      where: { id },
    });

    if (!record || record.userId !== userId) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      type: record.type as AiSuggestionType,
      input: record.input as Record<string, unknown>,
      output: record.output as Record<string, unknown>,
      feedback: (record.feedback as Record<string, unknown>) || undefined,
      appliedAt: record.appliedAt || undefined,
      appliedTodoIds:
        (record.appliedTodoIds as string[] | null | undefined) || undefined,
      status: record.status as AiSuggestionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async countByUserSince(userId: string, since: Date): Promise<number> {
    return this.prisma.aiSuggestion.count({
      where: {
        userId,
        createdAt: {
          gte: since,
        },
      },
    });
  }

  async markApplied(
    userId: string,
    id: string,
    appliedTodoIds: string[],
    feedback?: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null> {
    const existing = await this.prisma.aiSuggestion.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== userId) {
      return null;
    }
    if (existing.status === "rejected") {
      return {
        id: existing.id,
        userId: existing.userId,
        type: existing.type as AiSuggestionType,
        input: existing.input as Record<string, unknown>,
        output: existing.output as Record<string, unknown>,
        feedback: (existing.feedback as Record<string, unknown>) || undefined,
        appliedAt: existing.appliedAt || undefined,
        appliedTodoIds:
          (existing.appliedTodoIds as string[] | null | undefined) || undefined,
        status: existing.status as AiSuggestionStatus,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }
    if (existing.status === "accepted" && existing.appliedTodoIds) {
      return {
        id: existing.id,
        userId: existing.userId,
        type: existing.type as AiSuggestionType,
        input: existing.input as Record<string, unknown>,
        output: existing.output as Record<string, unknown>,
        feedback: (existing.feedback as Record<string, unknown>) || undefined,
        appliedAt: existing.appliedAt || undefined,
        appliedTodoIds:
          (existing.appliedTodoIds as string[] | null | undefined) || undefined,
        status: existing.status as AiSuggestionStatus,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    const now = new Date();
    const updateResult = await this.prisma.aiSuggestion.updateMany({
      where: { id, userId, status: "pending" },
      data: {
        status: "accepted",
        feedback: feedback as Prisma.InputJsonValue | undefined,
        appliedAt: now,
        appliedTodoIds: appliedTodoIds as unknown as Prisma.InputJsonValue,
      },
    });

    if (updateResult.count !== 1) {
      const latest = await this.prisma.aiSuggestion.findUnique({
        where: { id },
      });
      if (!latest || latest.userId !== userId) {
        return null;
      }
      return {
        id: latest.id,
        userId: latest.userId,
        type: latest.type as AiSuggestionType,
        input: latest.input as Record<string, unknown>,
        output: latest.output as Record<string, unknown>,
        feedback: (latest.feedback as Record<string, unknown>) || undefined,
        appliedAt: latest.appliedAt || undefined,
        appliedTodoIds:
          (latest.appliedTodoIds as string[] | null | undefined) || undefined,
        status: latest.status as AiSuggestionStatus,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt,
      };
    }

    const record = await this.prisma.aiSuggestion.findUnique({
      where: { id },
    });
    if (!record || record.userId !== userId) {
      return null;
    }
    return {
      id: record.id,
      userId: record.userId,
      type: record.type as AiSuggestionType,
      input: record.input as Record<string, unknown>,
      output: record.output as Record<string, unknown>,
      feedback: (record.feedback as Record<string, unknown>) || undefined,
      appliedAt: record.appliedAt || undefined,
      appliedTodoIds:
        (record.appliedTodoIds as string[] | null | undefined) || undefined,
      status: record.status as AiSuggestionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async updateStatus(
    userId: string,
    id: string,
    status: AiSuggestionStatus,
    feedback?: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null> {
    const result = await this.prisma.aiSuggestion.updateMany({
      where: { id, userId },
      data: {
        status,
        feedback: feedback as Prisma.InputJsonValue | undefined,
      },
    });

    if (result.count !== 1) {
      return null;
    }

    const record = await this.prisma.aiSuggestion.findUnique({
      where: { id },
    });
    if (!record || record.userId !== userId) {
      return null;
    }
    return {
      id: record.id,
      userId: record.userId,
      type: record.type as AiSuggestionType,
      input: record.input as Record<string, unknown>,
      output: record.output as Record<string, unknown>,
      feedback: (record.feedback as Record<string, unknown>) || undefined,
      appliedAt: record.appliedAt || undefined,
      appliedTodoIds:
        (record.appliedTodoIds as string[] | null | undefined) || undefined,
      status: record.status as AiSuggestionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
