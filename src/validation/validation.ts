import {
  CreateProjectDto,
  CreateHeadingDto,
  CreateSubtaskDto,
  CreateTodoDto,
  Energy,
  ProjectStatus,
  ProjectTaskDisposition,
  RecurrenceType,
  ReviewCadence,
  UpdateProjectDto,
  UpdateSubtaskDto,
  UpdateTodoDto,
  ReorderTodoItemDto,
  ReorderHeadingItemDto,
  FindTodosQuery,
  CreateFeedbackRequestDto,
  FeedbackAttachmentMetadataDto,
  FeedbackRequestStatus,
  FeedbackRequestType,
  ListAdminFeedbackRequestsQuery,
  Priority,
  TaskSource,
  TaskStatus,
  TodoSortBy,
  SortOrder,
  UpdateAdminFeedbackRequestDto,
} from "../types";
import {
  MAX_PAGE_SIZE,
  MAX_REORDER_ITEMS,
  MAX_SEARCH_QUERY_LENGTH,
  VALID_ENERGIES,
  VALID_PRIORITIES,
  VALID_PROJECT_STATUSES,
  VALID_RECURRENCE_TYPES,
  VALID_REVIEW_CADENCES,
  VALID_SORT_FIELDS,
  VALID_SORT_ORDERS,
  VALID_TASK_SOURCES,
  VALID_TASK_STATUSES,
} from "./constants";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function normalizeNullableString(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} cannot exceed ${maxLength} characters`);
  }
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  const normalized = normalizeNullableString(value, field, maxLength);
  return normalized === null ? undefined : normalized;
}

function normalizeDateValue(
  value: unknown,
  field: string,
  allowNull = false,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(`${field} must be a string`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ${field} format`);
  }
  return date;
}

function normalizePriorityValue(
  value: unknown,
  field: string,
  allowNull: boolean,
): Priority | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(
        `${field} must be low, medium, high, or urgent`,
      );
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be low, medium, high, or urgent`);
  }
  const priority = value.toLowerCase() as Priority;
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new ValidationError(`${field} must be low, medium, high, or urgent`);
  }
  return priority;
}

function normalizeTaskStatusValue(
  value: unknown,
  field: string,
  allowNull: boolean,
): TaskStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(`${field} is required`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} is invalid`);
  }
  const status = value.toLowerCase() as TaskStatus;
  if (!VALID_TASK_STATUSES.includes(status)) {
    throw new ValidationError(`${field} is invalid`);
  }
  return status;
}

function normalizeProjectStatusValue(
  value: unknown,
  field: string,
  allowNull: boolean,
): ProjectStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(`${field} is required`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} is invalid`);
  }
  const status = value.toLowerCase() as ProjectStatus;
  if (!VALID_PROJECT_STATUSES.includes(status)) {
    throw new ValidationError(`${field} is invalid`);
  }
  return status;
}

function normalizeEnergyValue(
  value: unknown,
  field: string,
  allowNull: boolean,
): Energy | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(`${field} is required`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} is invalid`);
  }
  const energy = value.toLowerCase() as Energy;
  if (!VALID_ENERGIES.includes(energy)) {
    throw new ValidationError(`${field} is invalid`);
  }
  return energy;
}

function normalizeReviewCadenceValue(
  value: unknown,
  field: string,
  allowNull: boolean,
): ReviewCadence | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(`${field} is required`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} is invalid`);
  }
  const cadence = value.toLowerCase() as ReviewCadence;
  if (!VALID_REVIEW_CADENCES.includes(cadence)) {
    throw new ValidationError(`${field} is invalid`);
  }
  return cadence;
}

function normalizeTaskSourceValue(
  value: unknown,
  field: string,
  allowNull: boolean,
): TaskSource | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(`${field} is required`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} is invalid`);
  }
  const source = value.toLowerCase() as TaskSource;
  if (!VALID_TASK_SOURCES.includes(source)) {
    throw new ValidationError(`${field} is invalid`);
  }
  return source;
}

function normalizeStringList(
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

function normalizeIdList(
  value: unknown,
  field: string,
  maxItems: number,
): string[] | undefined {
  const ids = normalizeStringList(value, field, maxItems, 120);
  if (!ids) {
    return undefined;
  }
  ids.forEach((id) => validateId(id));
  return ids;
}

function normalizeOptionalInteger(
  value: unknown,
  field: string,
  allowNull: boolean,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError(`${field} must be a non-negative integer`);
    }
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
  return value;
}

