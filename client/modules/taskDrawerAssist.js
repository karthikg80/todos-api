// =============================================================================
// taskDrawerAssist.js — AI decision assist in the todo drawer.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { getAllProjects } from "./projectsState.js";
import { STORAGE_KEYS } from "../utils/storageKeys.js";
import {
  illustrationAiEmpty,
  illustrationSubtasksEmpty,
} from "../utils/illustrations.js";

function taskDrawerDismissKey(todoId) {
  return `${STORAGE_KEYS.TASK_DRAWER_DISMISSED_PREFIX}${todoId}`;
}

function getTaskDrawerSuggestionLabel(type) {
  return hooks.labelForType(type);
}

function normalizeTaskDrawerAssistEnvelope(
  aiSuggestionId,
  outputEnvelope,
  fallbackTodoId,
) {
  const suggestionsRaw = Array.isArray(outputEnvelope?.suggestions)
    ? outputEnvelope.suggestions
    : [];
  const normalized = suggestionsRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const suggestion = item;
      const type = String(suggestion.type || "");
      if (!hooks.shouldRenderTypeForSurface("task_drawer", type)) {
        return null;
      }
      const payload =
        suggestion.payload && typeof suggestion.payload === "object"
          ? { ...suggestion.payload }
          : {};
      if (typeof payload.todoId !== "string" || !payload.todoId.trim()) {
        payload.todoId = fallbackTodoId;
      }
      return {
        type,
        suggestionId:
          String(suggestion.suggestionId || "").trim() ||
          `${aiSuggestionId || "drawer"}-${index + 1}`,
        confidence: Math.max(
          0,
          Math.min(1, Number(suggestion.confidence) || 0),
        ),
        rationale: hooks.truncateRationale(suggestion.rationale, 120),
        payload,
        requiresConfirmation: hooks.needsConfirmation(suggestion),
        dismissed: false,
      };
    })
    .filter(Boolean);
  return hooks.capSuggestions(
    hooks.sortSuggestions("task_drawer", normalized),
    6,
  );
}

function renderTaskDrawerSuggestionSummary(suggestion) {
  if (suggestion.type === "rewrite_title") {
    return String(suggestion.payload.title || "Rewrite task title");
  }
  if (suggestion.type === "set_due_date") {
    const due = new Date(String(suggestion.payload.dueDateISO || ""));
    return Number.isNaN(due.getTime())
      ? "Set due date"
      : `Set due ${due.toLocaleDateString()}`;
  }
  if (suggestion.type === "set_priority") {
    return `Set priority ${String(suggestion.payload.priority || "").toUpperCase()}`;
  }
  if (suggestion.type === "set_project") {
    return `Set project ${String(suggestion.payload.projectName || suggestion.payload.category || "")}`.trim();
  }
  if (suggestion.type === "set_category") {
    return `Set category ${String(suggestion.payload.category || "")}`.trim();
  }
  if (suggestion.type === "split_subtasks") {
    const count = Array.isArray(suggestion.payload.subtasks)
      ? suggestion.payload.subtasks.length
      : 0;
    return `Add ${count} subtasks`;
  }
  if (suggestion.type === "propose_next_action") {
    return String(suggestion.payload.text || suggestion.payload.title || "");
  }
  if (suggestion.type === "ask_clarification") {
    return String(suggestion.payload.question || "Need one clarification");
  }
  return "Suggestion";
}

