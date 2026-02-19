import { DecisionAssistSurface } from "./aiContracts";
import { AiSuggestionRecord } from "./aiSuggestionStore";
import {
  TODO_BOUND_TYPE,
  TODO_BOUND_SURFACES,
  TODAY_PLAN_SURFACE,
} from "./aiNormalizationService";

export type DismissValidationResult =
  | { ok: true; surface: DecisionAssistSurface }
  | { ok: false; status: number; error: string };

/**
 * Validates whether a suggestion record is eligible for dismiss.
 * Returns the resolved surface on success, or an error on failure.
 */
export function validateDismissable(
  suggestion: AiSuggestionRecord,
): DismissValidationResult {
  const isTodoBoundSuggestion = suggestion.type === TODO_BOUND_TYPE;
  const isTodayPlanSuggestion =
    suggestion.type === "plan_from_goal" &&
    suggestion.input &&
    typeof suggestion.input.surface === "string" &&
    suggestion.input.surface === TODAY_PLAN_SURFACE;

  if (!isTodoBoundSuggestion && !isTodayPlanSuggestion) {
    return {
      ok: false,
      status: 400,
      error:
        "Only on_create/task_drawer/today_plan suggestions can be dismissed",
    };
  }

  const inputSurfaceRaw =
    typeof suggestion.input?.surface === "string"
      ? suggestion.input.surface
      : "";
  const inputSurface = inputSurfaceRaw as DecisionAssistSurface;

  if (
    !TODO_BOUND_SURFACES.has(inputSurface) &&
    inputSurface !== TODAY_PLAN_SURFACE
  ) {
    return {
      ok: false,
      status: 400,
      error:
        "Only on_create/task_drawer/today_plan suggestions can be dismissed",
    };
  }

  return { ok: true, surface: inputSurface };
}
