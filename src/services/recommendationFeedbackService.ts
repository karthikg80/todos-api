import { PrismaClient } from "@prisma/client";

export type FeedbackSignal = "accepted" | "ignored" | "snoozed" | "reordered";

export interface FeedbackRecord {
  id: string;
  planDate: string;
  taskId: string;
  signal: FeedbackSignal;
  energy: string | null;
  availableMinutes: number | null;
  score: number | null;
  recordedAt: Date;
}

export interface FeedbackSummary {
  taskId: string;
  acceptedCount: number;
  ignoredCount: number;
  snoozedCount: number;
  reorderedCount: number;
  acceptanceRate: number;
  lastSignal: FeedbackSignal | null;
  lastSignalAt: Date | null;
}

const VALID_SIGNALS: FeedbackSignal[] = [
  "accepted",
  "ignored",
  "snoozed",
  "reordered",
];

export class RecommendationFeedbackService {
  constructor(private readonly prisma?: PrismaClient) {}

  async record(
    userId: string,
    input: {
      planDate: string;
      taskId: string;
      signal: FeedbackSignal;
      energy?: string;
      availableMinutes?: number;
      score?: number;
    },
  ): Promise<FeedbackRecord> {
    if (!this.prisma) {
      return this.mockRecord(input);
    }
    const created = await this.prisma.taskRecommendationFeedback.create({
      data: {
        userId,
        planDate: input.planDate,
        taskId: input.taskId,
        signal: input.signal,
        energy: input.energy ?? null,
        availableMinutes: input.availableMinutes ?? null,
        score: input.score ?? null,
      },
    });
    return this.toRecord(created);
  }

  async list(
    userId: string,
    filters: {
      taskId?: string;
      signal?: FeedbackSignal;
      since?: string;
      limit?: number;
    },
  ): Promise<FeedbackRecord[]> {
    if (!this.prisma) return [];
    const rows = await this.prisma.taskRecommendationFeedback.findMany({
      where: {
        userId,
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(filters.signal ? { signal: filters.signal } : {}),
        ...(filters.since
          ? { recordedAt: { gte: new Date(filters.since) } }
          : {}),
      },
      orderBy: { recordedAt: "desc" },
      take: filters.limit ?? 100,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async summary(
    userId: string,
    filters: { since?: string },
  ): Promise<FeedbackSummary[]> {
    if (!this.prisma) return [];
    const rows = await this.prisma.taskRecommendationFeedback.findMany({
      where: {
        userId,
        ...(filters.since
          ? { recordedAt: { gte: new Date(filters.since) } }
          : {}),
      },
      orderBy: { recordedAt: "desc" },
      select: {
        taskId: true,
        signal: true,
        recordedAt: true,
      },
    });

    const grouped = new Map<
      string,
      {
        accepted: number;
        ignored: number;
        snoozed: number;
        reordered: number;
        lastSignal: string;
        lastSignalAt: Date;
      }
    >();

    for (const row of rows) {
      const entry = grouped.get(row.taskId) ?? {
        accepted: 0,
        ignored: 0,
        snoozed: 0,
        reordered: 0,
        lastSignal: row.signal,
        lastSignalAt: row.recordedAt,
      };
      const sig = row.signal as keyof Pick<
        typeof entry,
        "accepted" | "ignored" | "snoozed" | "reordered"
      >;
      if (
        sig === "accepted" ||
        sig === "ignored" ||
        sig === "snoozed" ||
        sig === "reordered"
      ) {
        entry[sig]++;
      }
      if (row.recordedAt > entry.lastSignalAt) {
        entry.lastSignal = row.signal;
        entry.lastSignalAt = row.recordedAt;
      }
      grouped.set(row.taskId, entry);
    }

    return Array.from(grouped.entries()).map(([taskId, s]) => {
      const total = s.accepted + s.ignored + s.snoozed + s.reordered;
      return {
        taskId,
        acceptedCount: s.accepted,
        ignoredCount: s.ignored,
        snoozedCount: s.snoozed,
        reorderedCount: s.reordered,
        acceptanceRate: total > 0 ? s.accepted / total : 0,
        lastSignal: VALID_SIGNALS.includes(s.lastSignal as FeedbackSignal)
          ? (s.lastSignal as FeedbackSignal)
          : null,
        lastSignalAt: s.lastSignalAt,
      };
    });
  }

  /** Return score multiplier for plan_today: +10 if often accepted, -15 if often ignored */
  async getScoreAdjustment(userId: string, taskId: string): Promise<number> {
    if (!this.prisma) return 0;
    const rows = await this.prisma.taskRecommendationFeedback.findMany({
      where: { userId, taskId },
      select: { signal: true },
      take: 20,
      orderBy: { recordedAt: "desc" },
    });
    const accepted = rows.filter((r) => r.signal === "accepted").length;
    const ignored = rows.filter((r) => r.signal === "ignored").length;
    if (accepted >= 2) return 10;
    if (ignored >= 3) return -15;
    return 0;
  }

  private mockRecord(input: {
    planDate: string;
    taskId: string;
    signal: FeedbackSignal;
    energy?: string;
    availableMinutes?: number;
    score?: number;
  }): FeedbackRecord {
    return {
      id: "",
      planDate: input.planDate,
      taskId: input.taskId,
      signal: input.signal,
      energy: input.energy ?? null,
      availableMinutes: input.availableMinutes ?? null,
      score: input.score ?? null,
      recordedAt: new Date(),
    };
  }

  private toRecord(
    r: import("@prisma/client").TaskRecommendationFeedback,
  ): FeedbackRecord {
    return {
      id: r.id,
      planDate: r.planDate,
      taskId: r.taskId,
      signal: r.signal as FeedbackSignal,
      energy: r.energy,
      availableMinutes: r.availableMinutes,
      score: r.score,
      recordedAt: r.recordedAt,
    };
  }
}
