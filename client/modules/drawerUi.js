// =============================================================================
// drawerUi.js — Todo drawer UI: open/close, draft management, AI assist,
// kebab menu, drawer event bindings.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";
import { STORAGE_KEYS } from "../utils/storageKeys.js";
import {
  hasTodoRow,
  patchHeaderCountsFromVisibleTodos,
  patchProjectsRailCounts,
  patchSelectedTodoRowActiveState,
  patchTodoCompleted,
  patchTodoContentMetadata,
  patchTodoKebabState,
  patchVisibleCategoryGroupStats,
} from "./todosViewPatches.js";

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
  const { createInitialTaskDrawerAssistState } = hooks;
  state.taskDrawerAssistState = createInitialTaskDrawerAssistState
    ? { ...createInitialTaskDrawerAssistState(), todoId }
    : {
        todoId,
        loading: false,
        unavailable: false,
        error: "",
        aiSuggestionId: "",
        mustAbstain: false,
        suggestions: [],
        applyingSuggestionId: "",
        confirmSuggestionId: "",
        undoBySuggestionId: {},
        lastUndoSuggestionId: "",
        showFullAssist: false,
      };
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
      return `
        <div class="todo-drawer__section">
          <div class="todo-drawer__section-title">AI Suggestions</div>
          ${hooks.renderLintChip ? hooks.renderLintChip(issue) : ""}
        </div>
      `;
    }
    return "";
  }

  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    return `
      <div class="todo-drawer__section">
        <div class="todo-drawer__section-title">AI Suggestions</div>
        <div class="ai-empty" role="status">AI Suggestions unavailable.</div>
      </div>
    `;
  }

  const aiDebugMeta = hooks.renderAiDebugMeta
    ? hooks.renderAiDebugMeta({
        requestId: assistState.requestId,
        generatedAt: assistState.generatedAt,
        contractVersion: assistState.contractVersion,
      })
    : "";

  const base = `
    <div class="todo-drawer__section">
      <div class="todo-drawer__section-title">AI Suggestions</div>
      ${aiDebugMeta}
      ${assistState.loading ? '<div class="ai-empty" role="status">Loading suggestions...</div>' : ""}
      ${assistState.unavailable ? '<div class="ai-empty" role="status">AI Suggestions unavailable.</div>' : ""}
      ${assistState.error ? `<div class="ai-empty" role="status">${escapeHtml(assistState.error)}</div>` : ""}
      ${
        !assistState.loading &&
        !assistState.unavailable &&
        !assistState.error &&
        (assistState.mustAbstain || assistState.suggestions.length === 0)
          ? '<div class="ai-empty" role="status">No suggestions right now.</div>'
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
    </div>
  `;

  window.requestAnimationFrame(() => {
    const confirmButton = document.querySelector(
      `[data-drawer-ai-action="confirm-apply"][data-drawer-ai-suggestion-id="${escapeSelectorValue(assistState.confirmSuggestionId || "")}"]`,
    );
    if (confirmButton instanceof HTMLElement) {
      confirmButton.focus({ preventScroll: true });
    }
  });

  return base;
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
  state.drawerDraft = {
    id: todo.id,
    title: String(todo.title || ""),
    completed: !!todo.completed,
    dueDate: toDateInputValue(todo.dueDate),
    project: String(todo.category || ""),
    priority: String(todo.priority || "medium"),
    description: String(todo.description || ""),
    notes: String(todo.notes || ""),
    categoryDetail: String(todo.category || ""),
  };
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
    initializeDrawerDraft(updatedTodo);
    setDrawerSaveState("saved");
    const patchKeys = Object.keys(patch);
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
      if (patchKeys.includes("completed")) {
        patchTodoCompleted(updatedTodo.id, updatedTodo.completed);
        patchVisibleCategoryGroupStats();
        patchProjectsRailCounts();
        patchHeaderCountsFromVisibleTodos();
      }
      patchTodoContentMetadata(updatedTodo.id, updatedTodo);
    } else {
      EventBus.dispatch("todos:changed", { reason: "todo-updated" });
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

export function onDrawerProjectChange(event) {
  const normalizeProjectPath = hooks.normalizeProjectPath || ((v) => v);
  const project = normalizeProjectPath(String(event?.target?.value || ""));
  updateDrawerDraftField("project", project || "");
  saveDrawerPatch({ category: project || null });
}

export function onDrawerPriorityChange(event) {
  const priority = String(event?.target?.value || "medium");
  updateDrawerDraftField("priority", priority);
  saveDrawerPatch({ priority });
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
  saveDrawerPatch({ category: normalized || null });
}

// ---------------------------------------------------------------------------
// Drawer content rendering
// ---------------------------------------------------------------------------

function renderDrawerSubtasks(todo) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  if (!Array.isArray(todo.subtasks) || todo.subtasks.length === 0) {
    return '<p class="todo-drawer__subtasks-empty">No subtasks</p>';
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
    contentEl.innerHTML = `
      <div class="todo-drawer__section">
        <div class="todo-drawer__section-title">Unavailable</div>
        <p>This task is no longer available in the current view.</p>
      </div>
    `;
    return;
  }

  const draft = getCurrentDrawerDraft(todo);
  const detailsExpanded = state.isDrawerDetailsOpen;
  const detailsToggleLabel = detailsExpanded ? "Hide details" : "Show details";
  const detailsPanelHidden = detailsExpanded ? "" : "hidden";

  titleEl.textContent = "Task";
  contentEl.innerHTML = `
    <div class="todo-drawer__section">
      <div class="todo-drawer__section-title">Essentials</div>
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
        </select>
      </label>
    </div>
    ${renderTaskDrawerAssistSection(todo.id)}
    <div class="todo-drawer__section">
      <button
        id="drawerDetailsToggle"
        type="button"
        class="todo-drawer__accordion-toggle"
        aria-expanded="${detailsExpanded ? "true" : "false"}"
        aria-controls="drawerDetailsPanel"
      >
        <span>Details</span>
        <span class="todo-drawer__accordion-chevron" aria-hidden="true">${detailsExpanded ? "▾" : "▸"}</span>
      </button>
      <div
        id="drawerDetailsPanel"
        class="todo-drawer__accordion-panel ${detailsExpanded ? "todo-drawer__accordion-panel--open" : ""}"
        aria-hidden="${detailsExpanded ? "false" : "true"}"
        ${detailsPanelHidden}
      >
        <label class="todo-drawer__field" for="drawerDescriptionTextarea">
          <span>Description</span>
          <textarea id="drawerDescriptionTextarea" maxlength="1000">${escapeHtml(draft.description)}</textarea>
        </label>
        <label class="todo-drawer__field" for="drawerNotesTextarea">
          <span>Notes</span>
          <textarea id="drawerNotesTextarea" maxlength="2000">${escapeHtml(draft.notes)}</textarea>
        </label>
        <label class="todo-drawer__field" for="drawerCategoryInput">
          <span>Category</span>
          <input id="drawerCategoryInput" type="text" maxlength="50" value="${escapeHtml(draft.categoryDetail)}" />
        </label>
        <div class="todo-drawer__subtasks">
          <div class="todo-drawer__subtasks-title">Subtasks</div>
          ${renderDrawerSubtasks(todo)}
        </div>
      </div>
    </div>
    <div class="todo-drawer__section todo-drawer__section--danger">
      <div class="todo-drawer__section-title">Danger zone</div>
      <button id="drawerDeleteTodoButton" class="delete-btn todo-drawer__delete-btn" type="button">
        Delete task
      </button>
    </div>
  `;
  setDrawerSaveState(state.drawerSaveState, state.drawerSaveMessage);
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
    state.taskDrawerAssistState.unavailable = true;
    return;
  }

  if (state.taskDrawerAssistState.todoId !== todoId) {
    resetTaskDrawerAssistState(todoId);
  }
  state.taskDrawerAssistState.loading = true;
  state.taskDrawerAssistState.error = "";
  state.taskDrawerAssistState.unavailable = false;
  renderTodoDrawerContent();

  try {
    let latestResponse = await fetchTaskDrawerLatestSuggestion(todoId);
    if (latestResponse.status === 403 || latestResponse.status === 404) {
      state.taskDrawerAssistState.loading = false;
      state.taskDrawerAssistState.unavailable = true;
      renderTodoDrawerContent();
      return;
    }

    if (latestResponse.status === 204) {
      if (isTaskDrawerDismissed(todoId)) {
        state.taskDrawerAssistState.loading = false;
        state.taskDrawerAssistState.mustAbstain = true;
        renderTodoDrawerContent();
        return;
      }
      if (!allowGenerate) {
        state.taskDrawerAssistState.loading = false;
        state.taskDrawerAssistState.mustAbstain = true;
        renderTodoDrawerContent();
        return;
      }
      const generated = await generateTaskDrawerSuggestion(todo);
      if (generated.status === 403 || generated.status === 404) {
        state.taskDrawerAssistState.loading = false;
        state.taskDrawerAssistState.unavailable = true;
        renderTodoDrawerContent();
        return;
      }
      latestResponse = await fetchTaskDrawerLatestSuggestion(todoId);
    }

    if (!latestResponse.ok) {
      state.taskDrawerAssistState.loading = false;
      state.taskDrawerAssistState.error = "Could not load suggestions.";
      renderTodoDrawerContent();
      return;
    }

    const payload = await latestResponse.json();
    if (!state.isTodoDrawerOpen || state.selectedTodoId !== todoId) return;
    const envelope = payload?.outputEnvelope || {};
    state.taskDrawerAssistState.loading = false;
    state.taskDrawerAssistState.aiSuggestionId = String(
      payload?.aiSuggestionId || "",
    );
    state.taskDrawerAssistState.mustAbstain = !!envelope.must_abstain;
    state.taskDrawerAssistState.contractVersion = envelope.contractVersion;
    state.taskDrawerAssistState.requestId = envelope.requestId;
    state.taskDrawerAssistState.generatedAt = envelope.generatedAt;
    state.taskDrawerAssistState.suggestions = normalizeTaskDrawerAssistEnvelope(
      state.taskDrawerAssistState.aiSuggestionId,
      envelope,
      todoId,
    );
    state.taskDrawerAssistState.confirmSuggestionId = "";
    state.taskDrawerAssistState.applyingSuggestionId = "";
    renderTodoDrawerContent();
  } catch (error) {
    console.error("Task drawer AI load failed:", error);
    state.taskDrawerAssistState.loading = false;
    state.taskDrawerAssistState.error = "Could not load suggestions.";
    renderTodoDrawerContent();
  }
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
    EventBus.dispatch("todos:changed", { reason: "todo-updated" });
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
  EventBus.dispatch("todos:changed", { reason: "undo-applied" });
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

  state.selectedTodoId = todoId;
  initializeDrawerDraft(todo);
  resetTaskDrawerAssistState(todoId);
  state.isDrawerDetailsOpen = false;
  state.openTodoKebabId = null;
  state.drawerSaveSequence = 0;
  setDrawerSaveState("idle");
  state.lastFocusedTodoTrigger =
    triggerEl instanceof HTMLElement ? triggerEl : null;
  state.lastFocusedTodoId =
    triggerEl instanceof HTMLElement
      ? triggerEl.dataset.todoId || todoId
      : todoId;
  state.isTodoDrawerOpen = true;

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

  state.isTodoDrawerOpen = false;
  state.selectedTodoId = null;
  state.isDrawerDetailsOpen = false;
  state.openTodoKebabId = null;
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

  state.lastFocusedTodoTrigger = null;
  state.lastFocusedTodoId = null;

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
  state.isDrawerDetailsOpen = !state.isDrawerDetailsOpen;
  renderTodoDrawerContent();
}

