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
  updateStatus(
    userId: string,
    id: string,
    status: AiSuggestionStatus,
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

  async updateStatus(
    userId: string,
    id: string,
    status: AiSuggestionStatus,
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
      status: record.status as AiSuggestionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async updateStatus(
    userId: string,
    id: string,
    status: AiSuggestionStatus,
  ): Promise<AiSuggestionRecord | null> {
    const result = await this.prisma.aiSuggestion.updateMany({
      where: { id, userId },
      data: { status },
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
      status: record.status as AiSuggestionStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
