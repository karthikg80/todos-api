import { ValidationError } from "./validation";
import { Priority } from "./types";
import { CritiqueTaskInput, PlanFromGoalInput } from "./aiService";
import { AiSuggestionStatus } from "./aiSuggestionStore";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const MIN_PLAN_TASKS = 3;
const MAX_PLAN_TASKS = 8;
const ALLOWED_SUGGESTION_STATUSES: AiSuggestionStatus[] = [
  "accepted",
  "rejected",
];

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be an ISO date string`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be a valid date`);
  }
  return parsed;
}

export function validateCritiqueTaskInput(data: any): CritiqueTaskInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  if (typeof data.title !== "string" || data.title.trim().length === 0) {
    throw new ValidationError("title is required");
  }
  if (data.title.length > 200) {
    throw new ValidationError("title cannot exceed 200 characters");
  }

  if (data.description !== undefined && typeof data.description !== "string") {
    throw new ValidationError("description must be a string");
  }

  let dueDate: Date | undefined;
  if (data.dueDate !== undefined) {
    dueDate = parseDate(data.dueDate, "dueDate");
  }

  let priority: Priority | undefined;
  if (data.priority !== undefined) {
    if (typeof data.priority !== "string") {
      throw new ValidationError("priority must be low, medium, or high");
    }
    const normalized = data.priority.toLowerCase() as Priority;
    if (!PRIORITIES.includes(normalized)) {
      throw new ValidationError("priority must be low, medium, or high");
    }
    priority = normalized;
  }

  return {
    title: data.title.trim(),
    description: data.description?.trim(),
    dueDate,
    priority,
  };
}

export function validatePlanFromGoalInput(data: any): PlanFromGoalInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  if (typeof data.goal !== "string" || data.goal.trim().length === 0) {
    throw new ValidationError("goal is required");
  }
  if (data.goal.length > 200) {
    throw new ValidationError("goal cannot exceed 200 characters");
  }

  let targetDate: Date | undefined;
  if (data.targetDate !== undefined) {
    targetDate = parseDate(data.targetDate, "targetDate");
  }

  let maxTasks = 5;
  if (data.maxTasks !== undefined) {
    if (!Number.isInteger(data.maxTasks)) {
      throw new ValidationError("maxTasks must be an integer");
    }
    if (data.maxTasks < MIN_PLAN_TASKS || data.maxTasks > MAX_PLAN_TASKS) {
      throw new ValidationError(
        `maxTasks must be between ${MIN_PLAN_TASKS} and ${MAX_PLAN_TASKS}`,
      );
    }
    maxTasks = data.maxTasks;
  }

  return {
    goal: data.goal.trim(),
    targetDate,
    maxTasks,
  };
}

export function validateSuggestionListQuery(query: any): { limit: number } {
  if (query.limit === undefined) {
    return { limit: 20 };
  }

  if (typeof query.limit !== "string" || !/^\d+$/.test(query.limit)) {
    throw new ValidationError("limit must be a positive integer");
  }

  const limit = Number.parseInt(query.limit, 10);
  if (limit < 1 || limit > 100) {
    throw new ValidationError("limit must be between 1 and 100");
  }

  return { limit };
}

export function validateSuggestionStatusInput(data: any): {
  status: AiSuggestionStatus;
  reason?: string;
} {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  if (typeof data.status !== "string") {
    throw new ValidationError('status must be "accepted" or "rejected"');
  }

  const normalized = data.status.toLowerCase() as AiSuggestionStatus;
  if (!ALLOWED_SUGGESTION_STATUSES.includes(normalized)) {
    throw new ValidationError('status must be "accepted" or "rejected"');
  }

  let reason: string | undefined;
  if (data.reason !== undefined) {
    if (typeof data.reason !== "string") {
      throw new ValidationError("reason must be a string");
    }
    const trimmed = data.reason.trim();
    if (trimmed.length > 300) {
      throw new ValidationError("reason cannot exceed 300 characters");
    }
    reason = trimmed || undefined;
  }

  return { status: normalized, reason };
}

export function validateApplySuggestionInput(data: any): {
  reason?: string;
} {
  if (data === undefined || data === null) {
    return {};
  }
  if (typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  let reason: string | undefined;
  if ((data as Record<string, unknown>).reason !== undefined) {
    const raw = (data as Record<string, unknown>).reason;
    if (typeof raw !== "string") {
      throw new ValidationError("reason must be a string");
    }
    const trimmed = raw.trim();
    if (trimmed.length > 300) {
      throw new ValidationError("reason cannot exceed 300 characters");
    }
    reason = trimmed || undefined;
  }

  return { reason };
}

export function validateFeedbackSummaryQuery(query: any): {
  days: number;
  reasonLimit: number;
} {
  let days = 30;
  if (query.days !== undefined) {
    if (typeof query.days !== "string" || !/^\d+$/.test(query.days)) {
      throw new ValidationError("days must be a positive integer");
    }
    days = Number.parseInt(query.days, 10);
    if (days < 1 || days > 90) {
      throw new ValidationError("days must be between 1 and 90");
    }
  }

  let reasonLimit = 5;
  if (query.reasonLimit !== undefined) {
    if (
      typeof query.reasonLimit !== "string" ||
      !/^\d+$/.test(query.reasonLimit)
    ) {
      throw new ValidationError("reasonLimit must be a positive integer");
    }
    reasonLimit = Number.parseInt(query.reasonLimit, 10);
    if (reasonLimit < 1 || reasonLimit > 20) {
      throw new ValidationError("reasonLimit must be between 1 and 20");
    }
  }

  return { days, reasonLimit };
}

export function validateInsightsQuery(query: any): {
  days: number;
} {
  let days = 7;
  if (query.days !== undefined) {
    if (typeof query.days !== "string" || !/^\d+$/.test(query.days)) {
      throw new ValidationError("days must be a positive integer");
    }
    days = Number.parseInt(query.days, 10);
    if (days < 1 || days > 90) {
      throw new ValidationError("days must be between 1 and 90");
    }
  }

  return { days };
}

export function validateBreakdownTodoInput(data: any): {
  maxSubtasks: number;
  force: boolean;
} {
  if (data === undefined || data === null) {
    return { maxSubtasks: 5, force: false };
  }
  if (typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  let maxSubtasks = 5;
  if ((data as Record<string, unknown>).maxSubtasks !== undefined) {
    const raw = (data as Record<string, unknown>).maxSubtasks;
    if (!Number.isInteger(raw)) {
      throw new ValidationError("maxSubtasks must be an integer");
    }
    maxSubtasks = raw as number;
    if (maxSubtasks < 2 || maxSubtasks > 10) {
      throw new ValidationError("maxSubtasks must be between 2 and 10");
    }
  }

  let force = false;
  if ((data as Record<string, unknown>).force !== undefined) {
    const raw = (data as Record<string, unknown>).force;
    if (typeof raw !== "boolean") {
      throw new ValidationError("force must be a boolean");
    }
    force = raw;
  }

  return { maxSubtasks, force };
}
