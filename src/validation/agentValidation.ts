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
import { isCanonicalMetricType } from "../services/metricRegistry";
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
import {
  MAX_PAGE_SIZE,
  MAX_SEARCH_QUERY_LENGTH,
  VALID_ENERGIES,
  VALID_PRIORITIES,
  VALID_PROJECT_STATUSES,
  VALID_REVIEW_CADENCES,
  VALID_SORT_FIELDS,
  VALID_SORT_ORDERS,
  VALID_TASK_STATUSES,
} from "./constants";

const TASK_FIELD_KEYS = [
  "title",
  "description",
  "status",
  "completed",
  "projectId",
  "category",
  "headingId",
  "dueDate",
  "doDate",
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
  "blockedReason",
  "effortScore",
  "confidenceScore",
  "firstStep",
  "emotionalState",
];
const LIST_TASK_KEYS = [
  "completed",
  "priority",
  "status",
  "category",
  "project",
  "projectId",
  "unsorted",
  "needsOrganizing",
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
const CREATE_TASK_KEYS = [...TASK_FIELD_KEYS, "dryRun"];
const UPDATE_TASK_KEYS = ["id", ...TASK_FIELD_KEYS, "order", "dryRun"];
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
const DECIDE_NEXT_WORK_KEYS = ["availableMinutes", "energy", "context", "mode"];
const ANALYZE_PROJECT_HEALTH_KEYS = ["projectId"];
const ANALYZE_WORK_GRAPH_KEYS = ["projectId"];

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

function parseOptionalNonNegativeInt(
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
    value < 0 ||
    (typeof maxValue === "number" && value > maxValue)
  ) {
    if (typeof maxValue === "number") {
      throw new ValidationError(
        `${field} must be a non-negative integer not greater than ${maxValue}`,
      );
    }
    throw new ValidationError(`${field} must be a non-negative integer`);
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
  if (value === undefined || value === null) {
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
  if (value === undefined || value === null) {
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
  if (value === undefined || value === null) {
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

function parseOptionalEnergy(value: unknown): Energy | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("energy must be low, medium, or high");
  }
  const energy = value.toLowerCase() as Energy;
  if (!VALID_ENERGIES.includes(energy)) {
    throw new ValidationError("energy must be low, medium, or high");
  }
  return energy;
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

  const needsOrganizing = parseOptionalBoolean(
    body.needsOrganizing,
    "needsOrganizing",
  );
  if (needsOrganizing !== undefined) {
    query.needsOrganizing = needsOrganizing;
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

export function validateAgentCreateTaskInput(data: unknown): CreateTodoDto & {
  dryRun?: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, CREATE_TASK_KEYS, "Agent action input");
  const dryRun = parseOptionalBoolean(body.dryRun, "dryRun");
  const { dryRun: _dryRun, ...rest } = body;
  return {
    ...validateCreateTodo(rest),
    ...(dryRun !== undefined ? { dryRun } : {}),
  };
}

export function validateAgentUpdateTaskInput(data: unknown): {
  id: string;
  changes: UpdateTodoDto;
  dryRun?: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, UPDATE_TASK_KEYS, "Agent action input");
  const id = parseId(body);
  const dryRun = parseOptionalBoolean(body.dryRun, "dryRun");
  const { id: _id, dryRun: _dryRun, ...changes } = body;
  return {
    id,
    changes: validateUpdateTodo(changes),
    ...(dryRun !== undefined ? { dryRun } : {}),
  };
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

export function validateAgentDecideNextWorkInput(data: unknown): {
  availableMinutes?: number | null;
  energy?: Energy | null;
  context?: string[];
  mode: PlannerMode;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, DECIDE_NEXT_WORK_KEYS, "Agent action input");
  return {
    availableMinutes:
      parseOptionalNonNegativeInt(
        body.availableMinutes,
        "availableMinutes",
        1440,
      ) ?? undefined,
    energy: parseOptionalEnergy(body.energy) ?? undefined,
    context: parseOptionalStringList(body.context, "context", 10, 100),
    mode: parseOptionalPlannerMode(body.mode) ?? "suggest",
  };
}

export function validateAgentAnalyzeProjectHealthInput(data: unknown): {
  projectId: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ANALYZE_PROJECT_HEALTH_KEYS, "Agent action input");
  return {
    projectId: parseRequiredId(body, "projectId"),
  };
}

export function validateAgentAnalyzeWorkGraphInput(data: unknown): {
  projectId: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ANALYZE_WORK_GRAPH_KEYS, "Agent action input");
  return {
    projectId: parseRequiredId(body, "projectId"),
  };
}

// ─── Anti-entropy ────────────────────────────────────────────────────────────

const ANALYZE_TASK_QUALITY_KEYS = ["taskIds", "projectId"];
const FIND_DUPLICATE_TASKS_KEYS = ["projectId", "scope"];
const FIND_STALE_ITEMS_KEYS = ["staleDays"];
const TAXONOMY_CLEANUP_KEYS: string[] = [];

export function validateAgentAnalyzeTaskQualityInput(data: unknown): {
  taskIds?: string[];
  projectId?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, ANALYZE_TASK_QUALITY_KEYS, "Agent action input");
  if (body.taskIds !== undefined) {
    if (!Array.isArray(body.taskIds)) {
      throw new ValidationError("taskIds must be an array of strings");
    }
    for (const id of body.taskIds) {
      if (typeof id !== "string") {
        throw new ValidationError("taskIds must be an array of strings");
      }
    }
  }
  return {
    taskIds: body.taskIds as string[] | undefined,
    projectId: body.projectId ? parseRequiredId(body, "projectId") : undefined,
  };
}

