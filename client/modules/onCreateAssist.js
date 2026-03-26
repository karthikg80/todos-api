// =============================================================================
// onCreateAssist.js — AI on-create chip and suggestion assist (~1,250 lines).
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";
import { TODOS_CHANGED } from "../platform/events/eventTypes.js";
import { TODO_UPDATED } from "../platform/events/eventReasons.js";
import { runAsyncLifecycle } from "./asyncLifecycle.js";
import { getAllProjects } from "./projectsState.js";
import { applyFiltersAndRender } from "./filterLogic.js";
import { applyAsyncAction } from "./stateActions.js";
import { STORAGE_KEYS } from "../utils/storageKeys.js";
import { renderPanelHeader, renderPanelState } from "./uiTemplates.js";

function resetOnCreateAssistState() {
  applyAsyncAction("onCreateAssist/reset");
}

function loadOnCreateDismissedTodoIds() {
  try {
    const raw = window.localStorage.getItem(
      STORAGE_KEYS.AI_ON_CREATE_DISMISSED,
    );
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.map((value) => String(value || "").trim()).filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function persistOnCreateDismissedTodoIds() {
  try {
    const values = Array.from(
      state.onCreateAssistState.dismissedTodoIds || new Set(),
    );
    window.localStorage.setItem(
      STORAGE_KEYS.AI_ON_CREATE_DISMISSED,
      JSON.stringify(values),
    );
  } catch {
    // Ignore storage failures.
  }
}

function markOnCreateDismissed(todoId) {
  if (!todoId) return;
  state.onCreateAssistState.dismissedTodoIds.add(String(todoId));
  persistOnCreateDismissedTodoIds();
}

function clearOnCreateDismissed(todoId) {
  if (!todoId) return;
  state.onCreateAssistState.dismissedTodoIds.delete(String(todoId));
  persistOnCreateDismissedTodoIds();
}

function isOnCreateDismissed(todoId) {
  if (!todoId) return false;
  return state.onCreateAssistState.dismissedTodoIds.has(String(todoId));
}

function getOnCreateImpactRank(type) {
  return hooks.impactRankForSurface(hooks.ON_CREATE_SURFACE, type);
}

function getOnCreateConfidenceBadge(confidence) {
  return hooks.confidenceLabel(confidence);
}

function clampOnCreateRationale(value) {
  return hooks.truncateRationale(value, 120);
}

function formatOnCreateSuggestionLabel(type) {
  return hooks.labelForType(type);
}

function formatOnCreateChoiceValue(choice) {
  if (typeof choice === "string") {
    return { value: choice, label: choice };
  }
  const value = String(
    choice?.value ||
      choice?.projectName ||
      choice?.category ||
      choice?.label ||
      "",
  ).trim();
  const label = String(choice?.label || value).trim();
  if (!value) return null;
  return {
    value,
    label,
    projectName: choice?.projectName,
    category: choice?.category,
  };
}

function normalizeOnCreateSuggestion(rawSuggestion) {
  if (!rawSuggestion || typeof rawSuggestion !== "object") return null;
  const type = String(rawSuggestion.type || "");
  if (!hooks.isKnownSuggestionType(type)) return null;
  if (!hooks.shouldRenderTypeForSurface(hooks.ON_CREATE_SURFACE, type))
    return null;
  const suggestionId = String(rawSuggestion.suggestionId || "").trim();
  if (!suggestionId) return null;
  const payload =
    rawSuggestion.payload && typeof rawSuggestion.payload === "object"
      ? rawSuggestion.payload
      : {};
  const normalized = {
    type,
    suggestionId,
    confidence: Math.max(0, Math.min(1, Number(rawSuggestion.confidence) || 0)),
    rationale: clampOnCreateRationale(rawSuggestion.rationale),
    payload,
    requiresConfirmation: !!rawSuggestion.requiresConfirmation,
    dismissed: false,
    applied: false,
    confirmationOpen: false,
    undoSnapshot: null,
    clarificationExpanded: false,
    clarificationAnswered: false,
    clarificationAnswer: "",
    helperText: "",
  };
  if (type === "ask_clarification") {
    const choicesRaw = Array.isArray(payload.choices) ? payload.choices : [];
    normalized.payload = {
      ...payload,
      question: String(payload.question || "Pick one option").slice(0, 120),
      choices: choicesRaw
        .map((choice) => formatOnCreateChoiceValue(choice))
        .filter(Boolean)
        .slice(0, 4),
    };
  }
  return normalized;
}

function buildOnCreateSuggestion(
  type,
  suggestionId,
  confidence,
  rationale,
  payload,
  options = {},
) {
  return {
    type,
    suggestionId,
    confidence,
    rationale,
    payload,
    ...(options.requiresConfirmation ? { requiresConfirmation: true } : {}),
  };
}

function nextWeekdayAtNoonIso(day) {
  const target = new Date();
  const currentDay = target.getDay();
  let delta = (day - currentDay + 7) % 7;
  if (delta === 0) delta = 7;
  target.setDate(target.getDate() + delta);
  target.setHours(12, 0, 0, 0);
  return target.toISOString();
}

function yesterdayAtNoonIso() {
  const target = new Date();
  target.setDate(target.getDate() - 1);
  target.setHours(12, 0, 0, 0);
  return target.toISOString();
}

function buildMockOnCreateAssistEnvelope(rawTitle) {
  const title = String(rawTitle || "").trim();
  const titleLower = title.toLowerCase();
  const suggestions = [];

  if (titleLower.includes("tomorrow")) {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(12, 0, 0, 0);
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-tomorrow",
        0.88,
        "Detected a relative deadline in the title.",
        { dueDateISO: due.toISOString() },
      ),
    );
  } else if (titleLower.includes("by friday")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-friday",
        0.82,
        '"By Friday" implies a firm due date.',
        { dueDateISO: nextWeekdayAtNoonIso(5) },
      ),
    );
  }

  if (titleLower.includes("yesterday")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-past",
        0.51,
        "Parsed a past date mention. Confirm before applying.",
        { dueDateISO: yesterdayAtNoonIso() },
        { requiresConfirmation: true },
      ),
    );
  }

  if (/\burgent\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_priority",
        "oc-set-priority-urgent",
        0.9,
        '"Urgent" strongly signals high priority.',
        { priority: "high" },
      ),
    );
  } else if (/\basap\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_priority",
        "oc-set-priority-asap",
        0.67,
        "ASAP often maps to high priority. Confirm escalation.",
        { priority: "high" },
        { requiresConfirmation: true },
      ),
    );
  }

  const mentionsWebsite = titleLower.includes("website");
  const mentionsMarketing = titleLower.includes("marketing");
  if (mentionsWebsite && mentionsMarketing) {
    suggestions.push(
      buildOnCreateSuggestion(
        "ask_clarification",
        "oc-clarify-project",
        0.6,
        "Project target is ambiguous between website and marketing.",
        {
          questionId: "oc-project-choice",
          question: "Which project should this task belong to?",
          choices: [
            { value: "Website", label: "Website", projectName: "Website" },
            { value: "Marketing", label: "Marketing", category: "Marketing" },
          ],
        },
      ),
    );
  } else if (mentionsWebsite) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_project",
        "oc-set-project-website",
        0.84,
        "Detected a known project keyword.",
        { projectName: "Website", category: "Website" },
      ),
    );
  } else if (mentionsMarketing) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_category",
        "oc-set-category-marketing",
        0.8,
        "Detected a category keyword.",
        { category: "Marketing" },
      ),
    );
  }

  if (titleLower.includes("personal")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_category",
        "oc-set-category-personal",
        0.73,
        '"Personal" maps cleanly to a category.',
        { category: "Personal" },
      ),
    );
  }

  if (/\b(email|follow up|stuff)\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "rewrite_title",
        "oc-rewrite-vague",
        0.77,
        "Title is vague; propose a concrete next-action title.",
        { title: "Email stakeholder with specific next step and deadline" },
      ),
    );
  }

  if (titleLower.includes("unknown")) {
    suggestions.push({
      type: "not_supported",
      suggestionId: "oc-unknown-type",
      confidence: 0.5,
      rationale: "Should be ignored by UI.",
      payload: {},
    });
  }

  return {
    contractVersion: 1,
    generatedAt: new Date().toISOString(),
    surface: hooks.ON_CREATE_SURFACE,
    requestId: `on-create-${encodeURIComponent(titleLower.slice(0, 24) || "empty")}`,
    must_abstain: false,
    suggestions,
  };
}

