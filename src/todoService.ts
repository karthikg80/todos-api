import { Todo, CreateTodoDto, UpdateTodoDto } from './types';
import { randomUUID } from 'crypto';
import { ITodoService } from './interfaces/ITodoService';

export class TodoService implements ITodoService {
  private todos: Map<string, Todo> = new Map();

  async create(dto: CreateTodoDto): Promise<Todo> {
    const now = new Date();
    const todo: Todo = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description,
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    this.todos.set(todo.id, todo);
    return todo;
  }

  async findAll(): Promise<Todo[]> {
    return Array.from(this.todos.values());
  }

  async findById(id: string): Promise<Todo | null> {
    return this.todos.get(id) ?? null;
  }

  async update(id: string, dto: UpdateTodoDto): Promise<Todo | null> {
    const todo = this.todos.get(id);
    if (!todo) {
      return null;
    }

    const updated: Todo = {
      ...todo,
      ...dto,
      updatedAt: new Date()
    };

    this.todos.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.todos.delete(id);
  }

  async clear(): Promise<void> {
    this.todos.clear();
  }
}