export function validateAgentFindDuplicateTasksInput(data: unknown): {
  projectId?: string;
  scope?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, FIND_DUPLICATE_TASKS_KEYS, "Agent action input");
  return {
    projectId: body.projectId ? parseRequiredId(body, "projectId") : undefined,
    scope: parseOptionalString(body.scope, "scope", 20),
  };
}

export function validateAgentFindStaleItemsInput(data: unknown): {
  staleDays: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, FIND_STALE_ITEMS_KEYS, "Agent action input");
  return {
    staleDays: parseOptionalPositiveInt(body.staleDays, "staleDays", 365) ?? 30,
  };
}

export function validateAgentTaxonomyCleanupInput(data: unknown): void {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, TAXONOMY_CLEANUP_KEYS, "Agent action input");
}

// ─── Planning ─────────────────────────────────────────────────────────────────

const PLAN_TODAY_KEYS = ["availableMinutes", "energy", "date", "decisionRunId"];
const BREAK_DOWN_TASK_KEYS = ["taskId", "maxSubtasks"];
const SUGGEST_NEXT_ACTIONS_KEYS = ["projectId", "limit"];
const WEEKLY_REVIEW_SUMMARY_KEYS = ["weekStart"];

export function validateAgentPlanTodayInput(data: unknown): {
  availableMinutes?: number;
  energy?: Energy;
  date?: string;
  decisionRunId?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, PLAN_TODAY_KEYS, "Agent action input");
  return {
    availableMinutes:
      parseOptionalPositiveInt(
        body.availableMinutes,
        "availableMinutes",
        1440,
      ) ?? undefined,
    energy: parseOptionalEnergy(body.energy) ?? undefined,
    date: parseOptionalString(body.date, "date", 10),
    decisionRunId: parseOptionalString(body.decisionRunId, "decisionRunId", 36),
  };
}

export function validateAgentBreakDownTaskInput(data: unknown): {
  taskId: string;
  maxSubtasks?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, BREAK_DOWN_TASK_KEYS, "Agent action input");
  return {
    taskId: parseRequiredId(body, "taskId"),
    maxSubtasks:
      parseOptionalPositiveInt(body.maxSubtasks, "maxSubtasks", 10) ??
      undefined,
  };
}

export function validateAgentSuggestNextActionsInput(data: unknown): {
  projectId: string;
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, SUGGEST_NEXT_ACTIONS_KEYS, "Agent action input");
  return {
    projectId: parseRequiredId(body, "projectId"),
    limit: parseOptionalPositiveInt(body.limit, "limit", 50) ?? undefined,
  };
}

export function validateAgentWeeklyReviewSummaryInput(data: unknown): {
  weekStart?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, WEEKLY_REVIEW_SUMMARY_KEYS, "Agent action input");
  return {
    weekStart: parseOptionalString(body.weekStart, "weekStart", 10),
  };
}

// ─── Triage / audit / availability ───────────────────────────────────────────

const TRIAGE_CAPTURE_ITEM_KEYS = ["captureItemId", "mode"];
const TRIAGE_INBOX_KEYS = ["limit", "mode"];
const LIST_AUDIT_LOG_KEYS = ["limit", "since", "action"];
const GET_AVAILABILITY_WINDOWS_KEYS = ["date"];

export function validateAgentTriageCaptureItemInput(data: unknown): {
  captureItemId: string;
  mode?: "suggest" | "apply";
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, TRIAGE_CAPTURE_ITEM_KEYS, "Agent action input");
  const modeVal = parseOptionalString(body.mode, "mode", 10);
  if (modeVal !== undefined && modeVal !== "suggest" && modeVal !== "apply") {
    throw new ValidationError('mode must be "suggest" or "apply"');
  }
  return {
    captureItemId: parseRequiredId(body, "captureItemId"),
    mode: modeVal as "suggest" | "apply" | undefined,
  };
}

export function validateAgentTriageInboxInput(data: unknown): {
  limit?: number;
  mode?: "suggest" | "apply";
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, TRIAGE_INBOX_KEYS, "Agent action input");
  const modeVal = parseOptionalString(body.mode, "mode", 10);
  if (modeVal !== undefined && modeVal !== "suggest" && modeVal !== "apply") {
    throw new ValidationError('mode must be "suggest" or "apply"');
  }
  return {
    limit: parseOptionalPositiveInt(body.limit, "limit", 100) ?? undefined,
    mode: modeVal as "suggest" | "apply" | undefined,
  };
}

export function validateAgentListAuditLogInput(data: unknown): {
  limit?: number;
  since?: string;
  actionFilter?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_AUDIT_LOG_KEYS, "Agent action input");
  return {
    limit: parseOptionalPositiveInt(body.limit, "limit", 200) ?? undefined,
    since: parseOptionalString(body.since, "since", 30),
    actionFilter: parseOptionalString(body.action, "action", 60),
  };
}

export function validateAgentGetAvailabilityWindowsInput(data: unknown): {
  date?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, GET_AVAILABILITY_WINDOWS_KEYS, "Agent action input");
  return {
    date: parseOptionalString(body.date, "date", 10),
  };
}