function getOnCreateAssistElements() {
  const row = document.getElementById("aiOnCreateAssistRow");
  const titleInput = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  if (!(row instanceof HTMLElement)) return null;
  if (!(titleInput instanceof HTMLInputElement)) return null;
  return { row, titleInput, projectSelect, dueDateInput };
}

function ensureOnCreateProjectOption(projectName) {
  const refs = getOnCreateAssistElements();
  if (!refs || !(refs.projectSelect instanceof HTMLSelectElement)) return;
  const normalized = hooks.normalizeProjectPath(projectName);
  if (!normalized) return;
  const hasOption = Array.from(refs.projectSelect.options).some(
    (option) => hooks.normalizeProjectPath(option.value) === normalized,
  );
  if (hasOption) return;
  const option = document.createElement("option");
  option.value = normalized;
  option.textContent = normalized;
  refs.projectSelect.append(option);
}

function normalizeOnCreateAssistEnvelope(rawEnvelope) {
  const suggestionsRaw = Array.isArray(rawEnvelope?.suggestions)
    ? rawEnvelope.suggestions
    : [];
  const normalizedSuggestions = suggestionsRaw
    .map((suggestion) => normalizeOnCreateSuggestion(suggestion))
    .filter(Boolean)
    .map((suggestion) => ({
      ...suggestion,
      rationale: hooks.truncateRationale(suggestion.rationale, 120),
    }));
  const sortedSuggestions = hooks.sortSuggestions(
    hooks.ON_CREATE_SURFACE,
    normalizedSuggestions,
  );
  const cappedSuggestions = hooks.capSuggestions(sortedSuggestions, 6);

  let seenClarification = false;
  for (const suggestion of cappedSuggestions) {
    if (suggestion.type !== "ask_clarification") continue;
    if (!seenClarification) {
      seenClarification = true;
      continue;
    }
    suggestion.dismissed = true;
  }

  return {
    contractVersion: rawEnvelope?.contractVersion || 1,
    generatedAt: String(rawEnvelope?.generatedAt || new Date().toISOString()),
    requestId: String(rawEnvelope?.requestId || "on-create"),
    surface: hooks.ON_CREATE_SURFACE,
    must_abstain: !!rawEnvelope?.must_abstain,
    suggestions: cappedSuggestions,
  };
}

