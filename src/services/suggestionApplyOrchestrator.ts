/**
 * SuggestionApplyOrchestrator
 *
 * Orchestrates the polymorphic apply logic that was previously inlined
 * in the /suggestions/:id/apply route handler.
 *
 * Delegates actual application to the existing per-surface functions
 * in aiApplyService.ts and normalization to aiNormalizationService.ts.
 */

import { ITodoService } from "../interfaces/ITodoService";
import { IProjectService } from "../interfaces/IProjectService";
import {
  IAiSuggestionStore,
  AiSuggestionRecord,
} from "./aiSuggestionStore";
import {
  DecisionAssistSurface,
} from "../validation/aiContracts";
import {
  HOME_FOCUS_SURFACE,
  TODAY_PLAN_SURFACE,
  TODO_BOUND_TYPE,
  TODO_BOUND_SURFACES,
  normalizeHomeFocusEnvelope,
  normalizeTodoBoundEnvelope,
  normalizeTodayPlanEnvelope,
  parsePlanTasks,
  NormalizedHomeFocusSuggestion,
  NormalizedTodoBoundSuggestion,
  NormalizedTodayPlanSuggestion,
} from "./aiNormalizationService";
import {
  applyHomeFocusSuggestion,
  applyTodoBoundSuggestion,
  applyTodayPlanSuggestions,
} from "./aiApplyService";

export interface ApplyInput {
  reason?: string;
  suggestionId?: string;
  confirmed?: boolean;
  selectedTodoIds?: string[];
}

export type ApplyResult =
  | { ok: true; body: Record<string, unknown>; appliedTodoIds: string[] }
  | { ok: false; status: number; error: string };

interface OrchestratorDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
  suggestionStore: IAiSuggestionStore;
  decisionAssistEnabled: boolean;
}