// ── Issue #315: weekly_review apply_safe mode ─────────────────────────────────

export function validateAgentWeeklyReviewWithSafeInput(data: unknown): {
  mode?: "suggest" | "apply" | "apply_safe";
  includeArchived?: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, WEEKLY_REVIEW_KEYS, "Agent action input");
  const modeVal = parseOptionalString(body.mode, "mode", 20);
  if (
    modeVal !== undefined &&
    modeVal !== "suggest" &&
    modeVal !== "apply" &&
    modeVal !== "apply_safe"
  ) {
    throw new ValidationError(
      'mode must be "suggest", "apply", or "apply_safe"',
    );
  }
  return {
    mode: modeVal as "suggest" | "apply" | "apply_safe" | undefined,
    includeArchived: parseOptionalBoolean(
      body.includeArchived,
      "includeArchived",
    ),
  };
}

// ── Issue #316: create_follow_up_for_waiting_task ─────────────────────────────

const CREATE_FOLLOW_UP_KEYS = [
  "taskId",
  "mode",
  "cooldownDays",
  "title",
  "priority",
];

export function validateAgentCreateFollowUpInput(data: unknown): {
  taskId: string;
  mode?: "suggest" | "apply";
  cooldownDays?: number;
  title?: string;
  priority?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, CREATE_FOLLOW_UP_KEYS, "Agent action input");
  const modeVal = parseOptionalString(body.mode, "mode", 10);
  if (modeVal !== undefined && modeVal !== "suggest" && modeVal !== "apply") {
    throw new ValidationError('mode must be "suggest" or "apply"');
  }
  return {
    taskId: parseRequiredId(body, "taskId"),
    mode: modeVal as "suggest" | "apply" | undefined,
    cooldownDays: parseOptionalPositiveInt(
      body.cooldownDays,
      "cooldownDays",
      365,
    ),
    title: parseOptionalString(body.title, "title", 200),
    priority: parseOptionalPriority(body.priority),
  };
}

// ── Issue #314: job-run locking ───────────────────────────────────────────────

const CLAIM_JOB_RUN_KEYS = ["jobName", "periodKey"];
const COMPLETE_JOB_RUN_KEYS = ["jobName", "periodKey", "metadata"];
const FAIL_JOB_RUN_KEYS = ["jobName", "periodKey", "errorMessage"];
const GET_JOB_RUN_KEYS = ["jobName", "periodKey"];
const LIST_JOB_RUNS_KEYS = ["jobName", "status", "limit"];

export function validateAgentClaimJobRunInput(data: unknown): {
  jobName: string;
  periodKey: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, CLAIM_JOB_RUN_KEYS, "Agent action input");
  const jobName = parseOptionalString(body.jobName, "jobName", 100);
  if (!jobName) throw new ValidationError("jobName is required");
  const periodKey = parseOptionalString(body.periodKey, "periodKey", 20);
  if (!periodKey) throw new ValidationError("periodKey is required");
  return { jobName, periodKey };
}

export function validateAgentCompleteJobRunInput(data: unknown): {
  jobName: string;
  periodKey: string;
  metadata?: unknown;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, COMPLETE_JOB_RUN_KEYS, "Agent action input");
  const jobName = parseOptionalString(body.jobName, "jobName", 100);
  if (!jobName) throw new ValidationError("jobName is required");
  const periodKey = parseOptionalString(body.periodKey, "periodKey", 20);
  if (!periodKey) throw new ValidationError("periodKey is required");
  return { jobName, periodKey, metadata: body.metadata };
}

export function validateAgentFailJobRunInput(data: unknown): {
  jobName: string;
  periodKey: string;
  errorMessage: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, FAIL_JOB_RUN_KEYS, "Agent action input");
  const jobName = parseOptionalString(body.jobName, "jobName", 100);
  if (!jobName) throw new ValidationError("jobName is required");
  const periodKey = parseOptionalString(body.periodKey, "periodKey", 20);
  if (!periodKey) throw new ValidationError("periodKey is required");
  const errorMessage =
    parseOptionalString(body.errorMessage, "errorMessage", 500) ?? "";
  return { jobName, periodKey, errorMessage };
}

export function validateAgentGetJobRunInput(data: unknown): {
  jobName: string;
  periodKey: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, GET_JOB_RUN_KEYS, "Agent action input");
  const jobName = parseOptionalString(body.jobName, "jobName", 100);
  if (!jobName) throw new ValidationError("jobName is required");
  const periodKey = parseOptionalString(body.periodKey, "periodKey", 20);
  if (!periodKey) throw new ValidationError("periodKey is required");
  return { jobName, periodKey };
}

export function validateAgentListJobRunsInput(data: unknown): {
  jobName?: string;
  status?: string;
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_JOB_RUNS_KEYS, "Agent action input");
  return {
    jobName: parseOptionalString(body.jobName, "jobName", 100),
    status: parseOptionalString(body.status, "status", 20),
    limit: parseOptionalPositiveInt(body.limit, "limit", 200),
  };
}

// ── Issue #317: list_audit_log with job filter ─────────────────────────────────

const LIST_AUDIT_LOG_EXTENDED_KEYS = [
  "limit",
  "since",
  "action",
  "jobName",
  "periodKey",
  "triggeredBy",
];

