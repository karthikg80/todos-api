import { Todo, CreateTodoDto, UpdateTodoDto } from './types';
import { randomUUID } from 'crypto';
import { ITodoService } from './interfaces/ITodoService';

export class TodoService implements ITodoService {
  private todos: Map<string, Todo> = new Map();

  async create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    const now = new Date();
    const todo: Todo = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description,
      completed: false,
      userId,
      createdAt: now,
      updatedAt: now
    };

    this.todos.set(todo.id, todo);
    return todo;
  }

  async findAll(userId: string): Promise<Todo[]> {
    return Array.from(this.todos.values()).filter(todo => todo.userId === userId);
  }

  async findById(userId: string, id: string): Promise<Todo | null> {
    const todo = this.todos.get(id);
    return (todo && todo.userId === userId) ? todo : null;
  }

  async update(userId: string, id: string, dto: UpdateTodoDto): Promise<Todo | null> {
    const todo = this.todos.get(id);
    if (!todo || todo.userId !== userId) {
      return null;
    }

    const updated: Todo = {
      ...todo,
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.completed !== undefined && { completed: dto.completed }),
      ...(dto.category !== undefined && { category: dto.category === null ? undefined : dto.category }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate === null ? undefined : dto.dueDate }),
      updatedAt: new Date()
    };

    this.todos.set(id, updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const todo = this.todos.get(id);
    if (!todo || todo.userId !== userId) {
      return false;
    }
    return this.todos.delete(id);
  }

  async clear(): Promise<void> {
    this.todos.clear();
  }
}
