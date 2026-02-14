import { ValidationError } from "./validation";
import { Priority } from "./types";

export type DecisionAssistSurface = "on_create" | "task_drawer" | "today_plan";

export type DecisionAssistSuggestionType =
  | "set_due_date"
  | "set_priority"
  | "set_project"
  | "set_category"
  | "rewrite_title"
  | "propose_next_action"
  | "split_subtasks"
  | "ask_clarification"
  | "defer_task";

export interface DecisionAssistSuggestion {
  type: DecisionAssistSuggestionType;
  confidence: number;
  rationale: string;
  payload: Record<string, unknown>;
}

export interface DecisionPlanPreviewItem {
  todoId?: string;
  rank: number;
  timeEstimateMin?: number;
  rationale: string;
}

export interface DecisionPlanPreview {
  topN: number;
  items: DecisionPlanPreviewItem[];
}

export interface DecisionAssistOutput {
  requestId: string;
  surface: DecisionAssistSurface;
  must_abstain: boolean;
  modelInfo?: {
    provider?: string;
    model?: string;
    version?: string;
  };
  suggestions: DecisionAssistSuggestion[];
  planPreview?: DecisionPlanPreview;
}

const ALLOWED_SURFACES: DecisionAssistSurface[] = [
  "on_create",
  "task_drawer",
  "today_plan",
];
const ALLOWED_SUGGESTION_TYPES: DecisionAssistSuggestionType[] = [
  "set_due_date",
  "set_priority",
  "set_project",
  "set_category",
  "rewrite_title",
  "propose_next_action",
  "split_subtasks",
  "ask_clarification",
  "defer_task",
];
const ALLOWED_PRIORITIES: Priority[] = ["low", "medium", "high"];
const ALLOWED_DEFER_STRATEGIES = ["someday", "next_week", "next_month"];
const MAX_RATIONALE_LENGTH = 240;
const MAX_TEXT_LENGTH = 200;
const MAX_PROJECT_OR_CATEGORY_LENGTH = 50;
const MAX_SUBTASKS = 5;

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertString(
  value: unknown,
  field: string,
  maxLength = MAX_TEXT_LENGTH,
): string {
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

function assertConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError("suggestion.confidence must be a number");
  }
  if (value < 0 || value > 1) {
    throw new ValidationError("suggestion.confidence must be between 0 and 1");
  }
  return value;
}

function validateSetDueDatePayload(payload: Record<string, unknown>) {
  const dueDateISO = assertString(payload.dueDateISO, "payload.dueDateISO", 64);
  if (Number.isNaN(Date.parse(dueDateISO))) {
    throw new ValidationError("payload.dueDateISO must be a valid ISO date");
  }
}

function validateSetPriorityPayload(payload: Record<string, unknown>) {
  if (typeof payload.priority !== "string") {
    throw new ValidationError("payload.priority must be low, medium, or high");
  }
  if (!ALLOWED_PRIORITIES.includes(payload.priority as Priority)) {
    throw new ValidationError("payload.priority must be low, medium, or high");
  }
}

function validateSetProjectPayload(payload: Record<string, unknown>) {
  const projectId =
    typeof payload.projectId === "string" ? payload.projectId.trim() : "";
  const projectName =
    typeof payload.projectName === "string" ? payload.projectName.trim() : "";
  const category =
    typeof payload.category === "string" ? payload.category.trim() : "";

  if (!projectId && !projectName && !category) {
    throw new ValidationError(
      "payload for set_project must include projectId, projectName, or category",
    );
  }
  if (projectName.length > MAX_PROJECT_OR_CATEGORY_LENGTH) {
    throw new ValidationError(
      `payload.projectName cannot exceed ${MAX_PROJECT_OR_CATEGORY_LENGTH} characters`,
    );
  }
  if (category.length > MAX_PROJECT_OR_CATEGORY_LENGTH) {
    throw new ValidationError(
      `payload.category cannot exceed ${MAX_PROJECT_OR_CATEGORY_LENGTH} characters`,
    );
  }
}

