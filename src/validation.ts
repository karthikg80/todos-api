import {
  CreateProjectDto,
  CreateSubtaskDto,
  CreateTodoDto,
  UpdateProjectDto,
  UpdateSubtaskDto,
  UpdateTodoDto,
  ReorderTodoItemDto,
  FindTodosQuery,
  Priority,
  TodoSortBy,
  SortOrder,
} from "./types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const MAX_REORDER_ITEMS = 500;
const MAX_PAGE_SIZE = 100;
const VALID_SORT_FIELDS: TodoSortBy[] = [
  "order",
  "createdAt",
  "updatedAt",
  "dueDate",
  "priority",
  "title",
];
const VALID_SORT_ORDERS: SortOrder[] = ["asc", "desc"];
const VALID_PRIORITIES: Priority[] = ["low", "medium", "high"];

function validateProjectName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ValidationError("Project name must be a string");
  }
  const normalized = name
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
  if (!normalized) {
    throw new ValidationError("Project name cannot be empty");
  }
  if (normalized.length > 50) {
    throw new ValidationError("Project name cannot exceed 50 characters");
  }
  return normalized;
}

export function validateCreateProject(data: unknown): CreateProjectDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;
  return {
    name: validateProjectName(body.name),
  };
}

export function validateUpdateProject(data: unknown): UpdateProjectDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;
  return {
    name: validateProjectName(body.name),
  };
}

function parsePositiveInt(value: unknown, field: string): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return parsed;
}

export function validateFindTodosQuery(query: unknown): FindTodosQuery {
  if (!query || typeof query !== "object") {
    throw new ValidationError("Query must be an object");
  }
  const q = query as Record<string, unknown>;
  const normalized: FindTodosQuery = {};

  if (q.completed !== undefined) {
    if (q.completed === "true") {
      normalized.completed = true;
    } else if (q.completed === "false") {
      normalized.completed = false;
    } else {
      throw new ValidationError('completed must be "true" or "false"');
    }
  }

  if (q.priority !== undefined) {
    if (typeof q.priority !== "string") {
      throw new ValidationError("priority must be low, medium, or high");
    }
    const priority = q.priority.toLowerCase() as Priority;
    if (!VALID_PRIORITIES.includes(priority)) {
      throw new ValidationError("priority must be low, medium, or high");
    }
    normalized.priority = priority;
  }

  if (q.category !== undefined) {
    if (typeof q.category !== "string") {
      throw new ValidationError("category must be a string");
    }
    const category = q.category.trim();
    if (!category) {
      throw new ValidationError("category cannot be empty");
    }
    if (category.length > 50) {
      throw new ValidationError("category cannot exceed 50 characters");
    }
    normalized.category = category;
  }

  if (q.sortBy !== undefined) {
    if (typeof q.sortBy !== "string") {
      throw new ValidationError(
        `sortBy must be one of: ${VALID_SORT_FIELDS.join(", ")}`,
      );
    }
    const sortBy = q.sortBy as TodoSortBy;
    if (!VALID_SORT_FIELDS.includes(sortBy)) {
      throw new ValidationError(
        `sortBy must be one of: ${VALID_SORT_FIELDS.join(", ")}`,
      );
    }
    normalized.sortBy = sortBy;
  }

  if (q.sortOrder !== undefined) {
    if (typeof q.sortOrder !== "string") {
      throw new ValidationError("sortOrder must be asc or desc");
    }
    const sortOrder = q.sortOrder.toLowerCase() as SortOrder;
    if (!VALID_SORT_ORDERS.includes(sortOrder)) {
      throw new ValidationError("sortOrder must be asc or desc");
    }
    normalized.sortOrder = sortOrder;
  }

  const pageProvided = q.page !== undefined;
  const limitProvided = q.limit !== undefined;
  if (pageProvided || limitProvided) {
    const limit = limitProvided ? parsePositiveInt(q.limit, "limit") : 20;
    if (limit > MAX_PAGE_SIZE) {
      throw new ValidationError(`limit cannot exceed ${MAX_PAGE_SIZE}`);
    }
    const page = pageProvided ? parsePositiveInt(q.page, "page") : 1;
    normalized.page = page;
    normalized.limit = limit;
  }

  return normalized;
}

export function validateCreateTodo(data: unknown): CreateTodoDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;

  if (!body.title || typeof body.title !== "string") {
    throw new ValidationError("Title is required and must be a string");
  }

  if (body.title.trim().length === 0) {
    throw new ValidationError("Title cannot be empty");
  }

  if (body.title.length > 200) {
    throw new ValidationError("Title cannot exceed 200 characters");
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      throw new ValidationError("Description must be a string");
    }
    if (body.description.length > 1000) {
      throw new ValidationError("Description cannot exceed 1000 characters");
    }
  }

  if (body.category !== undefined) {
    if (typeof body.category !== "string") {
      throw new ValidationError("Category must be a string");
    }
    if (body.category.length > 50) {
      throw new ValidationError("Category cannot exceed 50 characters");
    }
  }

  if (body.dueDate !== undefined) {
    if (typeof body.dueDate !== "string") {
      throw new ValidationError("Due date must be a string");
    }
    const date = new Date(body.dueDate);
    if (isNaN(date.getTime())) {
      throw new ValidationError("Invalid due date format");
    }
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== "string") {
      throw new ValidationError("Priority must be a string");
    }
    if (!["low", "medium", "high"].includes(body.priority.toLowerCase())) {
      throw new ValidationError("Priority must be low, medium, or high");
    }
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      throw new ValidationError("Notes must be a string");
    }
    if (body.notes.length > 10000) {
      throw new ValidationError("Notes cannot exceed 10000 characters");
    }
  }

  return {
    title: body.title.trim(),
    description: (body.description as string | undefined)?.trim(),
    category: (body.category as string | undefined)?.trim(),
    dueDate: body.dueDate ? new Date(body.dueDate as string) : undefined,
    priority: (body.priority as string | undefined)?.toLowerCase() as
      | Priority
      | undefined,
    notes: (body.notes as string | undefined)?.trim(),
  };
}