async function fetchOnCreateLatestSuggestion(todoId) {
  return hooks.apiCall(
    `${hooks.API_URL}/ai/suggestions/latest?todoId=${encodeURIComponent(todoId)}&surface=${hooks.ON_CREATE_SURFACE}`,
  );
}

async function generateOnCreateSuggestion(todo) {
  return hooks.apiCall(`${hooks.API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: hooks.ON_CREATE_SURFACE,
      todoId: todo.id,
      title: todo.title,
      description: todo.description || "",
      notes: todo.notes || "",
    }),
  });
}

async function loadOnCreateDecisionAssist(todo, allowGenerate = true) {
  if (!todo?.id) return;
  const todoId = String(todo.id);
  await runAsyncLifecycle({
    start: () => {
      applyAsyncAction("onCreateAssist/start", { todoId });
      renderOnCreateAssistRow();
    },
    run: async () => {
      let latestResponse = await fetchOnCreateLatestSuggestion(todoId);
      if (latestResponse.status === 403 || latestResponse.status === 404) {
        return { outcome: "unavailable" };
      }

      if (latestResponse.status === 204) {
        if (isOnCreateDismissed(todoId) || !allowGenerate) {
          return {
            outcome: "empty",
            envelope: normalizeOnCreateAssistEnvelope({
              surface: hooks.ON_CREATE_SURFACE,
              must_abstain: true,
              suggestions: [],
            }),
          };
        }

        const generated = await generateOnCreateSuggestion(todo);
        if (generated.status === 403 || generated.status === 404) {
          return { outcome: "unavailable" };
        }
        latestResponse = await fetchOnCreateLatestSuggestion(todoId);
      }

      if (latestResponse.status === 204) {
        return {
          outcome: "empty",
          envelope: normalizeOnCreateAssistEnvelope({
            surface: hooks.ON_CREATE_SURFACE,
            must_abstain: true,
            suggestions: [],
          }),
        };
      }

      if (!latestResponse.ok) {
        return { outcome: "failure" };
      }

      const payload = await latestResponse.json();
      const envelope = normalizeOnCreateAssistEnvelope(
        payload?.outputEnvelope || {},
      );
      return {
        outcome: "success",
        payload: {
          todoId,
          aiSuggestionId: String(payload?.aiSuggestionId || ""),
          envelope,
          suggestions: envelope.suggestions,
        },
      };
    },
    success: (result) => {
      if (result?.outcome === "unavailable") {
        applyAsyncAction("onCreateAssist/unavailable");
      } else if (result?.outcome === "empty") {
        applyAsyncAction("onCreateAssist/empty", {
          envelope: result.envelope,
        });
      } else if (result?.outcome === "failure") {
        applyAsyncAction("onCreateAssist/failure");
      } else if (result?.outcome === "success") {
        applyAsyncAction("onCreateAssist/success", result.payload);
      }
      renderOnCreateAssistRow();
    },
    failure: (error) => {
      console.error("On-create AI load failed:", error);
      applyAsyncAction("onCreateAssist/failure");
      renderOnCreateAssistRow();
    },
  });
}

function refreshOnCreateAssistFromTitle(force = false) {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  const title = refs.titleInput.value.trim();
  if (!title) {
    resetOnCreateAssistState();
    renderOnCreateAssistRow();
    return;
  }
  if (!force && state.onCreateAssistState.titleBasis === title) {
    renderOnCreateAssistRow();
    return;
  }
  const envelope = normalizeOnCreateAssistEnvelope(
    buildMockOnCreateAssistEnvelope(title),
  );
  applyAsyncAction("onCreateAssist/mock", {
    titleBasis: title,
    envelope,
    suggestions: envelope.suggestions,
  });
  renderOnCreateAssistRow();
}

function getOnCreateSuggestionById(suggestionId) {
  return state.onCreateAssistState.suggestions.find(
    (suggestion) => suggestion.suggestionId === suggestionId,
  );
}

function getActiveOnCreateSuggestions() {
  return state.onCreateAssistState.suggestions.filter(
    (suggestion) => !suggestion.dismissed,
  );
}

function formatOnCreateDueDateLabel(dueDateIso) {
  const date = new Date(dueDateIso);
  if (Number.isNaN(date.getTime())) return "Set due date";
  return `Due ${date.toLocaleDateString()}`;
}

function buildOnCreateChipSummary(suggestion) {
  if (suggestion.type === "set_due_date") {
    return formatOnCreateDueDateLabel(suggestion.payload.dueDateISO);
  }
  if (suggestion.type === "set_priority") {
    return `Priority ${String(suggestion.payload.priority || "").toUpperCase() || "MEDIUM"}`;
  }
  if (suggestion.type === "set_project") {
    return `Project ${String(suggestion.payload.projectName || suggestion.payload.category || "suggested")}`;
  }
  if (suggestion.type === "set_category") {
    return `Category ${String(suggestion.payload.category || "suggested")}`;
  }
  if (suggestion.type === "rewrite_title") {
    return "Refine title";
  }
  if (suggestion.type === "ask_clarification") {
    return "Need one choice";
  }
  return "Suggestion";
}

function renderOnCreateChipChoices(suggestion) {
  if (
    suggestion.type !== "ask_clarification" ||
    !suggestion.clarificationExpanded ||
    suggestion.clarificationAnswered
  ) {
    return "";
  }
  const choices = Array.isArray(suggestion.payload.choices)
    ? suggestion.payload.choices
    : [];
  if (choices.length === 0) return "";
  return `
    <div
      class="ai-create-chip__choices"
      role="radiogroup"
      aria-label="Clarification choices"
      aria-describedby="ai-create-rationale-${hooks.escapeHtml(suggestion.suggestionId)}"
    >
      ${choices
        .map(
          (choice) => `
            <button
              type="button"
              class="ai-create-chip__choice ai-action-btn"
              role="radio"
              aria-checked="false"
              data-ai-create-action="choose"
              data-ai-create-suggestion-id="${hooks.escapeHtml(suggestion.suggestionId)}"
              data-ai-create-choice-value="${hooks.escapeHtml(String(choice.value || ""))}"
              aria-label="Choose ${hooks.escapeHtml(String(choice.label || choice.value || ""))}"
            >
              ${hooks.escapeHtml(String(choice.label || choice.value || ""))}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderOnCreateChipActions(suggestion) {
  const suggestionId = hooks.escapeHtml(suggestion.suggestionId);
  const label = hooks.escapeHtml(
    formatOnCreateSuggestionLabel(suggestion.type),
  );
  const rationaleId = `ai-create-rationale-${suggestionId}`;
  if (suggestion.applied) {
    return `
      <span class="ai-create-chip__applied">Applied</span>
      <button
        type="button"
        class="ai-create-chip__undo ai-undo"
        data-testid="ai-chip-undo-${suggestionId}"
        aria-label="Undo ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="undo"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        Undo
      </button>
    `;
  }
  if (suggestion.requiresConfirmation && suggestion.confirmationOpen) {
    return `
      <div class="ai-confirm" role="group" aria-label="Confirm apply ${label}">
        <button
          type="button"
          class="ai-create-chip__confirm ai-action-btn"
          data-testid="ai-chip-confirm-${suggestionId}"
          aria-label="Confirm apply ${label}"
          aria-describedby="${rationaleId}"
          data-ai-create-action="confirm-apply"
          data-ai-create-suggestion-id="${suggestionId}"
        >
          Confirm
        </button>
        <button
          type="button"
          class="ai-create-chip__action ai-action-btn"
          aria-label="Cancel confirmation for ${label}"
          aria-describedby="${rationaleId}"
          data-ai-create-action="cancel-confirm"
          data-ai-create-suggestion-id="${suggestionId}"
        >
          Cancel
        </button>
      </div>
    `;
  }
  if (
    suggestion.type === "ask_clarification" &&
    !suggestion.clarificationAnswered
  ) {
    return `
      <button
        type="button"
        class="ai-create-chip__action ai-action-btn"
        data-testid="ai-chip-apply-${suggestionId}"
        aria-label="Open choices for ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="toggle-choices"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        Choose
      </button>
      <button
        type="button"
        class="ai-create-chip__dismiss ai-action-btn"
        data-testid="ai-chip-dismiss-${suggestionId}"
        aria-label="Dismiss ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="dismiss"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        ×
      </button>
    `;
  }
  return `
    <button
      type="button"
      class="ai-create-chip__action ai-action-btn"
      data-testid="ai-chip-apply-${suggestionId}"
      aria-label="Apply ${label}"
      aria-describedby="${rationaleId}"
      data-ai-create-action="apply"
      data-ai-create-suggestion-id="${suggestionId}"
    >
      Apply
    </button>
    <button
      type="button"
      class="ai-create-chip__dismiss ai-action-btn"
      data-testid="ai-chip-dismiss-${suggestionId}"
      aria-label="Dismiss ${label}"
      aria-describedby="${rationaleId}"
      data-ai-create-action="dismiss"
      data-ai-create-suggestion-id="${suggestionId}"
    >
      ×
    </button>
  `;
}

function renderOnCreateAssistRow() {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  const title = refs.titleInput.value.trim();
  const hasLiveContext = !!state.onCreateAssistState.liveTodoId;
  if (!title && !hasLiveContext && !state.onCreateAssistState.loading) {
    refs.row.hidden = true;
    refs.row.innerHTML = "";
    return;
  }

  // Lint-first gate: show one chip only; full panel revealed by Fix/Review.
  // In debug mode, always show the full panel so developers see all metadata.
  if (!state.onCreateAssistState.showFullAssist && !hooks.AI_DEBUG_ENABLED) {
    const issue = hooks.lintTodoFields({
      title,
      dueDate: refs.dueDateInput ? refs.dueDateInput.value : "",
      priority: state.currentPriority,
      allTodos: state.todos,
      surface: "on_create",
    });
    state.onCreateAssistState.lintIssue = issue;
    if (!issue) {
      refs.row.hidden = true;
      refs.row.innerHTML = "";
    } else {
      refs.row.hidden = false;
      refs.row.innerHTML = hooks.renderLintChip(issue);
    }
    return;
  }

  refs.row.hidden = false;
  if (state.onCreateAssistState.loading) {
    refs.row.innerHTML = renderPanelState({
      headerClass: "ai-create-assist__header",
      titleClass: "ai-create-assist__title",
      title: "AI Assist",
      messageClass: "ai-create-assist__empty ai-empty",
      message: "Loading suggestions...",
    });
    return;
  }
  if (state.onCreateAssistState.unavailable) {
    refs.row.innerHTML = renderPanelState({
      headerClass: "ai-create-assist__header",
      titleClass: "ai-create-assist__title",
      title: "AI Assist",
      messageClass: "ai-create-assist__empty ai-empty",
      message: "Suggestions unavailable right now.",
    });
    return;
  }
  if (state.onCreateAssistState.error) {
    refs.row.innerHTML = renderPanelState({
      headerClass: "ai-create-assist__header",
      titleClass: "ai-create-assist__title",
      title: "AI Assist",
      messageClass: "ai-create-assist__empty ai-empty",
      message: "No suggestions right now.",
    });
    return;
  }
  const activeSuggestions = getActiveOnCreateSuggestions();
  if (activeSuggestions.length === 0) {
    refs.row.innerHTML = renderPanelState({
      headerClass: "ai-create-assist__header",
      titleClass: "ai-create-assist__title",
      title: "AI Assist",
      debugHtml: hooks.renderAiDebugMeta(
        state.onCreateAssistState.envelope || {},
      ),
      messageClass: "ai-create-assist__empty ai-empty",
      message: "No suggestions right now.",
    });
    return;
  }

  const defaultLimit = 4;
  const visibleLimit = state.onCreateAssistState.showAll ? 6 : defaultLimit;
  const visibleSuggestions = activeSuggestions.slice(0, visibleLimit);
  const hiddenCount = Math.max(
    0,
    activeSuggestions.length - visibleSuggestions.length,
  );

  refs.row.innerHTML = `
    ${renderPanelHeader({
      className: "ai-create-assist__header",
      titleClass: "ai-create-assist__title",
      title: "AI Assist",
      actionsHtml:
        hiddenCount > 0
          ? `
            <button
              type="button"
              class="ai-create-assist__expand"
              data-testid="ai-chip-expand-more"
              data-ai-create-action="toggle-more"
              aria-label="${state.onCreateAssistState.showAll ? "Show fewer suggestions" : `Show ${hiddenCount} more suggestions`}"
            >
              ${state.onCreateAssistState.showAll ? "Show less" : `+${hiddenCount} more`}
            </button>
          `
          : "",
    })}
    ${hooks.renderAiDebugMeta(state.onCreateAssistState.envelope || {})}
    <div class="ai-create-assist__chips">
      ${visibleSuggestions
        .map((suggestion) => {
          const confidenceLabel = getOnCreateConfidenceBadge(
            suggestion.confidence,
          );
          return `
            <div
              class="ai-create-chip ai-card ${suggestion.applied ? "ai-create-chip--applied" : ""}"
              data-testid="ai-chip-${hooks.escapeHtml(suggestion.suggestionId)}"
            >
              <div class="ai-create-chip__top">
                <span class="ai-create-chip__label">${hooks.escapeHtml(formatOnCreateSuggestionLabel(suggestion.type))}</span>
                <span
                  class="ai-create-chip__confidence ai-badge ai-badge--${hooks.escapeHtml(hooks.confidenceBand(suggestion.confidence))}"
                  aria-label="Confidence ${hooks.escapeHtml(confidenceLabel)}"
                >
                  ${hooks.escapeHtml(confidenceLabel)}
                </span>
              </div>
              <div
                class="ai-create-chip__summary"
                id="ai-create-rationale-${hooks.escapeHtml(suggestion.suggestionId)}"
                title="${hooks.escapeHtml(suggestion.rationale || buildOnCreateChipSummary(suggestion))}"
              >
                ${hooks.escapeHtml(buildOnCreateChipSummary(suggestion))}
              </div>
              <div class="ai-create-chip__rationale ai-tooltip">${hooks.escapeHtml(suggestion.rationale || buildOnCreateChipSummary(suggestion))}</div>
              ${hooks.renderAiDebugSuggestionId(suggestion.suggestionId)}
              ${
                suggestion.clarificationAnswered
                  ? `<div class="ai-create-chip__helper">Answer: ${hooks.escapeHtml(suggestion.clarificationAnswer)}</div>`
                  : ""
              }
              ${suggestion.helperText ? `<div class="ai-create-chip__helper">${hooks.escapeHtml(suggestion.helperText)}</div>` : ""}
              ${suggestion.continuityHint ? `<div class="ai-create-chip__continuity">${hooks.escapeHtml(suggestion.continuityHint)}</div>` : ""}
              ${renderOnCreateChipChoices(suggestion)}
              <div class="ai-create-chip__actions ai-actions">
                ${renderOnCreateChipActions(suggestion)}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  const confirmationSuggestion = visibleSuggestions.find(
    (suggestion) =>
      hooks.needsConfirmation(suggestion) && suggestion.confirmationOpen,
  );
  if (confirmationSuggestion) {
    window.requestAnimationFrame(() => {
      const confirmButton = refs.row.querySelector(
        `[data-testid="ai-chip-confirm-${hooks.escapeSelectorValue(confirmationSuggestion.suggestionId)}"]`,
      );
      if (confirmButton instanceof HTMLElement) {
        confirmButton.focus({ preventScroll: true });
      }
    });
  }
}

function snapshotOnCreateDraftState() {
  const refs = getOnCreateAssistElements();
  if (!refs) return null;
  return {
    title: refs.titleInput.value,
    dueDate:
      refs.dueDateInput instanceof HTMLInputElement
        ? refs.dueDateInput.value
        : "",
    project:
      refs.projectSelect instanceof HTMLSelectElement
        ? refs.projectSelect.value
        : "",
    priority: state.currentPriority,
  };
}

function restoreOnCreateDraftState(snapshot) {
  if (!snapshot) return;
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  state.suppressOnCreateAssistInput = true;
  refs.titleInput.value = snapshot.title || "";
  if (refs.dueDateInput instanceof HTMLInputElement) {
    refs.dueDateInput.value = snapshot.dueDate || "";
  }
  if (refs.projectSelect instanceof HTMLSelectElement) {
    if (snapshot.project) {
      ensureOnCreateProjectOption(snapshot.project);
    }
    refs.projectSelect.value = snapshot.project || "";
  }
  if (
    snapshot.priority === "low" ||
    snapshot.priority === "medium" ||
    snapshot.priority === "high"
  ) {
    hooks.setPriority(snapshot.priority);
  }
  state.suppressOnCreateAssistInput = false;
}

function applyOnCreateSuggestion(suggestion, clarificationChoice = "") {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  suggestion.undoSnapshot = snapshotOnCreateDraftState();
  suggestion.applied = true;
  suggestion.confirmationOpen = false;
  suggestion.helperText = "";

  if (suggestion.type === "rewrite_title") {
    const nextTitle = String(suggestion.payload.title || "").trim();
    if (nextTitle) {
      state.suppressOnCreateAssistInput = true;
      refs.titleInput.value = nextTitle;
      state.suppressOnCreateAssistInput = false;
    }
  } else if (suggestion.type === "set_due_date") {
    const dueDateIso = String(suggestion.payload.dueDateISO || "");
    if (refs.dueDateInput instanceof HTMLInputElement) {
      refs.dueDateInput.value = hooks.toDateTimeLocalValue(dueDateIso);
    }
  } else if (suggestion.type === "set_priority") {
    const nextPriority = String(
      suggestion.payload.priority || "",
    ).toLowerCase();
    if (
      nextPriority === "low" ||
      nextPriority === "medium" ||
      nextPriority === "high"
    ) {
      hooks.setPriority(nextPriority);
    }
  } else if (suggestion.type === "set_project") {
    const rawProject = String(
      suggestion.payload.projectName || suggestion.payload.category || "",
    );
    const normalized = hooks.normalizeProjectPath(rawProject);
    if (normalized && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(normalized);
      refs.projectSelect.value = normalized;
    }
  } else if (suggestion.type === "set_category") {
    const rawCategory = String(suggestion.payload.category || "");
    const normalized = hooks.normalizeProjectPath(rawCategory);
    if (normalized && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(normalized);
      refs.projectSelect.value = normalized;
    }
  } else if (suggestion.type === "ask_clarification") {
    suggestion.clarificationAnswered = true;
    suggestion.clarificationExpanded = false;
    suggestion.clarificationAnswer = clarificationChoice || "Selected";
    const selectedChoice =
      (Array.isArray(suggestion.payload.choices)
        ? suggestion.payload.choices.find(
            (choice) => String(choice.value || "") === clarificationChoice,
          )
        : null) || null;
    const projectValue = hooks.normalizeProjectPath(
      String(
        selectedChoice?.projectName ||
          selectedChoice?.category ||
          selectedChoice?.value ||
          "",
      ),
    );
    if (projectValue && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(projectValue);
      refs.projectSelect.value = projectValue;
    }
    suggestion.helperText = "Thanks — will refine next time.";
  }
}

async function applyLiveOnCreateSuggestion(suggestion, confirmed = false) {
  if (!state.onCreateAssistState.aiSuggestionId) return;
  const response = await hooks.apiCall(
    `${hooks.API_URL}/ai/suggestions/${encodeURIComponent(state.onCreateAssistState.aiSuggestionId)}/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionId: suggestion.suggestionId,
        confirmed: confirmed === true,
      }),
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    state.onCreateAssistState.error =
      typeof data?.error === "string"
        ? data.error
        : "Could not apply suggestion.";
    renderOnCreateAssistRow();
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (data?.todo?.id) {
    const index = state.todos.findIndex((item) => item.id === data.todo.id);
    if (index >= 0) {
      state.todos[index] = data.todo;
    }
    EventBus.dispatch(TODOS_CHANGED, { reason: TODO_UPDATED });
  }
  clearOnCreateDismissed(state.onCreateAssistState.liveTodoId);
  const refreshedTodo =
    (state.onCreateAssistState.liveTodoId &&
      state.todos.find(
        (item) => item.id === state.onCreateAssistState.liveTodoId,
      )) ||
    null;
  if (refreshedTodo) {
    await loadOnCreateDecisionAssist(refreshedTodo, false);
  } else {
    resetOnCreateAssistState();
    renderOnCreateAssistRow();
  }
}

async function onCreateAssistApplySuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || suggestion.dismissed || suggestion.applied) return;
  if (suggestion.type === "ask_clarification") {
    suggestion.clarificationExpanded = !suggestion.clarificationExpanded;
    renderOnCreateAssistRow();
    return;
  }
  if (suggestion.requiresConfirmation) {
    suggestion.confirmationOpen = true;
    renderOnCreateAssistRow();
    return;
  }
  if (state.onCreateAssistState.mode === "live") {
    await applyLiveOnCreateSuggestion(suggestion, false);
    return;
  }
  applyOnCreateSuggestion(suggestion);
  renderOnCreateAssistRow();
}

async function onCreateAssistConfirmApplySuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || suggestion.dismissed || suggestion.applied) return;
  if (state.onCreateAssistState.mode === "live") {
    await applyLiveOnCreateSuggestion(suggestion, true);
    return;
  }
  applyOnCreateSuggestion(suggestion);
  renderOnCreateAssistRow();
}

