import {
  DecisionAssistOutput,
  DecisionAssistSuggestion,
  DecisionAssistSuggestionType,
  DecisionAssistSurface,
  validateDecisionAssistOutput,
} from "./aiContracts";
import { IAiSuggestionStore, AiSuggestionRecord } from "./aiSuggestionStore";
import { CreateTodoDto, Priority } from "./types";

// ── Surface and type constants ──

export const TASK_DRAWER_SURFACE: DecisionAssistSurface = "task_drawer";
export const ON_CREATE_SURFACE: DecisionAssistSurface = "on_create";
export const TODAY_PLAN_SURFACE: DecisionAssistSurface = "today_plan";
export const TODO_BOUND_TYPE: "task_critic" = "task_critic";

export const TODO_BOUND_SURFACES = new Set<DecisionAssistSurface>([
  TASK_DRAWER_SURFACE,
  ON_CREATE_SURFACE,
]);

export const TODAY_PLAN_ALLOWED_TYPES = new Set<DecisionAssistSuggestionType>([
  "set_due_date",
  "set_priority",
  "split_subtasks",
  "propose_next_action",
]);

export const TODO_BOUND_ALLOWED_TYPES: Record<
  "task_drawer" | "on_create",
  Set<DecisionAssistSuggestionType>
> = {
  task_drawer: new Set<DecisionAssistSuggestionType>([
    "rewrite_title",
    "split_subtasks",
    "propose_next_action",
    "set_due_date",
    "set_priority",
    "set_project",
    "set_category",
    "ask_clarification",
    "defer_task",
  ]),
  on_create: new Set<DecisionAssistSuggestionType>([
    "rewrite_title",
    "set_due_date",
    "set_priority",
    "set_project",
    "set_category",
    "ask_clarification",
  ]),
};

// ── Normalized types ──

export type NormalizedTodoBoundSuggestion = DecisionAssistSuggestion & {
  suggestionId: string;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
};

export type NormalizedTodoBoundEnvelope = DecisionAssistOutput & {
  suggestions: NormalizedTodoBoundSuggestion[];
};

export type NormalizedTodayPlanSuggestion = DecisionAssistSuggestion & {
  suggestionId: string;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
};

export type NormalizedTodayPlanEnvelope = DecisionAssistOutput & {
  suggestions: NormalizedTodayPlanSuggestion[];
};

// ── Small helpers ──

export function parseBool(value: unknown): boolean {
  return value === true;
}

export function parseOptionalTopN(value: unknown): 3 | 5 | undefined {
  return value === 3 || value === 5 ? value : undefined;
}

// ── Envelope normalization ──

export function normalizeTodoBoundEnvelope(
  rawOutput: Record<string, unknown>,
  todoId: string,
  surface: DecisionAssistSurface,
): NormalizedTodoBoundEnvelope {
  const validated = validateDecisionAssistOutput(rawOutput);
  if (validated.surface !== surface) {
    throw new Error("Suggestion envelope surface mismatch");
  }
  const allowedTypes =
    TODO_BOUND_ALLOWED_TYPES[surface as "task_drawer" | "on_create"];

  const normalizedSuggestions = validated.suggestions
    .map((item, index): NormalizedTodoBoundSuggestion => {
      const rawItem =
        Array.isArray(rawOutput.suggestions) &&
        rawOutput.suggestions[index] &&
        typeof rawOutput.suggestions[index] === "object"
          ? (rawOutput.suggestions[index] as Record<string, unknown>)
          : {};
      const suggestionIdRaw =
        typeof rawItem.suggestionId === "string"
          ? rawItem.suggestionId.trim()
          : "";
      const suggestionId = suggestionIdRaw || `task-drawer-${index + 1}`;
      const payload = {
        ...(item.payload || {}),
        todoId:
          typeof (item.payload || {}).todoId === "string"
            ? (item.payload as Record<string, unknown>).todoId
            : todoId,
      };
      return {
        ...item,
        payload,
        suggestionId,
        requiresConfirmation: parseBool(rawItem.requiresConfirmation),
      };
    })
    .filter((item) => allowedTypes.has(item.type));

  return {
    ...validated,
    suggestions: normalizedSuggestions,
  };
}