export function validateUpdateTodo(data: unknown): UpdateTodoDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;

  const update: UpdateTodoDto = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      throw new ValidationError("Title must be a string");
    }
    if (body.title.trim().length === 0) {
      throw new ValidationError("Title cannot be empty");
    }
    if (body.title.length > 200) {
      throw new ValidationError("Title cannot exceed 200 characters");
    }
    update.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      throw new ValidationError("Description must be a string");
    }
    if (body.description.length > 1000) {
      throw new ValidationError("Description cannot exceed 1000 characters");
    }
    update.description = body.description.trim();
  }

  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      throw new ValidationError("Completed must be a boolean");
    }
    update.completed = body.completed;
  }

  if (body.category !== undefined) {
    if (body.category === null) {
      update.category = null;
    } else {
      if (typeof body.category !== "string") {
        throw new ValidationError("Category must be a string");
      }
      if (body.category.length > 50) {
        throw new ValidationError("Category cannot exceed 50 characters");
      }
      update.category = body.category.trim();
    }
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null) {
      update.dueDate = null;
    } else {
      if (typeof body.dueDate !== "string") {
        throw new ValidationError("Due date must be a string");
      }
      const date = new Date(body.dueDate);
      if (isNaN(date.getTime())) {
        throw new ValidationError("Invalid due date format");
      }
      update.dueDate = date;
    }
  }

  if (body.order !== undefined) {
    if (typeof body.order !== "number") {
      throw new ValidationError("Order must be a number");
    }
    if (body.order < 0 || !Number.isInteger(body.order)) {
      throw new ValidationError("Order must be a non-negative integer");
    }
    update.order = body.order;
  }

  if (body.priority !== undefined) {
    if (body.priority === null) {
      update.priority = "medium";
    } else {
      if (typeof body.priority !== "string") {
        throw new ValidationError("Priority must be a string");
      }
      if (!["low", "medium", "high"].includes(body.priority.toLowerCase())) {
        throw new ValidationError("Priority must be low, medium, or high");
      }
      update.priority = body.priority.toLowerCase() as Priority;
    }
  }

  if (body.notes !== undefined) {
    if (body.notes === null) {
      update.notes = null;
    } else {
      if (typeof body.notes !== "string") {
        throw new ValidationError("Notes must be a string");
      }
      if (body.notes.length > 10000) {
        throw new ValidationError("Notes cannot exceed 10000 characters");
      }
      update.notes = body.notes.trim();
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError("At least one field must be provided for update");
  }

  return update;
}

export function validateId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError("Invalid ID format");
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    throw new ValidationError("Invalid ID format");
  }
}

export function validateReorderTodos(data: unknown): ReorderTodoItemDto[] {
  if (!Array.isArray(data)) {
    throw new ValidationError("Request body must be an array");
  }

  if (data.length === 0) {
    throw new ValidationError("At least one todo order item is required");
  }
  if (data.length > MAX_REORDER_ITEMS) {
    throw new ValidationError(
      `Cannot reorder more than ${MAX_REORDER_ITEMS} todos at once`,
    );
  }

  const seenIds = new Set<string>();
  const items = data.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Item at index ${index} must be an object`);
    }
    const entry = item as Record<string, unknown>;

    const id = entry.id;
    const order = entry.order;
    if (typeof id !== "string") {
      throw new ValidationError(`Item at index ${index} has invalid id`);
    }
    validateId(id);

    if (typeof order !== "number" || !Number.isInteger(order) || order < 0) {
      throw new ValidationError(`Item at index ${index} has invalid order`);
    }

    if (seenIds.has(id)) {
      throw new ValidationError("Duplicate todo IDs are not allowed");
    }
    seenIds.add(id);

    return { id, order };
  });

  return items;
}

export function validateCreateSubtask(data: unknown): CreateSubtaskDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;

  if (!body.title || typeof body.title !== "string") {
    throw new ValidationError("Title is required and must be a string");
  }

  if (body.title.trim().length === 0) {
    throw new ValidationError("Title cannot be empty");
  }

  if (body.title.length > 200) {
    throw new ValidationError("Title cannot exceed 200 characters");
  }

  return {
    title: body.title.trim(),
  };
}

export function validateUpdateSubtask(data: unknown): UpdateSubtaskDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;

  const update: UpdateSubtaskDto = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      throw new ValidationError("Title must be a string");
    }
    if (body.title.trim().length === 0) {
      throw new ValidationError("Title cannot be empty");
    }
    if (body.title.length > 200) {
      throw new ValidationError("Title cannot exceed 200 characters");
    }
    update.title = body.title.trim();
  }

  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      throw new ValidationError("Completed must be a boolean");
    }
    update.completed = body.completed;
  }

  if (body.order !== undefined) {
    if (typeof body.order !== "number") {
      throw new ValidationError("Order must be a number");
    }
    if (body.order < 0 || !Number.isInteger(body.order)) {
      throw new ValidationError("Order must be a non-negative integer");
    }
    update.order = body.order;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError("At least one field must be provided for update");
  }

  return update;
}