async function onCreateAssistDismissSuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion) return;
  if (
    state.onCreateAssistState.mode === "live" &&
    state.onCreateAssistState.aiSuggestionId
  ) {
    try {
      await hooks.apiCall(
        `${hooks.API_URL}/ai/suggestions/${encodeURIComponent(state.onCreateAssistState.aiSuggestionId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, dismissAll: true }),
        },
      );
    } catch (error) {
      console.error("On-create AI dismiss failed:", error);
    }
    markOnCreateDismissed(state.onCreateAssistState.liveTodoId);
    state.onCreateAssistState.suggestions = [];
    state.onCreateAssistState.envelope = normalizeOnCreateAssistEnvelope({
      surface: hooks.ON_CREATE_SURFACE,
      must_abstain: true,
      suggestions: [],
    });
    state.onCreateAssistState.aiSuggestionId = "";
    state.onCreateAssistState.error = "";
    renderOnCreateAssistRow();
    return;
  }
  suggestion.dismissed = true;
  renderOnCreateAssistRow();
}

function onCreateAssistUndoSuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || !suggestion.applied) return;
  restoreOnCreateDraftState(suggestion.undoSnapshot);
  suggestion.applied = false;
  suggestion.confirmationOpen = false;
  suggestion.clarificationAnswered = false;
  suggestion.clarificationAnswer = "";
  suggestion.helperText = "";
  suggestion.clarificationExpanded = false;
  suggestion.undoSnapshot = null;
  hooks.emitAiSuggestionUndoTelemetry({
    surface: hooks.ON_CREATE_SURFACE,
    aiSuggestionDbId: state.onCreateAssistState.aiSuggestionId,
    suggestionId,
    todoId: state.onCreateAssistState.liveTodoId || "",
    selectedTodoIdsCount: 1,
  });
  renderOnCreateAssistRow();
}

function onCreateAssistChooseClarification(suggestionId, choiceValue) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (
    !suggestion ||
    suggestion.type !== "ask_clarification" ||
    suggestion.applied
  ) {
    return;
  }
  applyOnCreateSuggestion(suggestion, String(choiceValue || "").trim());
  renderOnCreateAssistRow();
}

function bindOnCreateAssistHandlers() {
  if (window.__onCreateAssistHandlersBound) {
    return;
  }
  window.__onCreateAssistHandlersBound = true;

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "todoInput") return;
    if (state.suppressOnCreateAssistInput) {
      renderOnCreateAssistRow();
      return;
    }
    refreshOnCreateAssistFromTitle();
  });

  // Lint chip Fix/Review delegation (on-create surface only).
  // Excludes clicks inside #todoDetailsDrawer which has its own handler.
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("#todoDetailsDrawer")) return;
    const lintEl = target.closest("[data-ai-lint-action]");
    if (!(lintEl instanceof HTMLElement)) return;
    const lintAction = lintEl.getAttribute("data-ai-lint-action");
    state.onCreateAssistState.showFullAssist = true;
    if (state.onCreateAssistState.liveTodoId) {
      // Post-create mode: load server-backed suggestions for the saved todo.
      const todo = hooks.getTodoById(state.onCreateAssistState.liveTodoId);
      await loadOnCreateDecisionAssist(todo, lintAction === "fix");
    } else {
      // Pre-create mode: regenerate client-side mock suggestions and reveal them.
      // refreshOnCreateAssistFromTitle resets state; set showFullAssist after.
      refreshOnCreateAssistFromTitle(true);
      state.onCreateAssistState.showFullAssist = true;
      renderOnCreateAssistRow();
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest("[data-ai-create-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-ai-create-action");
    const suggestionId =
      actionEl.getAttribute("data-ai-create-suggestion-id") || "";
    if (action === "toggle-more") {
      state.onCreateAssistState.showAll = !state.onCreateAssistState.showAll;
      renderOnCreateAssistRow();
      return;
    }
    if (action === "apply" || action === "toggle-choices") {
      await onCreateAssistApplySuggestion(suggestionId);
      return;
    }
    if (action === "confirm-apply") {
      await onCreateAssistConfirmApplySuggestion(suggestionId);
      return;
    }
    if (action === "cancel-confirm") {
      const suggestion = getOnCreateSuggestionById(suggestionId);
      if (!suggestion) return;
      suggestion.confirmationOpen = false;
      renderOnCreateAssistRow();
      return;
    }
    if (action === "dismiss") {
      await onCreateAssistDismissSuggestion(suggestionId);
      return;
    }
    if (action === "undo") {
      onCreateAssistUndoSuggestion(suggestionId);
      return;
    }
    if (action === "choose") {
      const choiceValue =
        actionEl.getAttribute("data-ai-create-choice-value") || "";
      onCreateAssistChooseClarification(suggestionId, choiceValue);
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (
      !state.onCreateAssistState.suggestions.some(
        (item) => item.confirmationOpen,
      )
    ) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && !target.closest("#aiOnCreateAssistRow")) {
      return;
    }
    state.onCreateAssistState.suggestions.forEach((item) => {
      item.confirmationOpen = false;
    });
    renderOnCreateAssistRow();
  });
}

export {
  resetOnCreateAssistState,
  loadOnCreateDismissedTodoIds,
  persistOnCreateDismissedTodoIds,
  markOnCreateDismissed,
  clearOnCreateDismissed,
  isOnCreateDismissed,
  getOnCreateImpactRank,
  getOnCreateConfidenceBadge,
  clampOnCreateRationale,
  formatOnCreateSuggestionLabel,
  formatOnCreateChoiceValue,
  normalizeOnCreateSuggestion,
  buildOnCreateSuggestion,
  nextWeekdayAtNoonIso,
  yesterdayAtNoonIso,
  buildMockOnCreateAssistEnvelope,
  getOnCreateAssistElements,
  ensureOnCreateProjectOption,
  normalizeOnCreateAssistEnvelope,
  fetchOnCreateLatestSuggestion,
  generateOnCreateSuggestion,
  loadOnCreateDecisionAssist,
  refreshOnCreateAssistFromTitle,
  getOnCreateSuggestionById,
  getActiveOnCreateSuggestions,
  formatOnCreateDueDateLabel,
  buildOnCreateChipSummary,
  renderOnCreateChipChoices,
  renderOnCreateChipActions,
  renderOnCreateAssistRow,
  snapshotOnCreateDraftState,
  restoreOnCreateDraftState,
  applyOnCreateSuggestion,
  applyLiveOnCreateSuggestion,
  onCreateAssistApplySuggestion,
  onCreateAssistConfirmApplySuggestion,
  onCreateAssistDismissSuggestion,
  onCreateAssistUndoSuggestion,
  onCreateAssistChooseClarification,
  bindOnCreateAssistHandlers,
};
