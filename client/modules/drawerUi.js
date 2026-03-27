// =============================================================================
// drawerUi.js — Todo drawer UI: open/close, draft management, AI assist,
// kebab menu, drawer event bindings.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";
import { TODOS_CHANGED } from "../platform/events/eventTypes.js";
import { TODO_UPDATED, UNDO_APPLIED } from "../platform/events/eventReasons.js";
import { runAsyncLifecycle } from "./asyncLifecycle.js";
import { applyAsyncAction, applyUiAction } from "./stateActions.js";
import { callAgentAction } from "./agentApiClient.js";
import { getEffortScoreLabel, getEffortScoreValue } from "./soulConfig.js";
import { STORAGE_KEYS } from "../utils/storageKeys.js";
import { illustrationSubtasksEmpty } from "../utils/illustrations.js";
import { mountTaskPicker } from "../utils/taskPicker.js";
import {
  hasTodoRow,
  patchHeaderCountsFromVisibleTodos,
  patchProjectsRailCounts,
  patchSelectedTodoRowActiveState,
  patchTodoById,
  patchTodoKebabState,
  patchVisibleCategoryGroupStats,
} from "./todosViewPatches.js";
import {
  renderDrawerAccordionSection,
  renderDrawerSection,
  renderStatusMessage,
} from "./uiTemplates.js";

// Active task-picker instance for the depends-on field. Destroyed and
// re-created each time the drawer content is fully re-rendered.
let activeDepPicker = null;

// ---------------------------------------------------------------------------
// Utilities (local, not cross-module)
// ---------------------------------------------------------------------------