export class SuggestionApplyOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async apply(
    userId: string,
    suggestion: AiSuggestionRecord,
    input: ApplyInput,
  ): Promise<ApplyResult> {
    const inputSurface = this.extractSurface(suggestion);

    // Route to the correct apply strategy based on suggestion type + surface
    if (suggestion.type === "plan_from_goal") {
      if (inputSurface === TODAY_PLAN_SURFACE) {
        return this.applyTodayPlan(userId, suggestion, input);
      }
      return this.applyLegacyGoalPlan(userId, suggestion, input);
    }

    if (suggestion.type === TODO_BOUND_TYPE) {
      if (inputSurface === HOME_FOCUS_SURFACE) {
        return this.applyHomeFocus(userId, suggestion, input);
      }
      if (TODO_BOUND_SURFACES.has(inputSurface)) {
        return this.applyTodoBound(userId, suggestion, input, inputSurface);
      }
    }

    return {
      ok: false,
      status: 400,
      error: "Only task_critic or plan_from_goal can be applied",
    };
  }

  private async applyTodayPlan(
    userId: string,
    suggestion: AiSuggestionRecord,
    input: ApplyInput,
  ): Promise<ApplyResult> {
    if (!this.deps.decisionAssistEnabled) {
      return { ok: false, status: 403, error: "Decision assist disabled" };
    }
    if (suggestion.status !== "pending") {
      return {
        ok: false,
        status: 409,
        error: "Suggestion is no longer pending",
      };
    }

    let envelope;
    try {
      envelope = normalizeTodayPlanEnvelope(suggestion.output);
    } catch {
      return {
        ok: false,
        status: 400,
        error: "Stored suggestion output is invalid",
      };
    }

    const plannedTodoIds = new Set(
      (envelope.planPreview?.items || [])
        .map((item) =>
          typeof item.todoId === "string" ? item.todoId : "",
        )
        .filter(Boolean),
    );
    const selectedSet =
      input.selectedTodoIds && input.selectedTodoIds.length > 0
        ? new Set(
            input.selectedTodoIds.filter((id) => plannedTodoIds.has(id)),
          )
        : plannedTodoIds;

    const applicableSuggestions = (
      envelope.suggestions as NormalizedTodayPlanSuggestion[]
    ).filter((item) => {
      const payloadTodoId =
        typeof item.payload?.todoId === "string" ? item.payload.todoId : "";
      return !!payloadTodoId && selectedSet.has(payloadTodoId);
    });

    if (!applicableSuggestions.length) {
      return {
        ok: false,
        status: 400,
        error: "No applicable today plan suggestions for selectedTodoIds",
      };
    }

    const applyResult = await applyTodayPlanSuggestions({
      applicableSuggestions,
      todoService: this.deps.todoService,
      userId,
      confirmed: input.confirmed,
    });

    if (!applyResult.ok) {
      return {
        ok: false,
        status: applyResult.status,
        error: applyResult.error,
      };
    }

    const updatedSuggestion = await this.deps.suggestionStore.markApplied(
      userId,
      suggestion.id,
      applyResult.appliedTodoIds,
      {
        reason: input.reason || "today_plan_apply",
        source: "today_plan_apply",
        suggestionId: input.suggestionId || null,
        selectedTodoIds: Array.from(selectedSet),
        updatedAt: new Date().toISOString(),
      },
    );
    if (!updatedSuggestion) {
      return { ok: false, status: 404, error: "Suggestion not found" };
    }

    return {
      ok: true,
      body: {
        updatedCount: applyResult.updatedTodos.length,
        todos: applyResult.updatedTodos,
        suggestion: updatedSuggestion,
        idempotent: false,
      },
      appliedTodoIds: applyResult.appliedTodoIds,
    };
  }

  private async applyLegacyGoalPlan(
    userId: string,
    suggestion: AiSuggestionRecord,
    input: ApplyInput,
  ): Promise<ApplyResult> {
    // Idempotent: if already applied, return existing todos
    if (
      suggestion.status === "accepted" &&
      Array.isArray(suggestion.appliedTodoIds) &&
      suggestion.appliedTodoIds.length > 0
    ) {
      const todos = [];
      for (const todoId of suggestion.appliedTodoIds) {
        const todo = await this.deps.todoService.findById(userId, todoId);
        if (todo) todos.push(todo);
      }
      return {
        ok: true,
        body: {
          createdCount: todos.length,
          todos,
          suggestion,
          idempotent: true,
        },
        appliedTodoIds: suggestion.appliedTodoIds,
      };
    }
    if (suggestion.status === "accepted") {
      return {
        ok: false,
        status: 409,
        error:
          "Suggestion already accepted but has no applied todo history",
      };
    }

    const tasks = parsePlanTasks(suggestion.output);
    if (tasks.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "Suggestion does not contain valid plan tasks",
      };
    }

    const createdTodos = [];
    for (const task of tasks) {
      const todo = await this.deps.todoService.create(userId, task);
      createdTodos.push(todo);
    }

    const createdIds = createdTodos.map((todo) => todo.id);
    const updatedSuggestion = await this.deps.suggestionStore.markApplied(
      userId,
      suggestion.id,
      createdIds,
      {
        reason: input.reason || "applied_via_endpoint",
        source: "apply_endpoint",
        updatedAt: new Date().toISOString(),
      },
    );
    if (!updatedSuggestion) {
      return { ok: false, status: 404, error: "Suggestion not found" };
    }

    return {
      ok: true,
      body: {
        createdCount: createdTodos.length,
        todos: createdTodos,
        suggestion: updatedSuggestion,
        idempotent: false,
      },
      appliedTodoIds: createdIds,
    };
  }

  private async applyHomeFocus(
    userId: string,
    suggestion: AiSuggestionRecord,
    input: ApplyInput,
  ): Promise<ApplyResult> {
    if (!this.deps.decisionAssistEnabled) {
      return { ok: false, status: 403, error: "Decision assist disabled" };
    }
    if (!input.suggestionId) {
      return {
        ok: false,
        status: 400,
        error: "suggestionId is required for suggestion apply",
      };
    }

    // Idempotent check
    if (
      suggestion.status === "accepted" &&
      Array.isArray(suggestion.appliedTodoIds) &&
      suggestion.appliedTodoIds.length > 0
    ) {
      const todo = await this.deps.todoService.findById(
        userId,
        suggestion.appliedTodoIds[0],
      );
      if (todo) {
        return {
          ok: true,
          body: {
            todo,
            appliedSuggestionId: input.suggestionId,
            suggestion,
            idempotent: true,
          },
          appliedTodoIds: suggestion.appliedTodoIds,
        };
      }
    }
    if (suggestion.status !== "pending") {
      return {
        ok: false,
        status: 409,
        error: "Suggestion is no longer pending",
      };
    }

    let envelope;
    try {
      envelope = normalizeHomeFocusEnvelope(suggestion.output);
    } catch {
      return {
        ok: false,
        status: 400,
        error: "Stored suggestion output is invalid",
      };
    }

    const selected = (
      envelope.suggestions as NormalizedHomeFocusSuggestion[]
    ).find((item) => item.suggestionId === input.suggestionId);
    if (!selected) {
      return { ok: false, status: 404, error: "Suggestion item not found" };
    }

    const applyResult = await applyHomeFocusSuggestion({
      selected,
      todoService: this.deps.todoService,
      userId,
    });
    if (!applyResult.ok) {
      return {
        ok: false,
        status: applyResult.status,
        error: applyResult.error,
      };
    }

    const updatedSuggestion = await this.deps.suggestionStore.markApplied(
      userId,
      suggestion.id,
      applyResult.appliedTodoIds,
      {
        reason: input.reason || `applied:${selected.suggestionId}`,
        source: "home_focus_apply",
        suggestionId: selected.suggestionId,
        updatedAt: new Date().toISOString(),
      },
    );
    if (!updatedSuggestion) {
      return { ok: false, status: 404, error: "Suggestion not found" };
    }

    return {
      ok: true,
      body: {
        todo: applyResult.todo,
        appliedSuggestionId: selected.suggestionId,
        suggestion: updatedSuggestion,
        idempotent: false,
      },
      appliedTodoIds: applyResult.appliedTodoIds,
    };
  }

  private async applyTodoBound(
    userId: string,
    suggestion: AiSuggestionRecord,
    input: ApplyInput,
    surface: DecisionAssistSurface,
  ): Promise<ApplyResult> {
    if (!this.deps.decisionAssistEnabled) {
      return { ok: false, status: 403, error: "Decision assist disabled" };
    }
    if (!input.suggestionId) {
      return {
        ok: false,
        status: 400,
        error: "suggestionId is required for suggestion apply",
      };
    }

    const inputTodoId =
      typeof suggestion.input?.todoId === "string"
        ? suggestion.input.todoId
        : "";
    if (!inputTodoId) {
      return {
        ok: false,
        status: 400,
        error: "Todo-bound suggestion missing todo context",
      };
    }
    const todo = await this.deps.todoService.findById(userId, inputTodoId);
    if (!todo) {
      return { ok: false, status: 404, error: "Todo not found" };
    }
    if (suggestion.status !== "pending") {
      return {
        ok: false,
        status: 409,
        error: "Suggestion is no longer pending",
      };
    }

    let envelope;
    try {
      envelope = normalizeTodoBoundEnvelope(
        suggestion.output,
        inputTodoId,
        surface,
      );
    } catch {
      return {
        ok: false,
        status: 400,
        error: "Stored suggestion output is invalid",
      };
    }

    const envelopeSuggestions =
      envelope.suggestions as NormalizedTodoBoundSuggestion[];
    const selected = envelopeSuggestions.find(
      (item) => item.suggestionId === input.suggestionId,
    );
    if (!selected) {
      return { ok: false, status: 404, error: "Suggestion item not found" };
    }

    if (selected.requiresConfirmation && input.confirmed !== true) {
      return {
        ok: false,
        status: 400,
        error: "Confirmation is required for this suggestion",
      };
    }

    const applyResult = await applyTodoBoundSuggestion({
      selected,
      todoService: this.deps.todoService,
      projectService: this.deps.projectService,
      userId,
      inputTodoId,
      todo,
      confirmed: input.confirmed,
    });

    if (!applyResult.ok) {
      return {
        ok: false,
        status: applyResult.status,
        error: applyResult.error,
      };
    }

    const todoIdsApplied = [inputTodoId];
    const updatedSuggestion = await this.deps.suggestionStore.markApplied(
      userId,
      suggestion.id,
      todoIdsApplied,
      {
        reason: input.reason || `applied:${selected.suggestionId}`,
        source: `${surface}_apply`,
        suggestionId: selected.suggestionId,
        updatedAt: new Date().toISOString(),
      },
    );
    if (!updatedSuggestion) {
      return { ok: false, status: 404, error: "Suggestion not found" };
    }

    return {
      ok: true,
      body: {
        todo: applyResult.updatedTodo,
        appliedSuggestionId: selected.suggestionId,
        suggestion: updatedSuggestion,
        idempotent: false,
      },
      appliedTodoIds: todoIdsApplied,
    };
  }

  private extractSurface(suggestion: AiSuggestionRecord): DecisionAssistSurface {
    const raw =
      typeof suggestion.input?.surface === "string"
        ? suggestion.input.surface
        : "";
    return raw as DecisionAssistSurface;
  }
}
