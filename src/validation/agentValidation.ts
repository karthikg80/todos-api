import {
  CreateProjectDto,
  CreateTodoDto,
  FindTodosQuery,
  Priority,
  SortOrder,
  TodoSortBy,
  UpdateProjectDto,
  UpdateTodoDto,
} from "../types";
import {
  ValidationError,
  validateCreateProject,
  validateCreateTodo,
  validateId,
  validateUpdateTodo,
} from "./validation";

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
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_QUERY_LENGTH = 200;

const LIST_TASK_KEYS = [
  "completed",
  "priority",
  "category",
  "project",
  "unsorted",
  "dueDateFrom",
  "dueDateTo",
  "dueDateAfter",
  "dueDateBefore",
  "dueDateIsNull",
  "sortBy",
  "sortOrder",
  "page",
  "limit",
  "search",
];
const CREATE_TASK_KEYS = [
  "title",
  "description",
  "category",
  "headingId",
  "dueDate",
  "priority",
  "notes",
];
const UPDATE_TASK_KEYS = ["id", ...CREATE_TASK_KEYS, "completed", "order"];
const COMPLETE_TASK_KEYS = ["id", "completed"];
const CREATE_PROJECT_KEYS = ["name"];
const UPDATE_PROJECT_KEYS = ["id", "name"];
const DELETE_PROJECT_KEYS = ["id", "moveTasksToProjectId"];
const MOVE_TASK_TO_PROJECT_KEYS = ["taskId", "projectId"];
const ARCHIVE_PROJECT_KEYS = ["id", "archived"];

function ensureObject(data: unknown, label: string): Record<string, unknown> {
  if (data === undefined || data === null) {
    return {};
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError(`${label} must be an object`);
  }
  return data as Record<string, unknown>;
}

function rejectUnknownKeys(
  body: Record<string, unknown>,
  allowedKeys: string[],
  label: string,
): void {
  const unknownKeys = Object.keys(body).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new ValidationError(
      `${label} contains unsupported field(s): ${unknownKeys.join(", ")}`,
    );
  }
}

function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be an ISO 8601 date string`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be an ISO 8601 date string`);
  }
  return parsed;
}

function parseOptionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new ValidationError(`${field} cannot be empty`);
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} cannot exceed ${maxLength} characters`);
  }
  return normalized;
}

function parseOptionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} must be a boolean`);
  }
  return value;
}

function parseOptionalPositiveInt(
  value: unknown,
  field: string,
  maxValue?: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    (typeof maxValue === "number" && value > maxValue)
  ) {
    if (typeof maxValue === "number") {
      throw new ValidationError(
        `${field} must be a positive integer not greater than ${maxValue}`,
      );
    }
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return value;
}

function parseOptionalPriority(value: unknown): Priority | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("priority must be low, medium, or high");
  }
  const priority = value.toLowerCase() as Priority;
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new ValidationError("priority must be low, medium, or high");
  }
  return priority;
}

function parseOptionalSortBy(value: unknown): TodoSortBy | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("sortBy is invalid");
  }
  const sortBy = value as TodoSortBy;
  if (!VALID_SORT_FIELDS.includes(sortBy)) {
    throw new ValidationError("sortBy is invalid");
  }
  return sortBy;
}

function parseOptionalSortOrder(value: unknown): SortOrder | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("sortOrder must be asc or desc");
  }
  const sortOrder = value.toLowerCase() as SortOrder;
  if (!VALID_SORT_ORDERS.includes(sortOrder)) {
    throw new ValidationError("sortOrder must be asc or desc");
  }
  return sortOrder;
}

function parseId(body: Record<string, unknown>): string {
  if (typeof body.id !== "string") {
    throw new ValidationError("id is required and must be a string");
  }
  validateId(body.id);
  return body.id;
}