function escapeSelectorValue(value) {
  const raw = String(value);
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Task drawer dismiss persistence
// ---------------------------------------------------------------------------

function taskDrawerDismissKey(todoId) {
  return `${STORAGE_KEYS.TASK_DRAWER_DISMISSED_PREFIX}${todoId}`;
}

export function markTaskDrawerDismissed(todoId) {
  try {
    window.localStorage.setItem(taskDrawerDismissKey(todoId), "1");
  } catch {}
}

export function clearTaskDrawerDismissed(todoId) {
  try {
    window.localStorage.removeItem(taskDrawerDismissKey(todoId));
  } catch {}
}

export function isTaskDrawerDismissed(todoId) {
  try {
    return window.localStorage.getItem(taskDrawerDismissKey(todoId)) === "1";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Task drawer assist state helpers
// ---------------------------------------------------------------------------

export function resetTaskDrawerAssistState(todoId = "") {
  applyAsyncAction("taskDrawerAssist/reset", { todoId });
}

function getTaskDrawerSuggestionLabel(type) {
  return hooks.labelForType ? hooks.labelForType(type) : type;
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
      if (
        hooks.shouldRenderTypeForSurface &&
        !hooks.shouldRenderTypeForSurface("task_drawer", type)
      ) {
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
        rationale: hooks.truncateRationale
          ? hooks.truncateRationale(suggestion.rationale, 120)
          : String(suggestion.rationale || "").slice(0, 120),
        payload,
        requiresConfirmation: hooks.needsConfirmation
          ? hooks.needsConfirmation(suggestion)
          : false,
        dismissed: false,
      };
    })
    .filter(Boolean);
  if (hooks.capSuggestions && hooks.sortSuggestions) {
    return hooks.capSuggestions(
      hooks.sortSuggestions("task_drawer", normalized),
      6,
    );
  }
  return normalized.slice(0, 6);
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
  const assistState = state.taskDrawerAssistState;
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const AI_DEBUG_ENABLED = hooks.AI_DEBUG_ENABLED || false;
  const FEATURE_TASK_DRAWER_DECISION_ASSIST =
    hooks.FEATURE_TASK_DRAWER_DECISION_ASSIST || false;

  if (!assistState.showFullAssist && !AI_DEBUG_ENABLED) {
    const todo = state.todos.find((t) => t.id === todoId) || null;
    const issue =
      todo && hooks.lintTodoFields
        ? hooks.lintTodoFields({
            title: todo.title,
            dueDate: todo.dueDate || "",
            priority: todo.priority || "",
            subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
            allTodos: state.todos,
          })
        : null;
    if (issue) {
      return renderDrawerSection({
        title: "Assistant",
        bodyHtml: hooks.renderLintChip ? hooks.renderLintChip(issue) : "",
      });
    }
    return "";
  }

  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    return renderDrawerSection({
      title: "Assistant",
      bodyHtml: renderStatusMessage({
        message: "Suggestions unavailable right now.",
      }),
    });
  }

  const aiDebugMeta = hooks.renderAiDebugMeta
    ? hooks.renderAiDebugMeta({
        requestId: assistState.requestId,
        generatedAt: assistState.generatedAt,
        contractVersion: assistState.contractVersion,
      })
    : "";

  const bodyHtml = `
    ${aiDebugMeta}
    ${
      assistState.loading
        ? renderStatusMessage({ message: "Loading suggestions..." })
        : ""
    }
    ${
      assistState.unavailable
        ? renderStatusMessage({ message: "Suggestions unavailable right now." })
        : ""
    }
    ${
      assistState.error
        ? renderStatusMessage({ message: assistState.error })
        : ""
    }
    ${
      !assistState.loading &&
      !assistState.unavailable &&
      !assistState.error &&
      (assistState.mustAbstain || assistState.suggestions.length === 0)
        ? renderStatusMessage({
            message: "This task looks good. No suggestions right now.",
          })
        : ""
    }
    ${
      assistState.suggestions.length > 0
        ? `<div class="todo-drawer-ai-list">
            ${assistState.suggestions
              .map((suggestion) => {
                const confidenceLabel = hooks.confidenceLabel
                  ? hooks.confidenceLabel(suggestion.confidence)
                  : "";
                const applying =
                  assistState.applyingSuggestionId === suggestion.suggestionId;
                const confirmOpen =
                  assistState.confirmSuggestionId === suggestion.suggestionId;
                const bandClass = hooks.confidenceBand
                  ? hooks.confidenceBand(suggestion.confidence)
                  : "low";
                const debugSuggId = hooks.renderAiDebugSuggestionId
                  ? hooks.renderAiDebugSuggestionId(suggestion.suggestionId)
                  : "";
                return `
                <div class="todo-drawer-ai-card ai-card" data-testid="task-drawer-ai-card-${escapeHtml(suggestion.suggestionId)}">
                  <div class="todo-drawer-ai-card__top">
                    <span class="todo-drawer-ai-card__label">${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}</span>
                    <span class="ai-badge ai-badge--${escapeHtml(bandClass)}" aria-label="Confidence ${escapeHtml(confidenceLabel)}">${escapeHtml(confidenceLabel)}</span>
                  </div>
                  <div class="todo-drawer-ai-card__summary">${escapeHtml(renderTaskDrawerSuggestionSummary(suggestion))}</div>
                  <div class="todo-drawer-ai-card__rationale ai-tooltip">${escapeHtml(suggestion.rationale)}</div>
                  ${debugSuggId}
                  ${
                    assistState.lastUndoSuggestionId === suggestion.suggestionId
                      ? `<div class="ai-tooltip">Undone locally</div>`
                      : ""
                  }
                  <div class="todo-drawer-ai-card__actions ai-actions">
                    ${
                      confirmOpen
                        ? `<div class="ai-confirm">
                          <button type="button" class="ai-action-btn"
                            data-testid="task-drawer-ai-confirm-${escapeHtml(suggestion.suggestionId)}"
                            data-drawer-ai-action="confirm-apply"
                            data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                            aria-label="Confirm apply ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                          >Confirm</button>
                          <button type="button" class="ai-action-btn"
                            data-testid="task-drawer-ai-cancel-${escapeHtml(suggestion.suggestionId)}"
                            data-drawer-ai-action="cancel-confirm"
                            data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                            aria-label="Cancel confirmation"
                          >Cancel</button>
                        </div>`
                        : `<button type="button" class="ai-action-btn"
                          data-testid="task-drawer-ai-apply-${escapeHtml(suggestion.suggestionId)}"
                          data-drawer-ai-action="apply"
                          data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                          aria-label="Apply ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                          ${applying ? "disabled" : ""}
                        >${applying ? "Applying..." : "Apply"}</button>`
                    }
                    <button type="button" class="ai-action-btn"
                      data-testid="task-drawer-ai-dismiss-${escapeHtml(suggestion.suggestionId)}"
                      data-drawer-ai-action="dismiss"
                      data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                      aria-label="Dismiss ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                    >Dismiss</button>
                    ${
                      assistState.undoBySuggestionId[suggestion.suggestionId]
                        ? `<button type="button" class="ai-undo"
                          data-testid="task-drawer-ai-undo-${escapeHtml(suggestion.suggestionId)}"
                          data-drawer-ai-action="undo"
                          data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                          aria-label="Undo ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                        >Undo</button>`
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
  `;

  window.requestAnimationFrame(() => {
    const confirmButton = document.querySelector(
      `[data-drawer-ai-action="confirm-apply"][data-drawer-ai-suggestion-id="${escapeSelectorValue(assistState.confirmSuggestionId || "")}"]`,
    );
    if (confirmButton instanceof HTMLElement) {
      confirmButton.focus({ preventScroll: true });
    }
  });

  return renderDrawerSection({
    title: "Assistant",
    bodyHtml,
  });
}

// ---------------------------------------------------------------------------
// Drawer element accessor
// ---------------------------------------------------------------------------

export function getTodoDrawerElements() {
  const drawer = document.getElementById("todoDetailsDrawer");
  const closeBtn = document.getElementById("todoDrawerClose");
  const titleEl = document.getElementById("todoDrawerTitle");
  const contentEl = drawer?.querySelector(".todo-drawer__content");
  const backdrop = document.getElementById("todoDrawerBackdrop");
  if (!(drawer instanceof HTMLElement)) return null;
  if (!(closeBtn instanceof HTMLElement)) return null;
  if (!(titleEl instanceof HTMLElement)) return null;
  if (!(contentEl instanceof HTMLElement)) return null;
  return { drawer, closeBtn, titleEl, contentEl, backdrop };
}

// ---------------------------------------------------------------------------
// Drawer draft management
// ---------------------------------------------------------------------------

export function initializeDrawerDraft(todo) {
  const toDateInputValue = hooks.toDateInputValue || ((v) => v || "");
  const toDateTimeLocalValue = hooks.toDateTimeLocalValue || ((v) => v || "");
  state.drawerDraft = {
    id: todo.id,
    title: String(todo.title || ""),
    completed: !!todo.completed,
    status: String(todo.status || (todo.completed ? "done" : "next")),
    dueDate: toDateInputValue(todo.dueDate),
    startDate: toDateTimeLocalValue(todo.startDate),
    scheduledDate: toDateTimeLocalValue(todo.scheduledDate),
    reviewDate: toDateTimeLocalValue(todo.reviewDate),
    project: String(todo.category || ""),
    priority: String(todo.priority || "medium"),
    description: String(todo.description || ""),
    notes: String(todo.notes || ""),
    categoryDetail: String(todo.category || ""),
    tagsText: Array.isArray(todo.tags) ? todo.tags.join(", ") : "",
    context: String(todo.context || ""),
    effortScore:
      typeof todo.effortScore === "number" ? String(todo.effortScore) : "",
    energy: String(todo.energy || ""),
    emotionalState: String(todo.emotionalState || ""),
    firstStep: String(todo.firstStep || ""),
    estimateMinutes:
      typeof todo.estimateMinutes === "number"
        ? String(todo.estimateMinutes)
        : "",
    waitingOn: String(todo.waitingOn || ""),
    dependsOnTaskIdsText: Array.isArray(todo.dependsOnTaskIds)
      ? todo.dependsOnTaskIds.join(", ")
      : "",
    archived: !!todo.archived,
    source: String(todo.source || ""),
    completedAt: todo.completedAt ? String(todo.completedAt) : "",
    recurrenceType: String(todo.recurrenceType || "none"),
    recurrenceInterval: todo.recurrenceInterval
      ? String(todo.recurrenceInterval)
      : "1",
  };
}

export function seedDrawerDraft(todoLike) {
  if (!todoLike || typeof todoLike !== "object") return;
  initializeDrawerDraft(todoLike);
}

/**
 * Selectively sync draft fields from a server response, touching only the
 * fields corresponding to `patchKeys`. Fields not in the patch (e.g.
 * dependsOnTaskIdsText when patching `archived`) are left untouched, so
 * in-progress user edits pending a blur event are never clobbered.
 */
function syncDrawerDraftFromPatch(updatedTodo, patchKeys) {
  if (!state.drawerDraft || state.drawerDraft.id !== updatedTodo.id) {
    initializeDrawerDraft(updatedTodo);
    return;
  }
  const toDateInputValue = hooks.toDateInputValue || ((v) => v || "");
  const toDateTimeLocalValue = hooks.toDateTimeLocalValue || ((v) => v || "");
  const d = state.drawerDraft;
  for (const key of patchKeys) {
    switch (key) {
      case "title":
        d.title = String(updatedTodo.title || "");
        break;
      case "completed":
        d.completed = !!updatedTodo.completed;
        d.status = String(
          updatedTodo.status || (updatedTodo.completed ? "done" : "next"),
        );
        break;
      case "status":
        d.status = String(
          updatedTodo.status || (updatedTodo.completed ? "done" : "next"),
        );
        break;
      case "dueDate":
        d.dueDate = toDateInputValue(updatedTodo.dueDate);
        break;
      case "startDate":
        d.startDate = toDateTimeLocalValue(updatedTodo.startDate);
        break;
      case "scheduledDate":
        d.scheduledDate = toDateTimeLocalValue(updatedTodo.scheduledDate);
        break;
      case "reviewDate":
        d.reviewDate = toDateTimeLocalValue(updatedTodo.reviewDate);
        break;
      case "category":
      case "projectId":
        d.project = String(updatedTodo.category || "");
        d.categoryDetail = String(updatedTodo.category || "");
        break;
      case "priority":
        d.priority = String(updatedTodo.priority || "medium");
        break;
      case "description":
        d.description = String(updatedTodo.description || "");
        break;
      case "notes":
        d.notes = String(updatedTodo.notes || "");
        break;
      case "tags":
        d.tagsText = Array.isArray(updatedTodo.tags)
          ? updatedTodo.tags.join(", ")
          : "";
        break;
      case "context":
        d.context = String(updatedTodo.context || "");
        break;
      case "effortScore":
        d.effortScore =
          typeof updatedTodo.effortScore === "number"
            ? String(updatedTodo.effortScore)
            : "";
        break;
      case "energy":
        d.energy = String(updatedTodo.energy || "");
        break;
      case "emotionalState":
        d.emotionalState = String(updatedTodo.emotionalState || "");
        break;
      case "firstStep":
        d.firstStep = String(updatedTodo.firstStep || "");
        break;
      case "estimateMinutes":
        d.estimateMinutes =
          typeof updatedTodo.estimateMinutes === "number"
            ? String(updatedTodo.estimateMinutes)
            : "";
        break;
      case "waitingOn":
        d.waitingOn = String(updatedTodo.waitingOn || "");
        break;
      case "dependsOnTaskIds":
        d.dependsOnTaskIdsText = Array.isArray(updatedTodo.dependsOnTaskIds)
          ? updatedTodo.dependsOnTaskIds.join(", ")
          : "";
        break;
      case "archived":
        d.archived = !!updatedTodo.archived;
        break;
      case "recurrence":
        d.recurrenceType = String(updatedTodo.recurrenceType || "none");
        d.recurrenceInterval = updatedTodo.recurrenceInterval
          ? String(updatedTodo.recurrenceInterval)
          : "1";
        break;
      default:
        break;
    }
  }
}

function getCurrentDrawerDraft(todo) {
  if (!todo) return null;
  if (!state.drawerDraft || state.drawerDraft.id !== todo.id) {
    initializeDrawerDraft(todo);
  }
  return state.drawerDraft;
}

// ---------------------------------------------------------------------------
// Drawer save state
// ---------------------------------------------------------------------------

export function setDrawerSaveState(newState, message = "") {
  if (state.drawerSaveResetTimer) {
    clearTimeout(state.drawerSaveResetTimer);
    state.drawerSaveResetTimer = null;
  }

  state.drawerSaveState = newState;
  state.drawerSaveMessage = message;
  const statusEl = document.getElementById("drawerSaveStatus");
  if (!(statusEl instanceof HTMLElement)) return;

  const textByState = {
    idle: "Ready",
    saving: "Saving...",
    saved: "Saved",
    error: message || "Save failed",
  };
  statusEl.textContent = textByState[newState] || textByState.idle;
  statusEl.setAttribute("data-state", newState);

  if (newState === "saved") {
    state.drawerSaveResetTimer = setTimeout(() => {
      if (state.drawerSaveState === "saved") {
        setDrawerSaveState("idle");
      }
    }, 1200);
  }
}

// ---------------------------------------------------------------------------
// Focus state capture/restore
// ---------------------------------------------------------------------------

function captureDrawerFocusState() {
  const refs = getTodoDrawerElements();
  if (!refs) return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!refs.drawer.contains(active)) return null;
  if (!active.id) return null;

  const focusState = {
    id: active.id,
    selectionStart: null,
    selectionEnd: null,
  };
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    focusState.selectionStart = active.selectionStart;
    focusState.selectionEnd = active.selectionEnd;
  }
  return focusState;
}

function applyDrawerFocusState(focusState) {
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

function restoreDrawerFocusState(focusState) {
  applyDrawerFocusState(focusState);
  window.requestAnimationFrame(() => {
    applyDrawerFocusState(focusState);
  });
}

// ---------------------------------------------------------------------------
// Body scroll lock for drawer (mobile)
// ---------------------------------------------------------------------------

const MOBILE_DRAWER_MEDIA_QUERY =
  hooks.MOBILE_DRAWER_MEDIA_QUERY || "(max-width: 768px)";

function isMobileDrawerViewport() {
  if (typeof hooks.isMobileViewport === "function") {
    return hooks.isMobileViewport();
  }
  if (window.matchMedia) {
    return window.matchMedia(MOBILE_DRAWER_MEDIA_QUERY).matches;
  }
  return window.innerWidth <= 768;
}

export function lockBodyScrollForDrawer() {
  if (state.isDrawerBodyLocked || !isMobileDrawerViewport()) return;
  const body = document.body;
  state.drawerScrollLockY = window.scrollY || window.pageYOffset || 0;
  body.classList.add("is-drawer-open");
  body.style.position = "fixed";
  body.style.top = `-${state.drawerScrollLockY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  state.isDrawerBodyLocked = true;
}

export function unlockBodyScrollForDrawer() {
  if (!state.isDrawerBodyLocked) return;
  const body = document.body;
  body.classList.remove("is-drawer-open");
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  window.scrollTo(0, state.drawerScrollLockY);
  state.isDrawerBodyLocked = false;
}

// ---------------------------------------------------------------------------
// Drawer patch save
// ---------------------------------------------------------------------------

export async function saveDrawerPatch(patch, { validateTitle = false } = {}) {
  if (!state.selectedTodoId || !state.drawerDraft) return;

  if (validateTitle) {
    const validateTodoTitle = hooks.validateTodoTitle || (() => null);
    const titleError = validateTodoTitle(state.drawerDraft.title);
    if (titleError) {
      setDrawerSaveState("error", titleError);
      return;
    }
  }

  const requestId = ++state.drawerSaveSequence;
  const focusState = captureDrawerFocusState();
  setDrawerSaveState("saving");

  try {
    const updatedTodo = await hooks.applyTodoPatch(state.selectedTodoId, patch);
    if (requestId !== state.drawerSaveSequence) return;
    const patchKeys = Object.keys(patch);
    syncDrawerDraftFromPatch(updatedTodo, patchKeys);
    setDrawerSaveState("saved");
    const canPatchInPlace =
      !hooks.shouldUseServerVisibleTodos?.() &&
      state.currentWorkspaceView === "all" &&
      !state.homeListDrilldownKey &&
      patchKeys.every((key) =>
        ["title", "description", "notes", "priority", "completed"].includes(
          key,
        ),
      ) &&
      (patchKeys.includes("completed")
        ? state.currentDateView !== "completed"
        : true) &&
      hasTodoRow(updatedTodo.id);

    if (canPatchInPlace) {
      patchTodoById(updatedTodo.id, updatedTodo, {
        syncCompleted: patchKeys.includes("completed"),
      });
      if (patchKeys.includes("completed")) {
        patchVisibleCategoryGroupStats();
        patchProjectsRailCounts();
        patchHeaderCountsFromVisibleTodos();
      }
    } else {
      EventBus.dispatch(TODOS_CHANGED, { reason: TODO_UPDATED });
    }
    syncTodoDrawerStateWithRender();
    restoreDrawerFocusState(focusState);
  } catch (error) {
    if (requestId !== state.drawerSaveSequence) return;
    setDrawerSaveState("error", error.message || "Save failed");
  }
}

// ---------------------------------------------------------------------------
// Drawer draft field updates + event handlers
// ---------------------------------------------------------------------------

function updateDrawerDraftField(field, value) {
  if (!state.drawerDraft) return;
  state.drawerDraft[field] = value;
  if (state.drawerSaveState !== "saving") {
    setDrawerSaveState("idle");
  }
}

function parseCommaSeparatedList(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIsoFromDateTimeInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function onDrawerTitleInput(event) {
  const value = String(event?.target?.value || "");
  updateDrawerDraftField("title", value);
}

export function onDrawerTitleBlur() {
  if (!state.drawerDraft) return;
  saveDrawerPatch(
    { title: state.drawerDraft.title.trim() },
    { validateTitle: true },
  );
}

export function onDrawerTitleKeydown(event) {
  if (!event) return;
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  onDrawerTitleBlur();
}

export function onDrawerCompletedChange(event) {
  const checked = !!event?.target?.checked;
  updateDrawerDraftField("completed", checked);
  saveDrawerPatch({ completed: checked });
}

export function onDrawerDueDateChange(event) {
  const dueDate = String(event?.target?.value || "");
  updateDrawerDraftField("dueDate", dueDate);
  const toIsoFromDateInput = hooks.toIsoFromDateInput || ((v) => v || null);
  saveDrawerPatch({ dueDate: toIsoFromDateInput(dueDate) });
}

export function onDrawerStatusChange(event) {
  const status = String(event?.target?.value || "next");
  const completed = status === "done";
  updateDrawerDraftField("status", status);
  updateDrawerDraftField("completed", completed);
  saveDrawerPatch({ status, completed });
}

export function onDrawerStartDateChange(event) {
  const value = String(event?.target?.value || "");
  updateDrawerDraftField("startDate", value);
  saveDrawerPatch({ startDate: toIsoFromDateTimeInput(value) });
}

export function onDrawerScheduledDateChange(event) {
  const value = String(event?.target?.value || "");
  updateDrawerDraftField("scheduledDate", value);
  saveDrawerPatch({ scheduledDate: toIsoFromDateTimeInput(value) });
}

export function onDrawerReviewDateChange(event) {
  const value = String(event?.target?.value || "");
  updateDrawerDraftField("reviewDate", value);
  saveDrawerPatch({ reviewDate: toIsoFromDateTimeInput(value) });
}

export function onDrawerRecurrenceTypeChange(event) {
  const value = String(event?.target?.value || "none");
  updateDrawerDraftField("recurrenceType", value);
  const recurrence =
    value === "none"
      ? null
      : {
          type: value,
          interval: parseInt(state.drawerDraft?.recurrenceInterval || "1", 10),
        };
  saveDrawerPatch({ recurrence });
}

export function onDrawerRecurrenceIntervalChange(event) {
  const value = String(event?.target?.value || "1");
  updateDrawerDraftField("recurrenceInterval", value);
  const recurrence = {
    type: state.drawerDraft?.recurrenceType || "daily",
    interval: parseInt(value, 10) || 1,
  };
  saveDrawerPatch({ recurrence });
}

export function onDrawerProjectChange(event) {
  const normalizeProjectPath = hooks.normalizeProjectPath || ((v) => v);
  const project = normalizeProjectPath(String(event?.target?.value || ""));
  updateDrawerDraftField("project", project || "");
  const patch = { category: project || null, projectId: null };
  if (project) {
    const projectRecord = hooks.getProjectRecordByName?.(project);
    if (projectRecord?.id) {
      patch.projectId = projectRecord.id;
    }
  }
  saveDrawerPatch(patch);
}

export function onDrawerPriorityChange(event) {
  const priority = String(event?.target?.value || "medium");
  updateDrawerDraftField("priority", priority);
  saveDrawerPatch({ priority });
}

export function onDrawerContextInput(event) {
  updateDrawerDraftField("context", String(event?.target?.value || ""));
}

export function onDrawerContextBlur() {
  if (!state.drawerDraft) return;
  const context = String(state.drawerDraft.context || "").trim();
  saveDrawerPatch({ context: context || null });
}

export function onDrawerEnergyChange(event) {
  const energy = String(event?.target?.value || "");
  updateDrawerDraftField("energy", energy);
  saveDrawerPatch({ energy: energy || null });
}

export function onDrawerEffortChange(event) {
  const effortScore = String(event?.target?.value || "");
  updateDrawerDraftField("effortScore", effortScore);
  saveDrawerPatch({ effortScore: getEffortScoreValue(effortScore) });
}

export function onDrawerEmotionalStateChange(event) {
  const emotionalState = String(event?.target?.value || "");
  updateDrawerDraftField("emotionalState", emotionalState);
  saveDrawerPatch({ emotionalState: emotionalState || null });
}

export function onDrawerFirstStepInput(event) {
  updateDrawerDraftField("firstStep", String(event?.target?.value || ""));
}

export function onDrawerFirstStepBlur() {
  if (!state.drawerDraft) return;
  const firstStep = String(state.drawerDraft.firstStep || "").trim();
  saveDrawerPatch({ firstStep: firstStep || null });
}

export function onDrawerEstimateChange(event) {
  const value = String(event?.target?.value || "");
  updateDrawerDraftField("estimateMinutes", value);
  const estimateMinutes =
    value.trim() === "" ? null : Number.parseInt(value, 10);
  saveDrawerPatch({
    estimateMinutes: Number.isFinite(estimateMinutes) ? estimateMinutes : null,
  });
}

export function onDrawerWaitingOnInput(event) {
  updateDrawerDraftField("waitingOn", String(event?.target?.value || ""));
}

export function onDrawerWaitingOnBlur() {
  if (!state.drawerDraft) return;
  const waitingOn = String(state.drawerDraft.waitingOn || "").trim();
  saveDrawerPatch({ waitingOn: waitingOn || null });
}

export function onDrawerTagsInput(event) {
  updateDrawerDraftField("tagsText", String(event?.target?.value || ""));
}

export function onDrawerTagsBlur() {
  if (!state.drawerDraft) return;
  saveDrawerPatch({
    tags: parseCommaSeparatedList(state.drawerDraft.tagsText),
  });
}

export function onDrawerDependsOnInput(event) {
  updateDrawerDraftField(
    "dependsOnTaskIdsText",
    String(event?.target?.value || ""),
  );
}

export function onDrawerDependsOnBlur() {
  if (!state.drawerDraft) return;
  saveDrawerPatch({
    dependsOnTaskIds: parseCommaSeparatedList(
      state.drawerDraft.dependsOnTaskIdsText,
    ),
  });
}

export function onDrawerArchivedChange(event) {
  const archived = !!event?.target?.checked;
  updateDrawerDraftField("archived", archived);
  saveDrawerPatch({ archived });
}

export function onDrawerDescriptionInput(event) {
  const description = String(event?.target?.value || "");
  updateDrawerDraftField("description", description);
  if (state.drawerDescriptionSaveTimer) {
    clearTimeout(state.drawerDescriptionSaveTimer);
  }
  state.drawerDescriptionSaveTimer = setTimeout(() => {
    if (!state.drawerDraft) return;
    const nextDescription = String(state.drawerDraft.description || "").trim();
    saveDrawerPatch({ description: nextDescription || "" });
  }, 500);
}

export function onDrawerDescriptionBlur() {
  if (!state.drawerDraft) return;
  if (state.drawerDescriptionSaveTimer) {
    clearTimeout(state.drawerDescriptionSaveTimer);
    state.drawerDescriptionSaveTimer = null;
  }
  const description = String(state.drawerDraft.description || "").trim();
  saveDrawerPatch({ description: description || "" });
}

export function onDrawerDescriptionKeydown(event) {
  if (!event) return;
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  onDrawerDescriptionBlur();
}

export function onDrawerNotesInput(event) {
  const notes = String(event?.target?.value || "");
  updateDrawerDraftField("notes", notes);
}

export function onDrawerNotesBlur() {
  if (!state.drawerDraft) return;
  const notes = String(state.drawerDraft.notes || "").trim();
  saveDrawerPatch({ notes: notes || null });
}

export function onDrawerNotesKeydown(event) {
  if (!event) return;
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  onDrawerNotesBlur();
}

export function onDrawerCategoryInput(event) {
  const category = String(event?.target?.value || "");
  updateDrawerDraftField("categoryDetail", category);
}

export function onDrawerCategoryBlur() {
  if (!state.drawerDraft) return;
  const normalizeProjectPath = hooks.normalizeProjectPath || ((v) => v);
  const normalized = normalizeProjectPath(
    String(state.drawerDraft.categoryDetail || ""),
  );
  updateDrawerDraftField("project", normalized || "");
  updateDrawerDraftField("categoryDetail", normalized || "");
  const patch = { category: normalized || null, projectId: null };
  if (normalized) {
    const projectRecord = hooks.getProjectRecordByName?.(normalized);
    if (projectRecord?.id) {
      patch.projectId = projectRecord.id;
    }
  }
  saveDrawerPatch(patch);
}

// ---------------------------------------------------------------------------
// Drawer content rendering
// ---------------------------------------------------------------------------

function renderDrawerSubtasks(todo) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  if (!Array.isArray(todo.subtasks) || todo.subtasks.length === 0) {
    return `<p class="todo-drawer__subtasks-empty">${illustrationSubtasksEmpty()}No subtasks</p>`;
  }
  return `
    <ul class="todo-drawer__subtasks-list">
      ${todo.subtasks
        .map((subtask) => {
          const title = escapeHtml(String(subtask?.title || ""));
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
}

// ---------------------------------------------------------------------------
// Agent action sections: Break Down + Follow Up
// ---------------------------------------------------------------------------

function renderBreakDownSection(todo) {
  // Don't show if the task already has subtasks — they're visible in Details.
  if (todo.subtasks && todo.subtasks.length > 0) return "";

  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const s = state.breakDownState;
  const isForThisTodo = s.todoId === todo.id;
  const helperHtml = `
    <p class="todo-drawer__agent-hint">
      Use this when a task feels vague or too big. We'll suggest smaller steps you can act on.
    </p>`;

  let bodyHtml;
  if (s.applying && isForThisTodo) {
    bodyHtml = `${helperHtml}<div class="todo-drawer__agent-loading">Adding subtasks…</div>`;
  } else if (s.loading && isForThisTodo) {
    bodyHtml = `${helperHtml}<div class="todo-drawer__agent-loading">Thinking…</div>`;
  } else if (s.error && isForThisTodo) {
    bodyHtml = `
      ${helperHtml}
      <div class="todo-drawer__agent-error">${escapeHtml(s.error)}</div>
      <button type="button" class="todo-drawer__agent-btn"
        data-break-down-action="generate">Try again</button>`;
  } else if (isForThisTodo && s.suggestions.length > 0) {
    const items = s.suggestions
      .map(
        (sub, i) => `
        <label class="todo-drawer__break-down-item">
          <input type="checkbox" data-break-down-index="${i}"
            ${s.checkedIndexes.has(i) ? "checked" : ""} />
          <span>${escapeHtml(sub.title)}</span>
        </label>`,
      )
      .join("");
    bodyHtml = `
      ${helperHtml}
      <div class="todo-drawer__break-down-list">${items}</div>
      <div class="todo-drawer__agent-actions">
        <button type="button" class="todo-drawer__agent-btn todo-drawer__agent-btn--primary"
          data-break-down-action="apply"
          ${s.checkedIndexes.size === 0 ? "disabled" : ""}>
          Add selected (${s.checkedIndexes.size})
        </button>
        <button type="button" class="todo-drawer__agent-btn"
          data-break-down-action="clear">Clear</button>
      </div>`;
  } else {
    bodyHtml = `
      ${helperHtml}
      <button type="button" class="todo-drawer__agent-btn"
        data-break-down-action="generate">Suggest subtasks</button>`;
  }

  return renderDrawerAccordionSection({
    toggleId: "drawerBreakDownToggle",
    panelId: "drawerBreakDownPanel",
    title: "Break down",
    expanded:
      isForThisTodo &&
      (s.loading || s.applying || s.suggestions.length > 0 || !!s.error),
    bodyHtml,
  });
}

function renderFollowUpSection(todo) {
  if (todo.status !== "waiting") return "";

  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const s = state.followUpState;
  const isForThisTodo = s.todoId === todo.id;

  let bodyHtml;
  if (isForThisTodo && s.applied) {
    bodyHtml = `<div class="todo-drawer__agent-success">Follow-up task created.</div>`;
  } else if (s.applying && isForThisTodo) {
    bodyHtml = `<div class="todo-drawer__agent-loading">Creating…</div>`;
  } else if (s.loading && isForThisTodo) {
    bodyHtml = `<div class="todo-drawer__agent-loading">Thinking…</div>`;
  } else if (s.error && isForThisTodo) {
    bodyHtml = `
      <div class="todo-drawer__agent-error">${escapeHtml(s.error)}</div>
      <button type="button" class="todo-drawer__agent-btn"
        data-follow-up-action="generate">Try again</button>`;
  } else if (isForThisTodo && s.suggestion) {
    bodyHtml = `
      <div class="todo-drawer__follow-up-preview">${escapeHtml(s.suggestion.title)}</div>
      <div class="todo-drawer__agent-actions">
        <button type="button" class="todo-drawer__agent-btn todo-drawer__agent-btn--primary"
          data-follow-up-action="apply">Create follow-up</button>
        <button type="button" class="todo-drawer__agent-btn"
          data-follow-up-action="clear">Dismiss</button>
      </div>`;
  } else {
    bodyHtml = `
      <button type="button" class="todo-drawer__agent-btn"
        data-follow-up-action="generate">Suggest follow-up</button>`;
  }

  return renderDrawerAccordionSection({
    toggleId: "drawerFollowUpToggle",
    panelId: "drawerFollowUpPanel",
    title: "Follow-up",
    expanded:
      isForThisTodo &&
      (s.loading || s.applying || !!s.suggestion || s.applied || !!s.error),
    bodyHtml,
  });
}

// ---------------------------------------------------------------------------
// Agent action handlers: Break Down + Follow Up
// ---------------------------------------------------------------------------

async function handleBreakDownAction(action, todoId) {
  if (action === "generate") {
    applyAsyncAction("breakDown/start", { todoId });
    renderTodoDrawerContent();
    try {
      const data = await callAgentAction("/agent/read/break_down_task", {
        taskId: todoId,
      });
      const suggestions = Array.isArray(data?.suggestedSubtasks)
        ? data.suggestedSubtasks
        : [];
      applyAsyncAction("breakDown/success", { todoId, suggestions });
    } catch (err) {
      applyAsyncAction("breakDown/failure", {
        todoId,
        error: err.message || "Could not suggest subtasks.",
      });
    }
    renderTodoDrawerContent();
  } else if (action === "clear") {
    applyAsyncAction("breakDown/reset", { todoId });
    renderTodoDrawerContent();
  } else if (action === "apply") {
    const s = state.breakDownState;
    const toAdd = s.suggestions.filter((_, i) => s.checkedIndexes.has(i));
    if (toAdd.length === 0) return;
    applyAsyncAction("breakDown/apply:start", { todoId });
    renderTodoDrawerContent();
    try {
      for (const sub of toAdd) {
        await callAgentAction("/agent/write/add_subtask", {
          taskId: todoId,
          title: sub.title,
        });
      }
      applyAsyncAction("breakDown/apply:complete", { todoId });
      // Reload todos so the new subtasks appear in the drawer Details section.
      if (typeof hooks.applyFiltersAndRender === "function") {
        hooks.applyFiltersAndRender();
      }
    } catch (err) {
      applyAsyncAction("breakDown/failure", {
        todoId,
        error: err.message || "Could not add subtasks.",
      });
    }
    renderTodoDrawerContent();
  }
}

async function handleFollowUpAction(action, todoId) {
  if (action === "generate") {
    applyAsyncAction("followUp/start", { todoId });
    renderTodoDrawerContent();
    try {
      const data = await callAgentAction(
        "/agent/write/create_follow_up_for_waiting_task",
        { taskId: todoId, mode: "suggest" },
      );
      applyAsyncAction("followUp/suggest:success", {
        todoId,
        suggestion: data?.suggestion || data?.task || null,
      });
    } catch (err) {
      applyAsyncAction("followUp/failure", {
        todoId,
        error: err.message || "Could not suggest follow-up.",
      });
    }
    renderTodoDrawerContent();
  } else if (action === "clear") {
    applyAsyncAction("followUp/reset", { todoId });
    renderTodoDrawerContent();
  } else if (action === "apply") {
    applyAsyncAction("followUp/apply:start", { todoId });
    renderTodoDrawerContent();
    try {
      await callAgentAction("/agent/write/create_follow_up_for_waiting_task", {
        taskId: todoId,
        mode: "apply",
      });
      applyAsyncAction("followUp/apply:complete", { todoId });
      if (typeof hooks.applyFiltersAndRender === "function") {
        hooks.applyFiltersAndRender();
      }
    } catch (err) {
      applyAsyncAction("followUp/failure", {
        todoId,
        error: err.message || "Could not create follow-up.",
      });
    }
    renderTodoDrawerContent();
  }
}

function buildDrawerProjectOptions(selectedProject = "") {
  const getAllProjects = hooks.getAllProjects || (() => []);
  const renderProjectOptionEntry =
    hooks.renderProjectOptionEntry ||
    ((p, sel) =>
      `<option value="${p}" ${p === sel ? "selected" : ""}>${p}</option>`);
  const projects = getAllProjects();
  return `<option value="">None</option>${projects
    .map((project) => renderProjectOptionEntry(project, selectedProject))
    .join("")}`;
}

export function renderTodoDrawerContent() {
  const refs = getTodoDrawerElements();
  if (!refs) return;

  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const { titleEl, contentEl } = refs;
  if (!state.selectedTodoId) {
    titleEl.textContent = "Task";
    contentEl.innerHTML = "";
    return;
  }

  const todo = state.todos.find((t) => t.id === state.selectedTodoId) || null;
  if (!todo) {
    state.drawerDraft = null;
    titleEl.textContent = "Task";
    contentEl.innerHTML = renderDrawerSection({
      title: "Unavailable",
      bodyHtml: "<p>This task is no longer available in the current view.</p>",
    });
    return;
  }

  // If the user is actively typing in a drawer text input or textarea, skip
  // replacing innerHTML — doing so would detach the focused element, fire a
  // premature blur with a stale draft value, and lose the in-progress edit.
  const activeEl = document.activeElement;
  if (
    activeEl instanceof HTMLElement &&
    contentEl.contains(activeEl) &&
    (activeEl instanceof HTMLTextAreaElement ||
      (activeEl instanceof HTMLInputElement &&
        activeEl.type !== "checkbox" &&
        activeEl.type !== "radio"))
  ) {
    getCurrentDrawerDraft(todo);
    return;
  }

  const draft = getCurrentDrawerDraft(todo);

  const descPreview = String(draft.description || "")
    .slice(0, 120)
    .replace(/\n/g, " ");

  titleEl.textContent = "Quick panel";
  // Slimmed drawer: triage fields only. Full editing is on the task page.
  contentEl.innerHTML = `
    ${renderDrawerSection({
      title: "Triage",
      bodyHtml: `
      <div class="todo-drawer__top-actions">
        <button type="button" class="mini-btn todo-drawer__full-task-btn" data-onclick="openTaskPageFromDrawer('${escapeHtml(todo.id)}')">Open full task</button>
      </div>
      <div class="todo-drawer__save-status" id="drawerSaveStatus" data-state="${escapeHtml(state.drawerSaveState)}">Ready</div>
      <label class="todo-drawer__field" for="drawerTitleInput">
        <span>Title</span>
        <input
          id="drawerTitleInput"
          type="text"
          maxlength="200"
          value="${escapeHtml(draft.title)}"
        />
      </label>
      <label class="todo-drawer__field todo-drawer__field--inline" for="drawerCompletedToggle">
        <span>Completed</span>
        <input id="drawerCompletedToggle" type="checkbox" ${draft.completed ? "checked" : ""} />
      </label>
      <label class="todo-drawer__field" for="drawerStatusSelect">
        <span>Status</span>
        <select id="drawerStatusSelect">
          <option value="inbox" ${draft.status === "inbox" ? "selected" : ""} title="Captured, not yet organized">Inbox</option>
          <option value="next" ${draft.status === "next" ? "selected" : ""} title="Ready to work on soon">Up Next</option>
          <option value="in_progress" ${draft.status === "in_progress" ? "selected" : ""}>In progress</option>
          <option value="waiting" ${draft.status === "waiting" ? "selected" : ""}>Waiting</option>
          <option value="scheduled" ${draft.status === "scheduled" ? "selected" : ""}>Scheduled</option>
          <option value="someday" ${draft.status === "someday" ? "selected" : ""}>Someday</option>
          ${draft.status === "done" ? `<option value="done" selected>Done</option>` : ""}
          ${draft.status === "cancelled" ? `<option value="cancelled" selected>Cancelled</option>` : ""}
        </select>
      </label>
      <label class="todo-drawer__field" for="drawerDueDateInput">
        <span>Due date</span>
        <input id="drawerDueDateInput" type="date" value="${escapeHtml(draft.dueDate)}" />
      </label>
      <label class="todo-drawer__field" for="drawerProjectSelect">
        <span>Project</span>
        <select id="drawerProjectSelect">
          ${buildDrawerProjectOptions(draft.project)}
        </select>
      </label>
      <label class="todo-drawer__field" for="drawerPrioritySelect">
        <span>Priority</span>
        <select id="drawerPrioritySelect">
          <option value="low" ${draft.priority === "low" ? "selected" : ""}>Low</option>
          <option value="medium" ${draft.priority === "medium" ? "selected" : ""}>Medium</option>
          <option value="high" ${draft.priority === "high" ? "selected" : ""}>High</option>
          <option value="urgent" ${draft.priority === "urgent" ? "selected" : ""}>Urgent</option>
        </select>
      </label>
      <label class="todo-drawer__field" for="drawerEffortSelect">
        <span>Effort</span>
        <select id="drawerEffortSelect">
          <option value="" ${!draft.effortScore ? "selected" : ""}>None</option>
          <option value="1" ${draft.effortScore === "1" ? "selected" : ""}>Tiny</option>
          <option value="2" ${draft.effortScore === "2" ? "selected" : ""}>Small</option>
          <option value="3" ${draft.effortScore === "3" ? "selected" : ""}>Medium</option>
          <option value="4" ${draft.effortScore === "4" ? "selected" : ""}>Deep</option>
        </select>
      </label>
      <label class="todo-drawer__field" for="drawerEnergySelect">
        <span>Energy</span>
        <select id="drawerEnergySelect">
          <option value="" ${!draft.energy ? "selected" : ""}>None</option>
          <option value="low" ${draft.energy === "low" ? "selected" : ""}>Low</option>
          <option value="medium" ${draft.energy === "medium" ? "selected" : ""}>Medium</option>
          <option value="high" ${draft.energy === "high" ? "selected" : ""}>High</option>
        </select>
      </label>
      <div class="todo-drawer__desc-preview">
        <span class="todo-drawer__desc-preview-text">${escapeHtml(descPreview)}</span>
        <button type="button" class="mini-link" data-onclick="openTaskPageFromDrawer('${escapeHtml(todo.id)}')">Edit in full task</button>
      </div>
    `,
    })}
  `;
  setDrawerSaveState(state.drawerSaveState, state.drawerSaveMessage);

  // Mount the task dependency picker into the placeholder div
  if (activeDepPicker) {
    activeDepPicker.destroy();
    activeDepPicker = null;
  }
  const pickerRoot = contentEl.querySelector("#drawerDependsOnPicker");
  if (pickerRoot && draft) {
    const initialIds = parseCommaSeparatedList(draft.dependsOnTaskIdsText);
    activeDepPicker = mountTaskPicker(pickerRoot, {
      selectedIds: initialIds,
      getTodos: () => state.todos,
      excludeId: draft.id,
      escapeHtml: escapeHtml,
      onChange(ids) {
        updateDrawerDraftField("dependsOnTaskIdsText", ids.join(", "));
        saveDrawerPatch({ dependsOnTaskIds: ids });
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Drawer AI: fetch / generate / load
// ---------------------------------------------------------------------------

async function fetchTaskDrawerLatestSuggestion(todoId) {
  const API_URL = hooks.API_URL || "";
  const apiCall = hooks.apiCall;
  const response = await apiCall(
    `${API_URL}/ai/suggestions/latest?todoId=${encodeURIComponent(todoId)}&surface=task_drawer`,
  );
  return response;
}

async function generateTaskDrawerSuggestion(todo) {
  const API_URL = hooks.API_URL || "";
  const apiCall = hooks.apiCall;
  return apiCall(`${API_URL}/ai/decision-assist/stub`, {
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

export async function loadTaskDrawerDecisionAssist(
  todoId,
  allowGenerate = true,
) {
  if (!state.isTodoDrawerOpen || state.selectedTodoId !== todoId) return;
  const todo = state.todos.find((t) => t.id === todoId) || null;
  if (!todo) return;
  const FEATURE_TASK_DRAWER_DECISION_ASSIST =
    hooks.FEATURE_TASK_DRAWER_DECISION_ASSIST || false;
  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    applyAsyncAction("taskDrawerAssist/unavailable");
    renderTodoDrawerContent();
    return;
  }

  await runAsyncLifecycle({
    start: () => {
      applyAsyncAction("taskDrawerAssist/start", { todoId });
      renderTodoDrawerContent();
    },
    run: async () => {
      let latestResponse = await fetchTaskDrawerLatestSuggestion(todoId);
      if (latestResponse.status === 403 || latestResponse.status === 404) {
        return { outcome: "unavailable" };
      }

      if (latestResponse.status === 204) {
        if (isTaskDrawerDismissed(todoId) || !allowGenerate) {
          return { outcome: "abstain" };
        }
        const generated = await generateTaskDrawerSuggestion(todo);
        if (generated.status === 403 || generated.status === 404) {
          return { outcome: "unavailable" };
        }
        latestResponse = await fetchTaskDrawerLatestSuggestion(todoId);
        if (latestResponse.status === 204) {
          return { outcome: "abstain" };
        }
      }

      if (!latestResponse.ok) {
        return { outcome: "failure" };
      }

      const payload = await latestResponse.json();
      const envelope = payload?.outputEnvelope || {};
      return {
        outcome: "success",
        payload: {
          aiSuggestionId: String(payload?.aiSuggestionId || ""),
          mustAbstain: !!envelope.must_abstain,
          contractVersion: envelope.contractVersion,
          requestId: envelope.requestId,
          generatedAt: envelope.generatedAt,
          suggestions: normalizeTaskDrawerAssistEnvelope(
            String(payload?.aiSuggestionId || ""),
            envelope,
            todoId,
          ),
        },
      };
    },
    success: (result) => {
      if (!state.isTodoDrawerOpen || state.selectedTodoId !== todoId) return;
      if (result?.outcome === "unavailable") {
        applyAsyncAction("taskDrawerAssist/unavailable");
      } else if (result?.outcome === "abstain") {
        applyAsyncAction("taskDrawerAssist/abstain");
      } else if (result?.outcome === "failure") {
        applyAsyncAction("taskDrawerAssist/failure");
      } else if (result?.outcome === "success") {
        applyAsyncAction("taskDrawerAssist/success", result.payload);
      }
      renderTodoDrawerContent();
    },
    failure: (error) => {
      console.error("Task drawer AI load failed:", error);
      if (!state.isTodoDrawerOpen || state.selectedTodoId !== todoId) return;
      applyAsyncAction("taskDrawerAssist/failure");
      renderTodoDrawerContent();
    },
  });
}

export async function applyTaskDrawerSuggestion(
  suggestionId,
  confirmed = false,
) {
  if (!state.selectedTodoId) return;
  const suggestion = state.taskDrawerAssistState.suggestions.find(
    (item) => item.suggestionId === suggestionId,
  );
  if (!suggestion || !state.taskDrawerAssistState.aiSuggestionId) return;

  const needsConfirmation = hooks.needsConfirmation || (() => false);
  if (needsConfirmation(suggestion) && !confirmed) {
    state.taskDrawerAssistState.confirmSuggestionId = suggestionId;
    renderTodoDrawerContent();
    return;
  }

  const snapshotTodo =
    state.todos.find((t) => t.id === state.selectedTodoId) || null;
  if (snapshotTodo) {
    state.taskDrawerAssistState.undoBySuggestionId[suggestionId] = JSON.parse(
      JSON.stringify(snapshotTodo),
    );
  }

  state.taskDrawerAssistState.applyingSuggestionId = suggestionId;
  state.taskDrawerAssistState.confirmSuggestionId = "";
  renderTodoDrawerContent();

  const API_URL = hooks.API_URL || "";
  const apiCall = hooks.apiCall;

  try {
    const response = await apiCall(
      `${API_URL}/ai/suggestions/${encodeURIComponent(state.taskDrawerAssistState.aiSuggestionId)}/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, confirmed: confirmed === true }),
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      state.taskDrawerAssistState.error =
        typeof data?.error === "string"
          ? data.error
          : "Could not apply suggestion.";
      state.taskDrawerAssistState.applyingSuggestionId = "";
      renderTodoDrawerContent();
      return;
    }

    const result = await response.json();
    if (result?.todo?.id) {
      const index = state.todos.findIndex((item) => item.id === result.todo.id);
      if (index >= 0) {
        state.todos[index] = result.todo;
      }
    } else {
      await hooks.loadTodos?.();
    }
    clearTaskDrawerDismissed(state.selectedTodoId);
    state.taskDrawerAssistState.lastUndoSuggestionId = "";
    await loadTaskDrawerDecisionAssist(state.selectedTodoId, false);
    EventBus.dispatch(TODOS_CHANGED, { reason: TODO_UPDATED });
  } catch (error) {
    console.error("Task drawer AI apply failed:", error);
    state.taskDrawerAssistState.error = "Could not apply suggestion.";
    state.taskDrawerAssistState.applyingSuggestionId = "";
    renderTodoDrawerContent();
  }
}