function normalizeRecurrenceInput(
  value: unknown,
  allowNull: boolean,
):
  | CreateTodoDto["recurrence"]
  | UpdateTodoDto["recurrence"]
  | null
  | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (!allowNull) {
      throw new ValidationError("recurrence must be an object");
    }
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("recurrence must be an object");
  }

  const body = value as Record<string, unknown>;
  const recurrenceType = body.type;
  let type: RecurrenceType | undefined;
  if (recurrenceType !== undefined) {
    if (typeof recurrenceType !== "string") {
      throw new ValidationError("recurrence.type is invalid");
    }
    const normalized = recurrenceType.toLowerCase() as RecurrenceType;
    if (!VALID_RECURRENCE_TYPES.includes(normalized)) {
      throw new ValidationError("recurrence.type is invalid");
    }
    type = normalized;
  }

  const interval = normalizeOptionalInteger(
    body.interval,
    "recurrence.interval",
    true,
  );
  const rrule = normalizeNullableString(body.rrule, "recurrence.rrule", 4000);
  const nextOccurrence = normalizeDateValue(
    body.nextOccurrence,
    "recurrence.nextOccurrence",
    true,
  );

  if (
    type === undefined &&
    interval === undefined &&
    rrule === undefined &&
    nextOccurrence === undefined
  ) {
    throw new ValidationError("recurrence must include at least one field");
  }

  return {
    ...(type !== undefined ? { type } : {}),
    ...(interval !== undefined ? { interval } : {}),
    ...(rrule !== undefined ? { rrule } : {}),
    ...(nextOccurrence !== undefined ? { nextOccurrence } : {}),
  };
}

function validateTaskDateOrdering(input: {
  startDate?: Date | null;
  scheduledDate?: Date | null;
  dueDate?: Date | null;
}) {
  if (
    input.startDate &&
    input.dueDate &&
    input.dueDate.getTime() < input.startDate.getTime()
  ) {
    throw new ValidationError("dueDate cannot be earlier than startDate");
  }
  if (
    input.scheduledDate &&
    input.dueDate &&
    input.scheduledDate.getTime() > input.dueDate.getTime()
  ) {
    throw new ValidationError("scheduledDate cannot be later than dueDate");
  }
}

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

function validateHeadingName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ValidationError("Heading name must be a string");
  }
  const normalized = name.trim();
  if (!normalized) {
    throw new ValidationError("Heading name cannot be empty");
  }
  if (normalized.length > 100) {
    throw new ValidationError("Heading name cannot exceed 100 characters");
  }
  return normalized;
}

export function validateCreateProject(data: unknown): CreateProjectDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;

  const status = normalizeProjectStatusValue(body.status, "status", true);
  const archived =
    body.archived === undefined
      ? undefined
      : body.archived === null
        ? null
        : typeof body.archived === "boolean"
          ? body.archived
          : (() => {
              throw new ValidationError("archived must be a boolean");
            })();
  if (archived === null) {
    throw new ValidationError("archived must be a boolean");
  }

  return {
    name: validateProjectName(body.name),
    description: normalizeNullableString(body.description, "description", 4000),
    status: status ?? undefined,
    priority: normalizePriorityValue(body.priority, "priority", true),
    area: normalizeNullableString(body.area, "area", 100),
    goal: normalizeNullableString(body.goal, "goal", 4000),
    targetDate: normalizeDateValue(body.targetDate, "targetDate", true),
    reviewCadence:
      normalizeReviewCadenceValue(body.reviewCadence, "reviewCadence", true) ??
      undefined,
    lastReviewedAt: normalizeDateValue(
      body.lastReviewedAt,
      "lastReviewedAt",
      true,
    ),
    archived: archived ?? undefined,
  };
}

export function validateUpdateProject(data: unknown): UpdateProjectDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;
  const update: UpdateProjectDto = {};

  if (body.name !== undefined) {
    update.name = validateProjectName(body.name);
  }

  if (body.description !== undefined) {
    update.description = normalizeNullableString(
      body.description,
      "description",
      4000,
    );
  }

  if (body.status !== undefined) {
    update.status =
      normalizeProjectStatusValue(body.status, "status", true) ?? null;
  }

  if (body.priority !== undefined) {
    update.priority = normalizePriorityValue(body.priority, "priority", true);
  }

  if (body.area !== undefined) {
    update.area = normalizeNullableString(body.area, "area", 100);
  }

  if (body.goal !== undefined) {
    update.goal = normalizeNullableString(body.goal, "goal", 4000);
  }

  if (body.targetDate !== undefined) {
    update.targetDate = normalizeDateValue(body.targetDate, "targetDate", true);
  }

  if (body.reviewCadence !== undefined) {
    update.reviewCadence =
      normalizeReviewCadenceValue(body.reviewCadence, "reviewCadence", true) ??
      null;
  }

  if (body.lastReviewedAt !== undefined) {
    update.lastReviewedAt = normalizeDateValue(
      body.lastReviewedAt,
      "lastReviewedAt",
      true,
    );
  }

  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      throw new ValidationError("archived must be a boolean");
    }
    update.archived = body.archived;
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError("At least one field must be provided for update");
  }

  return update;
}