export function validateAgentListTasksInput(data: unknown): FindTodosQuery {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_TASK_KEYS, "Agent action input");

  const query: FindTodosQuery = {};
  const completed = parseOptionalBoolean(body.completed, "completed");
  if (completed !== undefined) {
    query.completed = completed;
  }

  const priority = parseOptionalPriority(body.priority);
  if (priority !== undefined) {
    query.priority = priority;
  }

  const category = parseOptionalString(body.category, "category", 50);
  if (category !== undefined) {
    query.category = category;
  }

  const project = parseOptionalString(body.project, "project", 50);
  if (project !== undefined) {
    query.project = project;
  }

  const unsorted = parseOptionalBoolean(body.unsorted, "unsorted");
  if (unsorted !== undefined) {
    query.unsorted = unsorted;
  }

  const search = parseOptionalString(
    body.search,
    "search",
    MAX_SEARCH_QUERY_LENGTH,
  );
  if (search !== undefined) {
    query.search = search;
  }

  const dueDateFrom = parseOptionalDate(body.dueDateFrom, "dueDateFrom");
  if (dueDateFrom) {
    query.dueDateFrom = dueDateFrom;
  }
  const dueDateTo = parseOptionalDate(body.dueDateTo, "dueDateTo");
  if (dueDateTo) {
    query.dueDateTo = dueDateTo;
  }
  const dueDateAfter = parseOptionalDate(body.dueDateAfter, "dueDateAfter");
  if (dueDateAfter) {
    query.dueDateAfter = dueDateAfter;
  }
  const dueDateBefore = parseOptionalDate(body.dueDateBefore, "dueDateBefore");
  if (dueDateBefore) {
    query.dueDateBefore = dueDateBefore;
  }

  const dueDateIsNull = parseOptionalBoolean(
    body.dueDateIsNull,
    "dueDateIsNull",
  );
  if (dueDateIsNull !== undefined) {
    query.dueDateIsNull = dueDateIsNull;
  }

  const sortBy = parseOptionalSortBy(body.sortBy);
  if (sortBy !== undefined) {
    query.sortBy = sortBy;
  }

  const sortOrder = parseOptionalSortOrder(body.sortOrder);
  if (sortOrder !== undefined) {
    query.sortOrder = sortOrder;
  }

  const page = parseOptionalPositiveInt(body.page, "page");
  if (page !== undefined) {
    query.page = page;
  }

  const limit = parseOptionalPositiveInt(body.limit, "limit", MAX_PAGE_SIZE);
  if (limit !== undefined) {
    query.limit = limit;
  }

  return query;
}

export function validateAgentSearchTasksInput(data: unknown): FindTodosQuery {
  const query = validateAgentListTasksInput(data);
  if (!query.search) {
    throw new ValidationError("search is required");
  }
  return query;
}

export function validateAgentGetTaskInput(data: unknown): { id: string } {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ["id"], "Agent action input");
  return { id: parseId(body) };
}

export function validateAgentCreateTaskInput(data: unknown): CreateTodoDto {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, CREATE_TASK_KEYS, "Agent action input");
  return validateCreateTodo(body);
}

export function validateAgentUpdateTaskInput(data: unknown): {
  id: string;
  changes: UpdateTodoDto;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, UPDATE_TASK_KEYS, "Agent action input");
  const id = parseId(body);
  const { id: _id, ...changes } = body;
  if (Object.keys(changes).length === 0) {
    throw new ValidationError("At least one task field must be provided");
  }
  return { id, changes: validateUpdateTodo(changes) };
}

export function validateAgentCompleteTaskInput(data: unknown): {
  id: string;
  completed: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, COMPLETE_TASK_KEYS, "Agent action input");
  const id = parseId(body);

  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    throw new ValidationError("completed must be a boolean");
  }

  return {
    id,
    completed: body.completed === undefined ? true : body.completed,
  };
}

export function validateAgentListProjectsInput(data: unknown): void {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, [], "Agent action input");
}

export function validateAgentCreateProjectInput(
  data: unknown,
): CreateProjectDto {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, CREATE_PROJECT_KEYS, "Agent action input");
  return validateCreateProject(body);
}

export function validateAgentUpdateProjectInput(data: unknown): {
  id: string;
  changes: UpdateProjectDto;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, UPDATE_PROJECT_KEYS, "Agent action input");
  const id = parseId(body);
  const { id: _id, ...changes } = body;
  return { id, changes: validateCreateProject(changes) };
}

export function validateAgentDeleteProjectInput(data: unknown): {
  id: string;
  moveTasksToProjectId: string | null;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, DELETE_PROJECT_KEYS, "Agent action input");
  const id = parseId(body);

  if (
    body.moveTasksToProjectId === undefined ||
    body.moveTasksToProjectId === null
  ) {
    return { id, moveTasksToProjectId: null };
  }

  if (typeof body.moveTasksToProjectId !== "string") {
    throw new ValidationError("moveTasksToProjectId must be a string or null");
  }

  validateId(body.moveTasksToProjectId);
  if (body.moveTasksToProjectId === id) {
    throw new ValidationError(
      "moveTasksToProjectId must reference a different project",
    );
  }

  return { id, moveTasksToProjectId: body.moveTasksToProjectId };
}

export function validateAgentMoveTaskToProjectInput(data: unknown): {
  taskId: string;
  projectId: string | null;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, MOVE_TASK_TO_PROJECT_KEYS, "Agent action input");

  if (typeof body.taskId !== "string") {
    throw new ValidationError("taskId is required and must be a string");
  }
  validateId(body.taskId);

  if (body.projectId === undefined || body.projectId === null) {
    return { taskId: body.taskId, projectId: null };
  }

  if (typeof body.projectId !== "string") {
    throw new ValidationError("projectId must be a string or null");
  }
  validateId(body.projectId);

  return { taskId: body.taskId, projectId: body.projectId };
}

export function validateAgentArchiveProjectInput(data: unknown): {
  id: string;
  archived: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ARCHIVE_PROJECT_KEYS, "Agent action input");
  const id = parseId(body);
  const archived = parseOptionalBoolean(body.archived, "archived");
  if (archived === undefined) {
    throw new ValidationError("archived is required and must be a boolean");
  }
  return { id, archived };
}