export async function dismissTaskDrawerSuggestions(suggestionId) {
  const API_URL = hooks.API_URL || "";
  const apiCall = hooks.apiCall;
  if (!state.taskDrawerAssistState.aiSuggestionId) return;
  try {
    await apiCall(
      `${API_URL}/ai/suggestions/${encodeURIComponent(state.taskDrawerAssistState.aiSuggestionId)}/dismiss`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, dismissAll: true }),
      },
    );
  } catch (error) {
    console.error("Task drawer AI dismiss failed:", error);
  }
  state.taskDrawerAssistState.suggestions = [];
  state.taskDrawerAssistState.mustAbstain = true;
  state.taskDrawerAssistState.confirmSuggestionId = "";
  state.taskDrawerAssistState.applyingSuggestionId = "";
  if (state.selectedTodoId) {
    markTaskDrawerDismissed(state.selectedTodoId);
  }
  renderTodoDrawerContent();
}

export function undoTaskDrawerSuggestion(suggestionId) {
  const snapshot = state.taskDrawerAssistState.undoBySuggestionId[suggestionId];
  if (!snapshot || !state.selectedTodoId) return;
  const index = state.todos.findIndex(
    (item) => item.id === state.selectedTodoId,
  );
  if (index < 0) return;
  state.todos[index] = snapshot;
  initializeDrawerDraft(state.todos[index]);
  delete state.taskDrawerAssistState.undoBySuggestionId[suggestionId];
  state.taskDrawerAssistState.lastUndoSuggestionId = suggestionId;
  if (hooks.emitAiSuggestionUndoTelemetry) {
    hooks.emitAiSuggestionUndoTelemetry({
      surface: "task_drawer",
      aiSuggestionDbId: state.taskDrawerAssistState.aiSuggestionId,
      suggestionId,
      todoId: state.selectedTodoId,
      selectedTodoIdsCount: 1,
    });
  }
  EventBus.dispatch(TODOS_CHANGED, { reason: UNDO_APPLIED });
  syncTodoDrawerStateWithRender();
}