export function validateProjectTaskDisposition(
  value: unknown,
): ProjectTaskDisposition {
  if (value === undefined || value === null || value === "") {
    return "unsorted";
  }
  if (value === "unsorted" || value === "delete") {
    return value;
  }
  throw new ValidationError(
    'taskDisposition must be either "unsorted" or "delete"',
  );
}

export function validateCreateHeading(data: unknown): CreateHeadingDto {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const body = data as Record<string, unknown>;
  return {
    name: validateHeadingName(body.name),
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

function parseOptionalBooleanQuery(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new ValidationError(`${field} must be "true" or "false"`);
}

function parseOptionalDateQuery(
  value: unknown,
  field: string,
): Date | undefined {
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

function parseOptionalStringListQuery(
  value: unknown,
  field: string,
  maxItems: number,
  itemMaxLength: number,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a comma-separated string`);
  }
  const normalized = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (normalized.length === 0) {
    throw new ValidationError(`${field} cannot be empty`);
  }
  if (normalized.length > maxItems) {
    throw new ValidationError(`${field} cannot exceed ${maxItems} items`);
  }
  normalized.forEach((entry) => {
    if (entry.length > itemMaxLength) {
      throw new ValidationError(
        `${field} entries cannot exceed ${itemMaxLength} characters`,
      );
    }
  });
  return Array.from(new Set(normalized));
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
    normalized.priority =
      normalizePriorityValue(q.priority, "priority", false) ?? undefined;
  }

  if (q.status !== undefined) {
    const statuses = parseOptionalStringListQuery(q.status, "status", 20, 40);
    normalized.statuses = statuses?.map((status) => {
      const normalizedStatus = status.toLowerCase() as TaskStatus;
      if (!VALID_TASK_STATUSES.includes(normalizedStatus)) {
        throw new ValidationError(`status contains invalid value: ${status}`);
      }
      return normalizedStatus;
    });
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

  if (q.search !== undefined) {
    if (typeof q.search !== "string") {
      throw new ValidationError("search must be a string");
    }
    const search = q.search.trim();
    if (!search) {
      throw new ValidationError("search cannot be empty");
    }
    if (search.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new ValidationError(
        `search cannot exceed ${MAX_SEARCH_QUERY_LENGTH} characters`,
      );
    }
    normalized.search = search;
  }

  if (q.project !== undefined) {
    if (typeof q.project !== "string") {
      throw new ValidationError("project must be a string");
    }
    const project = q.project.trim();
    if (!project) {
      throw new ValidationError("project cannot be empty");
    }
    if (project.length > 50) {
      throw new ValidationError("project cannot exceed 50 characters");
    }
    normalized.project = project;
  }

  if (q.projectId !== undefined) {
    if (typeof q.projectId !== "string") {
      throw new ValidationError("projectId must be a string");
    }
    validateId(q.projectId);
    normalized.projectId = q.projectId;
  }

  const unsorted = parseOptionalBooleanQuery(q.unsorted, "unsorted");
  if (unsorted !== undefined) {
    normalized.unsorted = unsorted;
  }

  const archived = parseOptionalBooleanQuery(q.archived, "archived");
  if (archived !== undefined) {
    normalized.archived = archived;
  }

  const tags = parseOptionalStringListQuery(q.tags, "tags", 25, 50);
  if (tags) {
    normalized.tags = tags;
  }

  const contexts = parseOptionalStringListQuery(q.context, "context", 10, 100);
  if (contexts) {
    normalized.contexts = contexts;
  }

  const energies = parseOptionalStringListQuery(q.energy, "energy", 10, 20);
  if (energies) {
    normalized.energies = energies.map((entry) => {
      const energy = entry.toLowerCase() as Energy;
      if (!VALID_ENERGIES.includes(energy)) {
        throw new ValidationError(`energy contains invalid value: ${entry}`);
      }
      return energy;
    });
  }

  const dueDateIsNull = parseOptionalBooleanQuery(
    q.dueDateIsNull,
    "dueDateIsNull",
  );
  if (dueDateIsNull !== undefined) {
    normalized.dueDateIsNull = dueDateIsNull;
  }

  const dueDateFrom = parseOptionalDateQuery(q.dueDateFrom, "dueDateFrom");
  if (dueDateFrom) {
    normalized.dueDateFrom = dueDateFrom;
  }

  const dueDateTo = parseOptionalDateQuery(q.dueDateTo, "dueDateTo");
  if (dueDateTo) {
    normalized.dueDateTo = dueDateTo;
  }

  const dueDateAfter = parseOptionalDateQuery(q.dueDateAfter, "dueDateAfter");
  if (dueDateAfter) {
    normalized.dueDateAfter = dueDateAfter;
  }

  const dueDateBefore = parseOptionalDateQuery(
    q.dueDateBefore,
    "dueDateBefore",
  );
  if (dueDateBefore) {
    normalized.dueDateBefore = dueDateBefore;
  }

  const startDateFrom = parseOptionalDateQuery(
    q.startDateFrom,
    "startDateFrom",
  );
  if (startDateFrom) {
    normalized.startDateFrom = startDateFrom;
  }

  const startDateTo = parseOptionalDateQuery(q.startDateTo, "startDateTo");
  if (startDateTo) {
    normalized.startDateTo = startDateTo;
  }

  const scheduledDateFrom = parseOptionalDateQuery(
    q.scheduledDateFrom,
    "scheduledDateFrom",
  );
  if (scheduledDateFrom) {
    normalized.scheduledDateFrom = scheduledDateFrom;
  }

  const scheduledDateTo = parseOptionalDateQuery(
    q.scheduledDateTo,
    "scheduledDateTo",
  );
  if (scheduledDateTo) {
    normalized.scheduledDateTo = scheduledDateTo;
  }

  const reviewDateFrom = parseOptionalDateQuery(
    q.reviewDateFrom,
    "reviewDateFrom",
  );
  if (reviewDateFrom) {
    normalized.reviewDateFrom = reviewDateFrom;
  }

  const reviewDateTo = parseOptionalDateQuery(q.reviewDateTo, "reviewDateTo");
  if (reviewDateTo) {
    normalized.reviewDateTo = reviewDateTo;
  }

  const updatedBefore = parseOptionalDateQuery(
    q.updatedBefore,
    "updatedBefore",
  );
  if (updatedBefore) {
    normalized.updatedBefore = updatedBefore;
  }

  const updatedAfter = parseOptionalDateQuery(q.updatedAfter, "updatedAfter");
  if (updatedAfter) {
    normalized.updatedAfter = updatedAfter;
  }

  if (
    normalized.dueDateIsNull === true &&
    (normalized.dueDateFrom ||
      normalized.dueDateTo ||
      normalized.dueDateAfter ||
      normalized.dueDateBefore)
  ) {
    throw new ValidationError(
      "dueDateIsNull cannot be combined with due date range filters",
    );
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

  const projectId =
    body.projectId === undefined || body.projectId === null
      ? body.projectId === null
        ? null
        : undefined
      : typeof body.projectId === "string"
        ? (validateId(body.projectId), body.projectId.trim())
        : (() => {
            throw new ValidationError("projectId must be a string");
          })();

  if (body.headingId !== undefined) {
    if (body.headingId !== null && typeof body.headingId !== "string") {
      throw new ValidationError("Heading ID must be a string");
    }
    if (
      typeof body.headingId === "string" &&
      body.headingId.trim().length === 0
    ) {
      throw new ValidationError("Heading ID cannot be empty");
    }
    if (typeof body.headingId === "string") {
      validateId(body.headingId);
    }
  }

  const status = normalizeTaskStatusValue(body.status, "status", true);
  const completed =
    body.completed === undefined
      ? undefined
      : typeof body.completed === "boolean"
        ? body.completed
        : (() => {
            throw new ValidationError("Completed must be a boolean");
          })();
  const dueDate = normalizeDateValue(body.dueDate, "dueDate", true);
  const startDate = normalizeDateValue(body.startDate, "startDate", true);
  const scheduledDate = normalizeDateValue(
    body.scheduledDate,
    "scheduledDate",
    true,
  );
  const reviewDate = normalizeDateValue(body.reviewDate, "reviewDate", true);
  const estimateMinutes = normalizeOptionalInteger(
    body.estimateMinutes,
    "estimateMinutes",
    true,
  );

  validateTaskDateOrdering({ startDate, scheduledDate, dueDate });

  let normalizedStatus = status ?? "next";
  let normalizedCompleted = completed ?? false;
  if (normalizedCompleted) {
    normalizedStatus = "done";
  } else if (normalizedStatus === "done") {
    normalizedCompleted = true;
  }

  const effortScore = normalizeOptionalInteger(
    body.effortScore,
    "effortScore",
    true,
  );
  if (effortScore !== undefined && effortScore !== null) {
    if (effortScore < 1 || effortScore > 5) {
      throw new ValidationError(
        "effortScore must be an integer between 1 and 5",
      );
    }
  }
  const confidenceScore = normalizeOptionalInteger(
    body.confidenceScore,
    "confidenceScore",
    true,
  );
  if (confidenceScore !== undefined && confidenceScore !== null) {
    if (confidenceScore < 1 || confidenceScore > 5) {
      throw new ValidationError(
        "confidenceScore must be an integer between 1 and 5",
      );
    }
  }

  const areaId =
    body.areaId === undefined || body.areaId === null
      ? body.areaId === null
        ? null
        : undefined
      : typeof body.areaId === "string"
        ? (validateId(body.areaId), body.areaId.trim())
        : (() => {
            throw new ValidationError("areaId must be a string");
          })();
  const goalId =
    body.goalId === undefined || body.goalId === null
      ? body.goalId === null
        ? null
        : undefined
      : typeof body.goalId === "string"
        ? (validateId(body.goalId), body.goalId.trim())
        : (() => {
            throw new ValidationError("goalId must be a string");
          })();

  return {
    title: body.title.trim(),
    description: normalizeNullableString(body.description, "Description", 1000),
    status: normalizedStatus,
    completed: normalizedCompleted,
    projectId,
    category: normalizeNullableString(body.category, "category", 50),
    headingId:
      typeof body.headingId === "string"
        ? body.headingId.trim()
        : body.headingId,
    dueDate,
    startDate,
    scheduledDate,
    reviewDate,
    priority: normalizePriorityValue(body.priority, "priority", true),
    tags: normalizeStringList(body.tags, "tags", 25, 50),
    context: normalizeNullableString(body.context, "context", 100),
    energy: normalizeEnergyValue(body.energy, "energy", true),
    estimateMinutes,
    waitingOn: normalizeNullableString(body.waitingOn, "waitingOn", 255),
    dependsOnTaskIds: normalizeIdList(
      body.dependsOnTaskIds,
      "dependsOnTaskIds",
      50,
    ),
    archived:
      body.archived === undefined
        ? undefined
        : typeof body.archived === "boolean"
          ? body.archived
          : (() => {
              throw new ValidationError("archived must be a boolean");
            })(),
    recurrence: normalizeRecurrenceInput(body.recurrence, true) ?? undefined,
    source: normalizeTaskSourceValue(body.source, "source", true),
    doDate: normalizeDateValue(body.doDate, "doDate", true),
    blockedReason: normalizeNullableString(
      body.blockedReason,
      "blockedReason",
      500,
    ),
    effortScore,
    confidenceScore,
    sourceText: normalizeNullableString(body.sourceText, "sourceText", 100000),
    areaId,
    goalId,
    createdByPrompt: normalizeNullableString(
      body.createdByPrompt,
      "createdByPrompt",
      4000,
    ),
    notes: normalizeNullableString(body.notes, "notes", 10000),
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
    update.description = normalizeNullableString(
      body.description,
      "Description",
      1000,
    );
  }

  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      throw new ValidationError("Completed must be a boolean");
    }
    update.completed = body.completed;
  }

  if (body.status !== undefined) {
    update.status =
      normalizeTaskStatusValue(body.status, "status", true) ?? undefined;
  }

  if (body.projectId !== undefined) {
    if (body.projectId === null) {
      update.projectId = null;
    } else {
      if (typeof body.projectId !== "string") {
        throw new ValidationError("projectId must be a string");
      }
      validateId(body.projectId);
      update.projectId = body.projectId.trim();
    }
  }

  if (body.category !== undefined) {
    update.category = normalizeNullableString(body.category, "category", 50);
  }

  if (body.dueDate !== undefined) {
    update.dueDate = normalizeDateValue(body.dueDate, "dueDate", true);
  }

  if (body.startDate !== undefined) {
    update.startDate = normalizeDateValue(body.startDate, "startDate", true);
  }

  if (body.scheduledDate !== undefined) {
    update.scheduledDate = normalizeDateValue(
      body.scheduledDate,
      "scheduledDate",
      true,
    );
  }

  if (body.reviewDate !== undefined) {
    update.reviewDate = normalizeDateValue(body.reviewDate, "reviewDate", true);
  }

  if (body.headingId !== undefined) {
    if (body.headingId === null) {
      update.headingId = null;
    } else {
      if (typeof body.headingId !== "string") {
        throw new ValidationError("Heading ID must be a string");
      }
      const headingId = body.headingId.trim();
      if (!headingId) {
        throw new ValidationError("Heading ID cannot be empty");
      }
      validateId(headingId);
      update.headingId = headingId;
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
      update.priority =
        normalizePriorityValue(body.priority, "priority", true) ?? null;
    }
  }

  if (body.tags !== undefined) {
    update.tags = normalizeStringList(body.tags, "tags", 25, 50);
  }

  if (body.context !== undefined) {
    update.context = normalizeNullableString(body.context, "context", 100);
  }

  if (body.energy !== undefined) {
    update.energy = normalizeEnergyValue(body.energy, "energy", true);
  }

  if (body.estimateMinutes !== undefined) {
    update.estimateMinutes = normalizeOptionalInteger(
      body.estimateMinutes,
      "estimateMinutes",
      true,
    );
  }

  if (body.waitingOn !== undefined) {
    update.waitingOn = normalizeNullableString(
      body.waitingOn,
      "waitingOn",
      255,
    );
  }

  if (body.dependsOnTaskIds !== undefined) {
    update.dependsOnTaskIds = normalizeIdList(
      body.dependsOnTaskIds,
      "dependsOnTaskIds",
      50,
    );
  }

  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      throw new ValidationError("archived must be a boolean");
    }
    update.archived = body.archived;
  }

  if (body.recurrence !== undefined) {
    update.recurrence = normalizeRecurrenceInput(body.recurrence, true);
  }

  if (body.source !== undefined) {
    update.source = normalizeTaskSourceValue(body.source, "source", true);
  }

  if (body.doDate !== undefined) {
    update.doDate = normalizeDateValue(body.doDate, "doDate", true);
  }

  if (body.blockedReason !== undefined) {
    update.blockedReason = normalizeNullableString(
      body.blockedReason,
      "blockedReason",
      500,
    );
  }

  if (body.effortScore !== undefined) {
    const effortScore = normalizeOptionalInteger(
      body.effortScore,
      "effortScore",
      true,
    );
    if (effortScore !== undefined && effortScore !== null) {
      if (effortScore < 1 || effortScore > 5) {
        throw new ValidationError(
          "effortScore must be an integer between 1 and 5",
        );
      }
    }
    update.effortScore = effortScore;
  }

  if (body.confidenceScore !== undefined) {
    const confidenceScore = normalizeOptionalInteger(
      body.confidenceScore,
      "confidenceScore",
      true,
    );
    if (confidenceScore !== undefined && confidenceScore !== null) {
      if (confidenceScore < 1 || confidenceScore > 5) {
        throw new ValidationError(
          "confidenceScore must be an integer between 1 and 5",
        );
      }
    }
    update.confidenceScore = confidenceScore;
  }

  if (body.sourceText !== undefined) {
    update.sourceText = normalizeNullableString(
      body.sourceText,
      "sourceText",
      100000,
    );
  }

  if (body.areaId !== undefined) {
    if (body.areaId === null) {
      update.areaId = null;
    } else {
      if (typeof body.areaId !== "string") {
        throw new ValidationError("areaId must be a string");
      }
      validateId(body.areaId);
      update.areaId = body.areaId.trim();
    }
  }

  if (body.goalId !== undefined) {
    if (body.goalId === null) {
      update.goalId = null;
    } else {
      if (typeof body.goalId !== "string") {
        throw new ValidationError("goalId must be a string");
      }
      validateId(body.goalId);
      update.goalId = body.goalId.trim();
    }
  }

  if (body.createdByPrompt !== undefined) {
    update.createdByPrompt = normalizeNullableString(
      body.createdByPrompt,
      "createdByPrompt",
      4000,
    );
  }

  if (body.notes !== undefined) {
    update.notes = normalizeNullableString(body.notes, "notes", 10000);
  }

  validateTaskDateOrdering({
    startDate: update.startDate !== undefined ? update.startDate : undefined,
    scheduledDate:
      update.scheduledDate !== undefined ? update.scheduledDate : undefined,
    dueDate: update.dueDate !== undefined ? update.dueDate : undefined,
  });

  if (update.completed === true) {
    update.status = "done";
  } else if (update.completed === false && update.status === "done") {
    throw new ValidationError(
      "completed=false cannot be combined with status=done",
    );
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

  const normalized = id.trim();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(normalized)) {
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
    const headingId = entry.headingId;
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

    if (
      headingId !== undefined &&
      headingId !== null &&
      typeof headingId !== "string"
    ) {
      throw new ValidationError(`Item at index ${index} has invalid headingId`);
    }
    if (typeof headingId === "string") {
      if (headingId.trim().length === 0) {
        throw new ValidationError(
          `Item at index ${index} has invalid headingId`,
        );
      }
      validateId(headingId);
    }

    return {
      id,
      order,
      ...(headingId !== undefined && {
        headingId: typeof headingId === "string" ? headingId.trim() : null,
      }),
    };
  });

  return items;
}

export function validateReorderHeadings(
  data: unknown,
): ReorderHeadingItemDto[] {
  if (!Array.isArray(data)) {
    throw new ValidationError("Request body must be an array");
  }
  if (data.length === 0) {
    throw new ValidationError("At least one heading order item is required");
  }
  if (data.length > MAX_REORDER_ITEMS) {
    throw new ValidationError(
      `Cannot reorder more than ${MAX_REORDER_ITEMS} headings at once`,
    );
  }

  const seenIds = new Set<string>();
  return data.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Item at index ${index} must be an object`);
    }
    const entry = item as Record<string, unknown>;
    const id = entry.id;
    const sortOrder = entry.sortOrder;

    if (typeof id !== "string") {
      throw new ValidationError(`Item at index ${index} has invalid id`);
    }
    validateId(id);
    if (
      typeof sortOrder !== "number" ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      throw new ValidationError(`Item at index ${index} has invalid sortOrder`);
    }
    if (seenIds.has(id)) {
      throw new ValidationError("Duplicate heading IDs are not allowed");
    }
    seenIds.add(id);
    return { id, sortOrder };
  });
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

