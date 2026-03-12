import {
  CreateProjectDto,
  CreateSubtaskDto,
  CreateTodoDto,
  Energy,
  FindTodosQuery,
  Priority,
  ReviewCadence,
  ProjectStatus,
  SortOrder,
  TaskStatus,
  TodoSortBy,
  UpdateProjectDto,
  UpdateSubtaskDto,
  UpdateTodoDto,
} from "../types";
import { PlannerMode } from "../types/plannerTypes";
import {
  ValidationError,
  validateCreateProject,
  validateCreateSubtask,
  validateCreateTodo,
  validateId,
  validateUpdateProject,
  validateUpdateSubtask,
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
const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const VALID_TASK_STATUSES: TaskStatus[] = [
  "inbox",
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
  "done",
  "cancelled",
];
const VALID_PROJECT_STATUSES: ProjectStatus[] = [
  "active",
  "on_hold",
  "completed",
  "archived",
];
const VALID_ENERGIES: Energy[] = ["low", "medium", "high"];
const VALID_REVIEW_CADENCES: ReviewCadence[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
];
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_QUERY_LENGTH = 200;

const TASK_FIELD_KEYS = [
  "title",
  "description",
  "status",
  "completed",
  "projectId",
  "category",
  "headingId",
  "dueDate",
  "startDate",
  "scheduledDate",
  "reviewDate",
  "priority",
  "tags",
  "context",
  "energy",
  "estimateMinutes",
  "waitingOn",
  "dependsOnTaskIds",
  "archived",
  "recurrence",
  "source",
  "createdByPrompt",
  "notes",
];
const LIST_TASK_KEYS = [
  "completed",
  "priority",
  "status",
  "category",
  "project",
  "projectId",
  "unsorted",
  "archived",
  "tags",
  "context",
  "energy",
  "dueDateFrom",
  "dueDateTo",
  "dueDateAfter",
  "dueDateBefore",
  "dueDateIsNull",
  "startDateFrom",
  "startDateTo",
  "scheduledDateFrom",
  "scheduledDateTo",
  "reviewDateFrom",
  "reviewDateTo",
  "updatedBefore",
  "updatedAfter",
  "sortBy",
  "sortOrder",
  "page",
  "limit",
  "search",
];
const CREATE_TASK_KEYS = TASK_FIELD_KEYS;
const UPDATE_TASK_KEYS = ["id", ...TASK_FIELD_KEYS, "order"];
const COMPLETE_TASK_KEYS = ["id", "completed"];
const ARCHIVE_TASK_KEYS = ["id", "archived"];
const DELETE_TASK_KEYS = ["id", "hardDelete"];
const SUBTASK_CREATE_KEYS = ["taskId", "title"];
const SUBTASK_UPDATE_KEYS = [
  "taskId",
  "subtaskId",
  "title",
  "completed",
  "order",
];
const SUBTASK_DELETE_KEYS = ["taskId", "subtaskId"];
const PROJECT_FIELD_KEYS = [
  "name",
  "description",
  "status",
  "priority",
  "area",
  "goal",
  "targetDate",
  "reviewCadence",
  "lastReviewedAt",
  "archived",
];
const LIST_PROJECT_KEYS = ["status", "archived", "reviewCadence"];
const CREATE_PROJECT_KEYS = PROJECT_FIELD_KEYS;
const UPDATE_PROJECT_KEYS = ["id", ...PROJECT_FIELD_KEYS];
const RENAME_PROJECT_KEYS = ["id", "name"];
const DELETE_PROJECT_KEYS = ["id", "moveTasksToProjectId", "archiveInstead"];
const MOVE_TASK_TO_PROJECT_KEYS = ["taskId", "projectId"];
const ARCHIVE_PROJECT_KEYS = ["id", "archived"];
const LIST_TODAY_KEYS = ["includeOverdue", "includeCompleted"];
const LIST_NEXT_ACTION_KEYS = ["projectId", "context", "energy", "limit"];
const LIST_WAITING_ON_KEYS = ["projectId"];
const LIST_UPCOMING_KEYS = ["days", "includeScheduled", "includeDue"];
const LIST_STALE_TASK_KEYS = ["daysSinceUpdate", "completed"];
const LIST_PROJECTS_WITHOUT_NEXT_ACTION_KEYS = ["includeOnHold"];
const REVIEW_PROJECTS_KEYS = ["dueForReviewOnly"];
const PLAN_PROJECT_KEYS = ["projectId", "goal", "constraints", "mode"];
const ENSURE_NEXT_ACTION_KEYS = ["projectId", "mode"];
const WEEKLY_REVIEW_KEYS = ["mode", "includeArchived"];

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
    throw new ValidationError("priority must be low, medium, high, or urgent");
  }
  const priority = value.toLowerCase() as Priority;
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new ValidationError("priority must be low, medium, high, or urgent");
  }
  return priority;
}

