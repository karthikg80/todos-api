import { PrismaClient } from "@prisma/client";

export interface GoalRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetDate: Date | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class GoalService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(
    userId: string,
    opts?: { archived?: boolean },
  ): Promise<GoalRecord[]> {
    return this.prisma.goal.findMany({
      where: {
        userId,
        ...(opts?.archived !== undefined ? { archived: opts.archived } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async findById(userId: string, id: string): Promise<GoalRecord | null> {
    return this.prisma.goal.findFirst({ where: { id, userId } });
  }

  async create(
    userId: string,
    input: {
      name: string;
      description?: string | null;
      targetDate?: string | null;
    },
  ): Promise<GoalRecord> {
    return this.prisma.goal.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
      },
    });
  }

  async update(
    userId: string,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      targetDate?: string | Date | null;
      archived?: boolean;
    },
  ): Promise<GoalRecord | null> {
    const existing = await this.prisma.goal.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.archived !== undefined) data.archived = input.archived;
    if (input.targetDate !== undefined) {
      data.targetDate = input.targetDate
        ? new Date(String(input.targetDate))
        : null;
    }

    return this.prisma.goal.update({ where: { id }, data });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.goal.findFirst({
      where: { id, userId },
    });
    if (!existing) return false;
    await this.prisma.goal.delete({ where: { id } });
    return true;
  }
}