function normalizeOptionalAbsoluteUrl(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  const normalized = normalizeNullableString(value, field, maxLength);
  if (normalized == null) {
    return normalized;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new ValidationError(`${field} must be a valid absolute URL`);
  }
  if (!parsed.protocol || !parsed.host) {
    throw new ValidationError(`${field} must be a valid absolute URL`);
  }
  return normalized;
}

function normalizeFeedbackAttachmentMetadata(
  value: unknown,
): FeedbackAttachmentMetadataDto | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("attachmentMetadata must be an object");
  }

  const body = value as Record<string, unknown>;
  const metadata: FeedbackAttachmentMetadataDto = {};

  const name = normalizeNullableString(
    body.name,
    "attachmentMetadata.name",
    255,
  );
  if (name !== undefined) {
    metadata.name = name;
  }

  const type = normalizeNullableString(
    body.type,
    "attachmentMetadata.type",
    100,
  );
  if (type !== undefined) {
    metadata.type = type;
  }

  const size = body.size;
  if (size !== undefined) {
    if (size === null) {
      metadata.size = null;
    } else if (
      typeof size === "number" &&
      Number.isInteger(size) &&
      size >= 0
    ) {
      metadata.size = size;
    } else {
      throw new ValidationError(
        "attachmentMetadata.size must be a non-negative integer",
      );
    }
  }

  const lastModified = body.lastModified;
  if (lastModified !== undefined) {
    if (lastModified === null) {
      metadata.lastModified = null;
    } else if (
      typeof lastModified === "number" &&
      Number.isInteger(lastModified) &&
      lastModified >= 0
    ) {
      metadata.lastModified = lastModified;
    } else {
      throw new ValidationError(
        "attachmentMetadata.lastModified must be a non-negative integer",
      );
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function validateCreateFeedbackRequest(
  data: unknown,
): CreateFeedbackRequestDto {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Request body must be an object");
  }

  const body = data as Record<string, unknown>;
  const type = body.type;
  if (typeof type !== "string") {
    throw new ValidationError("type is required");
  }
  if (!["bug", "feature", "general"].includes(type)) {
    throw new ValidationError('type must be "bug", "feature", or "general"');
  }

  const title = normalizeOptionalString(body.title, "title", 200);
  if (!title) {
    throw new ValidationError("title is required");
  }

  const feedbackBody = normalizeOptionalString(body.body, "body", 8000);
  if (!feedbackBody) {
    throw new ValidationError("body is required");
  }

  return {
    type: type as CreateFeedbackRequestDto["type"],
    title,
    body: feedbackBody,
    screenshotUrl:
      normalizeOptionalAbsoluteUrl(body.screenshotUrl, "screenshotUrl", 2000) ??
      undefined,
    attachmentMetadata:
      normalizeFeedbackAttachmentMetadata(body.attachmentMetadata) ?? undefined,
    pageUrl:
      normalizeOptionalAbsoluteUrl(body.pageUrl, "pageUrl", 2000) ?? undefined,
    userAgent: normalizeOptionalString(body.userAgent, "userAgent", 2000),
    appVersion: normalizeOptionalString(body.appVersion, "appVersion", 50),
  };
}

export function validateListAdminFeedbackRequestsQuery(
  query: unknown,
): ListAdminFeedbackRequestsQuery {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return {};
  }

  const params = query as Record<string, unknown>;
  const status = normalizeOptionalString(params.status, "status", 20);
  const type = normalizeOptionalString(params.type, "type", 20);

  if (status && !["new", "triaged", "promoted", "rejected"].includes(status)) {
    throw new ValidationError(
      'status must be "new", "triaged", "promoted", or "rejected"',
    );
  }

  if (type && !["bug", "feature", "general"].includes(type)) {
    throw new ValidationError('type must be "bug", "feature", or "general"');
  }

  return {
    status: status as FeedbackRequestStatus | undefined,
    type: type as FeedbackRequestType | undefined,
  };
}

