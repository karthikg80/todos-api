import { PrismaClient } from "@prisma/client";

export type DayMode =
  | "normal"
  | "rescue"
  | "travel"
  | "office"
  | "home"
  | "overloaded"
  | "sprint"
  | "catch_up";

export interface DayContextRecord {
  id: string;
  contextDate: string;
  mode: DayMode;
  energy: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Per-mode plan_today modifiers applied in the executor */
export interface ModeModifiers {
  maxTaskCount?: number;
  budgetMultiplier?: number;
  scoreBoosts: {
    projectTask?: number;
    adminTask?: number;
    waitingTask?: number;
    shortTask?: number;
  };
}

export const MODE_MODIFIERS: Record<DayMode, ModeModifiers> = {
  normal: { scoreBoosts: {} },
  rescue: {
    maxTaskCount: 3,
    budgetMultiplier: 0.6,
    scoreBoosts: { shortTask: 20, adminTask: 5, projectTask: -10 },
  },
  travel: {
    budgetMultiplier: 0.7,
    scoreBoosts: { shortTask: 10, adminTask: -10 },
  },
  office: { scoreBoosts: { projectTask: 5 } },
  home: { scoreBoosts: {} },
  overloaded: {
    maxTaskCount: 3,
    scoreBoosts: { shortTask: 15, projectTask: -5 },
  },
  sprint: { scoreBoosts: { projectTask: 15, adminTask: -10 } },
  catch_up: { scoreBoosts: { waitingTask: 20, adminTask: 10 } },
};

export class DayContextService {
  constructor(private readonly prisma?: PrismaClient) {}

  async getContext(
    userId: string,
    contextDate: string,
  ): Promise<DayContextRecord | null> {
    if (!this.prisma) return null;
    const row = await this.prisma.userDayContext.findUnique({
      where: { userId_contextDate: { userId, contextDate } },
    });
    return row ? this.toRecord(row) : null;
  }

  async setContext(
    userId: string,
    input: {
      contextDate: string;
      mode: DayMode;
      energy?: string;
      notes?: string;
    },
  ): Promise<DayContextRecord> {
    if (!this.prisma) {
      return this.mockRecord(input);
    }
    const row = await this.prisma.userDayContext.upsert({
      where: {
        userId_contextDate: {
          userId,
          contextDate: input.contextDate,
        },
      },
      create: {
        userId,
        contextDate: input.contextDate,
        mode: input.mode,
        energy: input.energy ?? null,
        notes: input.notes ?? null,
      },
      update: {
        mode: input.mode,
        energy: input.energy ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.toRecord(row);
  }

  private mockRecord(input: {
    contextDate: string;
    mode: DayMode;
    energy?: string;
    notes?: string;
  }): DayContextRecord {
    const now = new Date();
    return {
      id: "",
      contextDate: input.contextDate,
      mode: input.mode,
      energy: input.energy ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private toRecord(
    r: import("@prisma/client").UserDayContext,
  ): DayContextRecord {
    return {
      id: r.id,
      contextDate: r.contextDate,
      mode: r.mode as DayMode,
      energy: r.energy,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
