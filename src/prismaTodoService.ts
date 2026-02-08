import { PrismaClient } from '@prisma/client';
import { ITodoService } from './interfaces/ITodoService';
import { Todo, CreateTodoDto, UpdateTodoDto } from './types';

/**
 * Prisma-based implementation of ITodoService using PostgreSQL database.
 * Provides persistent storage for todos with full CRUD operations.
 */
export class PrismaTodoService implements ITodoService {
  constructor(private prisma: PrismaClient) {}

  private hasPrismaCode(error: unknown, codes: string[]): boolean {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return false;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && codes.includes(code);
  }

  async create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    // Calculate next order: max order + 1 for this user
    const maxOrderTodo = await this.prisma.todo.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderTodo?.order ?? -1) + 1;

    const todo = await this.prisma.todo.create({
      data: {
        title: dto.title,
        description: dto.description,
        completed: false,
        category: dto.category,
        dueDate: dto.dueDate,
        order: nextOrder,
        priority: dto.priority || 'medium',
        notes: dto.notes,
        userId,
      },
      include: {
        subtasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return this.mapPrismaToTodo(todo);
  }

  async findAll(userId: string): Promise<Todo[]> {
    const todos = await this.prisma.todo.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
      include: {
        subtasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return todos.map(this.mapPrismaToTodo);
  }

  async findById(userId: string, id: string): Promise<Todo | null> {
    try {
      const todo = await this.prisma.todo.findFirst({
        where: { id, userId },
        include: {
          subtasks: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return todo ? this.mapPrismaToTodo(todo) : null;
    } catch (error: unknown) {
      // Invalid UUID in id filter.
      if (this.hasPrismaCode(error, ['P2023'])) {
        return null;
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateTodoDto): Promise<Todo | null> {
    try {
      // Verify ownership first — Prisma requires a unique selector for update,
      // and (id, userId) is not a composite unique in the schema.
      const existing = await this.prisma.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return null;
      }

      const updateData: any = {};

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.completed !== undefined) updateData.completed = dto.completed;
      if (dto.category !== undefined) updateData.category = dto.category;
      if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate;
      if (dto.order !== undefined) updateData.order = dto.order;
      if (dto.priority !== undefined) updateData.priority = dto.priority;
      if (dto.notes !== undefined) updateData.notes = dto.notes;

      const todo = await this.prisma.todo.update({
        where: { id },
        data: updateData,
        include: {
          subtasks: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return this.mapPrismaToTodo(todo);
    } catch (error: unknown) {
      // Invalid UUID or race where row disappears before update.
      if (this.hasPrismaCode(error, ['P2023', 'P2025'])) {
        return null;
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    try {
      // Verify ownership first — Prisma requires a unique selector for delete,
      // and (id, userId) is not a composite unique in the schema.
      const existing = await this.prisma.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return false;
      }

      await this.prisma.todo.delete({
        where: { id },
      });
      return true;
    } catch (error: unknown) {
      // Invalid UUID or race where row disappears before delete.
      if (this.hasPrismaCode(error, ['P2023', 'P2025'])) {
        return false;
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.prisma.todo.deleteMany();
  }

  /**
   * Map Prisma Todo model to application Todo type.
   * Ensures consistent interface regardless of database representation.
   */
  private mapPrismaToTodo(prismaTodo: any): Todo {
    return {
      id: prismaTodo.id,
      title: prismaTodo.title,
      description: prismaTodo.description || undefined,
      completed: prismaTodo.completed,
      category: prismaTodo.category || undefined,
      dueDate: prismaTodo.dueDate || undefined,
      order: prismaTodo.order,
      priority: prismaTodo.priority || 'medium',
      notes: prismaTodo.notes || undefined,
      userId: prismaTodo.userId,
      createdAt: prismaTodo.createdAt,
      updatedAt: prismaTodo.updatedAt,
      subtasks: prismaTodo.subtasks || undefined,
    };
  }
}
