import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PlanSuggestionV1 } from "./ai/planSuggestionSchema";

export type AiSuggestionType = "task_critic" | "plan_from_goal";
export type AiSuggestionStatus = "pending" | "accepted" | "rejected";

export interface AiSuggestionRecord {
  id: string;
  userId: string;
  type: AiSuggestionType;
  schemaVersion?: number;
  provider?: string;
  model?: string;
  promptHash?: string;
  inputSummary?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  feedback?: Record<string, unknown>;
  appliedAt?: Date;
  appliedTodoIds?: string[];
  status: AiSuggestionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiFeedbackSummary {
  acceptedCount: number;
  rejectedCount: number;
  acceptedReasons: Array<{ reason: string; count: number }>;
  rejectedReasons: Array<{ reason: string; count: number }>;
}

export interface IAiSuggestionStore {
  create(record: {
    userId: string;
    type: AiSuggestionType;
    schemaVersion?: number;
    provider?: string;
    model?: string;
    promptHash?: string;
    inputSummary?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }): Promise<AiSuggestionRecord>;
  listByUser(userId: string, limit: number): Promise<AiSuggestionRecord[]>;
  getById(userId: string, id: string): Promise<AiSuggestionRecord | null>;
  countByUserSince(userId: string, since: Date): Promise<number>;
  summarizeFeedbackByUserSince(
    userId: string,
    since: Date,
    reasonLimit: number,
  ): Promise<AiFeedbackSummary>;
  listByUserAndType(
    userId: string,
    type: AiSuggestionType,
    limit: number,
  ): Promise<AiSuggestionRecord[]>;
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
  saveFeedback(
    userId: string,
    id: string,
    feedback: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null>;
  applyPlanSuggestionTransaction?(params: {
    userId: string;
    suggestionId: string;
    plan: PlanSuggestionV1;
    reason?: string;
    injectFailureAfterTodoCount?: number;
  }): Promise<{
    suggestion: AiSuggestionRecord | null;
    appliedTodoIds: string[];
    idempotent: boolean;
  }>;
}

export class InMemoryAiSuggestionStore implements IAiSuggestionStore {
  private records: AiSuggestionRecord[] = [];

