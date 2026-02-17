import { ValidationError } from "./validation";
import { Priority } from "./types";
import {
  CritiqueTaskInput,
  DecisionAssistStubInput,
  PlanFromGoalInput,
} from "./aiService";
import { DecisionAssistSurface } from "./aiContracts";
import { AiSuggestionStatus } from "./aiSuggestionStore";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const MIN_PLAN_TASKS = 3;
const MAX_PLAN_TASKS = 8;
const ALLOWED_SUGGESTION_STATUSES: AiSuggestionStatus[] = [
  "accepted",
  "rejected",
];
const ALLOWED_DECISION_ASSIST_SURFACES: DecisionAssistSurface[] = [
  "on_create",
  "task_drawer",
  "today_plan",
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
  suggestionId?: string;
  confirmed?: boolean;
  selectedTodoIds?: string[];
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

  let suggestionId: string | undefined;
  if ((data as Record<string, unknown>).suggestionId !== undefined) {
    const raw = (data as Record<string, unknown>).suggestionId;
    if (typeof raw !== "string") {
      throw new ValidationError("suggestionId must be a string");
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new ValidationError("suggestionId cannot be empty");
    }
    if (trimmed.length > 120) {
      throw new ValidationError("suggestionId cannot exceed 120 characters");
    }
    suggestionId = trimmed;
  }

  let confirmed: boolean | undefined;
  if ((data as Record<string, unknown>).confirmed !== undefined) {
    const raw = (data as Record<string, unknown>).confirmed;
    if (typeof raw !== "boolean") {
      throw new ValidationError("confirmed must be a boolean");
    }
    confirmed = raw;
  }

  let selectedTodoIds: string[] | undefined;
  if ((data as Record<string, unknown>).selectedTodoIds !== undefined) {
    const raw = (data as Record<string, unknown>).selectedTodoIds;
    if (!Array.isArray(raw)) {
      throw new ValidationError("selectedTodoIds must be an array of strings");
    }
    const parsed = raw.map((item, index) => {
      if (typeof item !== "string") {
        throw new ValidationError(`selectedTodoIds[${index}] must be a string`);
      }
      const trimmed = item.trim();
      if (!trimmed) {
        throw new ValidationError(`selectedTodoIds[${index}] cannot be empty`);
      }
      if (trimmed.length > 120) {
        throw new ValidationError(
          `selectedTodoIds[${index}] cannot exceed 120 characters`,
        );
      }
      return trimmed;
    });
    selectedTodoIds = Array.from(new Set(parsed));
  }

  return { reason, suggestionId, confirmed, selectedTodoIds };
}

export function validateDecisionAssistLatestQuery(query: any): {
  todoId?: string;
  surface: DecisionAssistSurface;
} {
  if (typeof query.surface !== "string") {
    throw new ValidationError(
      `surface must be one of: ${ALLOWED_DECISION_ASSIST_SURFACES.join(", ")}`,
    );
  }
  const surface = query.surface as DecisionAssistSurface;
  if (!ALLOWED_DECISION_ASSIST_SURFACES.includes(surface)) {
    throw new ValidationError(
      `surface must be one of: ${ALLOWED_DECISION_ASSIST_SURFACES.join(", ")}`,
    );
  }

  let todoId: string | undefined;
  if (query.todoId !== undefined && query.todoId !== null) {
    if (typeof query.todoId !== "string" || query.todoId.trim().length === 0) {
      throw new ValidationError("todoId must be a non-empty string");
    }
    if (query.todoId.trim().length > 120) {
      throw new ValidationError("todoId cannot exceed 120 characters");
    }
    todoId = query.todoId.trim();
  }

  if (surface !== "today_plan" && !todoId) {
    throw new ValidationError("todoId is required");
  }

  return {
    todoId,
    surface,
  };
}

