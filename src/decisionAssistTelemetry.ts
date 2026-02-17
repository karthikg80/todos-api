import { DecisionAssistSurface } from "./aiContracts";

export type DecisionAssistTelemetryEventName =
  | "ai_suggestion_generated"
  | "ai_suggestion_viewed"
  | "ai_suggestion_applied"
  | "ai_suggestion_dismissed"
  | "ai_suggestion_undo";

export interface DecisionAssistTelemetryEvent {
  eventName: DecisionAssistTelemetryEventName;
  surface: DecisionAssistSurface;
  aiSuggestionDbId?: string;
  suggestionId?: string;
  todoId?: string;
  suggestionCount?: number;
  selectedTodoIdsCount?: number;
  ts?: string;
}

const normalizeCount = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value >= 0 ? Math.floor(value) : undefined;
};

export function emitDecisionAssistTelemetry(
  event: DecisionAssistTelemetryEvent,
): void {
  const payload = {
    eventName: event.eventName,
    surface: event.surface,
    aiSuggestionDbId:
      typeof event.aiSuggestionDbId === "string"
        ? event.aiSuggestionDbId
        : undefined,
    suggestionId:
      typeof event.suggestionId === "string" ? event.suggestionId : undefined,
    todoId: typeof event.todoId === "string" ? event.todoId : undefined,
    suggestionCount: normalizeCount(event.suggestionCount),
    selectedTodoIdsCount: normalizeCount(event.selectedTodoIdsCount),
    ts: typeof event.ts === "string" ? event.ts : new Date().toISOString(),
  };

  console.info(
    JSON.stringify({
      type: "ai_decision_assist_telemetry",
      ...payload,
    }),
  );
}