  async create(record: {
    userId: string;
    type: AiSuggestionType;
    schemaVersion?: number;
    provider?: string;
    model?: string;
    promptHash?: string;
    inputSummary?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }): Promise<AiSuggestionRecord> {
    const now = new Date();
    const created: AiSuggestionRecord = {
      id: randomUUID(),
      userId: record.userId,
      type: record.type,
      schemaVersion: record.schemaVersion,
      provider: record.provider,
      model: record.model,
      promptHash: record.promptHash,
      inputSummary: record.inputSummary,
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

  async listByUserAndType(
    userId: string,
    type: AiSuggestionType,
    limit: number,
  ): Promise<AiSuggestionRecord[]> {
    return this.records
      .filter((record) => record.userId === userId && record.type === type)
      .slice(0, limit);
  }

  async summarizeFeedbackByUserSince(
    userId: string,
    since: Date,
    reasonLimit: number,
  ): Promise<AiFeedbackSummary> {
    const acceptedReasons = new Map<string, number>();
    const rejectedReasons = new Map<string, number>();
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const record of this.records) {
      if (record.userId !== userId || record.updatedAt < since) {
        continue;
      }
      if (record.status !== "accepted" && record.status !== "rejected") {
        continue;
      }

      const reasonRaw = record.feedback?.reason;
      const reason =
        typeof reasonRaw === "string" && reasonRaw.trim().length > 0
          ? reasonRaw.trim()
          : "unspecified";

      if (record.status === "accepted") {
        acceptedCount += 1;
        acceptedReasons.set(reason, (acceptedReasons.get(reason) || 0) + 1);
      } else {
        rejectedCount += 1;
        rejectedReasons.set(reason, (rejectedReasons.get(reason) || 0) + 1);
      }
    }

    const toRanked = (counts: Map<string, number>) =>
      [...counts.entries()]
        .sort((a, b) => {
          if (b[1] !== a[1]) {
            return b[1] - a[1];
          }
          return a[0].localeCompare(b[0]);
        })
        .slice(0, reasonLimit)
        .map(([reason, count]) => ({ reason, count }));

    return {
      acceptedCount,
      rejectedCount,
      acceptedReasons: toRanked(acceptedReasons),
      rejectedReasons: toRanked(rejectedReasons),
    };
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

  async saveFeedback(
    userId: string,
    id: string,
    feedback: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null> {
    const index = this.records.findIndex(
      (record) => record.id === id && record.userId === userId,
    );
    if (index === -1) {
      return null;
    }
    const updated = {
      ...this.records[index],
      feedback,
      updatedAt: new Date(),
    };
    this.records[index] = updated;
    return updated;
  }
}

export class PrismaAiSuggestionStore implements IAiSuggestionStore {
  constructor(private prisma: PrismaClient) {}

  private mapRecord(record: any): AiSuggestionRecord {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type as AiSuggestionType,
      schemaVersion: record.schemaVersion ?? undefined,
      provider: record.provider || undefined,
      model: record.model || undefined,
      promptHash: record.promptHash || undefined,
      inputSummary: record.inputSummary || undefined,
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

  async create(record: {
    userId: string;
    type: AiSuggestionType;
    schemaVersion?: number;
    provider?: string;
    model?: string;
    promptHash?: string;
    inputSummary?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }): Promise<AiSuggestionRecord> {
    const created = await this.prisma.aiSuggestion.create({
      data: {
        userId: record.userId,
        type: record.type,
        schemaVersion: record.schemaVersion,
        provider: record.provider,
        model: record.model,
        promptHash: record.promptHash,
        inputSummary: record.inputSummary,
        input: record.input as Prisma.InputJsonValue,
        output: record.output as Prisma.InputJsonValue,
        status: "pending",
      },
    });

    return this.mapRecord(created);
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

    return records.map((record) => this.mapRecord(record));
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

    return this.mapRecord(record);
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

  async listByUserAndType(
    userId: string,
    type: AiSuggestionType,
    limit: number,
  ): Promise<AiSuggestionRecord[]> {
    const records = await this.prisma.aiSuggestion.findMany({
      where: { userId, type },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return records.map((record) => this.mapRecord(record));
  }

  async summarizeFeedbackByUserSince(
    userId: string,
    since: Date,
    reasonLimit: number,
  ): Promise<AiFeedbackSummary> {
    const records = await this.prisma.aiSuggestion.findMany({
      where: {
        userId,
        updatedAt: {
          gte: since,
        },
        status: {
          in: ["accepted", "rejected"],
        },
      },
      select: {
        status: true,
        feedback: true,
      },
    });

    const acceptedReasons = new Map<string, number>();
    const rejectedReasons = new Map<string, number>();
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const record of records) {
      const feedback =
        record.feedback && typeof record.feedback === "object"
          ? (record.feedback as Record<string, unknown>)
          : undefined;
      const reasonRaw = feedback?.reason;
      const reason =
        typeof reasonRaw === "string" && reasonRaw.trim().length > 0
          ? reasonRaw.trim()
          : "unspecified";

      if (record.status === "accepted") {
        acceptedCount += 1;
        acceptedReasons.set(reason, (acceptedReasons.get(reason) || 0) + 1);
      } else {
        rejectedCount += 1;
        rejectedReasons.set(reason, (rejectedReasons.get(reason) || 0) + 1);
      }
    }

    const toRanked = (counts: Map<string, number>) =>
      [...counts.entries()]
        .sort((a, b) => {
          if (b[1] !== a[1]) {
            return b[1] - a[1];
          }
          return a[0].localeCompare(b[0]);
        })
        .slice(0, reasonLimit)
        .map(([reason, count]) => ({ reason, count }));

    return {
      acceptedCount,
      rejectedCount,
      acceptedReasons: toRanked(acceptedReasons),
      rejectedReasons: toRanked(rejectedReasons),
    };
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
      return this.mapRecord(existing);
    }
    if (existing.status === "accepted" && existing.appliedTodoIds) {
      return this.mapRecord(existing);
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
      return this.mapRecord(latest);
    }

    const record = await this.prisma.aiSuggestion.findUnique({
      where: { id },
    });
    if (!record || record.userId !== userId) {
      return null;
    }
    return this.mapRecord(record);
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
    return this.mapRecord(record);
  }

  async saveFeedback(
    userId: string,
    id: string,
    feedback: Record<string, unknown>,
  ): Promise<AiSuggestionRecord | null> {
    const result = await this.prisma.aiSuggestion.updateMany({
      where: { id, userId },
      data: {
        feedback: feedback as Prisma.InputJsonValue,
      },
    });
    if (result.count !== 1) {
      return null;
    }
    const record = await this.prisma.aiSuggestion.findUnique({ where: { id } });
    if (!record || record.userId !== userId) {
      return null;
    }
    return this.mapRecord(record);
  }

  async applyPlanSuggestionTransaction(params: {
    userId: string;
    suggestionId: string;
    plan: PlanSuggestionV1;
    reason?: string;
    injectFailureAfterTodoCount?: number;
  }): Promise<{
    suggestion: AiSuggestionRecord | null;
    appliedTodoIds: string[];
    idempotent: boolean;
  }> {
    const existing = await this.prisma.aiSuggestion.findUnique({
      where: { id: params.suggestionId },
    });
    if (!existing || existing.userId !== params.userId) {
      return { suggestion: null, appliedTodoIds: [], idempotent: false };
    }
    if (
      existing.status === "accepted" &&
      Array.isArray(existing.appliedTodoIds) &&
      existing.appliedTodoIds.length > 0
    ) {
      return {
        suggestion: this.mapRecord(existing),
        appliedTodoIds: existing.appliedTodoIds as unknown as string[],
        idempotent: true,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.aiSuggestion.findUnique({
        where: { id: params.suggestionId },
      });
      if (!locked || locked.userId !== params.userId) {
        return { suggestion: null, appliedTodoIds: [], idempotent: false };
      }
      if (
        locked.status === "accepted" &&
        Array.isArray(locked.appliedTodoIds) &&
        locked.appliedTodoIds.length > 0
      ) {
        return {
          suggestion: this.mapRecord(locked),
          appliedTodoIds: locked.appliedTodoIds as unknown as string[],
          idempotent: true,
        };
      }
      if (locked.status === "rejected") {
        return { suggestion: this.mapRecord(locked), appliedTodoIds: [], idempotent: false };
      }

      const createdTodoIds: string[] = [];
      for (const [index, task] of params.plan.tasks.entries()) {
        let projectId: string | null = null;
        if (task.projectName) {
          const project = await tx.project.upsert({
            where: {
              userId_name: {
                userId: params.userId,
                name: task.projectName,
              },
            },
            create: {
              userId: params.userId,
              name: task.projectName,
            },
            update: {},
            select: { id: true },
          });
          projectId = project.id;
        }

        const maxOrder = await tx.todo.findFirst({
          where: { userId: params.userId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        const createdTodo = await tx.todo.create({
          data: {
            userId: params.userId,
            title: task.title,
            description: task.description || undefined,
            notes: task.notes || undefined,
            category: task.category || undefined,
            projectId,
            dueDate: task.dueDate ? new Date(`${task.dueDate}T00:00:00.000Z`) : undefined,
            priority: task.priority,
            order: (maxOrder?.order ?? -1) + 1,
          },
        });
        createdTodoIds.push(createdTodo.id);

        for (const [subtaskOrder, subtask] of task.subtasks.entries()) {
          await tx.subtask.create({
            data: {
              todoId: createdTodo.id,
              title: subtask.title,
              order: subtaskOrder,
            },
          });
        }

        if (
          typeof params.injectFailureAfterTodoCount === "number" &&
          params.injectFailureAfterTodoCount > 0 &&
          index + 1 >= params.injectFailureAfterTodoCount
        ) {
          throw new Error("INJECTED_AI_APPLY_FAILURE");
        }
      }

      const updated = await tx.aiSuggestion.update({
        where: { id: params.suggestionId },
        data: {
          status: "accepted",
          appliedAt: new Date(),
          appliedTodoIds: createdTodoIds as unknown as Prisma.InputJsonValue,
          feedback: {
            reason: params.reason || "applied_via_endpoint",
            source: "apply_endpoint",
            updatedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        suggestion: this.mapRecord(updated),
        appliedTodoIds: createdTodoIds,
        idempotent: false,
      };
    });

    return result;
  }
}
