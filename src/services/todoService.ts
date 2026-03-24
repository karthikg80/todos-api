import {
  Todo,
  Subtask,
  CreateTodoDto,
  UpdateTodoDto,
  CreateSubtaskDto,
  UpdateSubtaskDto,
  ReorderTodoItemDto,
  FindTodosQuery,
} from "../types";
import { randomUUID } from "crypto";
import { ITodoService } from "../interfaces/ITodoService";

const PROJECT_PATH_SEPARATOR = " / ";

export class TodoService implements ITodoService {
  private todos: Map<string, Todo> = new Map();

  private buildTodoState(input: {
    currentStatus?: Todo["status"];
    currentCompleted?: boolean;
    currentCompletedAt?: Date | null;
    nextStatus?: Todo["status"];
    nextCompleted?: boolean;
  }) {
    let status = input.nextStatus ?? input.currentStatus ?? "next";
    let completed = input.nextCompleted ?? input.currentCompleted ?? false;
    let completedAt = input.currentCompletedAt ?? null;

    if (input.nextStatus !== undefined && input.nextStatus !== "done") {
      completed = input.nextCompleted ?? false;
    }

    if (completed) {
      status = "done";
      completedAt = completedAt || new Date();
    } else if (status === "done") {
      status = "next";
      completedAt = null;
    } else {
      completedAt = null;
    }

    return { status, completed, completedAt };
  }

  private matchesProjectQuery(
    todo: Todo,
    projectQuery: string | undefined,
  ): boolean {
    if (!projectQuery) {
      return true;
    }
    const todoProject = String(todo.category || "").trim();
    return (
      todoProject === projectQuery ||
      todoProject.startsWith(`${projectQuery}${PROJECT_PATH_SEPARATOR}`)
    );
  }