// ---------------------------------------------------------------------------
// Open / close / sync drawer
// ---------------------------------------------------------------------------

export function openTodoDrawer(todoId, triggerEl) {
  const refs = getTodoDrawerElements();
  if (!refs) return;
  const todo = state.todos.find((t) => t.id === todoId) || null;
  if (!todo) return;

  if (state.isRailSheetOpen) {
    hooks.closeProjectsRailSheet?.({ restoreFocus: false });
  }

  if (!state.drawerDraft || state.drawerDraft.id !== todoId) {
    initializeDrawerDraft(todo);
  }
  resetTaskDrawerAssistState(todoId);
  state.drawerSaveSequence = 0;
  setDrawerSaveState("idle");
  applyUiAction("todoDrawer/open", { todoId, triggerEl });

  const { drawer, backdrop } = refs;
  drawer.classList.add("todo-drawer--open");
  drawer.setAttribute("aria-hidden", "false");
  if (backdrop instanceof HTMLElement) {
    backdrop.classList.add("todo-drawer-backdrop--open");
    backdrop.setAttribute("aria-hidden", "false");
  }
  lockBodyScrollForDrawer();
  hooks.DialogManager?.open("todoDrawer", drawer, {
    onEscape: () => {
      if (state.taskDrawerAssistState.confirmSuggestionId) {
        state.taskDrawerAssistState.confirmSuggestionId = "";
        renderTodoDrawerContent();
        return;
      }
      if (state.openTodoKebabId) {
        closeTodoKebabMenu({ restoreFocus: true });
        return;
      }
      closeTodoDrawer({ restoreFocus: true });
    },
  });

  renderTodoDrawerContent();
  patchTodoKebabState();
  patchSelectedTodoRowActiveState();
  const titleInput = document.getElementById("drawerTitleInput");
  if (titleInput instanceof HTMLElement) {
    titleInput.focus();
  } else {
    refs.closeBtn.focus();
  }
  if (hooks.AI_DEBUG_ENABLED) {
    loadTaskDrawerDecisionAssist(todoId);
  }
}