function validateSetCategoryPayload(payload: Record<string, unknown>) {
  assertString(
    payload.category,
    "payload.category",
    MAX_PROJECT_OR_CATEGORY_LENGTH,
  );
}

function validateRewriteTitlePayload(payload: Record<string, unknown>) {
  assertString(payload.title, "payload.title");
}

function validateProposeNextActionPayload(payload: Record<string, unknown>) {
  const title =
    typeof payload.title === "string" ? payload.title.trim() : undefined;
  const text =
    typeof payload.text === "string" ? payload.text.trim() : undefined;

  if (!title && !text) {
    throw new ValidationError(
      "payload for propose_next_action must include title or text",
    );
  }
  if (title && title.length > MAX_TEXT_LENGTH) {
    throw new ValidationError(
      `payload.title cannot exceed ${MAX_TEXT_LENGTH} characters`,
    );
  }
  if (text && text.length > MAX_TEXT_LENGTH) {
    throw new ValidationError(
      `payload.text cannot exceed ${MAX_TEXT_LENGTH} characters`,
    );
  }
}

function validateSplitSubtasksPayload(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.subtasks)) {
    throw new ValidationError("payload.subtasks must be an array");
  }
  if (payload.subtasks.length < 1 || payload.subtasks.length > MAX_SUBTASKS) {
    throw new ValidationError(
      `payload.subtasks must contain between 1 and ${MAX_SUBTASKS} items`,
    );
  }
  for (const [index, subtask] of payload.subtasks.entries()) {
    const item = assertObject(subtask, `payload.subtasks[${index}]`);
    assertString(item.title, `payload.subtasks[${index}].title`);
    if (!Number.isInteger(item.order) || (item.order as number) < 1) {
      throw new ValidationError(
        `payload.subtasks[${index}].order must be a positive integer`,
      );
    }
  }
}

function validateAskClarificationPayload(payload: Record<string, unknown>) {
  assertString(payload.question, "payload.question");
  if (payload.choices !== undefined) {
    if (!Array.isArray(payload.choices)) {
      throw new ValidationError("payload.choices must be an array");
    }
    if (payload.choices.length < 2 || payload.choices.length > 5) {
      throw new ValidationError(
        "payload.choices must contain between 2 and 5 items",
      );
    }
    for (const [index, choice] of payload.choices.entries()) {
      assertString(choice, `payload.choices[${index}]`, 80);
    }
  }
}

function validateDeferTaskPayload(payload: Record<string, unknown>) {
  if (typeof payload.strategy !== "string") {
    throw new ValidationError(
      "payload.strategy must be someday, next_week, or next_month",
    );
  }
  if (!ALLOWED_DEFER_STRATEGIES.includes(payload.strategy)) {
    throw new ValidationError(
      "payload.strategy must be someday, next_week, or next_month",
    );
  }
}

function validateSuggestion(
  suggestion: unknown,
  clarificationCount: { count: number },
): DecisionAssistSuggestion {
  const normalized = assertObject(suggestion, "suggestion");
  const type = normalized.type;

  if (typeof type !== "string") {
    throw new ValidationError("suggestion.type must be a string");
  }
  if (
    !ALLOWED_SUGGESTION_TYPES.includes(type as DecisionAssistSuggestionType)
  ) {
    throw new ValidationError(`Unsupported suggestion.type: ${type}`);
  }

  if (type.includes("delete") || type.includes("bulk")) {
    throw new ValidationError("Destructive suggestion types are not allowed");
  }

  const confidence = assertConfidence(normalized.confidence);
  const rationale = assertString(
    normalized.rationale,
    "suggestion.rationale",
    MAX_RATIONALE_LENGTH,
  );
  const payload = assertObject(normalized.payload, "suggestion.payload");

  switch (type) {
    case "set_due_date":
      validateSetDueDatePayload(payload);
      break;
    case "set_priority":
      validateSetPriorityPayload(payload);
      break;
    case "set_project":
      validateSetProjectPayload(payload);
      break;
    case "set_category":
      validateSetCategoryPayload(payload);
      break;
    case "rewrite_title":
      validateRewriteTitlePayload(payload);
      break;
    case "propose_next_action":
      validateProposeNextActionPayload(payload);
      break;
    case "split_subtasks":
      validateSplitSubtasksPayload(payload);
      break;
    case "ask_clarification":
      clarificationCount.count += 1;
      if (clarificationCount.count > 1) {
        throw new ValidationError(
          "At most one ask_clarification suggestion is allowed",
        );
      }
      validateAskClarificationPayload(payload);
      break;
    case "defer_task":
      validateDeferTaskPayload(payload);
      break;
    default:
      throw new ValidationError(`Unsupported suggestion.type: ${type}`);
  }

  return {
    type: type as DecisionAssistSuggestionType,
    confidence,
    rationale,
    payload,
  };
}

