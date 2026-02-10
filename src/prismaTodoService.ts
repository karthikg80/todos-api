import { PrismaClient, Prisma } from "@prisma/client";
import { ITodoService } from "./interfaces/ITodoService";
import {
  Todo,
  Subtask,
  CreateTodoDto,
  UpdateTodoDto,
  CreateSubtaskDto,
  UpdateSubtaskDto,
  ReorderTodoItemDto,
  FindTodosQuery,
  TodoSortBy,
  SortOrder,
} from "./types";

/**
 * Prisma-based implementation of ITodoService using PostgreSQL database.
 * Provides persistent storage for todos with full CRUD operations.
 */
export class PrismaTodoService implements ITodoService {
  constructor(private prisma: PrismaClient) {}
  private static readonly NOT_FOUND_ERROR = "TODO_NOT_FOUND";
  private normalizeCategory(category?: string | null): string | null {
    if (category === null || category === undefined) {
      return null;
    }
    const trimmed = category.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async ensureProjectId(
    tx: Prisma.TransactionClient,
    userId: string,
    projectName: string,
  ): Promise<string> {
    const project = await tx.project.upsert({
      where: {
        userId_name: {
          userId,
          name: projectName,
        },
      },
      create: {
        name: projectName,
        userId,
      },
      update: {},
      select: {
        id: true,
      },
    });
    return project.id;
  }

  private hasPrismaCode(error: unknown, codes: string[]): boolean {
    if (!error || typeof error !== "object" || !("code" in error)) {
      return false;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && codes.includes(code);
  }

  async create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    const todo = await this.prisma.$transaction(async (tx) => {
      // Calculate next order: max order + 1 for this user
      const maxOrderTodo = await tx.todo.findFirst({
        where: { userId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const nextOrder = (maxOrderTodo?.order ?? -1) + 1;
      const category = this.normalizeCategory(dto.category);
      const projectId = category
        ? await this.ensureProjectId(tx, userId, category)
        : null;

      return tx.todo.create({
        data: {
          title: dto.title,
          description: dto.description,
          completed: false,
          category,
          projectId,
          dueDate: dto.dueDate,
          order: nextOrder,
          priority: dto.priority || "medium",
          notes: dto.notes,
          userId,
        },
        include: {
          project: true,
          subtasks: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    return this.mapPrismaToTodo(todo);
  }

  async findAll(userId: string, query?: FindTodosQuery): Promise<Todo[]> {
    const where: any = { userId };
    if (query?.completed !== undefined) {
      where.completed = query.completed;
    }
    if (query?.priority) {
      where.priority = query.priority;
    }
    if (query?.category !== undefined) {
      where.category = query.category;
    }

    const sortBy: TodoSortBy = query?.sortBy ?? "order";
    const sortOrder: SortOrder = query?.sortOrder ?? "asc";
    const orderBy =
      sortBy === "order"
        ? [{ order: sortOrder }]
        : [{ [sortBy]: sortOrder }, { order: "asc" as const }];

    const skip =
      query?.limit !== undefined
        ? ((query.page ?? 1) - 1) * query.limit
        : undefined;

    const todos = await this.prisma.todo.findMany({
      where,
      orderBy,
      include: {
        project: true,
        subtasks: {
          orderBy: { order: "asc" },
        },
      },
      skip,
      take: query?.limit,
    });

    return todos.map(this.mapPrismaToTodo);
  }

  async findById(userId: string, id: string): Promise<Todo | null> {
    try {
      const todo = await this.prisma.todo.findFirst({
        where: { id, userId },
        include: {
          project: true,
          subtasks: {
            orderBy: { order: "asc" },
          },
        },
      });

      return todo ? this.mapPrismaToTodo(todo) : null;
    } catch (error: unknown) {
      // Invalid UUID in id filter.
      if (this.hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTodoDto,
  ): Promise<Todo | null> {
    try {
      const updateData: any = {};

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.completed !== undefined) updateData.completed = dto.completed;
      if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate;
      if (dto.order !== undefined) updateData.order = dto.order;
      if (dto.priority !== undefined) updateData.priority = dto.priority;
      if (dto.notes !== undefined) updateData.notes = dto.notes;

      const todo = await this.prisma.$transaction(async (tx) => {
        if (dto.category !== undefined) {
          const category = this.normalizeCategory(dto.category);
          if (!category) {
            updateData.category = null;
            updateData.projectId = null;
          } else {
            updateData.category = category;
            updateData.projectId = await this.ensureProjectId(tx, userId, category);
          }
        }

        if (Object.keys(updateData).length === 0) {
          return tx.todo.findFirst({
            where: { id, userId },
            include: {
              project: true,
              subtasks: {
                orderBy: { order: "asc" },
              },
            },
          });
        }

        const result = await tx.todo.updateMany({
          where: { id, userId },
          data: updateData,
        });

        if (result.count !== 1) {
          return null;
        }

        return tx.todo.findFirst({
          where: { id, userId },
          include: {
            project: true,
            subtasks: {
              orderBy: { order: "asc" },
            },
          },
        });
      });

      return todo ? this.mapPrismaToTodo(todo) : null;
    } catch (error: unknown) {
      // Invalid UUID format.
      if (this.hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    try {
      const result = await this.prisma.todo.deleteMany({
        where: { id, userId },
      });
      return result.count === 1;
    } catch (error: unknown) {
      // Invalid UUID format.
      if (this.hasPrismaCode(error, ["P2023"])) {
        return false;
      }
      throw error;
    }
  }

  async reorder(
    userId: string,
    items: ReorderTodoItemDto[],
  ): Promise<Todo[] | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        for (const item of items) {
          const updateResult = await tx.todo.updateMany({
            where: { id: item.id, userId },
            data: { order: item.order },
          });
          if (updateResult.count !== 1) {
            throw new Error(PrismaTodoService.NOT_FOUND_ERROR);
          }
        }

        const todos = await tx.todo.findMany({
          where: { userId },
          orderBy: { order: "asc" },
          include: {
            project: true,
            subtasks: {
              orderBy: { order: "asc" },
            },
          },
        });
        return todos.map((todo) => this.mapPrismaToTodo(todo));
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === PrismaTodoService.NOT_FOUND_ERROR
      ) {
        return null;
      }
      if (this.hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async findSubtasks(
    userId: string,
    todoId: string,
  ): Promise<Subtask[] | null> {
    try {
      const todo = await this.prisma.todo.findFirst({
        where: { id: todoId, userId },
      });
      if (!todo) {
        return null;
      }

      const subtasks = await this.prisma.subtask.findMany({
        where: { todoId },
        orderBy: { order: "asc" },
      });
      return subtasks.map((subtask) => this.mapPrismaToSubtask(subtask));
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async createSubtask(
    userId: string,
    todoId: string,
    dto: CreateSubtaskDto,
  ): Promise<Subtask | null> {
    try {
      const subtask = await this.prisma.$transaction(async (tx) => {
        // Lock the parent todo row so concurrent subtask inserts for the same todo
        // are serialized and cannot compute the same next order value.
        const todoRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "todos"
          WHERE "id" = ${todoId} AND "user_id" = ${userId}
          FOR UPDATE
        `;

        if (todoRows.length === 0) {
          return null;
        }

        const maxOrder = await tx.subtask.findFirst({
          where: { todoId },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        return tx.subtask.create({
          data: {
            title: dto.title,
            completed: false,
            order: (maxOrder?.order ?? -1) + 1,
            todoId,
          },
        });
      });

      return subtask ? this.mapPrismaToSubtask(subtask) : null;
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async updateSubtask(
    userId: string,
    todoId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ): Promise<Subtask | null> {
    try {
      const todo = await this.prisma.todo.findFirst({
        where: { id: todoId, userId },
      });
      if (!todo) {
        return null;
      }

      const updateData: any = {};
      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.completed !== undefined) updateData.completed = dto.completed;
      if (dto.order !== undefined) updateData.order = dto.order;

      const updated = await this.prisma.subtask.updateMany({
        where: { id: subtaskId, todoId },
        data: updateData,
      });

      if (updated.count !== 1) {
        return null;
      }

      const subtask = await this.prisma.subtask.findUnique({
        where: { id: subtaskId },
      });
      return subtask ? this.mapPrismaToSubtask(subtask) : null;
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, ["P2023", "P2025"])) {
        return null;
      }
      throw error;
    }
  }

  async deleteSubtask(
    userId: string,
    todoId: string,
    subtaskId: string,
  ): Promise<boolean> {
    try {
      const todo = await this.prisma.todo.findFirst({
        where: { id: todoId, userId },
      });
      if (!todo) {
        return false;
      }

      const deleted = await this.prisma.subtask.deleteMany({
        where: { id: subtaskId, todoId },
      });
      return deleted.count === 1;
    } catch (error: unknown) {
      if (this.hasPrismaCode(error, ["P2023", "P2025"])) {
        return false;
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("clear() is not allowed in production");
    }
    await this.prisma.todo.deleteMany();
    await this.prisma.project.deleteMany();
  }

  /**
   * Map Prisma Todo model to application Todo type.
   * Ensures consistent interface regardless of database representation.
   */
  private mapPrismaToTodo(prismaTodo: any): Todo {
    return {
      id: prismaTodo.id,
      title: prismaTodo.title,
      description: prismaTodo.description ?? undefined,
      completed: prismaTodo.completed,
      category: prismaTodo.project?.name ?? prismaTodo.category ?? undefined,
      dueDate: prismaTodo.dueDate ?? undefined,
      order: prismaTodo.order,
      priority: prismaTodo.priority || "medium",
      notes: prismaTodo.notes ?? undefined,
      userId: prismaTodo.userId,
      createdAt: prismaTodo.createdAt,
      updatedAt: prismaTodo.updatedAt,
      subtasks: prismaTodo.subtasks || undefined,
    };
  }

  private mapPrismaToSubtask(prismaSubtask: any): Subtask {
    return {
      id: prismaSubtask.id,
      title: prismaSubtask.title,
      completed: prismaSubtask.completed,
      order: prismaSubtask.order,
      todoId: prismaSubtask.todoId,
      createdAt: prismaSubtask.createdAt,
      updatedAt: prismaSubtask.updatedAt,
    };
  }
}