export function closeTodoDrawer({ restoreFocus = true } = {}) {
  const refs = getTodoDrawerElements();
  const focusTrigger = state.lastFocusedTodoTrigger;
  const focusTodoId = state.lastFocusedTodoId;

  applyUiAction("todoDrawer/close");
  state.drawerDraft = null;
  resetTaskDrawerAssistState();
  state.drawerSaveSequence = 0;
  if (state.drawerSaveResetTimer) {
    clearTimeout(state.drawerSaveResetTimer);
    state.drawerSaveResetTimer = null;
  }
  if (state.drawerDescriptionSaveTimer) {
    clearTimeout(state.drawerDescriptionSaveTimer);
    state.drawerDescriptionSaveTimer = null;
  }
  setDrawerSaveState("idle");

  if (refs) {
    const { drawer, backdrop } = refs;
    drawer.classList.remove("todo-drawer--open");
    drawer.setAttribute("aria-hidden", "true");
    if (backdrop instanceof HTMLElement) {
      backdrop.classList.remove("todo-drawer-backdrop--open");
      backdrop.setAttribute("aria-hidden", "true");
    }
    hooks.DialogManager?.close("todoDrawer");
    renderTodoDrawerContent();
  }
  patchTodoKebabState();
  patchSelectedTodoRowActiveState();
  unlockBodyScrollForDrawer();

  if (!restoreFocus) return;

  const focusFallbackRow = () => {
    if (!focusTodoId) return false;
    const fallback = document.querySelector(
      `.todo-item[data-todo-id="${escapeSelectorValue(focusTodoId)}"]`,
    );
    if (!(fallback instanceof HTMLElement)) return false;
    fallback.focus({ preventScroll: true });
    return true;
  };

  window.requestAnimationFrame(() => {
    if (focusTrigger instanceof HTMLElement && focusTrigger.isConnected) {
      focusTrigger.focus({ preventScroll: true });
      if (document.activeElement === focusTrigger) {
        return;
      }
    }
    focusFallbackRow();
  });
}