function renderTaskDrawerAssistSection(todoId) {
  // Lint-first gate: show lint chip only when a heuristic fires.
  // Full panel should render only after explicit user action.
  // In debug mode, always show the full panel so developers see all metadata.
  const assistState = state.taskDrawerAssistState;
  if (!assistState.showFullAssist && !hooks.AI_DEBUG_ENABLED) {
    const todo = getTodoById(todoId);
    const issue = todo
      ? hooks.lintTodoFields({
          title: todo.title,
          dueDate: todo.dueDate || "",
          priority: todo.priority || "",
          subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
          allTodos: state.todos,
        })
      : null;
    if (issue) {
      // A lint issue is present — show only the chip (suppress full panel).
      return `
        <div class="todo-drawer__section">
          <div class="todo-drawer__section-title">AI Suggestions</div>
          ${hooks.renderLintChip(issue)}
        </div>
      `;
    }
    return "";
  }

  if (!hooks.FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    return `
      <div class="todo-drawer__section">
        <div class="todo-drawer__section-title">AI Suggestions</div>
        <div class="ai-empty" role="status">${illustrationAiEmpty()}AI Suggestions unavailable.</div>
      </div>
    `;
  }
  const base = `
    <div class="todo-drawer__section">
      <div class="todo-drawer__section-title">AI Suggestions</div>
      ${hooks.renderAiDebugMeta({
        requestId: assistState.requestId,
        generatedAt: assistState.generatedAt,
        contractVersion: assistState.contractVersion,
      })}
      ${assistState.loading ? '<div class="ai-empty" role="status">Loading suggestions...</div>' : ""}
      ${
        assistState.unavailable
          ? '<div class="ai-empty" role="status">AI Suggestions unavailable.</div>'
          : ""
      }
      ${assistState.error ? `<div class="ai-empty" role="status">${hooks.escapeHtml(assistState.error)}</div>` : ""}
      ${
        !assistState.loading &&
        !assistState.unavailable &&
        !assistState.error &&
        (assistState.mustAbstain || assistState.suggestions.length === 0)
          ? `<div class="ai-empty" role="status">${illustrationAiEmpty()}No suggestions right now.</div>`
          : ""
      }
      ${
        assistState.suggestions.length > 0
          ? `<div class="todo-drawer-ai-list">
              ${assistState.suggestions
                .map((suggestion) => {
                  const confidenceLabel = confidenceLabelForSuggestion(
                    suggestion.confidence,
                  );
                  const applying =
                    assistState.applyingSuggestionId ===
                    suggestion.suggestionId;
                  const confirmOpen =
                    assistState.confirmSuggestionId === suggestion.suggestionId;
                  return `
                    <div class="todo-drawer-ai-card ai-card" data-testid="task-drawer-ai-card-${hooks.escapeHtml(suggestion.suggestionId)}">
                      <div class="todo-drawer-ai-card__top">
                        <span class="todo-drawer-ai-card__label">${hooks.escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}</span>
                        <span class="ai-badge ai-badge--${hooks.escapeHtml(hooks.confidenceBand(suggestion.confidence))}" aria-label="Confidence ${hooks.escapeHtml(confidenceLabel)}">${hooks.escapeHtml(confidenceLabel)}</span>
                      </div>
                      <div class="todo-drawer-ai-card__summary">${hooks.escapeHtml(renderTaskDrawerSuggestionSummary(suggestion))}</div>
                      <div class="todo-drawer-ai-card__rationale ai-tooltip">${hooks.escapeHtml(suggestion.rationale)}</div>
                      ${hooks.renderAiDebugSuggestionId(suggestion.suggestionId)}
                      ${
                        assistState.lastUndoSuggestionId ===
                        suggestion.suggestionId
                          ? `<div class="ai-tooltip">Undone locally</div>`
                          : ""
                      }
                      <div class="todo-drawer-ai-card__actions ai-actions">
                        ${
                          confirmOpen
                            ? `
                              <div class="ai-confirm">
                                <button
                                  type="button"
                                  class="ai-action-btn"
                                  data-testid="task-drawer-ai-confirm-${hooks.escapeHtml(suggestion.suggestionId)}"
                                  data-drawer-ai-action="confirm-apply"
                                  data-drawer-ai-suggestion-id="${hooks.escapeHtml(suggestion.suggestionId)}"
                                  aria-label="Confirm apply ${hooks.escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  class="ai-action-btn"
                                  data-testid="task-drawer-ai-cancel-${hooks.escapeHtml(suggestion.suggestionId)}"
                                  data-drawer-ai-action="cancel-confirm"
                                  data-drawer-ai-suggestion-id="${hooks.escapeHtml(suggestion.suggestionId)}"
                                  aria-label="Cancel confirmation"
                                >
                                  Cancel
                                </button>
                              </div>
                            `
                            : `
                              <button
                                type="button"
                                class="ai-action-btn"
                                data-testid="task-drawer-ai-apply-${hooks.escapeHtml(suggestion.suggestionId)}"
                                data-drawer-ai-action="apply"
                                data-drawer-ai-suggestion-id="${hooks.escapeHtml(suggestion.suggestionId)}"
                                aria-label="Apply ${hooks.escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                                ${applying ? "disabled" : ""}
                              >
                                ${applying ? "Applying..." : "Apply"}
                              </button>
                            `
                        }
                        <button
                          type="button"
                          class="ai-action-btn"
                          data-testid="task-drawer-ai-dismiss-${hooks.escapeHtml(suggestion.suggestionId)}"
                          data-drawer-ai-action="dismiss"
                          data-drawer-ai-suggestion-id="${hooks.escapeHtml(suggestion.suggestionId)}"
                          aria-label="Dismiss ${hooks.escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                        >
                          Dismiss
                        </button>
                        ${
                          assistState.undoBySuggestionId[
                            suggestion.suggestionId
                          ]
                            ? `
                              <button
                                type="button"
                                class="ai-undo"
                                data-testid="task-drawer-ai-undo-${hooks.escapeHtml(suggestion.suggestionId)}"
                                data-drawer-ai-action="undo"
                                data-drawer-ai-suggestion-id="${hooks.escapeHtml(suggestion.suggestionId)}"
                                aria-label="Undo ${hooks.escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                              >
                                Undo
                              </button>
                            `
                            : ""
                        }
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;

  window.requestAnimationFrame(() => {
    const confirmButton = document.querySelector(
      `[data-drawer-ai-action="confirm-apply"][data-drawer-ai-suggestion-id="${escapeSelectorValue(
        assistState.confirmSuggestionId || "",
      )}"]`,
    );
    if (confirmButton instanceof HTMLElement) {
      confirmButton.focus({ preventScroll: true });
    }
  });

  return base;
}