export function validateAgentListAuditLogExtendedInput(data: unknown): {
  limit?: number;
  since?: string;
  actionFilter?: string;
  jobName?: string;
  periodKey?: string;
  triggeredBy?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_AUDIT_LOG_EXTENDED_KEYS, "Agent action input");
  return {
    limit: parseOptionalPositiveInt(body.limit, "limit", 200) ?? undefined,
    since: parseOptionalString(body.since, "since", 30),
    actionFilter: parseOptionalString(body.action, "action", 60),
    jobName: parseOptionalString(body.jobName, "jobName", 100),
    periodKey: parseOptionalString(body.periodKey, "periodKey", 20),
    triggeredBy: parseOptionalString(body.triggeredBy, "triggeredBy", 20),
  };
}

// ── Issue #320: dead-letter store ─────────────────────────────────────────────

const LIST_FAILED_ACTIONS_KEYS = [
  "jobName",
  "periodKey",
  "includeResolved",
  "limit",
];
const RESOLVE_FAILED_ACTION_KEYS = ["id", "resolution"];
const RECORD_FAILED_ACTION_KEYS = [
  "jobName",
  "periodKey",
  "actionType",
  "entityType",
  "entityId",
  "errorCode",
  "errorMessage",
  "payload",
  "retryable",
];

export function validateAgentListFailedActionsInput(data: unknown): {
  jobName?: string;
  periodKey?: string;
  includeResolved?: boolean;
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_FAILED_ACTIONS_KEYS, "Agent action input");
  return {
    jobName: parseOptionalString(body.jobName, "jobName", 100),
    periodKey: parseOptionalString(body.periodKey, "periodKey", 20),
    includeResolved: parseOptionalBoolean(
      body.includeResolved,
      "includeResolved",
    ),
    limit: parseOptionalPositiveInt(body.limit, "limit", 200),
  };
}

export function validateAgentResolveFailedActionInput(data: unknown): {
  id: string;
  resolution: "retried" | "dismissed";
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, RESOLVE_FAILED_ACTION_KEYS, "Agent action input");
  const id = parseId(body);
  const resolution = parseOptionalString(body.resolution, "resolution", 20);
  if (resolution !== "retried" && resolution !== "dismissed") {
    throw new ValidationError('resolution must be "retried" or "dismissed"');
  }
  return { id, resolution };
}

export function validateAgentRecordFailedActionInput(data: unknown): {
  jobName: string;
  periodKey: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  errorCode?: string;
  errorMessage?: string;
  payload?: unknown;
  retryable?: boolean;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, RECORD_FAILED_ACTION_KEYS, "Agent action input");
  const jobName = parseOptionalString(body.jobName, "jobName", 100);
  if (!jobName) throw new ValidationError("jobName is required");
  const periodKey = parseOptionalString(body.periodKey, "periodKey", 20);
  if (!periodKey) throw new ValidationError("periodKey is required");
  const actionType = parseOptionalString(body.actionType, "actionType", 100);
  if (!actionType) throw new ValidationError("actionType is required");
  return {
    jobName,
    periodKey,
    actionType,
    entityType: parseOptionalString(body.entityType, "entityType", 50),
    entityId: parseOptionalString(body.entityId, "entityId", 100),
    errorCode: parseOptionalString(body.errorCode, "errorCode", 100),
    errorMessage: parseOptionalString(body.errorMessage, "errorMessage", 1000),
    payload: body.payload,
    retryable: parseOptionalBoolean(body.retryable, "retryable"),
  };
}

// ── Issue #329: agent control plane ───────────────────────────────────────────

const UPDATE_AGENT_CONFIG_KEYS = [
  "dailyEnabled",
  "weeklyEnabled",
  "inboxEnabled",
  "watchdogEnabled",
  "decomposerEnabled",
  "autoApply",
  "maxWriteActionsPerRun",
  "inboxConfidenceThreshold",
  "staleThresholdDays",
  "waitingFollowUpDays",
  "plannerWeightPriority",
  "plannerWeightDueDate",
  "plannerWeightEnergyMatch",
  "plannerWeightEstimateFit",
  "plannerWeightFreshness",
];

export function validateAgentGetAgentConfigInput(
  _data: unknown,
): Record<string, never> {
  return {};
}