export async function deleteTodoFromDrawer() {
  if (!state.selectedTodoId) return;
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
  state.openTodoKebabId = null;
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
  state.openTodoKebabId = shouldOpen ? todoId : null;
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
  state.openTodoKebabId = null;
  const row = document.querySelector(
    `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"]`,
  );
  openTodoDrawer(todoId, row instanceof HTMLElement ? row : null);
}

export function openEditTodoFromKebab(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  state.openTodoKebabId = null;
  patchTodoKebabState();
  hooks.openEditTodoModal?.(todoId);
}

export function openDrawerDangerZone(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  state.openTodoKebabId = null;
  const row = document.querySelector(
    `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"]`,
  );
  if (!state.isTodoDrawerOpen || state.selectedTodoId !== todoId) {
    openTodoDrawer(todoId, row instanceof HTMLElement ? row : null);
  }
  state.isDrawerDetailsOpen = true;
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
    openTodoDrawer(todoId, row);
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
    if (target.id === "drawerProjectSelect") {
      onDrawerProjectChange(event);
      return;
    }
    if (target.id === "drawerPrioritySelect") {
      onDrawerPriorityChange(event);
      return;
    }
    if (target.id === "drawerDescriptionTextarea") {
      onDrawerDescriptionBlur();
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
    openTodoDrawer(todoId, target);
  });
}