function confidenceLabelForSuggestion(confidence) {
  return hooks.confidenceLabel(confidence);
}

function getTodoById(todoId) {
  return state.todos.find((todo) => todo.id === todoId) || null;
}

function getCurrentDrawerDraft(todo) {
  if (!todo) return null;
  if (!state.drawerDraft || state.drawerDraft.id !== todo.id) {
    hooks.initializeDrawerDraft(todo);
  }
  return state.drawerDraft;
}

function captureDrawerFocusState() {
  const refs = hooks.getTodoDrawerElements();
  if (!refs) return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!refs.drawer.contains(active)) return null;
  if (!active.id) return null;

  const state = { id: active.id, selectionStart: null, selectionEnd: null };
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    state.selectionStart = active.selectionStart;
    state.selectionEnd = active.selectionEnd;
  }
  return state;
}

function restoreDrawerFocusState(focusState) {
  if (!focusState || !focusState.id) return;
  const target = document.getElementById(focusState.id);
  if (!(target instanceof HTMLElement)) return;

  target.focus({ preventScroll: true });
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    if (
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number"
    ) {
      target.setSelectionRange(
        focusState.selectionStart,
        focusState.selectionEnd,
      );
    }
  }
}

function isMobileDrawerViewport() {
  if (typeof hooks.isMobileViewport === "function") {
    return hooks.isMobileViewport();
  }
  if (window.matchMedia) {
    return window.matchMedia(hooks.MOBILE_DRAWER_MEDIA_QUERY).matches;
  }
  return window.innerWidth <= 768;
}

function updateDrawerDraftField(field, value) {
  if (!state.drawerDraft) return;
  state.drawerDraft[field] = value;
  if (state.drawerSaveState !== "saving") {
    hooks.setDrawerSaveState("idle");
  }
}

function renderDrawerSubtasks(todo) {
  if (!Array.isArray(todo.subtasks) || todo.subtasks.length === 0) {
    return `<div class="todo-drawer__subtasks-empty">${illustrationSubtasksEmpty()}No subtasks</div>`;
  }

  return `
    <ul class="todo-drawer__subtasks-list">
      ${todo.subtasks
        .map((subtask) => {
          const title = hooks.escapeHtml(String(subtask?.title || ""));
          return `
            <li class="todo-drawer__subtasks-item ${subtask?.completed ? "completed" : ""}">
              <span aria-hidden="true">${subtask?.completed ? "✓" : "○"}</span>
              <span>${title}</span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
  hooks.updateAiWorkspaceStatusChip();
}

function buildDrawerProjectOptions(selectedProject = "") {
  const projects = getAllProjects();
  return `<option value="">None</option>${projects
    .map((project) => hooks.renderProjectOptionEntry(project, selectedProject))
    .join("")}`;
}