function parseOptionalStatusList(value: unknown): TaskStatus[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => {
    if (typeof entry !== "string") {
      throw new ValidationError("status must be a string or array of strings");
    }
    const status = entry.toLowerCase() as TaskStatus;
    if (!VALID_TASK_STATUSES.includes(status)) {
      throw new ValidationError(`status contains invalid value: ${entry}`);
    }
    return status;
  });
}

function parseOptionalProjectStatusList(
  value: unknown,
): ProjectStatus[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => {
    if (typeof entry !== "string") {
      throw new ValidationError("status must be a string or array of strings");
    }
    const status = entry.toLowerCase() as ProjectStatus;
    if (!VALID_PROJECT_STATUSES.includes(status)) {
      throw new ValidationError(`status contains invalid value: ${entry}`);
    }
    return status;
  });
}

function parseOptionalEnergyList(value: unknown): Energy[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => {
    if (typeof entry !== "string") {
      throw new ValidationError("energy must be a string or array of strings");
    }
    const energy = entry.toLowerCase() as Energy;
    if (!VALID_ENERGIES.includes(energy)) {
      throw new ValidationError(`energy contains invalid value: ${entry}`);
    }
    return energy;
  });
}

function parseOptionalStringList(
  value: unknown,
  field: string,
  maxItems: number,
  itemMaxLength: number,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array of strings`);
  }
  if (value.length > maxItems) {
    throw new ValidationError(`${field} cannot exceed ${maxItems} items`);
  }
  return Array.from(
    new Set(
      value.map((entry) => {
        if (typeof entry !== "string") {
          throw new ValidationError(`${field} must be an array of strings`);
        }
        const normalized = entry.trim();
        if (!normalized) {
          throw new ValidationError(`${field} cannot contain empty values`);
        }
        if (normalized.length > itemMaxLength) {
          throw new ValidationError(
            `${field} entries cannot exceed ${itemMaxLength} characters`,
          );
        }
        return normalized;
      }),
    ),
  );
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

function parseOptionalPlannerMode(value: unknown): PlannerMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError('mode must be "suggest" or "apply"');
  }
  const mode = value.toLowerCase() as PlannerMode;
  if (mode !== "suggest" && mode !== "apply") {
    throw new ValidationError('mode must be "suggest" or "apply"');
  }
  return mode;
}

function parseId(body: Record<string, unknown>): string {
  if (typeof body.id !== "string") {
    throw new ValidationError("id is required and must be a string");
  }
  validateId(body.id);
  return body.id;
}

function parseRequiredId(body: Record<string, unknown>, key: string): string {
  if (typeof body[key] !== "string") {
    throw new ValidationError(`${key} is required and must be a string`);
  }
  validateId(body[key] as string);
  return body[key] as string;
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

  const statuses = parseOptionalStatusList(body.status);
  if (statuses?.length) {
    query.statuses = statuses;
  }

  const category = parseOptionalString(body.category, "category", 50);
  if (category !== undefined) {
    query.category = category;
  }

  const project = parseOptionalString(body.project, "project", 50);
  if (project !== undefined) {
    query.project = project;
  }

  if (body.projectId !== undefined) {
    if (typeof body.projectId !== "string") {
      throw new ValidationError("projectId must be a string");
    }
    validateId(body.projectId);
    query.projectId = body.projectId;
  }

  const archived = parseOptionalBoolean(body.archived, "archived");
  if (archived !== undefined) {
    query.archived = archived;
  }

  const unsorted = parseOptionalBoolean(body.unsorted, "unsorted");
  if (unsorted !== undefined) {
    query.unsorted = unsorted;
  }

  const tags = parseOptionalStringList(body.tags, "tags", 25, 50);
  if (tags?.length) {
    query.tags = tags;
  }

  const contexts = parseOptionalStringList(body.context, "context", 10, 100);
  if (contexts?.length) {
    query.contexts = contexts;
  }

  const energies = parseOptionalEnergyList(body.energy);
  if (energies?.length) {
    query.energies = energies;
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

  const startDateFrom = parseOptionalDate(body.startDateFrom, "startDateFrom");
  if (startDateFrom) {
    query.startDateFrom = startDateFrom;
  }
  const startDateTo = parseOptionalDate(body.startDateTo, "startDateTo");
  if (startDateTo) {
    query.startDateTo = startDateTo;
  }
  const scheduledDateFrom = parseOptionalDate(
    body.scheduledDateFrom,
    "scheduledDateFrom",
  );
  if (scheduledDateFrom) {
    query.scheduledDateFrom = scheduledDateFrom;
  }
  const scheduledDateTo = parseOptionalDate(
    body.scheduledDateTo,
    "scheduledDateTo",
  );
  if (scheduledDateTo) {
    query.scheduledDateTo = scheduledDateTo;
  }
  const reviewDateFrom = parseOptionalDate(
    body.reviewDateFrom,
    "reviewDateFrom",
  );
  if (reviewDateFrom) {
    query.reviewDateFrom = reviewDateFrom;
  }
  const reviewDateTo = parseOptionalDate(body.reviewDateTo, "reviewDateTo");
  if (reviewDateTo) {
    query.reviewDateTo = reviewDateTo;
  }
  const updatedBefore = parseOptionalDate(body.updatedBefore, "updatedBefore");
  if (updatedBefore) {
    query.updatedBefore = updatedBefore;
  }
  const updatedAfter = parseOptionalDate(body.updatedAfter, "updatedAfter");
  if (updatedAfter) {
    query.updatedAfter = updatedAfter;
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
  return { id, changes: validateUpdateTodo(changes) };
}

export function validateAgentCompleteTaskInput(data: unknown): {
  id: string;
  completed: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, COMPLETE_TASK_KEYS, "Agent action input");
  const id = parseId(body);
  const completed = parseOptionalBoolean(body.completed, "completed");
  return {
    id,
    completed: completed === undefined ? true : completed,
  };
}

export function validateAgentArchiveTaskInput(data: unknown): {
  id: string;
  archived: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ARCHIVE_TASK_KEYS, "Agent action input");
  const id = parseId(body);
  const archived = parseOptionalBoolean(body.archived, "archived");
  if (archived === undefined) {
    throw new ValidationError("archived is required and must be a boolean");
  }
  return { id, archived };
}

export function validateAgentDeleteTaskInput(data: unknown): {
  id: string;
  hardDelete: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, DELETE_TASK_KEYS, "Agent action input");
  const id = parseId(body);
  const hardDelete = parseOptionalBoolean(body.hardDelete, "hardDelete");
  return { id, hardDelete: hardDelete ?? false };
}

export function validateAgentAddSubtaskInput(data: unknown): {
  taskId: string;
  changes: CreateSubtaskDto;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, SUBTASK_CREATE_KEYS, "Agent action input");
  const taskId = parseRequiredId(body, "taskId");
  const { taskId: _taskId, ...changes } = body;
  return { taskId, changes: validateCreateSubtask(changes) };
}

export function validateAgentUpdateSubtaskInput(data: unknown): {
  taskId: string;
  subtaskId: string;
  changes: UpdateSubtaskDto;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, SUBTASK_UPDATE_KEYS, "Agent action input");
  const taskId = parseRequiredId(body, "taskId");
  const subtaskId = parseRequiredId(body, "subtaskId");
  const { taskId: _taskId, subtaskId: _subtaskId, ...changes } = body;
  return { taskId, subtaskId, changes: validateUpdateSubtask(changes) };
}

export function validateAgentDeleteSubtaskInput(data: unknown): {
  taskId: string;
  subtaskId: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, SUBTASK_DELETE_KEYS, "Agent action input");
  return {
    taskId: parseRequiredId(body, "taskId"),
    subtaskId: parseRequiredId(body, "subtaskId"),
  };
}

export function validateAgentListProjectsInput(data: unknown): {
  statuses?: ProjectStatus[];
  archived?: boolean;
  reviewCadences?: ReviewCadence[];
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_PROJECT_KEYS, "Agent action input");
  const archived = parseOptionalBoolean(body.archived, "archived");
  const statuses = parseOptionalProjectStatusList(body.status);
  const reviewCadences = body.reviewCadence
    ? Array.isArray(body.reviewCadence)
      ? body.reviewCadence.map((entry) => {
          if (typeof entry !== "string") {
            throw new ValidationError(
              "reviewCadence must be a string or array of strings",
            );
          }
          const cadence = entry.toLowerCase() as ReviewCadence;
          if (!VALID_REVIEW_CADENCES.includes(cadence)) {
            throw new ValidationError(
              `reviewCadence contains invalid value: ${entry}`,
            );
          }
          return cadence;
        })
      : (() => {
          if (typeof body.reviewCadence !== "string") {
            throw new ValidationError(
              "reviewCadence must be a string or array of strings",
            );
          }
          const cadence = body.reviewCadence.toLowerCase() as ReviewCadence;
          if (!VALID_REVIEW_CADENCES.includes(cadence)) {
            throw new ValidationError(
              `reviewCadence contains invalid value: ${body.reviewCadence}`,
            );
          }
          return [cadence];
        })()
    : undefined;
  return { statuses, archived, reviewCadences };
}

export function validateAgentCreateProjectInput(
  data: unknown,
): CreateProjectDto {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, CREATE_PROJECT_KEYS, "Agent action input");
  return validateCreateProject(body);
}

export function validateAgentGetProjectInput(data: unknown): { id: string } {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ["id"], "Agent action input");
  return { id: parseId(body) };
}

export function validateAgentUpdateProjectInput(data: unknown): {
  id: string;
  changes: UpdateProjectDto;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, UPDATE_PROJECT_KEYS, "Agent action input");
  const id = parseId(body);
  const { id: _id, ...changes } = body;
  return { id, changes: validateUpdateProject(changes) };
}

export function validateAgentRenameProjectInput(data: unknown): {
  id: string;
  name: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, RENAME_PROJECT_KEYS, "Agent action input");
  const id = parseId(body);
  const name = parseOptionalString(body.name, "name", 50);
  if (!name) {
    throw new ValidationError("name is required");
  }
  return { id, name };
}

export function validateAgentDeleteProjectInput(data: unknown): {
  id: string;
  moveTasksToProjectId: string | null;
  archiveInstead: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, DELETE_PROJECT_KEYS, "Agent action input");
  const id = parseId(body);
  const archiveInstead = parseOptionalBoolean(
    body.archiveInstead,
    "archiveInstead",
  );

  if (
    body.moveTasksToProjectId === undefined ||
    body.moveTasksToProjectId === null
  ) {
    return {
      id,
      moveTasksToProjectId: null,
      archiveInstead: archiveInstead ?? false,
    };
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

  return {
    id,
    moveTasksToProjectId: body.moveTasksToProjectId,
    archiveInstead: archiveInstead ?? false,
  };
}

export function validateAgentMoveTaskToProjectInput(data: unknown): {
  taskId: string;
  projectId: string | null;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, MOVE_TASK_TO_PROJECT_KEYS, "Agent action input");
  const taskId = parseRequiredId(body, "taskId");

  if (body.projectId === undefined || body.projectId === null) {
    return { taskId, projectId: null };
  }

  if (typeof body.projectId !== "string") {
    throw new ValidationError("projectId must be a string or null");
  }
  validateId(body.projectId);
  return { taskId, projectId: body.projectId };
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

export function validateAgentListTodayInput(data: unknown): {
  includeOverdue: boolean;
  includeCompleted: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_TODAY_KEYS, "Agent action input");
  return {
    includeOverdue:
      parseOptionalBoolean(body.includeOverdue, "includeOverdue") ?? true,
    includeCompleted:
      parseOptionalBoolean(body.includeCompleted, "includeCompleted") ?? false,
  };
}

export function validateAgentListNextActionsInput(data: unknown): {
  projectId?: string | null;
  contexts?: string[];
  energies?: Energy[];
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_NEXT_ACTION_KEYS, "Agent action input");
  const projectId =
    body.projectId === undefined
      ? undefined
      : body.projectId === null
        ? null
        : parseRequiredId(body, "projectId");
  return {
    projectId,
    contexts: parseOptionalStringList(body.context, "context", 10, 100),
    energies: parseOptionalEnergyList(body.energy),
    limit: parseOptionalPositiveInt(body.limit, "limit", MAX_PAGE_SIZE),
  };
}

export function validateAgentListWaitingOnInput(data: unknown): {
  projectId?: string | null;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_WAITING_ON_KEYS, "Agent action input");
  if (body.projectId === undefined) {
    return {};
  }
  if (body.projectId === null) {
    return { projectId: null };
  }
  return { projectId: parseRequiredId(body, "projectId") };
}

export function validateAgentListUpcomingInput(data: unknown): {
  days: number;
  includeScheduled: boolean;
  includeDue: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_UPCOMING_KEYS, "Agent action input");
  return {
    days: parseOptionalPositiveInt(body.days, "days", 365) ?? 7,
    includeScheduled:
      parseOptionalBoolean(body.includeScheduled, "includeScheduled") ?? true,
    includeDue: parseOptionalBoolean(body.includeDue, "includeDue") ?? true,
  };
}

export function validateAgentListStaleTasksInput(data: unknown): {
  daysSinceUpdate: number;
  completed: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_STALE_TASK_KEYS, "Agent action input");
  return {
    daysSinceUpdate:
      parseOptionalPositiveInt(body.daysSinceUpdate, "daysSinceUpdate", 3650) ??
      30,
    completed: parseOptionalBoolean(body.completed, "completed") ?? false,
  };
}

export function validateAgentListProjectsWithoutNextActionInput(
  data: unknown,
): {
  includeOnHold: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(
    body,
    LIST_PROJECTS_WITHOUT_NEXT_ACTION_KEYS,
    "Agent action input",
  );
  return {
    includeOnHold:
      parseOptionalBoolean(body.includeOnHold, "includeOnHold") ?? false,
  };
}

export function validateAgentReviewProjectsInput(data: unknown): {
  dueForReviewOnly: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, REVIEW_PROJECTS_KEYS, "Agent action input");
  return {
    dueForReviewOnly:
      parseOptionalBoolean(body.dueForReviewOnly, "dueForReviewOnly") ?? true,
  };
}

export function validateAgentPlanProjectInput(data: unknown): {
  projectId: string;
  goal?: string | null;
  constraints?: string[];
  mode: PlannerMode;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, PLAN_PROJECT_KEYS, "Agent action input");

  const goal =
    body.goal === undefined || body.goal === null
      ? body.goal === null
        ? null
        : undefined
      : parseOptionalString(body.goal, "goal", 200);

  return {
    projectId: parseRequiredId(body, "projectId"),
    goal,
    constraints: parseOptionalStringList(
      body.constraints,
      "constraints",
      20,
      200,
    ),
    mode: parseOptionalPlannerMode(body.mode) ?? "suggest",
  };
}

export function validateAgentEnsureNextActionInput(data: unknown): {
  projectId: string;
  mode: PlannerMode;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ENSURE_NEXT_ACTION_KEYS, "Agent action input");
  return {
    projectId: parseRequiredId(body, "projectId"),
    mode: parseOptionalPlannerMode(body.mode) ?? "suggest",
  };
}

export function validateAgentWeeklyReviewInput(data: unknown): {
  mode: PlannerMode;
  includeArchived: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, WEEKLY_REVIEW_KEYS, "Agent action input");
  return {
    mode: parseOptionalPlannerMode(body.mode) ?? "suggest",
    includeArchived:
      parseOptionalBoolean(body.includeArchived, "includeArchived") ?? false,
  };
}