function validatePlanPreview(
  value: unknown,
  surface: DecisionAssistSurface,
): DecisionPlanPreview | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (surface !== "today_plan") {
    throw new ValidationError("planPreview is only allowed for today_plan");
  }

  const plan = assertObject(value, "planPreview");
  if (!Number.isInteger(plan.topN) || ![3, 5].includes(plan.topN as number)) {
    throw new ValidationError("planPreview.topN must be 3 or 5");
  }
  if (!Array.isArray(plan.items)) {
    throw new ValidationError("planPreview.items must be an array");
  }
  const topN = plan.topN as number;
  if (plan.items.length > topN) {
    throw new ValidationError(
      "planPreview.items cannot exceed planPreview.topN",
    );
  }

  const items: DecisionPlanPreviewItem[] = plan.items.map((item, index) => {
    const normalized = assertObject(item, `planPreview.items[${index}]`);
    const rationale = assertString(
      normalized.rationale,
      `planPreview.items[${index}].rationale`,
      MAX_RATIONALE_LENGTH,
    );
    if (!Number.isInteger(normalized.rank) || (normalized.rank as number) < 1) {
      throw new ValidationError(
        `planPreview.items[${index}].rank must be a positive integer`,
      );
    }
    const todoId =
      typeof normalized.todoId === "string" &&
      normalized.todoId.trim().length > 0
        ? normalized.todoId.trim()
        : undefined;
    const timeEstimateMin =
      Number.isInteger(normalized.timeEstimateMin) &&
      (normalized.timeEstimateMin as number) > 0
        ? (normalized.timeEstimateMin as number)
        : undefined;

    return {
      todoId,
      rank: normalized.rank as number,
      timeEstimateMin,
      rationale,
    };
  });

  return {
    topN,
    items,
  };
}

export function validateDecisionAssistOutput(
  data: unknown,
): DecisionAssistOutput {
  const body = assertObject(data, "body");
  const requestId = assertString(body.requestId, "requestId", 120);

  if (typeof body.surface !== "string") {
    throw new ValidationError("surface must be a string");
  }
  if (!ALLOWED_SURFACES.includes(body.surface as DecisionAssistSurface)) {
    throw new ValidationError(
      `surface must be one of: ${ALLOWED_SURFACES.join(", ")}`,
    );
  }
  const surface = body.surface as DecisionAssistSurface;

  if (typeof body.must_abstain !== "boolean") {
    throw new ValidationError("must_abstain must be a boolean");
  }

  if (!Array.isArray(body.suggestions)) {
    throw new ValidationError("suggestions must be an array");
  }

  const clarificationCount = { count: 0 };
  const suggestions = body.suggestions.map((item) =>
    validateSuggestion(item, clarificationCount),
  );

  const planPreview = validatePlanPreview(body.planPreview, surface);

  const modelInfo =
    body.modelInfo !== undefined
      ? (assertObject(body.modelInfo, "modelInfo") as {
          provider?: string;
          model?: string;
          version?: string;
        })
      : undefined;

  return {
    requestId,
    surface,
    must_abstain: body.must_abstain,
    modelInfo,
    suggestions,
    planPreview,
  };
}