export function normalizeTodayPlanEnvelope(
  rawOutput: Record<string, unknown>,
): NormalizedTodayPlanEnvelope {
  const validated = validateDecisionAssistOutput(rawOutput);
  if (validated.surface !== TODAY_PLAN_SURFACE) {
    throw new Error("Suggestion envelope surface mismatch");
  }
  const previewTodoIds = new Set(
    (validated.planPreview?.items || [])
      .map((item) => (typeof item.todoId === "string" ? item.todoId : ""))
      .filter(Boolean),
  );
  const normalizedSuggestions = validated.suggestions.reduce<
    NormalizedTodayPlanSuggestion[]
  >((acc, item, index) => {
    const rawItem =
      Array.isArray(rawOutput.suggestions) &&
      rawOutput.suggestions[index] &&
      typeof rawOutput.suggestions[index] === "object"
        ? (rawOutput.suggestions[index] as Record<string, unknown>)
        : {};
    const suggestionIdRaw =
      typeof rawItem.suggestionId === "string"
        ? rawItem.suggestionId.trim()
        : "";
    const suggestionId = suggestionIdRaw || `today-plan-${index + 1}`;
    const payload =
      item.payload && typeof item.payload === "object"
        ? ({ ...item.payload } as Record<string, unknown>)
        : {};
    const payloadTodoId =
      typeof payload.todoId === "string" ? payload.todoId.trim() : "";
    if (!payloadTodoId || !previewTodoIds.has(payloadTodoId)) {
      return acc;
    }
    const normalized: NormalizedTodayPlanSuggestion = {
      ...item,
      suggestionId,
      requiresConfirmation: parseBool(rawItem.requiresConfirmation),
      payload: {
        ...payload,
        todoId: payloadTodoId,
      },
    };
    if (TODAY_PLAN_ALLOWED_TYPES.has(normalized.type)) {
      acc.push(normalized);
    }
    return acc;
  }, []);

  return {
    ...validated,
    suggestions: normalizedSuggestions,
  };
}

// ── Plan task parsing ──

export function parsePlanTasks(
  output: Record<string, unknown>,
): CreateTodoDto[] {
  const rawTasks = output.tasks;
  if (!Array.isArray(rawTasks)) {
    return [];
  }

  const priorities: Priority[] = ["low", "medium", "high"];
  return rawTasks
    .map((task): CreateTodoDto | null => {
      if (!task || typeof task !== "object") {
        return null;
      }
      const item = task as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) {
        return null;
      }

      const description =
        typeof item.description === "string"
          ? item.description.trim()
          : undefined;
      const priority = priorities.includes(item.priority as Priority)
        ? (item.priority as Priority)
        : "medium";

      let dueDate: Date | undefined;
      if (
        typeof item.dueDate === "string" &&
        !Number.isNaN(Date.parse(item.dueDate))
      ) {
        dueDate = new Date(item.dueDate);
      }

      return {
        title,
        description,
        priority,
        dueDate,
        category: "AI Plan",
      };
    })
    .filter((task): task is CreateTodoDto => !!task);
}

// ── Throttle abstain envelope ──

export function buildThrottleAbstainEnvelope(
  surface: DecisionAssistSurface,
  preferredTopN?: 3 | 5,
): DecisionAssistOutput {
  return {
    requestId: `throttle-${surface}-${Date.now()}`,
    surface,
    must_abstain: true,
    planPreview:
      surface === TODAY_PLAN_SURFACE
        ? {
            topN: preferredTopN || 3,
            items: [],
          }
        : undefined,
    suggestions: [],
  };
}

// ── Latest suggestion finders ──

export async function findLatestPendingDecisionAssistSuggestion(
  suggestionStore: IAiSuggestionStore,
  userId: string,
  todoId: string,
  surface: DecisionAssistSurface,
): Promise<AiSuggestionRecord | null> {
  const records = await suggestionStore.listByUser(userId, 100);
  return (
    records.find((record) => {
      if (record.status !== "pending") return false;
      if (record.type !== TODO_BOUND_TYPE) return false;
      const inputSurface =
        typeof record.input?.surface === "string" ? record.input.surface : "";
      const inputTodoId =
        typeof record.input?.todoId === "string" ? record.input.todoId : "";
      return inputSurface === surface && inputTodoId === todoId;
    }) || null
  );
}

export async function findLatestPendingTodayPlanSuggestion(
  suggestionStore: IAiSuggestionStore,
  userId: string,
): Promise<AiSuggestionRecord | null> {
  const records = await suggestionStore.listByUser(userId, 100);
  return (
    records.find((record) => {
      if (record.status !== "pending") return false;
      if (record.type !== "plan_from_goal") return false;
      const inputSurface =
        typeof record.input?.surface === "string" ? record.input.surface : "";
      const inputTodoId =
        typeof record.input?.todoId === "string" ? record.input.todoId : "";
      return inputSurface === TODAY_PLAN_SURFACE && !inputTodoId;
    }) || null
  );
}