export function validateAgentUpdateAgentConfigInput(data: unknown): {
  dailyEnabled?: boolean;
  weeklyEnabled?: boolean;
  inboxEnabled?: boolean;
  watchdogEnabled?: boolean;
  decomposerEnabled?: boolean;
  autoApply?: boolean;
  maxWriteActionsPerRun?: number;
  inboxConfidenceThreshold?: number;
  staleThresholdDays?: number;
  waitingFollowUpDays?: number;
  plannerWeightPriority?: number;
  plannerWeightDueDate?: number;
  plannerWeightEnergyMatch?: number;
  plannerWeightEstimateFit?: number;
  plannerWeightFreshness?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, UPDATE_AGENT_CONFIG_KEYS, "Agent action input");
  const result: ReturnType<typeof validateAgentUpdateAgentConfigInput> = {};
  if (body.dailyEnabled !== undefined)
    result.dailyEnabled = parseOptionalBoolean(
      body.dailyEnabled,
      "dailyEnabled",
    );
  if (body.weeklyEnabled !== undefined)
    result.weeklyEnabled = parseOptionalBoolean(
      body.weeklyEnabled,
      "weeklyEnabled",
    );
  if (body.inboxEnabled !== undefined)
    result.inboxEnabled = parseOptionalBoolean(
      body.inboxEnabled,
      "inboxEnabled",
    );
  if (body.watchdogEnabled !== undefined)
    result.watchdogEnabled = parseOptionalBoolean(
      body.watchdogEnabled,
      "watchdogEnabled",
    );
  if (body.decomposerEnabled !== undefined)
    result.decomposerEnabled = parseOptionalBoolean(
      body.decomposerEnabled,
      "decomposerEnabled",
    );
  if (body.autoApply !== undefined)
    result.autoApply = parseOptionalBoolean(body.autoApply, "autoApply");
  if (body.maxWriteActionsPerRun !== undefined) {
    const v = parseOptionalPositiveInt(
      body.maxWriteActionsPerRun,
      "maxWriteActionsPerRun",
      500,
    );
    if (v !== undefined) result.maxWriteActionsPerRun = v;
  }
  if (body.inboxConfidenceThreshold !== undefined) {
    const raw = Number(body.inboxConfidenceThreshold);
    if (isNaN(raw) || raw < 0 || raw > 1)
      throw new ValidationError(
        "inboxConfidenceThreshold must be between 0 and 1",
      );
    result.inboxConfidenceThreshold = raw;
  }
  if (body.staleThresholdDays !== undefined) {
    const v = parseOptionalPositiveInt(
      body.staleThresholdDays,
      "staleThresholdDays",
      365,
    );
    if (v !== undefined) result.staleThresholdDays = v;
  }
  if (body.waitingFollowUpDays !== undefined) {
    const v = parseOptionalPositiveInt(
      body.waitingFollowUpDays,
      "waitingFollowUpDays",
      90,
    );
    if (v !== undefined) result.waitingFollowUpDays = v;
  }
  for (const field of [
    "plannerWeightPriority",
    "plannerWeightDueDate",
    "plannerWeightEnergyMatch",
    "plannerWeightEstimateFit",
    "plannerWeightFreshness",
  ] as const) {
    if (body[field] !== undefined) {
      const raw = Number(body[field]);
      if (isNaN(raw) || raw < 0 || raw > 10)
        throw new ValidationError(`${field} must be a number between 0 and 10`);
      result[field] = raw;
    }
  }
  return result;
}

// ── Issue #330: replay_job_run ─────────────────────────────────────────────────

const REPLAY_JOB_RUN_KEYS = ["jobName", "periodKey"];

export function validateAgentReplayJobRunInput(data: unknown): {
  jobName: string;
  periodKey: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, REPLAY_JOB_RUN_KEYS, "Agent action input");
  const jobName = parseOptionalString(body.jobName, "jobName", 100);
  if (!jobName) throw new ValidationError("jobName is required");
  const periodKey = parseOptionalString(body.periodKey, "periodKey", 20);
  if (!periodKey) throw new ValidationError("periodKey is required");
  return { jobName, periodKey };
}

// ── Issue #331: simulate_plan ──────────────────────────────────────────────────

const SIMULATE_PLAN_KEYS = [
  "availableMinutes",
  "energy",
  "date",
  "compareToDate",
  "decisionRunId",
];

export function validateAgentSimulatePlanInput(data: unknown): {
  availableMinutes?: number;
  energy?: string;
  date?: string;
  compareToDate?: string;
  decisionRunId?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, SIMULATE_PLAN_KEYS, "Agent action input");
  const availableMinutes = parseOptionalPositiveInt(
    body.availableMinutes,
    "availableMinutes",
    1440,
  );
  const energy = parseOptionalString(body.energy, "energy", 20);
  const date = parseOptionalString(body.date, "date", 10);
  const compareToDate = parseOptionalString(
    body.compareToDate,
    "compareToDate",
    10,
  );
  const decisionRunId = parseOptionalString(
    body.decisionRunId,
    "decisionRunId",
    36,
  );
  return { availableMinutes, energy, date, compareToDate, decisionRunId };
}

// ── Issue #332: automation metrics ── Issue #348: canonical metric registry ───

const RECORD_METRIC_KEYS = [
  "jobName",
  "periodKey",
  "metricType",
  "entityType",
  "entityId",
  "value",
  "metadata",
];
const LIST_METRICS_KEYS = ["jobName", "metricType", "periodKey", "limit"];
const METRICS_SUMMARY_KEYS = ["jobName", "since"];

export function validateAgentRecordMetricInput(data: unknown): {
  jobName: string;
  periodKey: string;
  metricType: string;
  entityType?: string;
  entityId?: string;
  value?: number;
  metadata?: unknown;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, RECORD_METRIC_KEYS, "Agent action input");
  const jobName = parseOptionalString(body.jobName, "jobName", 100);
  if (!jobName) throw new ValidationError("jobName is required");
  const periodKey = parseOptionalString(body.periodKey, "periodKey", 20);
  if (!periodKey) throw new ValidationError("periodKey is required");
  const metricType = parseOptionalString(body.metricType, "metricType", 100);
  if (!metricType) throw new ValidationError("metricType is required");
  // Lenient: allow unknown types but log a warning so callers can audit drift
  if (!isCanonicalMetricType(metricType)) {
    console.warn(
      JSON.stringify({
        type: "metric:unknown_type",
        metricType,
        jobName,
        periodKey,
      }),
    );
  }
  let value: number | undefined;
  if (body.value !== undefined) {
    const raw = Number(body.value);
    if (isNaN(raw)) throw new ValidationError("value must be a number");
    value = raw;
  }
  return {
    jobName,
    periodKey,
    metricType,
    entityType: parseOptionalString(body.entityType, "entityType", 50),
    entityId: parseOptionalString(body.entityId, "entityId", 100),
    value,
    metadata: body.metadata,
  };
}