async function fetchTaskDrawerLatestSuggestion(todoId) {
  const response = await hooks.apiCall(
    `${hooks.API_URL}/ai/suggestions/latest?todoId=${encodeURIComponent(todoId)}&surface=task_drawer`,
  );
  return response;
}

async function generateTaskDrawerSuggestion(todo) {
  return hooks.apiCall(`${hooks.API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: "task_drawer",
      todoId: todo.id,
      title: todo.title,
      description: todo.description || "",
      notes: todo.notes || "",
    }),
  });
}

function escapeSelectorValue(value) {
  const raw = String(value);
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, "\\$&");
}

function renderTodoChips(todo, { isOverdue, dueDateStr }) {
  const chips = [];

  if (todo.dueDate) {
    const dueLabel = `${isOverdue ? "⚠️" : "📅"} ${dueDateStr}`;
    chips.push(
      `<span class="todo-chip todo-chip--due ${isOverdue ? "todo-chip--due-overdue" : ""}" title="${hooks.escapeHtml(dueLabel)}">${hooks.escapeHtml(dueLabel)}</span>`,
    );
  }

  // Workflow status chip (show non-default statuses)
  const status = String(todo.status || "").toLowerCase();
  const STATUS_LABELS = {
    waiting: "Waiting",
    scheduled: "Scheduled",
    someday: "Someday",
    in_progress: "In Progress",
    next: "Up Next",
    cancelled: "Cancelled",
  };
  if (STATUS_LABELS[status]) {
    chips.push(
      `<span class="todo-chip todo-chip--status todo-chip--status-${hooks.escapeHtml(status)}" title="${hooks.escapeHtml(STATUS_LABELS[status])}">${hooks.escapeHtml(STATUS_LABELS[status])}</span>`,
    );
  }

  // Context chip
  if (todo.context && chips.length < 2) {
    chips.push(
      `<span class="todo-chip todo-chip--context" title="${hooks.escapeHtml(String(todo.context))}">@${hooks.escapeHtml(String(todo.context).replace(/^@/, ""))}</span>`,
    );
  }

  if (todo.category && chips.length < 2) {
    chips.push(
      `<span class="todo-chip todo-chip--project" title="${hooks.escapeHtml(todo.category)}">🏷️ ${hooks.escapeHtml(todo.category)}</span>`,
    );
  }

  if (todo.priority === "high" && chips.length < 2) {
    chips.push(
      `<span class="todo-chip todo-chip--priority priority-badge high" title="High priority">HIGH</span>`,
    );
  }

  if (
    todo.recurrenceType &&
    todo.recurrenceType !== "none" &&
    chips.length < 3
  ) {
    const units = {
      daily: "day",
      weekly: "week",
      monthly: "month",
      yearly: "year",
    };
    const n = todo.recurrenceInterval || 1;
    const unit = units[todo.recurrenceType] || todo.recurrenceType;
    const label = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
    chips.push(
      `<span class="todo-chip todo-chip--recurrence" title="${hooks.escapeHtml(label)}"><svg class="app-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> ${hooks.escapeHtml(label)}</span>`,
    );
  }

  // Tag chips — clickable to filter
  if (Array.isArray(todo.tags) && todo.tags.length > 0 && chips.length < 3) {
    const maxTags = 3 - chips.length;
    todo.tags.slice(0, maxTags).forEach((tag) => {
      const safeTag = hooks.escapeHtml(String(tag));
      chips.push(
        `<span class="todo-chip todo-chip--tag" title="Filter by #${safeTag}" data-onclick="event.stopPropagation(); toggleTagFilter('${safeTag}')">#${safeTag}</span>`,
      );
    });
  }

  return chips.slice(0, 4).join("");
}

export {
  taskDrawerDismissKey,
  getTaskDrawerSuggestionLabel,
  normalizeTaskDrawerAssistEnvelope,
  renderTaskDrawerSuggestionSummary,
  renderTaskDrawerAssistSection,
  confidenceLabelForSuggestion,
  getTodoById,
  getCurrentDrawerDraft,
  captureDrawerFocusState,
  restoreDrawerFocusState,
  isMobileDrawerViewport,
  updateDrawerDraftField,
  renderDrawerSubtasks,
  buildDrawerProjectOptions,
  fetchTaskDrawerLatestSuggestion,
  generateTaskDrawerSuggestion,
  escapeSelectorValue,
  renderTodoChips,
};