export function syncTodoDrawerStateWithRender() {
  const refs = getTodoDrawerElements();
  if (!refs) return;

  if (!state.isTodoDrawerOpen || !state.selectedTodoId) {
    refs.drawer.classList.remove("todo-drawer--open");
    refs.drawer.setAttribute("aria-hidden", "true");
    if (refs.backdrop instanceof HTMLElement) {
      refs.backdrop.classList.remove("todo-drawer-backdrop--open");
      refs.backdrop.setAttribute("aria-hidden", "true");
    }
    return;
  }

  refs.drawer.classList.add("todo-drawer--open");
  refs.drawer.setAttribute("aria-hidden", "false");
  if (refs.backdrop instanceof HTMLElement) {
    refs.backdrop.classList.add("todo-drawer-backdrop--open");
    refs.backdrop.setAttribute("aria-hidden", "false");
  }
  renderTodoDrawerContent();
}

export function toggleDrawerDetailsPanel() {
  if (!state.isTodoDrawerOpen || !state.selectedTodoId) return;
  applyUiAction("todoDrawer/details:set", {
    isOpen: !state.isDrawerDetailsOpen,
  });
  renderTodoDrawerContent();
}

export async function deleteTodoFromDrawer() {
  if (!state.selectedTodoId) return;
  // Confirmation dialog is inside hooks.deleteTodo() — no double prompt
  const deletedTodoId = state.selectedTodoId;
  const deleted = await hooks.deleteTodo(deletedTodoId);
  if (!deleted) return;

  closeTodoDrawer({ restoreFocus: false });
  window.requestAnimationFrame(() => {
    const nextRow = document.querySelector(".todo-item");
    if (nextRow instanceof HTMLElement) {
      nextRow.focus();
      return;
    }
    const listContainer = document.getElementById("todosContent");
    if (listContainer instanceof HTMLElement) {
      if (!listContainer.hasAttribute("tabindex")) {
        listContainer.setAttribute("tabindex", "-1");
      }
      listContainer.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Kebab menu
// ---------------------------------------------------------------------------

export function getKebabTriggerForTodo(todoId) {
  const selector = `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"] .todo-kebab`;
  const trigger = document.querySelector(selector);
  return trigger instanceof HTMLElement ? trigger : null;
}

export function closeTodoKebabMenu({ restoreFocus = false } = {}) {
  const activeTodoId = state.openTodoKebabId;
  applyUiAction("todoKebab:set", { todoId: null });
  patchTodoKebabState();

  if (!restoreFocus || !activeTodoId) return;
  window.requestAnimationFrame(() => {
    const trigger = getKebabTriggerForTodo(activeTodoId);
    trigger?.focus();
  });
}

export function toggleTodoKebab(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const shouldOpen = state.openTodoKebabId !== todoId;
  applyUiAction("todoKebab:set", {
    todoId: shouldOpen ? todoId : null,
  });
  patchTodoKebabState();

  if (!shouldOpen) return;
  window.requestAnimationFrame(() => {
    const firstAction = document.querySelector(
      `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"] .todo-kebab-menu .todo-kebab-item`,
    );
    if (firstAction instanceof HTMLElement) {
      firstAction.focus();
    }
  });
}

export function openTodoFromKebab(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  applyUiAction("todoKebab:set", { todoId: null });
  const row = document.querySelector(
    `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"]`,
  );
  openTodoDrawer(todoId, row instanceof HTMLElement ? row : null);
}

export function openEditTodoFromKebab(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  applyUiAction("todoKebab:set", { todoId: null });
  patchTodoKebabState();
  hooks.openEditTodoModal?.(todoId);
}

export function openDrawerDangerZone(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  applyUiAction("todoKebab:set", { todoId: null });
  const row = document.querySelector(
    `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"]`,
  );
  if (!state.isTodoDrawerOpen || state.selectedTodoId !== todoId) {
    openTodoDrawer(todoId, row instanceof HTMLElement ? row : null);
  }
  applyUiAction("todoDrawer/details:set", { isOpen: true });
  renderTodoDrawerContent();
  window.requestAnimationFrame(() => {
    const deleteBtn = document.getElementById("drawerDeleteTodoButton");
    if (deleteBtn instanceof HTMLElement) {
      deleteBtn.focus();
      return;
    }
    const detailsToggle = document.getElementById("drawerDetailsToggle");
    if (detailsToggle instanceof HTMLElement) {
      detailsToggle.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Todo drawer handler binding (called once by app.js)
// ---------------------------------------------------------------------------

function shouldIgnoreTodoDrawerOpen(target) {
  if (!(target instanceof Element)) return true;
  return !!target.closest(
    "input, button, select, textarea, a, label, [data-onclick], [data-onchange], .drag-handle, .todo-inline-actions, .subtasks-section, .todo-kebab, .todo-kebab-menu",
  );
}

export function bindTodoDrawerHandlers() {
  if (window.__todoDrawerHandlersBound) {
    return;
  }
  window.__todoDrawerHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (
      state.openTodoKebabId &&
      !target.closest(".todo-kebab") &&
      !target.closest(".todo-kebab-menu")
    ) {
      closeTodoKebabMenu();
      return;
    }

    const closeBtn = target.closest("#todoDrawerClose");
    if (closeBtn) {
      closeTodoDrawer({ restoreFocus: true });
      return;
    }

    const backdrop = target.closest("#todoDrawerBackdrop");
    if (backdrop) {
      closeTodoDrawer({ restoreFocus: true });
      return;
    }

    const detailsToggle = target.closest("#drawerDetailsToggle");
    if (detailsToggle) {
      toggleDrawerDetailsPanel();
      return;
    }

    const breakDownEl = target.closest("[data-break-down-action]");
    if (breakDownEl instanceof HTMLElement && state.selectedTodoId) {
      handleBreakDownAction(
        breakDownEl.getAttribute("data-break-down-action"),
        state.selectedTodoId,
      );
      return;
    }

    const followUpEl = target.closest("[data-follow-up-action]");
    if (followUpEl instanceof HTMLElement && state.selectedTodoId) {
      handleFollowUpAction(
        followUpEl.getAttribute("data-follow-up-action"),
        state.selectedTodoId,
      );
      return;
    }

    const drawerDeleteBtn = target.closest("#drawerDeleteTodoButton");
    if (drawerDeleteBtn) {
      deleteTodoFromDrawer();
      return;
    }

    if (target.closest("#todoDetailsDrawer")) {
      const drawerLintEl = target.closest("[data-ai-lint-action]");
      if (drawerLintEl instanceof HTMLElement) {
        const lintAction = drawerLintEl.getAttribute("data-ai-lint-action");
        state.taskDrawerAssistState.showFullAssist = true;
        renderTodoDrawerContent();
        if (state.selectedTodoId) {
          loadTaskDrawerDecisionAssist(
            state.selectedTodoId,
            lintAction === "fix",
          );
        }
        return;
      }
    }

    const drawerAiAction = target.closest("[data-drawer-ai-action]");
    if (drawerAiAction instanceof HTMLElement) {
      const action = drawerAiAction.getAttribute("data-drawer-ai-action");
      const suggestionId =
        drawerAiAction.getAttribute("data-drawer-ai-suggestion-id") || "";
      if (action === "apply") {
        applyTaskDrawerSuggestion(suggestionId, false);
      } else if (action === "confirm-apply") {
        applyTaskDrawerSuggestion(suggestionId, true);
      } else if (action === "cancel-confirm") {
        state.taskDrawerAssistState.confirmSuggestionId = "";
        renderTodoDrawerContent();
      } else if (action === "dismiss") {
        dismissTaskDrawerSuggestions(suggestionId);
      } else if (action === "undo") {
        undoTaskDrawerSuggestion(suggestionId);
      }
      return;
    }

    const row = target.closest(".todo-item");
    if (!(row instanceof HTMLElement)) return;
    if (shouldIgnoreTodoDrawerOpen(target)) return;

    const todoId = row.dataset.todoId;
    if (!todoId) return;
    window.openTodoFromRow?.(todoId);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "drawerTitleInput") {
      onDrawerTitleInput(event);
      return;
    }
    if (target.id === "drawerDescriptionTextarea") {
      onDrawerDescriptionInput(event);
      return;
    }
    if (target.id === "drawerNotesTextarea") {
      onDrawerNotesInput(event);
      return;
    }
    if (target.id === "drawerContextInput") {
      onDrawerContextInput(event);
      return;
    }
    if (target.id === "drawerFirstStepInput") {
      onDrawerFirstStepInput(event);
      return;
    }
    if (target.id === "drawerWaitingOnInput") {
      onDrawerWaitingOnInput(event);
      return;
    }
    if (target.id === "drawerTagsInput") {
      onDrawerTagsInput(event);
      return;
    }
    // drawerDependsOnInput replaced by task picker — no delegated handler
    if (target.id === "drawerCategoryInput") {
      onDrawerCategoryInput(event);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "drawerCompletedToggle") {
      onDrawerCompletedChange(event);
      return;
    }
    if (target.id === "drawerDueDateInput") {
      onDrawerDueDateChange(event);
      return;
    }
    if (target.id === "drawerStartDateInput") {
      onDrawerStartDateChange(event);
      return;
    }
    if (target.id === "drawerScheduledDateInput") {
      onDrawerScheduledDateChange(event);
      return;
    }
    if (target.id === "drawerReviewDateInput") {
      onDrawerReviewDateChange(event);
      return;
    }
    if (target.id === "drawerRecurrenceType") {
      onDrawerRecurrenceTypeChange(event);
      return;
    }
    if (target.id === "drawerRecurrenceInterval") {
      onDrawerRecurrenceIntervalChange(event);
      return;
    }
    if (target.id === "drawerProjectSelect") {
      onDrawerProjectChange(event);
      return;
    }
    if (target.id === "drawerStatusSelect") {
      onDrawerStatusChange(event);
      return;
    }
    if (target.id === "drawerPrioritySelect") {
      onDrawerPriorityChange(event);
      return;
    }
    if (target.id === "drawerEffortSelect") {
      onDrawerEffortChange(event);
      return;
    }
    if (target.id === "drawerEnergySelect") {
      onDrawerEnergyChange(event);
      return;
    }
    if (target.id === "drawerEmotionalStateSelect") {
      onDrawerEmotionalStateChange(event);
      return;
    }
    if (target.id === "drawerEstimateInput") {
      onDrawerEstimateChange(event);
      return;
    }
    if (target.id === "drawerArchivedToggle") {
      onDrawerArchivedChange(event);
      return;
    }
    if (target.id === "drawerDescriptionTextarea") {
      onDrawerDescriptionBlur();
      return;
    }
    if (target.hasAttribute("data-break-down-index")) {
      const idx = parseInt(target.getAttribute("data-break-down-index"), 10);
      if (!isNaN(idx)) {
        applyAsyncAction("breakDown/toggle:checked", {
          index: idx,
          checked: target.checked,
        });
        renderTodoDrawerContent();
      }
      return;
    }
  });

  document.addEventListener(
    "blur",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === "drawerTitleInput") {
        onDrawerTitleBlur();
        return;
      }
      if (target.id === "drawerDescriptionTextarea") {
        onDrawerDescriptionBlur();
        return;
      }
      if (target.id === "drawerNotesTextarea") {
        onDrawerNotesBlur();
        return;
      }
      if (target.id === "drawerContextInput") {
        onDrawerContextBlur();
        return;
      }
      if (target.id === "drawerFirstStepInput") {
        onDrawerFirstStepBlur();
        return;
      }
      if (target.id === "drawerWaitingOnInput") {
        onDrawerWaitingOnBlur();
        return;
      }
      if (target.id === "drawerTagsInput") {
        onDrawerTagsBlur();
        return;
      }
      // drawerDependsOnInput replaced by task picker — no delegated handler
      if (target.id === "drawerCategoryInput") {
        onDrawerCategoryBlur();
      }
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.id === "drawerDescriptionTextarea"
    ) {
      onDrawerDescriptionKeydown(event);
      return;
    }
    if (target instanceof HTMLElement && target.id === "drawerNotesTextarea") {
      onDrawerNotesKeydown(event);
      return;
    }
    if (target instanceof HTMLElement && target.id === "drawerTitleInput") {
      onDrawerTitleKeydown(event);
      return;
    }

    if (
      event.key === "Escape" &&
      state.taskDrawerAssistState.confirmSuggestionId
    ) {
      const active = event.target;
      if (active instanceof Element && active.closest("#todoDetailsDrawer")) {
        state.taskDrawerAssistState.confirmSuggestionId = "";
        renderTodoDrawerContent();
        event.preventDefault();
        return;
      }
    }

    if (event.key !== "Enter") return;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("todo-item")) return;
    if (target.closest("#todoDetailsDrawer")) return;

    const todoId = target.dataset.todoId;
    if (!todoId) return;
    event.preventDefault();
    window.openInlineTaskEditor?.(todoId);
  });
}