export function validateAgentListMetricsInput(data: unknown): {
  jobName?: string;
  metricType?: string;
  periodKey?: string;
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_METRICS_KEYS, "Agent action input");
  return {
    jobName: parseOptionalString(body.jobName, "jobName", 100),
    metricType: parseOptionalString(body.metricType, "metricType", 100),
    periodKey: parseOptionalString(body.periodKey, "periodKey", 20),
    limit: parseOptionalPositiveInt(body.limit, "limit", 1000),
  };
}

export function validateAgentMetricsSummaryInput(data: unknown): {
  jobName?: string;
  since?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, METRICS_SUMMARY_KEYS, "Agent action input");
  return {
    jobName: parseOptionalString(body.jobName, "jobName", 100),
    since: parseOptionalString(body.since, "since", 30),
  };
}

// ── Issue #334: recommendation feedback ───────────────────────────────────────

const VALID_FEEDBACK_SIGNALS = ["accepted", "ignored", "snoozed", "reordered"];

const RECORD_FEEDBACK_KEYS = [
  "planDate",
  "taskId",
  "signal",
  "energy",
  "availableMinutes",
  "score",
];
const LIST_FEEDBACK_KEYS = ["taskId", "signal", "since", "limit"];
const FEEDBACK_SUMMARY_KEYS = ["since"];

export function validateAgentRecordFeedbackInput(data: unknown): {
  planDate: string;
  taskId: string;
  signal: "accepted" | "ignored" | "snoozed" | "reordered";
  energy?: string;
  availableMinutes?: number;
  score?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, RECORD_FEEDBACK_KEYS, "Agent action input");
  const planDate = parseOptionalString(body.planDate, "planDate", 10);
  if (!planDate) throw new ValidationError("planDate is required");
  const taskId = parseOptionalString(body.taskId, "taskId", 100);
  if (!taskId) throw new ValidationError("taskId is required");
  const signal = parseOptionalString(body.signal, "signal", 20);
  if (!signal || !VALID_FEEDBACK_SIGNALS.includes(signal))
    throw new ValidationError(
      `signal must be one of: ${VALID_FEEDBACK_SIGNALS.join(", ")}`,
    );
  let score: number | undefined;
  if (body.score !== undefined) {
    score = Number(body.score);
    if (isNaN(score)) throw new ValidationError("score must be a number");
  }
  return {
    planDate,
    taskId,
    signal: signal as "accepted" | "ignored" | "snoozed" | "reordered",
    energy: parseOptionalString(body.energy, "energy", 20),
    availableMinutes: parseOptionalPositiveInt(
      body.availableMinutes,
      "availableMinutes",
      1440,
    ),
    score,
  };
}

export function validateAgentListFeedbackInput(data: unknown): {
  taskId?: string;
  signal?: "accepted" | "ignored" | "snoozed" | "reordered";
  since?: string;
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_FEEDBACK_KEYS, "Agent action input");
  const signal = parseOptionalString(body.signal, "signal", 20);
  if (signal && !VALID_FEEDBACK_SIGNALS.includes(signal))
    throw new ValidationError(
      `signal must be one of: ${VALID_FEEDBACK_SIGNALS.join(", ")}`,
    );
  return {
    taskId: parseOptionalString(body.taskId, "taskId", 100),
    signal: signal as
      | "accepted"
      | "ignored"
      | "snoozed"
      | "reordered"
      | undefined,
    since: parseOptionalString(body.since, "since", 30),
    limit: parseOptionalPositiveInt(body.limit, "limit", 500),
  };
}

export function validateAgentFeedbackSummaryInput(data: unknown): {
  since?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, FEEDBACK_SUMMARY_KEYS, "Agent action input");
  return {
    since: parseOptionalString(body.since, "since", 30),
  };
}

// ── Issue #336: life state / day context ──────────────────────────────────────

const VALID_DAY_MODES = [
  "normal",
  "travel",
  "office",
  "home",
  "overloaded",
  "rescue",
  "sprint",
  "catch_up",
];

const SET_DAY_CONTEXT_KEYS = ["contextDate", "mode", "energy", "notes"];
const GET_DAY_CONTEXT_KEYS = ["contextDate"];

export function validateAgentSetDayContextInput(data: unknown): {
  contextDate: string;
  mode: import("../services/dayContextService").DayMode;
  energy?: string;
  notes?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, SET_DAY_CONTEXT_KEYS, "Agent action input");
  const contextDate =
    parseOptionalString(body.contextDate, "contextDate", 10) ??
    new Date().toISOString().slice(0, 10);
  const mode = parseOptionalString(body.mode, "mode", 20);
  if (!mode || !VALID_DAY_MODES.includes(mode))
    throw new ValidationError(
      `mode must be one of: ${VALID_DAY_MODES.join(", ")}`,
    );
  return {
    contextDate,
    mode: mode as import("../services/dayContextService").DayMode,
    energy: parseOptionalString(body.energy, "energy", 20),
    notes: parseOptionalString(body.notes, "notes", 500),
  };
}