  private matchesSearchQuery(
    todo: Todo,
    searchQuery: string | undefined,
  ): boolean {
    if (!searchQuery) {
      return true;
    }
    const needle = searchQuery.toLowerCase();
    return (
      todo.title.toLowerCase().includes(needle) ||
      String(todo.description || "")
        .toLowerCase()
        .includes(needle) ||
      String(todo.notes || "")
        .toLowerCase()
        .includes(needle) ||
      String(todo.category || "")
        .toLowerCase()
        .includes(needle) ||
      String(todo.waitingOn || "")
        .toLowerCase()
        .includes(needle) ||
      todo.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  }

  private matchesDueDateQuery(
    todo: Todo,
    query: FindTodosQuery | undefined,
  ): boolean {
    if (!query) {
      return true;
    }
    if (query.dueDateIsNull === true) {
      return !todo.dueDate;
    }

    const dueDate = todo.dueDate;
    const hasRangeFilter =
      !!query.dueDateFrom ||
      !!query.dueDateTo ||
      !!query.dueDateAfter ||
      !!query.dueDateBefore;
    if (!hasRangeFilter) {
      return true;
    }
    if (!dueDate) {
      return false;
    }
    if (query.dueDateFrom && dueDate < query.dueDateFrom) {
      return false;
    }
    if (query.dueDateTo && dueDate > query.dueDateTo) {
      return false;
    }
    if (query.dueDateAfter && dueDate <= query.dueDateAfter) {
      return false;
    }
    if (query.dueDateBefore && dueDate >= query.dueDateBefore) {
      return false;
    }
    return true;
  }

  private matchesDateRange(
    value: Date | null | undefined,
    from?: Date,
    to?: Date,
  ): boolean {
    if (!from && !to) {
      return true;
    }
    if (!value) {
      return false;
    }
    if (from && value < from) {
      return false;
    }
    if (to && value > to) {
      return false;
    }
    return true;
  }

  async create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    const now = new Date();

    // Calculate next order: max order + 1 for this user
    const userTodos = Array.from(this.todos.values()).filter(
      (t) => t.userId === userId,
    );
    const maxOrder =
      userTodos.length > 0 ? Math.max(...userTodos.map((t) => t.order)) : -1;
    const state = this.buildTodoState({
      nextStatus: dto.status,
      nextCompleted: dto.completed,
    });

    const todo: Todo = {
      id: randomUUID(),
      title: dto.title,
      description: dto.description ?? undefined,
      status: state.status,
      completed: state.completed,
      projectId: dto.projectId ?? undefined,
      category: dto.category ?? undefined,
      tags: dto.tags ?? [],
      context: dto.context ?? undefined,
      energy: dto.energy ?? undefined,
      headingId: dto.headingId || undefined,
      dueDate: dto.dueDate,
      startDate: dto.startDate,
      scheduledDate: dto.scheduledDate,
      reviewDate: dto.reviewDate,
      completedAt: state.completedAt,
      estimateMinutes: dto.estimateMinutes ?? undefined,
      waitingOn: dto.waitingOn ?? undefined,
      dependsOnTaskIds: dto.dependsOnTaskIds ?? [],
      order: maxOrder + 1,
      priority: dto.priority || "medium",
      archived: dto.archived ?? false,
      recurrence: {
        type: dto.recurrence?.type ?? "none",
        interval: dto.recurrence?.interval ?? undefined,
        rrule: dto.recurrence?.rrule ?? undefined,
        nextOccurrence: dto.recurrence?.nextOccurrence ?? undefined,
      },
      source: dto.source ?? undefined,
      blockedReason: dto.blockedReason ?? undefined,
      effortScore: dto.effortScore ?? undefined,
      confidenceScore: dto.confidenceScore ?? undefined,
      firstStep: dto.firstStep ?? undefined,
      emotionalState: dto.emotionalState ?? undefined,
      sourceText: dto.sourceText ?? undefined,
      areaId: dto.areaId ?? undefined,
      goalId: dto.goalId ?? undefined,
      createdByPrompt: dto.createdByPrompt ?? undefined,
      notes: dto.notes ?? undefined,
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
      (todo) =>
        todo.userId === userId && (query?.archived ?? false) === todo.archived,
    );

    if (query?.completed !== undefined) {
      todos = todos.filter((todo) => todo.completed === query.completed);
    }

    if (query?.priority) {
      todos = todos.filter((todo) => todo.priority === query.priority);
    }

    if (query?.statuses?.length) {
      todos = todos.filter((todo) => query.statuses?.includes(todo.status));
    }

    if (query?.category !== undefined) {
      todos = todos.filter((todo) => (todo.category ?? "") === query.category);
    }

    if (query?.projectId !== undefined) {
      todos = todos.filter(
        (todo) => (todo.projectId ?? null) === query.projectId,
      );
    }

    if (query?.unsorted) {
      todos = todos.filter((todo) => !String(todo.category || "").trim());
    }

    if (query?.project) {
      todos = todos.filter((todo) =>
        this.matchesProjectQuery(todo, query.project),
      );
    }

    if (query?.search) {
      todos = todos.filter((todo) =>
        this.matchesSearchQuery(todo, query.search),
      );
    }

    if (query?.tags?.length) {
      todos = todos.filter((todo) =>
        query.tags?.some((tag) => todo.tags.includes(tag)),
      );
    }

    if (query?.contexts?.length) {
      todos = todos.filter((todo) =>
        query.contexts?.includes(String(todo.context || "")),
      );
    }

    if (query?.energies?.length) {
      todos = todos.filter((todo) =>
        todo.energy ? query.energies?.includes(todo.energy) : false,
      );
    }

    todos = todos.filter((todo) => this.matchesDueDateQuery(todo, query));
    todos = todos.filter((todo) =>
      this.matchesDateRange(
        todo.startDate,
        query?.startDateFrom,
        query?.startDateTo,
      ),
    );
    todos = todos.filter((todo) =>
      this.matchesDateRange(
        todo.scheduledDate,
        query?.scheduledDateFrom,
        query?.scheduledDateTo,
      ),
    );
    todos = todos.filter((todo) =>
      this.matchesDateRange(
        todo.reviewDate,
        query?.reviewDateFrom,
        query?.reviewDateTo,
      ),
    );
    todos = todos.filter((todo) =>
      this.matchesDateRange(
        todo.updatedAt,
        query?.updatedAfter,
        query?.updatedBefore,
      ),
    );

    const sortBy = query?.sortBy ?? "order";
    const sortOrder = query?.sortOrder ?? "asc";
    const sortMultiplier = sortOrder === "asc" ? 1 : -1;
    const priorityRank: Record<string, number> = {
      low: 0,
      medium: 1,
      high: 2,
      urgent: 3,
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
          result =
            priorityRank[a.priority ?? "medium"] -
            priorityRank[b.priority ?? "medium"];
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
      ...(dto.description !== undefined && {
        description: dto.description ?? undefined,
      }),
      ...(dto.projectId !== undefined && {
        projectId: dto.projectId ?? undefined,
      }),
      ...(dto.category !== undefined && {
        category: dto.category === null ? undefined : dto.category,
      }),
      ...(dto.headingId !== undefined && {
        headingId: dto.headingId === null ? undefined : dto.headingId,
      }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate === null ? undefined : dto.dueDate,
      }),
      ...(dto.startDate !== undefined && {
        startDate: dto.startDate === null ? undefined : dto.startDate,
      }),
      ...(dto.scheduledDate !== undefined && {
        scheduledDate:
          dto.scheduledDate === null ? undefined : dto.scheduledDate,
      }),
      ...(dto.reviewDate !== undefined && {
        reviewDate: dto.reviewDate === null ? undefined : dto.reviewDate,
      }),
      ...(dto.order !== undefined && { order: dto.order }),
      ...(dto.priority !== undefined && { priority: dto.priority || "medium" }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.context !== undefined && {
        context: dto.context === null ? undefined : dto.context,
      }),
      ...(dto.energy !== undefined && {
        energy: dto.energy === null ? undefined : dto.energy,
      }),
      ...(dto.estimateMinutes !== undefined && {
        estimateMinutes:
          dto.estimateMinutes === null ? undefined : dto.estimateMinutes,
      }),
      ...(dto.waitingOn !== undefined && {
        waitingOn: dto.waitingOn === null ? undefined : dto.waitingOn,
      }),
      ...(dto.dependsOnTaskIds !== undefined && {
        dependsOnTaskIds: dto.dependsOnTaskIds,
      }),
      ...(dto.archived !== undefined && { archived: dto.archived }),
      ...(dto.recurrence !== undefined && {
        recurrence:
          dto.recurrence === null
            ? { type: "none" }
            : {
                ...todo.recurrence,
                ...dto.recurrence,
              },
      }),
      ...(dto.source !== undefined && {
        source: dto.source === null ? undefined : dto.source,
      }),
      ...(dto.blockedReason !== undefined && {
        blockedReason:
          dto.blockedReason === null ? undefined : dto.blockedReason,
      }),
      ...(dto.effortScore !== undefined && {
        effortScore: dto.effortScore === null ? undefined : dto.effortScore,
      }),
      ...(dto.confidenceScore !== undefined && {
        confidenceScore:
          dto.confidenceScore === null ? undefined : dto.confidenceScore,
      }),
      ...(dto.firstStep !== undefined && {
        firstStep: dto.firstStep === null ? undefined : dto.firstStep,
      }),
      ...(dto.emotionalState !== undefined && {
        emotionalState:
          dto.emotionalState === null ? undefined : dto.emotionalState,
      }),
      ...(dto.sourceText !== undefined && {
        sourceText: dto.sourceText === null ? undefined : dto.sourceText,
      }),
      ...(dto.areaId !== undefined && {
        areaId: dto.areaId === null ? undefined : dto.areaId,
      }),
      ...(dto.goalId !== undefined && {
        goalId: dto.goalId === null ? undefined : dto.goalId,
      }),
      ...(dto.createdByPrompt !== undefined && {
        createdByPrompt:
          dto.createdByPrompt === null ? undefined : dto.createdByPrompt,
      }),
      ...(dto.notes !== undefined && {
        notes: dto.notes === null ? undefined : dto.notes,
      }),
      updatedAt: new Date(),
    };

    const state = this.buildTodoState({
      currentStatus: todo.status,
      currentCompleted: todo.completed,
      currentCompletedAt: todo.completedAt,
      nextStatus: dto.status,
      nextCompleted: dto.completed,
    });
    updated.status = state.status;
    updated.completed = state.completed;
    updated.completedAt = state.completedAt ?? undefined;

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
        ...(item.headingId !== undefined && {
          headingId: item.headingId === null ? undefined : item.headingId,
        }),
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
      completedAt: undefined,
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
      ...(dto.completed !== undefined && {
        completedAt: dto.completed ? now : undefined,
      }),
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
