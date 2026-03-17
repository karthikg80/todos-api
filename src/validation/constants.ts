import {
  Energy,
  Priority,
  ProjectStatus,
  RecurrenceType,
  ReviewCadence,
  SortOrder,
  TaskSource,
  TaskStatus,
  TodoSortBy,
} from "../types";

export const MAX_REORDER_ITEMS = 500;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_QUERY_LENGTH = 200;

export const VALID_SORT_FIELDS: TodoSortBy[] = [
  "order",
  "createdAt",
  "updatedAt",
  "dueDate",
  "priority",
  "title",
];

export const VALID_SORT_ORDERS: SortOrder[] = ["asc", "desc"];

export const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

export const VALID_TASK_STATUSES: TaskStatus[] = [
  "inbox",
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
  "done",
  "cancelled",
];

export const VALID_PROJECT_STATUSES: ProjectStatus[] = [
  "active",
  "on_hold",
  "completed",
  "archived",
];

export const VALID_ENERGIES: Energy[] = ["low", "medium", "high"];

export const VALID_REVIEW_CADENCES: ReviewCadence[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
];

export const VALID_TASK_SOURCES: TaskSource[] = [
  "manual",
  "chat",
  "email",
  "import",
  "automation",
  "api",
];

export const VALID_RECURRENCE_TYPES: RecurrenceType[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "rrule",
];