export function validateAgentGetDayContextInput(data: unknown): {
  contextDate?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, GET_DAY_CONTEXT_KEYS, "Agent action input");
  return {
    contextDate: parseOptionalString(body.contextDate, "contextDate", 10),
  };
}

// ── Issue #351: learning recommendations ──────────────────────────────────────

const RECORD_LEARNING_REC_KEYS = [
  "type",
  "target",
  "currentValue",
  "suggestedValue",
  "confidence",
  "why",
  "evidence",
];
const LIST_LEARNING_REC_KEYS = ["status", "limit"];
const APPLY_LEARNING_REC_KEYS = ["id"];

export function validateAgentRecordLearningRecInput(data: unknown): {
  type: "config_change" | "score_weight";
  target: string;
  currentValue: unknown;
  suggestedValue: unknown;
  confidence: number;
  why: string;
  evidence?: unknown;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, RECORD_LEARNING_REC_KEYS, "Agent action input");
  const typeVal = parseOptionalString(body.type, "type", 20);
  if (typeVal !== "config_change" && typeVal !== "score_weight") {
    throw new ValidationError('type must be "config_change" or "score_weight"');
  }
  const target = parseOptionalString(body.target, "target", 100);
  if (!target) throw new ValidationError("target is required");
  if (body.currentValue === undefined)
    throw new ValidationError("currentValue is required");
  if (body.suggestedValue === undefined)
    throw new ValidationError("suggestedValue is required");
  const confidence = Number(body.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new ValidationError("confidence must be a number between 0 and 1");
  }
  const why = parseOptionalString(body.why, "why", 500);
  if (!why) throw new ValidationError("why is required");
  return {
    type: typeVal,
    target,
    currentValue: body.currentValue,
    suggestedValue: body.suggestedValue,
    confidence,
    why,
    evidence: body.evidence,
  };
}

export function validateAgentListLearningRecsInput(data: unknown): {
  status?: "pending" | "applied" | "dismissed";
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_LEARNING_REC_KEYS, "Agent action input");
  const statusVal = parseOptionalString(body.status, "status", 20);
  if (
    statusVal !== undefined &&
    statusVal !== "pending" &&
    statusVal !== "applied" &&
    statusVal !== "dismissed"
  ) {
    throw new ValidationError(
      "status must be one of: pending, applied, dismissed",
    );
  }
  return {
    status: statusVal as "pending" | "applied" | "dismissed" | undefined,
    limit: parseOptionalPositiveInt(body.limit, "limit", 100) ?? undefined,
  };
}

export function validateAgentApplyLearningRecInput(data: unknown): {
  id: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, APPLY_LEARNING_REC_KEYS, "Agent action input");
  return { id: parseRequiredId(body, "id") };
}

// ── Issues #349/#350: evaluation endpoints ────────────────────────────────────

const EVALUATE_DAILY_KEYS = ["date", "decisionRunId"];
const EVALUATE_WEEKLY_KEYS = ["weekOffset"];

export function validateAgentEvaluateDailyInput(data: unknown): {
  date: string;
  decisionRunId?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, EVALUATE_DAILY_KEYS, "Agent action input");
  const date = parseOptionalString(body.date, "date", 10);
  if (!date) throw new ValidationError("date is required (YYYY-MM-DD)");
  return {
    date,
    decisionRunId: parseOptionalString(body.decisionRunId, "decisionRunId", 36),
  };
}

export function validateAgentEvaluateWeeklyInput(data: unknown): {
  weekOffset?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, EVALUATE_WEEKLY_KEYS, "Agent action input");
  let weekOffset: number | undefined;
  if (body.weekOffset !== undefined) {
    weekOffset = Number(body.weekOffset);
    if (!Number.isInteger(weekOffset) || weekOffset < -52 || weekOffset > 0)
      throw new ValidationError(
        "weekOffset must be an integer between -52 and 0",
      );
  }
  return { weekOffset };
}

// ── Issue #343: inbox namespace expansion ─────────────────────────────────────

const CAPTURE_INBOX_ITEM_KEYS = ["text", "source"];
const LIST_INBOX_ITEMS_KEYS = ["lifecycle", "source", "limit", "since"];
const PROMOTE_INBOX_ITEM_KEYS = ["captureItemId", "type", "projectId", "title"];
const SUGGEST_CAPTURE_ROUTE_KEYS = ["text", "project", "workspaceView"];

export function validateAgentCaptureInboxItemInput(data: unknown): {
  text: string;
  source?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, CAPTURE_INBOX_ITEM_KEYS, "Agent action input");
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    throw new ValidationError(
      "text is required and must be a non-empty string",
    );
  }
  if (body.text.length > 2000) {
    throw new ValidationError("text must be at most 2000 characters");
  }
  const text = body.text.trim();
  const source = parseOptionalString(body.source, "source", 50);
  if (
    source !== undefined &&
    !["voice", "email", "manual", "api"].includes(source)
  ) {
    throw new ValidationError(
      "source must be one of: voice, email, manual, api",
    );
  }
  return { text, source };
}

