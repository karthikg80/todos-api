import { PrismaClient } from '@prisma/client';
import { ITodoService } from './interfaces/ITodoService';
import { Todo, CreateTodoDto, UpdateTodoDto } from './types';

/**
 * Prisma-based implementation of ITodoService using PostgreSQL database.
 * Provides persistent storage for todos with full CRUD operations.
 */
export class PrismaTodoService implements ITodoService {
  constructor(private prisma: PrismaClient) {}

  async create(dto: CreateTodoDto): Promise<Todo> {
    const todo = await this.prisma.todo.create({
      data: {
        title: dto.title,
        description: dto.description,
        completed: false,
      },
    });

    return this.mapPrismaToTodo(todo);
  }

  async findAll(): Promise<Todo[]> {
    const todos = await this.prisma.todo.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return todos.map(this.mapPrismaToTodo);
  }

  async findById(id: string): Promise<Todo | null> {
    try {
      const todo = await this.prisma.todo.findUnique({
        where: { id },
      });

      return todo ? this.mapPrismaToTodo(todo) : null;
    } catch (error) {
      // Handle invalid UUID or other errors
      return null;
    }
  }

  async update(id: string, dto: UpdateTodoDto): Promise<Todo | null> {
    try {
      const todo = await this.prisma.todo.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          completed: dto.completed,
        },
      });

      return this.mapPrismaToTodo(todo);
    } catch (error: any) {
      // P2025: Record not found
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.todo.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      // P2025: Record not found
      if (error.code === 'P2025') {
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
      createdAt: prismaTodo.createdAt,
      updatedAt: prismaTodo.updatedAt,
    };
  }
}
