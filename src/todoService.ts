import {
  Todo,
  Subtask,
  CreateTodoDto,
  UpdateTodoDto,
  CreateSubtaskDto,
  UpdateSubtaskDto,
  ReorderTodoItemDto,
  FindTodosQuery,
} from "./types";
import { randomUUID } from "crypto";
import { ITodoService } from "./interfaces/ITodoService";

export class TodoService implements ITodoService {
  private todos: Map<string, Todo> = new Map();

  async create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    const now = new Date();

    // Calculate next order: max order + 1 for this user
    const userTodos = Array.from(this.todos.values()).filter(
      (t) => t.userId === userId,
    );
    const maxOrder =
      userTodos.length > 0 ? Math.max(...userTodos.map((t) => t.order)) : -1;

    const todo: Todo = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description,
      completed: false,
      category: dto.category,
      dueDate: dto.dueDate,
      order: maxOrder + 1,
      priority: dto.priority || "medium",
      notes: dto.notes,
      userId,
      createdAt: now,
      updatedAt: now,
      subtasks: [],
    };

    this.todos.set(todo.id, todo);
    return todo;
  }

  async findAll(userId: string, query?: FindTodosQuery): Promise<Todo[]> {
    let todos = Array.from(this.todos.values()).filter(
      (todo) => todo.userId === userId,
    );

    if (query?.completed !== undefined) {
      todos = todos.filter((todo) => todo.completed === query.completed);
    }

    if (query?.priority) {
      todos = todos.filter((todo) => todo.priority === query.priority);
    }

    if (query?.category !== undefined) {
      todos = todos.filter((todo) => (todo.category ?? "") === query.category);
    }

    const sortBy = query?.sortBy ?? "order";
    const sortOrder = query?.sortOrder ?? "asc";
    const sortMultiplier = sortOrder === "asc" ? 1 : -1;
    const priorityRank: Record<string, number> = {
      low: 0,
      medium: 1,
      high: 2,
    };

    todos.sort((a, b) => {
      let result = 0;

      switch (sortBy) {
        case "createdAt":
          result = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case "updatedAt":
          result = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case "dueDate":
          if (!a.dueDate && !b.dueDate) {
            result = 0;
          } else if (!a.dueDate) {
            result = 1;
          } else if (!b.dueDate) {
            result = -1;
          } else {
            result = a.dueDate.getTime() - b.dueDate.getTime();
          }
          break;
        case "priority":
          result = priorityRank[a.priority] - priorityRank[b.priority];
          break;
        case "title":
          result = a.title.localeCompare(b.title);
          break;
        case "order":
        default:
          result = a.order - b.order;
          break;
      }

      if (result === 0) {
        result = a.order - b.order;
      }

      return result * sortMultiplier;
    });

    if (query?.limit !== undefined) {
      const page = query.page ?? 1;
      const offset = (page - 1) * query.limit;
      todos = todos.slice(offset, offset + query.limit);
    }

    return todos;
  }

  async findById(userId: string, id: string): Promise<Todo | null> {
    const todo = this.todos.get(id);
    return todo && todo.userId === userId ? todo : null;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTodoDto,
  ): Promise<Todo | null> {
    const todo = this.todos.get(id);
    if (!todo || todo.userId !== userId) {
      return null;
    }

    const updated: Todo = {
      ...todo,
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.completed !== undefined && { completed: dto.completed }),
      ...(dto.category !== undefined && {
        category: dto.category === null ? undefined : dto.category,
      }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate === null ? undefined : dto.dueDate,
      }),
      ...(dto.order !== undefined && { order: dto.order }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.notes !== undefined && {
        notes: dto.notes === null ? undefined : dto.notes,
      }),
      updatedAt: new Date(),
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

  async reorder(
    userId: string,
    items: ReorderTodoItemDto[],
  ): Promise<Todo[] | null> {
    const now = new Date();
    const userTodos = new Map(
      Array.from(this.todos.values())
        .filter((todo) => todo.userId === userId)
        .map((todo) => [todo.id, todo]),
    );

    for (const item of items) {
      if (!userTodos.has(item.id)) {
        return null;
      }
    }

    for (const item of items) {
      const todo = userTodos.get(item.id)!;
      const updatedTodo: Todo = {
        ...todo,
        order: item.order,
        updatedAt: now,
      };
      this.todos.set(item.id, updatedTodo);
    }

    return this.findAll(userId);
  }

  async findSubtasks(
    userId: string,
    todoId: string,
  ): Promise<Subtask[] | null> {
    const todo = this.todos.get(todoId);
    if (!todo || todo.userId !== userId) {
      return null;
    }

    return [...(todo.subtasks || [])].sort((a, b) => a.order - b.order);
  }

  async createSubtask(
    userId: string,
    todoId: string,
    dto: CreateSubtaskDto,
  ): Promise<Subtask | null> {
    const todo = this.todos.get(todoId);
    if (!todo || todo.userId !== userId) {
      return null;
    }

    const subtasks = [...(todo.subtasks || [])];
    const maxOrder =
      subtasks.length > 0 ? Math.max(...subtasks.map((s) => s.order)) : -1;
    const now = new Date();
    const subtask: Subtask = {
      id: randomUUID(),
      title: dto.title,
      completed: false,
      order: maxOrder + 1,
      todoId,
      createdAt: now,
      updatedAt: now,
    };

    const updatedTodo: Todo = {
      ...todo,
      subtasks: [...subtasks, subtask],
      updatedAt: now,
    };
    this.todos.set(todoId, updatedTodo);
    return subtask;
  }

  async updateSubtask(
    userId: string,
    todoId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ): Promise<Subtask | null> {
    const todo = this.todos.get(todoId);
    if (!todo || todo.userId !== userId || !todo.subtasks) {
      return null;
    }

    const idx = todo.subtasks.findIndex((subtask) => subtask.id === subtaskId);
    if (idx === -1) {
      return null;
    }

    const now = new Date();
    const current = todo.subtasks[idx];
    const updatedSubtask: Subtask = {
      ...current,
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.completed !== undefined && { completed: dto.completed }),
      ...(dto.order !== undefined && { order: dto.order }),
      updatedAt: now,
    };

    const updatedSubtasks = [...todo.subtasks];
    updatedSubtasks[idx] = updatedSubtask;

    const updatedTodo: Todo = {
      ...todo,
      subtasks: updatedSubtasks,
      updatedAt: now,
    };
    this.todos.set(todoId, updatedTodo);
    return updatedSubtask;
  }

  async deleteSubtask(
    userId: string,
    todoId: string,
    subtaskId: string,
  ): Promise<boolean> {
    const todo = this.todos.get(todoId);
    if (!todo || todo.userId !== userId || !todo.subtasks) {
      return false;
    }

    const nextSubtasks = todo.subtasks.filter(
      (subtask) => subtask.id !== subtaskId,
    );
    if (nextSubtasks.length === todo.subtasks.length) {
      return false;
    }

    const updatedTodo: Todo = {
      ...todo,
      subtasks: nextSubtasks,
      updatedAt: new Date(),
    };
    this.todos.set(todoId, updatedTodo);
    return true;
  }

  async clear(): Promise<void> {
    this.todos.clear();
  }
}
