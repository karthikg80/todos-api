import { PrismaClient } from "@prisma/client";
import { IProjectService } from "../interfaces/IProjectService";
import {
  CreateProjectDto,
  Project,
  ProjectTaskDisposition,
  UpdateProjectDto,
} from "../types";
import { hasPrismaCode } from "../errorHandling";

export class DuplicateProjectNameError extends Error {
  constructor() {
    super("Project name already exists");
    this.name = "DuplicateProjectNameError";
  }
}

export class PrismaProjectService implements IProjectService {
  constructor(private prisma: PrismaClient) {}

  private async mapProjectRows(
    userId: string,
    rows: Array<{
      id: string;
      name: string;
      archived: boolean;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
      _count: { todos: number };
    }>,
  ): Promise<Project[]> {
    const openTodoCountByProjectId = await this.getOpenTodoCountMap(
      userId,
      rows.map((row) => row.id),
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      archived: row.archived,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      todoCount: row._count.todos,
      openTodoCount: openTodoCountByProjectId.get(row.id) || 0,
    }));
  }

  private async getOpenTodoCountMap(
    userId: string,
    projectIds: string[],
  ): Promise<Map<string, number>> {
    if (!projectIds.length) {
      return new Map();
    }

    const rows = await this.prisma.todo.groupBy({
      by: ["projectId"],
      where: {
        userId,
        completed: false,
        projectId: { in: projectIds },
      },
      _count: { _all: true },
    });

    return new Map(
      rows
        .filter((row) => typeof row.projectId === "string" && row.projectId)
        .map((row) => [String(row.projectId), row._count._all]),
    );
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
    return this.mapProjectRows(userId, rows);
  }

  async findById(userId: string, projectId: string): Promise<Project | null> {
    try {
      const row = await this.prisma.project.findFirst({
        where: { id: projectId, userId },
        include: {
          _count: {
            select: { todos: true },
          },
        },
      });
      if (!row) {
        return null;
      }

      const [project] = await this.mapProjectRows(userId, [row]);
      return project;
    } catch (error: unknown) {
      if (hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    try {
      const row = await this.prisma.project.create({
        data: {
          archived: false,
          name: dto.name,
          userId,
        },
      });
      return {
        id: row.id,
        name: row.name,
        archived: row.archived,
        userId: row.userId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        todoCount: 0,
        openTodoCount: 0,
      };
    } catch (error: unknown) {
      if (hasPrismaCode(error, ["P2002"])) {
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

        const [count, openTodoCount] = await Promise.all([
          tx.todo.count({ where: { userId, projectId } }),
          tx.todo.count({
            where: { userId, projectId, completed: false },
          }),
        ]);
        return {
          id: updated.id,
          name: updated.name,
          archived: updated.archived,
          userId: updated.userId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          todoCount: count,
          openTodoCount,
        };
      });
    } catch (error: unknown) {
      if (hasPrismaCode(error, ["P2002"])) {
        throw new DuplicateProjectNameError();
      }
      if (hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async setArchived(
    userId: string,
    projectId: string,
    archived: boolean,
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
          data: { archived },
        });

        const [count, openTodoCount] = await Promise.all([
          tx.todo.count({ where: { userId, projectId } }),
          tx.todo.count({
            where: { userId, projectId, completed: false },
          }),
        ]);

        return {
          id: updated.id,
          name: updated.name,
          archived: updated.archived,
          userId: updated.userId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          todoCount: count,
          openTodoCount,
        };
      });
    } catch (error: unknown) {
      if (hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async delete(
    userId: string,
    projectId: string,
    taskDisposition: ProjectTaskDisposition,
    moveTasksToProjectId?: string | null,
  ): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.project.findFirst({
          where: { id: projectId, userId },
          select: { id: true },
        });
        if (!existing) {
          return false;
        }

        if (moveTasksToProjectId) {
          const targetProject = await tx.project.findFirst({
            where: { id: moveTasksToProjectId, userId },
            select: { id: true, name: true },
          });
          if (!targetProject) {
            return false;
          }

          await tx.todo.updateMany({
            where: { userId, projectId },
            data: {
              projectId: targetProject.id,
              category: targetProject.name,
              headingId: null,
            },
          });
        } else if (taskDisposition === "delete") {
          await tx.todo.deleteMany({
            where: { userId, projectId },
          });
        } else {
          await tx.todo.updateMany({
            where: { userId, projectId },
            data: {
              projectId: null,
              category: null,
              headingId: null,
            },
          });
        }

        await tx.project.delete({
          where: { id: projectId },
        });

        return true;
      });
    } catch (error: unknown) {
      if (hasPrismaCode(error, ["P2023"])) {
        return false;
      }
      throw error;
    }
  }
}
