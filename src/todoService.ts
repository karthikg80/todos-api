import { Todo, CreateTodoDto, UpdateTodoDto } from './types';
import { randomUUID } from 'crypto';

export class TodoService {
  private todos: Map<string, Todo> = new Map();

  create(dto: CreateTodoDto): Todo {
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

  findAll(): Todo[] {
    return Array.from(this.todos.values());
  }

  findById(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  update(id: string, dto: UpdateTodoDto): Todo | undefined {
    const todo = this.todos.get(id);
    if (!todo) {
      return undefined;
    }

    const updated: Todo = {
      ...todo,
      ...dto,
      updatedAt: new Date()
    };

    this.todos.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }

  clear(): void {
    this.todos.clear();
  }
}