export function validateUpdateAdminFeedbackRequest(
  data: unknown,
): UpdateAdminFeedbackRequestDto {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Request body must be an object");
  }

  const body = data as Record<string, unknown>;
  const status = body.status;
  if (typeof status !== "string") {
    throw new ValidationError("status is required");
  }
  if (!["triaged", "promoted", "rejected"].includes(status)) {
    throw new ValidationError(
      'status must be "triaged", "promoted", or "rejected"',
    );
  }

  const rejectionReason = normalizeNullableString(
    body.rejectionReason,
    "rejectionReason",
    4000,
  );
  const duplicateReason = normalizeNullableString(
    body.duplicateReason,
    "duplicateReason",
    4000,
  );
  const ignoreDuplicateSuggestion =
    body.ignoreDuplicateSuggestion === undefined
      ? undefined
      : typeof body.ignoreDuplicateSuggestion === "boolean"
        ? body.ignoreDuplicateSuggestion
        : (() => {
            throw new ValidationError(
              "ignoreDuplicateSuggestion must be a boolean",
            );
          })();
  const duplicateOfFeedbackIdRaw = normalizeNullableString(
    body.duplicateOfFeedbackId,
    "duplicateOfFeedbackId",
    120,
  );
  const duplicateOfGithubIssueNumber =
    body.duplicateOfGithubIssueNumber === undefined
      ? undefined
      : body.duplicateOfGithubIssueNumber === null
        ? null
        : typeof body.duplicateOfGithubIssueNumber === "number" &&
            Number.isInteger(body.duplicateOfGithubIssueNumber) &&
            body.duplicateOfGithubIssueNumber > 0
          ? body.duplicateOfGithubIssueNumber
          : (() => {
              throw new ValidationError(
                "duplicateOfGithubIssueNumber must be a positive integer",
              );
            })();

  if (duplicateOfFeedbackIdRaw) {
    validateId(duplicateOfFeedbackIdRaw);
  }

  if (status === "rejected" && !rejectionReason) {
    throw new ValidationError(
      "rejectionReason is required when status is rejected",
    );
  }

  if (duplicateOfFeedbackIdRaw && duplicateOfGithubIssueNumber) {
    throw new ValidationError(
      "Provide either duplicateOfFeedbackId or duplicateOfGithubIssueNumber, not both",
    );
  }

  const hasDuplicateResolution = Boolean(
    duplicateOfFeedbackIdRaw || duplicateOfGithubIssueNumber,
  );
  if (hasDuplicateResolution && status !== "triaged") {
    throw new ValidationError(
      "status must be triaged when linking a confirmed duplicate",
    );
  }

  if (hasDuplicateResolution && !duplicateReason) {
    throw new ValidationError(
      "duplicateReason is required when linking a confirmed duplicate",
    );
  }

  if (ignoreDuplicateSuggestion && status !== "promoted") {
    throw new ValidationError(
      "ignoreDuplicateSuggestion can only be used when status is promoted",
    );
  }

  return {
    status: status as UpdateAdminFeedbackRequestDto["status"],
    rejectionReason:
      status === "rejected"
        ? (rejectionReason ?? null)
        : (rejectionReason ?? null),
    ignoreDuplicateSuggestion,
    duplicateOfFeedbackId: duplicateOfFeedbackIdRaw ?? null,
    duplicateOfGithubIssueNumber: duplicateOfGithubIssueNumber ?? null,
    duplicateReason: duplicateReason ?? null,
  };
}