export function validateAgentListInboxItemsInput(data: unknown): {
  lifecycle?: "new" | "triaged" | "discarded";
  source?: string;
  limit?: number;
  since?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_INBOX_ITEMS_KEYS, "Agent action input");
  const lifecycleVal = parseOptionalString(body.lifecycle, "lifecycle", 20);
  if (
    lifecycleVal !== undefined &&
    lifecycleVal !== "new" &&
    lifecycleVal !== "triaged" &&
    lifecycleVal !== "discarded"
  ) {
    throw new ValidationError(
      "lifecycle must be one of: new, triaged, discarded",
    );
  }
  return {
    lifecycle: lifecycleVal as "new" | "triaged" | "discarded" | undefined,
    source: parseOptionalString(body.source, "source", 50),
    limit: parseOptionalPositiveInt(body.limit, "limit", 200) ?? undefined,
    since: parseOptionalString(body.since, "since", 30),
  };
}

export function validateAgentPromoteInboxItemInput(data: unknown): {
  captureItemId: string;
  type: "task" | "project";
  projectId?: string;
  title?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, PROMOTE_INBOX_ITEM_KEYS, "Agent action input");
  const typeVal = parseOptionalString(body.type, "type", 10);
  if (typeVal !== "task" && typeVal !== "project") {
    throw new ValidationError('type must be "task" or "project"');
  }
  return {
    captureItemId: parseRequiredId(body, "captureItemId"),
    type: typeVal,
    projectId: parseOptionalString(body.projectId, "projectId", 36),
    title: parseOptionalString(body.title, "title", 500),
  };
}

export function validateAgentSuggestCaptureRouteInput(data: unknown): {
  text: string;
  project?: string;
  workspaceView?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, SUGGEST_CAPTURE_ROUTE_KEYS, "Agent action input");
  const text = parseOptionalString(body.text, "text", 2000);
  if (!text) {
    throw new ValidationError(
      "text is required and must be a non-empty string",
    );
  }
  return {
    text,
    project: parseOptionalString(body.project, "project", 120),
    workspaceView: parseOptionalString(body.workspaceView, "workspaceView", 40),
  };
}

// ── Issue #338: friction patterns ─────────────────────────────────────────────

const LIST_FRICTION_PATTERNS_KEYS = ["since", "limit"];

export function validateAgentListFrictionPatternsInput(data: unknown): {
  since?: string;
  limit?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, LIST_FRICTION_PATTERNS_KEYS, "Agent action input");
  return {
    since: parseOptionalString(body.since, "since", 10),
    limit: parseOptionalPositiveInt(body.limit, "limit", 200) ?? undefined,
  };
}

// ── Issue #339: action policies ───────────────────────────────────────────────

const UPDATE_ACTION_POLICY_KEYS = ["actionName", "autoApply", "minConfidence"];
const PREWARM_HOME_FOCUS_KEYS = [
  "topN",
  "freshnessHours",
  "force",
  "timezone",
  "periodKey",
];

export function validateAgentGetActionPoliciesInput(
  _data: unknown,
): Record<string, never> {
  return {};
}

export function validateAgentPrewarmHomeFocusInput(data: unknown): {
  topN?: 3 | 5;
  freshnessHours?: number;
  force?: boolean;
  timezone?: string;
  periodKey?: string;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, PREWARM_HOME_FOCUS_KEYS, "Agent action input");

  let topN: 3 | 5 | undefined;
  if (body.topN !== undefined) {
    const parsedTopN = Number(body.topN);
    if (parsedTopN !== 3 && parsedTopN !== 5) {
      throw new ValidationError("topN must be 3 or 5");
    }
    topN = parsedTopN;
  }

  let freshnessHours: number | undefined;
  if (body.freshnessHours !== undefined) {
    const parsedHours = Number(body.freshnessHours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 48) {
      throw new ValidationError("freshnessHours must be between 1 and 48");
    }
    freshnessHours = Math.round(parsedHours);
  }

  return {
    topN,
    freshnessHours,
    force: parseOptionalBoolean(body.force, "force"),
    timezone: parseOptionalString(body.timezone, "timezone", 50),
    periodKey: parseOptionalString(body.periodKey, "periodKey", 20),
  };
}

export function validateAgentUpdateActionPolicyInput(data: unknown): {
  actionName: string;
  autoApply?: boolean;
  minConfidence?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, UPDATE_ACTION_POLICY_KEYS, "Agent action input");
  const actionName = parseOptionalString(body.actionName, "actionName", 100);
  if (!actionName) throw new ValidationError("actionName is required");
  const result: {
    actionName: string;
    autoApply?: boolean;
    minConfidence?: number;
  } = { actionName };
  if (body.autoApply !== undefined)
    result.autoApply = parseOptionalBoolean(body.autoApply, "autoApply");
  if (body.minConfidence !== undefined) {
    const raw = Number(body.minConfidence);
    if (isNaN(raw) || raw < 0 || raw > 1)
      throw new ValidationError("minConfidence must be between 0 and 1");
    result.minConfidence = raw;
  }
  return result;
}

// ── Issue #337: weekly executive summary ──────────────────────────────────────

const WEEKLY_EXEC_SUMMARY_KEYS = ["weekOffset"];

export function validateAgentWeeklyExecSummaryInput(data: unknown): {
  weekOffset?: number;
} {
  const body = ensureObject(data, "Agent action input");
  rejectUnknownKeys(body, WEEKLY_EXEC_SUMMARY_KEYS, "Agent action input");
  let weekOffset: number | undefined;
  if (body.weekOffset !== undefined) {
    weekOffset = Number(body.weekOffset);
    if (!Number.isInteger(weekOffset) || weekOffset < -52 || weekOffset > 0)
      throw new ValidationError(
        "weekOffset must be an integer between -52 and 0",
      );
  }
  return { weekOffset };
}