export function validateDecisionAssistDismissInput(data: any): {
  suggestionId?: string;
  dismissAll: boolean;
} {
  if (data === undefined || data === null) {
    return { dismissAll: true };
  }
  if (typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  let suggestionId: string | undefined;
  if ((data as Record<string, unknown>).suggestionId !== undefined) {
    const raw = (data as Record<string, unknown>).suggestionId;
    if (typeof raw !== "string") {
      throw new ValidationError("suggestionId must be a string");
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new ValidationError("suggestionId cannot be empty");
    }
    if (trimmed.length > 120) {
      throw new ValidationError("suggestionId cannot exceed 120 characters");
    }
    suggestionId = trimmed;
  }

  let dismissAll = false;
  if ((data as Record<string, unknown>).dismissAll !== undefined) {
    const raw = (data as Record<string, unknown>).dismissAll;
    if (typeof raw !== "boolean") {
      throw new ValidationError("dismissAll must be a boolean");
    }
    dismissAll = raw;
  }

  if (!dismissAll && !suggestionId) {
    dismissAll = true;
  }

  return { suggestionId, dismissAll };
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

export function validateDecisionAssistStubInput(
  data: any,
): DecisionAssistStubInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  if (typeof data.surface !== "string") {
    throw new ValidationError(
      `surface must be one of: ${ALLOWED_DECISION_ASSIST_SURFACES.join(", ")}`,
    );
  }

  const surface = data.surface as DecisionAssistSurface;
  if (!ALLOWED_DECISION_ASSIST_SURFACES.includes(surface)) {
    throw new ValidationError(
      `surface must be one of: ${ALLOWED_DECISION_ASSIST_SURFACES.join(", ")}`,
    );
  }

  const parseOptionalString = (value: unknown, field: string) => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new ValidationError(`${field} must be a string`);
    }
    const trimmed = value.trim();
    if (trimmed.length > 200) {
      throw new ValidationError(`${field} cannot exceed 200 characters`);
    }
    return trimmed || undefined;
  };

  const topNRaw = data.topN;
  let topN: 3 | 5 | undefined;
  if (topNRaw !== undefined) {
    if (!Number.isInteger(topNRaw) || (topNRaw !== 3 && topNRaw !== 5)) {
      throw new ValidationError("topN must be 3 or 5");
    }
    topN = topNRaw as 3 | 5;
  }

  let timeZone: string | undefined;
  if (data.timeZone !== undefined) {
    if (typeof data.timeZone !== "string") {
      throw new ValidationError("timeZone must be a string");
    }
    const trimmed = data.timeZone.trim();
    if (trimmed.length > 100) {
      throw new ValidationError("timeZone cannot exceed 100 characters");
    }
    timeZone = trimmed || undefined;
  }

  let anchorDateISO: string | undefined;
  if (data.anchorDateISO !== undefined) {
    if (typeof data.anchorDateISO !== "string") {
      throw new ValidationError("anchorDateISO must be a string");
    }
    const parsed = new Date(data.anchorDateISO);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError("anchorDateISO must be a valid date");
    }
    anchorDateISO = parsed.toISOString();
  }

  let todoCandidates: DecisionAssistStubInput["todoCandidates"];
  if (data.todoCandidates !== undefined) {
    if (!Array.isArray(data.todoCandidates)) {
      throw new ValidationError("todoCandidates must be an array");
    }
    todoCandidates = data.todoCandidates.map((item: unknown, index: number) => {
      if (!item || typeof item !== "object") {
        throw new ValidationError(`todoCandidates[${index}] must be an object`);
      }
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string" || !record.id.trim()) {
        throw new ValidationError(`todoCandidates[${index}].id is required`);
      }
      if (typeof record.title !== "string" || !record.title.trim()) {
        throw new ValidationError(`todoCandidates[${index}].title is required`);
      }
      if (
        record.dueDate !== undefined &&
        (typeof record.dueDate !== "string" ||
          Number.isNaN(new Date(record.dueDate).getTime()))
      ) {
        throw new ValidationError(
          `todoCandidates[${index}].dueDate must be a valid ISO date`,
        );
      }
      if (
        record.priority !== undefined &&
        (typeof record.priority !== "string" ||
          !PRIORITIES.includes(record.priority.toLowerCase() as Priority))
      ) {
        throw new ValidationError(
          `todoCandidates[${index}].priority must be low, medium, or high`,
        );
      }
      return {
        id: record.id.trim(),
        title: record.title.trim(),
        dueDate:
          typeof record.dueDate === "string"
            ? new Date(record.dueDate).toISOString()
            : undefined,
        priority:
          typeof record.priority === "string"
            ? (record.priority.toLowerCase() as Priority)
            : undefined,
        createdAt:
          typeof record.createdAt === "string" ? record.createdAt : undefined,
        updatedAt:
          typeof record.updatedAt === "string" ? record.updatedAt : undefined,
      };
    });
  }

  return {
    surface,
    todoId: parseOptionalString(data.todoId, "todoId"),
    title: parseOptionalString(data.title, "title"),
    description: parseOptionalString(data.description, "description"),
    notes: parseOptionalString(data.notes, "notes"),
    goal: parseOptionalString(data.goal, "goal"),
    topN,
    timeZone,
    anchorDateISO,
    todoCandidates,
  };
}
