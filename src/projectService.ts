import { PrismaClient } from "@prisma/client";
import { IProjectService } from "./interfaces/IProjectService";
import { CreateProjectDto, Project, UpdateProjectDto } from "./types";

export class DuplicateProjectNameError extends Error {
  constructor() {
    super("Project name already exists");
    this.name = "DuplicateProjectNameError";
  }
}

export class PrismaProjectService implements IProjectService {
  constructor(private prisma: PrismaClient) {}

  private hasPrismaCode(error: unknown, codes: string[]): boolean {
    if (!error || typeof error !== "object" || !("code" in error)) {
      return false;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && codes.includes(code);
  }

  async findAll(userId: string): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { todos: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      todoCount: row._count.todos,
    }));
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    try {
      const row = await this.prisma.project.create({
        data: {
          name: dto.name,
          userId,
        },
      });
      return {
        id: row.id,
        name: row.name,
        userId: row.userId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        todoCount: 0,
      };
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, ["P2002"])) {
        throw new DuplicateProjectNameError();
      }
      throw error;
    }
  }

  async update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.project.findFirst({
          where: { id: projectId, userId },
        });
        if (!existing) {
          return null;
        }

        const updated = await tx.project.update({
          where: { id: projectId },
          data: { name: dto.name },
        });

        // Keep legacy category column synchronized until full API migration is complete.
        await tx.todo.updateMany({
          where: { userId, projectId },
          data: { category: dto.name },
        });

        const count = await tx.todo.count({ where: { userId, projectId } });
        return {
          id: updated.id,
          name: updated.name,
          userId: updated.userId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          todoCount: count,
        };
      });
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, ["P2002"])) {
        throw new DuplicateProjectNameError();
      }
      if (this.hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async delete(userId: string, projectId: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.project.findFirst({
          where: { id: projectId, userId },
          select: { id: true },
        });
        if (!existing) {
          return false;
        }

        await tx.todo.updateMany({
          where: { userId, projectId },
          data: {
            projectId: null,
            category: null,
          },
        });

        await tx.project.delete({
          where: { id: projectId },
        });

        return true;
      });
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, ["P2023"])) {
        return false;
      }
      throw error;
    }
  }
}
