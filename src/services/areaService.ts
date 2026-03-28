import { PrismaClient } from "@prisma/client";

export class DuplicateAreaNameError extends Error {
  constructor() {
    super("Area name already exists");
    this.name = "DuplicateAreaNameError";
  }
}

export interface AreaRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AreaService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(
    userId: string,
    opts?: { archived?: boolean },
  ): Promise<AreaRecord[]> {
    return this.prisma.area.findMany({
      where: {
        userId,
        ...(opts?.archived !== undefined ? { archived: opts.archived } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async findById(userId: string, id: string): Promise<AreaRecord | null> {
    return this.prisma.area.findFirst({ where: { id, userId } });
  }

  async create(
    userId: string,
    input: { name: string; description?: string | null },
  ): Promise<AreaRecord> {
    try {
      return await this.prisma.area.create({
        data: { userId, name: input.name, description: input.description },
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new DuplicateAreaNameError();
      }
      throw err;
    }
  }

  async update(
    userId: string,
    id: string,
    input: { name?: string; description?: string | null; archived?: boolean },
  ): Promise<AreaRecord | null> {
    const existing = await this.prisma.area.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    try {
      return await this.prisma.area.update({
        where: { id },
        data: input,
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new DuplicateAreaNameError();
      }
      throw err;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.area.findFirst({
      where: { id, userId },
    });
    if (!existing) return false;
    await this.prisma.area.delete({ where: { id } });
    return true;
  }
}
