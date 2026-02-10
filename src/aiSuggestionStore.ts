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
      status: record.status as AiSuggestionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
