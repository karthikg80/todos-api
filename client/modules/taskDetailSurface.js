// =============================================================================
// taskDetailSurface.js — Progressive task-detail flow.
//
// Owns:
// - inline description editor beneath list rows
// - full task page rendering + route sync
// - transitions between inline, drawer, and page surfaces
// =============================================================================

import { state, hooks } from "./store.js";
import { applyUiAction } from "./stateActions.js";
import { mountTaskPicker } from "../utils/taskPicker.js";

const TASK_ROUTE_PREFIX = "#task/";
const SAVE_STATE_RESET_DELAY_MS = 1800;
const INLINE_AUTOSAVE_DELAY_MS = 650;
const TASK_PAGE_DESCRIPTION_AUTOSAVE_DELAY_MS = 650;
const TASK_PAGE_NOTES_AUTOSAVE_DELAY_MS = 650;

let activeTaskPageDepPicker = null;

function toIsoFromDateTimeLocal(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function escapeHtml(value) {
  if (typeof hooks.escapeHtml === "function") {
    return hooks.escapeHtml(value);
  }
  return String(value ?? "");
}

function getTodoById(todoId) {
  return hooks.getTodoById?.(todoId) || null;
}

function getTodoRow(todoId) {
  if (!todoId) return null;
  const selector = `.todo-item[data-todo-id="${String(todoId).replace(/["\\]/g, "\\$&")}"]`;
  const row = document.querySelector(selector);
  return row instanceof HTMLElement ? row : null;
}

function getCurrentUrlWithoutHash() {
  return `${window.location.pathname}${window.location.search}`;
}

function buildInlineDraft(todo, override = {}) {
  return {
    id: String(todo?.id || ""),
    title:
      typeof override.title === "string"
        ? override.title
        : String(todo?.title || ""),
    description:
      typeof override.description === "string"
        ? override.description
        : String(todo?.description || ""),
  };
}

function buildTaskPageDraft(todo, override = {}) {
  const toDateInputValue = hooks.toDateInputValue || ((v) => v || "");
  const toDateTimeLocalValue = hooks.toDateTimeLocalValue || ((v) => v || "");
  const str = (ov, fallback) =>
    typeof ov === "string" ? ov : String(fallback || "");
  return {
    id: String(todo?.id || ""),
    title: str(override.title, todo?.title),
    description: str(override.description, todo?.description),
    status: String(
      override.status || todo?.status || (todo?.completed ? "done" : "next"),
    ),
    completed:
      typeof override.completed === "boolean"
        ? override.completed
        : !!todo?.completed,
    dueDate: toDateInputValue(override.dueDate ?? todo?.dueDate),
    project: String(
      override.project ??
        override.category ??
        todo?.category ??
        todo?.project ??
        "",
    ),
    priority: String(override.priority || todo?.priority || "medium"),
    // --- Fields promoted from drawer ---
    notes: str(override.notes, todo?.notes),
    firstStep: str(override.firstStep, todo?.firstStep),
    startDate: toDateTimeLocalValue(override.startDate ?? todo?.startDate),
    scheduledDate: toDateTimeLocalValue(
      override.scheduledDate ?? todo?.scheduledDate,
    ),
    reviewDate: toDateTimeLocalValue(override.reviewDate ?? todo?.reviewDate),
    recurrenceType: String(
      override.recurrenceType || todo?.recurrenceType || "none",
    ),
    recurrenceInterval: override.recurrenceInterval
      ? String(override.recurrenceInterval)
      : todo?.recurrenceInterval
        ? String(todo.recurrenceInterval)
        : "1",
    energy: str(override.energy, todo?.energy),
    effortScore:
      typeof (override.effortScore ?? todo?.effortScore) === "number"
        ? String(override.effortScore ?? todo?.effortScore)
        : str(override.effortScore, todo?.effortScore),
    estimateMinutes:
      typeof (override.estimateMinutes ?? todo?.estimateMinutes) === "number"
        ? String(override.estimateMinutes ?? todo?.estimateMinutes)
        : "",
    context: str(override.context, todo?.context),
    tagsText:
      typeof override.tagsText === "string"
        ? override.tagsText
        : Array.isArray(todo?.tags)
          ? todo.tags.join(", ")
          : "",
    waitingOn: str(override.waitingOn, todo?.waitingOn),
    categoryDetail: String(override.categoryDetail ?? todo?.category ?? ""),
    emotionalState: str(override.emotionalState, todo?.emotionalState),
    dependsOnTaskIdsText:
      typeof override.dependsOnTaskIdsText === "string"
        ? override.dependsOnTaskIdsText
        : Array.isArray(todo?.dependsOnTaskIds)
          ? todo.dependsOnTaskIds.join(", ")
          : "",
    archived:
      typeof override.archived === "boolean"
        ? override.archived
        : !!todo?.archived,
    source: String(override.source ?? todo?.source ?? ""),
    completedAt: todo?.completedAt ? String(todo.completedAt) : "",
  };
}

function setInlineSaveState(nextState, message = "") {
  if (state.inlineTaskEditorResetTimer) {
    clearTimeout(state.inlineTaskEditorResetTimer);
    state.inlineTaskEditorResetTimer = null;
  }
  state.inlineTaskEditorSaveState = nextState;
  state.inlineTaskEditorSaveMessage = message;
  if (nextState === "saved") {
    state.inlineTaskEditorResetTimer = setTimeout(() => {
      state.inlineTaskEditorSaveState = "idle";
      state.inlineTaskEditorSaveMessage = "";
      hooks.renderTodos?.();
    }, SAVE_STATE_RESET_DELAY_MS);
  }
}

function setTaskPageSaveState(nextState, message = "") {
  if (state.taskPageSaveResetTimer) {
    clearTimeout(state.taskPageSaveResetTimer);
    state.taskPageSaveResetTimer = null;
  }
  state.taskPageSaveState = nextState;
  state.taskPageSaveMessage = message;
  if (nextState === "saved") {
    state.taskPageSaveResetTimer = setTimeout(() => {
      state.taskPageSaveState = "idle";
      state.taskPageSaveMessage = "";
      hooks.renderTodos?.();
    }, SAVE_STATE_RESET_DELAY_MS);
  }
}

function renderSaveStateLabel(saveState, message = "") {
  if (saveState === "saving") return "Saving";
  if (saveState === "saved") return "Saved just now";
  if (saveState === "error") return message || "Could not save";
  return "Editing";
}

function buildDrawerSeedFromTaskPage() {
  if (!state.taskPageTodoId || !state.taskPageDraft) return null;
  return {
    ...state.taskPageDraft,
    category: state.taskPageDraft.project || "",
    project: state.taskPageDraft.project || "",
  };
}

function buildDrawerSeedFromInline() {
  if (!state.inlineTaskEditorTodoId || !state.inlineTaskEditorDraft)
    return null;
  const todo = getTodoById(state.inlineTaskEditorTodoId);
  if (!todo) return null;
  return {
    ...todo,
    title: state.inlineTaskEditorDraft.title,
    description: state.inlineTaskEditorDraft.description,
  };
}

function buildProjectOptions(selectedProject = "") {
  const projects = hooks.getAllProjects?.() || [];
  const renderEntry =
    hooks.renderProjectOptionEntry ||
    ((project, selected) =>
      `<option value="${escapeHtml(project)}" ${project === selected ? "selected" : ""}>${escapeHtml(project)}</option>`);
  return `<option value="">None</option>${projects
    .map((project) => renderEntry(project, selectedProject))
    .join("")}`;
}

function readInlineTitleValue(todoId) {
  if (!todoId) {
    return String(state.inlineTaskEditorDraft?.title || "");
  }
  const selector = `[data-inline-title-input="${String(todoId).replace(/["\\]/g, "\\$&")}"]`;
  const input = document.querySelector(selector);
  if (input instanceof HTMLInputElement) {
    return input.value;
  }
  return String(state.inlineTaskEditorDraft?.title || "");
}

function readInlineDescriptionValue(todoId) {
  if (!todoId) {
    return String(state.inlineTaskEditorDraft?.description || "");
  }
  const selector = `[data-inline-description-input="${String(todoId).replace(/["\\]/g, "\\$&")}"]`;
  const input = document.querySelector(selector);
  if (input instanceof HTMLTextAreaElement) {
    return input.value;
  }
  return String(state.inlineTaskEditorDraft?.description || "");
}

function renderTaskPageSubtasks(todo) {
  const subtasks = Array.isArray(todo?.subtasks) ? todo.subtasks : [];
  if (subtasks.length === 0) {
    return `<p class="task-page__empty">No subtasks yet.</p>`;
  }
  return `
    <ul class="task-page__subtasks">
      ${subtasks
        .map((subtask) => {
          const title = escapeHtml(String(subtask?.title || ""));
          const todoId = escapeHtml(String(todo?.id || ""));
          const subtaskId = escapeHtml(String(subtask?.id || ""));
          return `
            <li class="task-page__subtask-item">
              <input
                type="checkbox"
                class="task-page__subtask-toggle"
                ${subtask?.completed ? "checked" : ""}
                data-onchange="toggleSubtask('${todoId}', '${subtaskId}')"
              />
              <span class="${subtask?.completed ? "task-page__subtask-title--done" : ""}">${title}</span>
              <button
                type="button"
                class="task-page__subtask-delete"
                data-onclick="deleteSubtaskFromTaskPage('${todoId}', '${subtaskId}')"
                aria-label="Delete subtask"
              >&times;</button>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

export function renderInlineTaskEditor(todo) {
  if (
    !todo ||
    state.inlineTaskEditorTodoId !== todo.id ||
    !state.inlineTaskEditorDraft
  ) {
    return "";
  }
  const draft = state.inlineTaskEditorDraft;
  const todoId = escapeHtml(String(todo.id));
  const saveLabel = escapeHtml(
    renderSaveStateLabel(
      state.inlineTaskEditorSaveState,
      state.inlineTaskEditorSaveMessage,
    ),
  );

  return `
    <div class="todo-inline-editor" data-inline-editor-for="${todoId}">
      <div class="todo-inline-editor__header">
        <div>
          <div class="todo-inline-editor__eyebrow">Quick edit</div>
          <div class="todo-inline-editor__title">Task</div>
          <div class="todo-inline-editor__hint">Quick changes stay in the list until you need more space.</div>
        </div>
        <div class="todo-inline-editor__status" data-state="${escapeHtml(state.inlineTaskEditorSaveState)}">${saveLabel}</div>
      </div>
      <label class="sr-only" for="todoInlineTitleInput-${todoId}">Task title</label>
      <input
        id="todoInlineTitleInput-${todoId}"
        class="todo-inline-editor__title-input"
        data-inline-title-input="${todoId}"
        type="text"
        maxlength="200"
        value="${escapeHtml(draft.title)}"
        placeholder="Task title"
      />
      <div class="todo-inline-editor__field-label">Notes</div>
      <label class="todo-inline-editor__field" for="todoInlineDescriptionInput-${todoId}">
        <textarea
          id="todoInlineDescriptionInput-${todoId}"
          data-inline-description-input="${todoId}"
          placeholder="Add context, notes, or acceptance criteria"
        >${escapeHtml(draft.description)}</textarea>
      </label>
      <div class="todo-inline-editor__actions">
        <button type="button" class="mini-btn" data-onclick="openDrawerFromInline('${todoId}')">More details</button>
        <button type="button" class="mini-btn" data-onclick="openTaskPageFromInline('${todoId}')">Open full task</button>
        <button type="button" class="mini-btn" data-onclick="closeInlineDescriptionEditor('${todoId}')">Close</button>
      </div>
    </div>
  `;
}

export function renderTaskPageSurface(todo) {
  const draft =
    state.taskPageDraft && state.taskPageDraft.id === todo?.id
      ? state.taskPageDraft
      : buildTaskPageDraft(todo);

  if (!todo || !draft) {
    return `
      <section class="task-page task-page--missing">
        <div class="task-page__hero">
          <button type="button" class="mini-btn" data-onclick="closeTaskPage()">Back to list</button>
        </div>
        <div class="task-page__empty">This task is no longer available.</div>
      </section>
    `;
  }

  const saveLabel = escapeHtml(
    renderSaveStateLabel(state.taskPageSaveState, state.taskPageSaveMessage),
  );
  const todoId = escapeHtml(String(todo.id));

  const recurrenceIntervalHtml =
    draft.recurrenceType !== "none"
      ? `
            <label class="task-page__field" for="taskPageRecurrenceInterval">
              <span>Every</span>
              <input id="taskPageRecurrenceInterval" type="number" min="1" max="365" value="${escapeHtml(draft.recurrenceInterval)}" />
            </label>`
      : "";

  return `
    <section class="task-page" data-task-page-for="${todoId}">
      <div class="task-page__hero">
        <div class="task-page__hero-main">
          <button type="button" class="mini-btn task-page__back-btn" data-onclick="closeTaskPage()">Back to list</button>
          <div class="task-page__save-state" data-state="${escapeHtml(state.taskPageSaveState)}">${saveLabel}</div>
          <label class="sr-only" for="taskPageTitleInput">Task title</label>
          <input
            id="taskPageTitleInput"
            class="task-page__title-input"
            type="text"
            maxlength="200"
            value="${escapeHtml(draft.title)}"
            placeholder="Task title"
          />
          <div class="task-page__hero-actions">
            <label class="task-page__complete-toggle">
              <input id="taskPageCompletedToggle" type="checkbox" ${draft.completed ? "checked" : ""} />
              <span>${draft.completed ? "Completed" : "Mark complete"}</span>
            </label>
            <button type="button" class="mini-btn" data-onclick="openDrawerFromTaskPage('${todoId}')">Open quick panel</button>
          </div>
        </div>
      </div>
      <div class="task-page__layout">
        <div class="task-page__main">
          <section class="task-page__section">
            <div class="task-page__section-title">Description</div>
            <label class="sr-only" for="taskPageDescriptionTextarea">Task description</label>
            <textarea
              id="taskPageDescriptionTextarea"
              class="task-page__description"
              maxlength="1000"
              placeholder="Add context, notes, or acceptance criteria"
            >${escapeHtml(draft.description)}</textarea>
          </section>
          <section class="task-page__section">
            <div class="task-page__section-title">Notes</div>
            <label class="sr-only" for="taskPageNotesTextarea">Private notes</label>
            <textarea
              id="taskPageNotesTextarea"
              class="task-page__description"
              maxlength="2000"
              placeholder="Private notes, reference links, or context for future you"
            >${escapeHtml(draft.notes)}</textarea>
          </section>
          <section class="task-page__section">
            <div class="task-page__section-title">First step</div>
            <label class="sr-only" for="taskPageFirstStepInput">First step</label>
            <input
              id="taskPageFirstStepInput"
              type="text"
              class="task-page__first-step-input"
              maxlength="255"
              value="${escapeHtml(draft.firstStep)}"
              placeholder="What's the very first thing to do?"
            />
          </section>
          <section class="task-page__section">
            <div class="task-page__section-title">Subtasks</div>
            <div class="task-page__subtask-add">
              <input
                id="taskPageSubtaskInput"
                type="text"
                class="task-page__subtask-add-input"
                maxlength="200"
                placeholder="Add a subtask\u2026"
              />
              <button type="button" class="mini-btn" data-onclick="addSubtaskFromTaskPage('${todoId}')">Add</button>
            </div>
            ${renderTaskPageSubtasks(todo)}
          </section>
        </div>
        <aside class="task-page__rail">
          <section class="task-page__section">
            <div class="task-page__section-title">Task details</div>
            <label class="task-page__field" for="taskPageStatusSelect">
              <span>Status</span>
              <select id="taskPageStatusSelect">
                <option value="inbox" ${draft.status === "inbox" ? "selected" : ""}>Desk</option>
                <option value="next" ${draft.status === "next" ? "selected" : ""}>Up next</option>
                <option value="in_progress" ${draft.status === "in_progress" ? "selected" : ""}>In progress</option>
                <option value="waiting" ${draft.status === "waiting" ? "selected" : ""}>Waiting</option>
                <option value="scheduled" ${draft.status === "scheduled" ? "selected" : ""}>Scheduled</option>
                <option value="someday" ${draft.status === "someday" ? "selected" : ""}>Someday</option>
                <option value="done" ${draft.status === "done" ? "selected" : ""}>Done</option>
              </select>
            </label>
            <label class="task-page__field" for="taskPageDueDateInput">
              <span>Due date</span>
              <input id="taskPageDueDateInput" type="date" value="${escapeHtml(draft.dueDate)}" />
            </label>
            <label class="task-page__field" for="taskPageProjectSelect">
              <span>Project</span>
              <select id="taskPageProjectSelect">
                ${buildProjectOptions(draft.project)}
              </select>
            </label>
            <label class="task-page__field" for="taskPagePrioritySelect">
              <span>Priority</span>
              <select id="taskPagePrioritySelect">
                <option value="low" ${draft.priority === "low" ? "selected" : ""}>Low</option>
                <option value="medium" ${draft.priority === "medium" ? "selected" : ""}>Medium</option>
                <option value="high" ${draft.priority === "high" ? "selected" : ""}>High</option>
                <option value="urgent" ${draft.priority === "urgent" ? "selected" : ""}>Urgent</option>
              </select>
            </label>
          </section>
          <section class="task-page__section">
            <div class="task-page__section-title">Planning</div>
            <label class="task-page__field" for="taskPageEnergySelect">
              <span>Energy</span>
              <select id="taskPageEnergySelect">
                <option value="" ${!draft.energy ? "selected" : ""}>None</option>
                <option value="low" ${draft.energy === "low" ? "selected" : ""}>Low</option>
                <option value="medium" ${draft.energy === "medium" ? "selected" : ""}>Medium</option>
                <option value="high" ${draft.energy === "high" ? "selected" : ""}>High</option>
              </select>
            </label>
            <label class="task-page__field" for="taskPageEffortSelect">
              <span>Effort</span>
              <select id="taskPageEffortSelect">
                <option value="" ${!draft.effortScore ? "selected" : ""}>None</option>
                <option value="1" ${draft.effortScore === "1" ? "selected" : ""}>Tiny</option>
                <option value="2" ${draft.effortScore === "2" ? "selected" : ""}>Small</option>
                <option value="3" ${draft.effortScore === "3" ? "selected" : ""}>Medium</option>
                <option value="4" ${draft.effortScore === "4" ? "selected" : ""}>Deep</option>
              </select>
            </label>
            <label class="task-page__field" for="taskPageEstimateInput">
              <span>Estimate (minutes)</span>
              <input id="taskPageEstimateInput" type="number" min="0" step="1" value="${escapeHtml(draft.estimateMinutes)}" />
            </label>
            <label class="task-page__field" for="taskPageContextInput">
              <span>Context</span>
              <input id="taskPageContextInput" type="text" maxlength="100" value="${escapeHtml(draft.context)}" placeholder="computer, home, calls" />
            </label>
          </section>
          <section class="task-page__section">
            <div class="task-page__section-title">Dates</div>
            <label class="task-page__field" for="taskPageStartDateInput">
              <span>Start date</span>
              <input id="taskPageStartDateInput" type="datetime-local" value="${escapeHtml(draft.startDate)}" />
            </label>
            <label class="task-page__field" for="taskPageScheduledDateInput">
              <span>Scheduled date</span>
              <input id="taskPageScheduledDateInput" type="datetime-local" value="${escapeHtml(draft.scheduledDate)}" />
            </label>
            <label class="task-page__field" for="taskPageReviewDateInput">
              <span>Review date</span>
              <input id="taskPageReviewDateInput" type="datetime-local" value="${escapeHtml(draft.reviewDate)}" />
            </label>
            <label class="task-page__field" for="taskPageRecurrenceType">
              <span>Repeat</span>
              <select id="taskPageRecurrenceType">
                <option value="none" ${draft.recurrenceType === "none" ? "selected" : ""}>None</option>
                <option value="daily" ${draft.recurrenceType === "daily" ? "selected" : ""}>Daily</option>
                <option value="weekly" ${draft.recurrenceType === "weekly" ? "selected" : ""}>Weekly</option>
                <option value="monthly" ${draft.recurrenceType === "monthly" ? "selected" : ""}>Monthly</option>
                <option value="yearly" ${draft.recurrenceType === "yearly" ? "selected" : ""}>Yearly</option>
              </select>
            </label>
            ${recurrenceIntervalHtml}
          </section>
          <section class="task-page__section">
            <div class="task-page__section-title">Metadata</div>
            <label class="task-page__field" for="taskPageTagsInput">
              <span>Tags</span>
              <input id="taskPageTagsInput" type="text" maxlength="512" value="${escapeHtml(draft.tagsText)}" placeholder="travel, planning, admin" />
            </label>
            <label class="task-page__field" for="taskPageWaitingOnInput">
              <span>Waiting on</span>
              <input id="taskPageWaitingOnInput" type="text" maxlength="255" value="${escapeHtml(draft.waitingOn)}" placeholder="Budget approval, vendor reply" />
            </label>
            <label class="task-page__field" for="taskPageCategoryInput">
              <span>Category</span>
              <input id="taskPageCategoryInput" type="text" maxlength="50" value="${escapeHtml(draft.categoryDetail)}" />
            </label>
            <label class="task-page__field" for="taskPageEmotionalStateSelect">
              <span>Emotional state</span>
              <select id="taskPageEmotionalStateSelect">
                <option value="" ${!draft.emotionalState ? "selected" : ""}>None</option>
                <option value="avoiding" ${draft.emotionalState === "avoiding" ? "selected" : ""}>Avoiding</option>
                <option value="unclear" ${draft.emotionalState === "unclear" ? "selected" : ""}>Unclear</option>
                <option value="heavy" ${draft.emotionalState === "heavy" ? "selected" : ""}>Heavy</option>
                <option value="exciting" ${draft.emotionalState === "exciting" ? "selected" : ""}>Exciting</option>
                <option value="draining" ${draft.emotionalState === "draining" ? "selected" : ""}>Draining</option>
              </select>
            </label>
          </section>
          <section class="task-page__section">
            <div class="task-page__section-title">Dependencies</div>
            <div id="taskPageDependsOnPicker"></div>
          </section>
          <section class="task-page__section task-page__section--danger">
            <div class="task-page__section-title">Danger zone</div>
            <label class="task-page__field task-page__field--inline" for="taskPageArchivedToggle">
              <span>Archived</span>
              <input id="taskPageArchivedToggle" type="checkbox" ${draft.archived ? "checked" : ""} />
            </label>
            <button type="button" class="delete-btn task-page__delete-btn" data-onclick="deleteTaskFromTaskPage('${todoId}')">Delete task</button>
          </section>
        </aside>
      </div>
    </section>
  `;
}

async function saveInlineTaskDraft(todoId) {
  if (
    !todoId ||
    state.inlineTaskEditorTodoId !== todoId ||
    !state.inlineTaskEditorDraft
  ) {
    return true;
  }
  const draft = state.inlineTaskEditorDraft;
  setInlineSaveState("saving");
  try {
    const updatedTodo = await hooks.applyTodoPatch?.(todoId, {
      title: String(draft.title || "").trim(),
      description: String(draft.description || "").trim(),
    });
    if (updatedTodo?.id) {
      const index = state.todos.findIndex((item) => item.id === updatedTodo.id);
      if (index >= 0) {
        state.todos[index] = updatedTodo;
      }
      state.inlineTaskEditorDraft = buildInlineDraft(updatedTodo);
    }
    setInlineSaveState("saved");
    hooks.applyFiltersAndRender?.({ reason: "inline-description-save" });
    return true;
  } catch (error) {
    setInlineSaveState("error", error.message || "Save failed");
    hooks.renderTodos?.();
    return false;
  }
}

async function flushTaskPageDraft(patch) {
  if (!state.taskPageTodoId || !state.taskPageDraft) return true;
  setTaskPageSaveState("saving");
  try {
    const updatedTodo = await hooks.applyTodoPatch?.(
      state.taskPageTodoId,
      patch,
    );
    if (updatedTodo?.id) {
      const index = state.todos.findIndex((item) => item.id === updatedTodo.id);
      if (index >= 0) {
        state.todos[index] = updatedTodo;
      }
      state.taskPageDraft = buildTaskPageDraft(
        updatedTodo,
        state.taskPageDraft,
      );
    }
    setTaskPageSaveState("saved");
    hooks.applyFiltersAndRender?.({ reason: "task-page-save" });
    return true;
  } catch (error) {
    setTaskPageSaveState("error", error.message || "Save failed");
    hooks.renderTodos?.();
    return false;
  }
}

function parseTaskIdFromLocation() {
  const hash = String(window.location.hash || "");
  if (!hash.startsWith(TASK_ROUTE_PREFIX)) return "";
  return decodeURIComponent(hash.slice(TASK_ROUTE_PREFIX.length));
}

export function syncTaskPageRouteFromLocation() {
  const todoId = parseTaskIdFromLocation();
  if (!todoId) {
    if (state.taskPageTodoId) {
      applyUiAction("taskPage/close");
      hooks.renderTodos?.();
    }
    return;
  }

  if (state.taskPageTodoId === todoId) return;
  const todo = getTodoById(todoId);
  if (!todo) return;
  applyUiAction("taskPage/open", {
    todoId,
    draft: buildTaskPageDraft(todo),
  });
  hooks.renderTodos?.();
}

function updateTaskPageRoute(todoId) {
  const nextHash = `${TASK_ROUTE_PREFIX}${encodeURIComponent(todoId)}`;
  if (window.location.hash === nextHash) return;
  window.history.pushState(
    {},
    document.title,
    `${getCurrentUrlWithoutHash()}${nextHash}`,
  );
}

function clearTaskPageRoute() {
  if (!window.location.hash) return;
  window.history.replaceState({}, document.title, getCurrentUrlWithoutHash());
}

function isMobileTaskSurface() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function isInlineDraftDirty(todoId) {
  if (
    !todoId ||
    state.inlineTaskEditorTodoId !== todoId ||
    !state.inlineTaskEditorDraft
  ) {
    return false;
  }
  const todo = getTodoById(todoId);
  if (!todo) return false;
  // Keep this in sync with buildInlineDraft() while inline editing only covers
  // title + description.
  return (
    state.inlineTaskEditorDraft.title !== String(todo.title || "") ||
    state.inlineTaskEditorDraft.description !== String(todo.description || "")
  );
}

export function openTodoFromRow(todoId) {
  if (!todoId) return;
  const row = getTodoRow(todoId);

  if (state.taskPageTodoId) {
    applyUiAction("taskPage/close");
    clearTaskPageRoute();
  }

  if (isMobileTaskSurface()) {
    if (state.inlineTaskEditorTodoId) {
      applyUiAction("taskInline/close");
      hooks.renderTodos?.();
    }
    hooks.openTodoDrawer?.(todoId, row);
    return;
  }

  openInlineTaskEditor(todoId, "title");
}

export function openInlineTaskEditor(todoId, focusField = "title") {
  const todo = getTodoById(todoId);
  if (!todo) return;

  if (state.taskPageTodoId) {
    applyUiAction("taskPage/close");
    clearTaskPageRoute();
  }

  applyUiAction("taskInline/open", {
    todoId,
    draft: buildInlineDraft(todo),
  });
  setInlineSaveState("idle");
  hooks.renderTodos?.();
  window.requestAnimationFrame(() => {
    const input = document.querySelector(
      focusField === "description"
        ? `[data-inline-description-input="${String(todoId).replace(/["\\]/g, "\\$&")}"]`
        : `[data-inline-title-input="${String(todoId).replace(/["\\]/g, "\\$&")}"]`,
    );
    if (input instanceof HTMLElement) {
      input.focus({ preventScroll: true });
      if (input instanceof HTMLTextAreaElement) {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }
  });
}

export function openInlineDescriptionEditor(todoId) {
  openInlineTaskEditor(todoId, "description");
}

export function closeInlineDescriptionEditor(todoId = "") {
  if (todoId && state.inlineTaskEditorTodoId !== todoId) return;
  if (state.inlineTaskEditorSaveTimer) {
    clearTimeout(state.inlineTaskEditorSaveTimer);
    state.inlineTaskEditorSaveTimer = null;
  }
  if (state.inlineTaskEditorResetTimer) {
    clearTimeout(state.inlineTaskEditorResetTimer);
    state.inlineTaskEditorResetTimer = null;
  }
  applyUiAction("taskInline/close");
  hooks.renderTodos?.();
  if (todoId) {
    window.requestAnimationFrame(() => {
      const row = getTodoRow(todoId);
      row?.focus({ preventScroll: true });
    });
  }
}

export async function openDrawerFromInline(todoId) {
  if (state.inlineTaskEditorDraft) {
    state.inlineTaskEditorDraft.title = readInlineTitleValue(todoId);
    state.inlineTaskEditorDraft.description =
      readInlineDescriptionValue(todoId);
  }
  const saved = isInlineDraftDirty(todoId)
    ? await saveInlineTaskDraft(todoId)
    : true;
  if (!saved) return;

  const row = getTodoRow(todoId);
  const seed = buildDrawerSeedFromInline();
  applyUiAction("taskInline/close");
  hooks.renderTodos?.();
  if (seed && typeof hooks.seedDrawerDraft === "function") {
    hooks.seedDrawerDraft(seed);
  }
  hooks.openTodoDrawer?.(todoId, row);
}

export function openTaskPage(
  todoId,
  { draft = null, updateRoute = true } = {},
) {
  const todo = getTodoById(todoId);
  if (!todo) return;
  applyUiAction("taskPage/open", {
    todoId,
    draft: draft || buildTaskPageDraft(todo),
  });
  if (updateRoute) {
    updateTaskPageRoute(todoId);
  }
  hooks.renderTodos?.();
  window.requestAnimationFrame(() => {
    const titleInput = document.getElementById("taskPageTitleInput");
    if (titleInput instanceof HTMLElement) {
      titleInput.focus({ preventScroll: true });
    }
  });
}

export async function openTaskPageFromInline(todoId) {
  if (state.inlineTaskEditorDraft) {
    state.inlineTaskEditorDraft.title = readInlineTitleValue(todoId);
    state.inlineTaskEditorDraft.description =
      readInlineDescriptionValue(todoId);
  }
  const saved = isInlineDraftDirty(todoId)
    ? await saveInlineTaskDraft(todoId)
    : true;
  if (!saved) return;
  const todo = getTodoById(todoId);
  if (!todo) return;
  const draft = buildTaskPageDraft(todo, {
    title: state.inlineTaskEditorDraft?.title ?? todo.title,
    description: state.inlineTaskEditorDraft?.description ?? todo.description,
  });
  applyUiAction("taskInline/close");
  openTaskPage(todoId, { draft });
}

export function openTaskPageFromDrawer(todoId = "") {
  const taskId = todoId || state.selectedTodoId;
  if (!taskId) return;
  const seed = buildDrawerSeedFromTaskPage() || state.drawerDraft;
  const todo = getTodoById(taskId);
  if (!todo) return;
  const draft = buildTaskPageDraft(todo, seed || {});
  hooks.closeTodoDrawer?.({ restoreFocus: false });
  openTaskPage(taskId, { draft });
}

export function closeTaskPage() {
  if (state.taskPageDescriptionSaveTimer) {
    clearTimeout(state.taskPageDescriptionSaveTimer);
    state.taskPageDescriptionSaveTimer = null;
  }
  if (state.taskPageSaveResetTimer) {
    clearTimeout(state.taskPageSaveResetTimer);
    state.taskPageSaveResetTimer = null;
  }
  const todoId = state.taskPageTodoId;
  applyUiAction("taskPage/close");
  clearTaskPageRoute();
  hooks.renderTodos?.();
  if (todoId) {
    window.requestAnimationFrame(() => {
      const row = getTodoRow(todoId);
      row?.focus({ preventScroll: true });
    });
  }
}

export async function openDrawerFromTaskPage(todoId) {
  const currentTodoId = todoId || state.taskPageTodoId;
  if (!currentTodoId) return;

  if (state.taskPageDescriptionSaveTimer) {
    clearTimeout(state.taskPageDescriptionSaveTimer);
    state.taskPageDescriptionSaveTimer = null;
  }

  const draft = buildDrawerSeedFromTaskPage();
  const patch = state.taskPageDraft
    ? {
        title: String(state.taskPageDraft.title || "").trim(),
        description: String(state.taskPageDraft.description || "").trim(),
        status: state.taskPageDraft.status,
        completed: !!state.taskPageDraft.completed,
        dueDate: hooks.toIsoFromDateInput
          ? hooks.toIsoFromDateInput(state.taskPageDraft.dueDate)
          : state.taskPageDraft.dueDate || null,
        category: state.taskPageDraft.project || null,
        projectId:
          hooks.getProjectRecordByName?.(state.taskPageDraft.project || "")
            ?.id || null,
        priority: state.taskPageDraft.priority || "medium",
      }
    : null;

  if (patch) {
    const saved = await flushTaskPageDraft(patch);
    if (!saved) return;
  }

  const row = getTodoRow(currentTodoId);
  applyUiAction("taskPage/close");
  clearTaskPageRoute();
  hooks.renderTodos?.();
  if (draft && typeof hooks.seedDrawerDraft === "function") {
    hooks.seedDrawerDraft(draft);
  }
  hooks.openTodoDrawer?.(currentTodoId, row);
}

function onInlineDescriptionInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;
  const todoId = String(target.dataset.inlineDescriptionInput || "");
  if (
    !todoId ||
    state.inlineTaskEditorTodoId !== todoId ||
    !state.inlineTaskEditorDraft
  ) {
    return;
  }
  state.inlineTaskEditorDraft.description = target.value;
  setInlineSaveState("idle");
  if (state.inlineTaskEditorSaveTimer) {
    clearTimeout(state.inlineTaskEditorSaveTimer);
  }
  state.inlineTaskEditorSaveTimer = setTimeout(() => {
    state.inlineTaskEditorSaveTimer = null;
    void saveInlineTaskDraft(todoId);
  }, INLINE_AUTOSAVE_DELAY_MS);
}

function onInlineTitleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const todoId = String(target.dataset.inlineTitleInput || "");
  if (
    !todoId ||
    state.inlineTaskEditorTodoId !== todoId ||
    !state.inlineTaskEditorDraft
  ) {
    return;
  }
  state.inlineTaskEditorDraft.title = target.value;
  setInlineSaveState("idle");
  if (state.inlineTaskEditorSaveTimer) {
    clearTimeout(state.inlineTaskEditorSaveTimer);
  }
  state.inlineTaskEditorSaveTimer = setTimeout(() => {
    state.inlineTaskEditorSaveTimer = null;
    void saveInlineTaskDraft(todoId);
  }, INLINE_AUTOSAVE_DELAY_MS);
}

function onTaskPageTitleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !state.taskPageDraft) return;
  state.taskPageDraft.title = target.value;
  setTaskPageSaveState("idle");
}

function onTaskPageDescriptionInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !state.taskPageDraft) return;
  state.taskPageDraft.description = target.value;
  setTaskPageSaveState("idle");
  if (state.taskPageDescriptionSaveTimer) {
    clearTimeout(state.taskPageDescriptionSaveTimer);
  }
  state.taskPageDescriptionSaveTimer = setTimeout(() => {
    state.taskPageDescriptionSaveTimer = null;
    void flushTaskPageDraft({
      description: String(state.taskPageDraft?.description || "").trim(),
    });
  }, TASK_PAGE_DESCRIPTION_AUTOSAVE_DELAY_MS);
}

function onTaskPageNotesInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !state.taskPageDraft) return;
  state.taskPageDraft.notes = target.value;
  setTaskPageSaveState("idle");
  if (state.taskPageNotesSaveTimer) {
    clearTimeout(state.taskPageNotesSaveTimer);
  }
  state.taskPageNotesSaveTimer = setTimeout(() => {
    state.taskPageNotesSaveTimer = null;
    void flushTaskPageDraft({
      notes: String(state.taskPageDraft?.notes || "").trim() || null,
    });
  }, TASK_PAGE_NOTES_AUTOSAVE_DELAY_MS);
}

function onTaskPageTextFieldInput(fieldName, draftKey) {
  return (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !state.taskPageDraft) return;
    state.taskPageDraft[draftKey] = target.value;
    setTaskPageSaveState("idle");
  };
}

async function flushTaskPageTextField(field) {
  if (!state.taskPageDraft) return;
  if (field === "title") {
    await flushTaskPageDraft({
      title: String(state.taskPageDraft.title || "").trim(),
    });
    return;
  }
  if (field === "description") {
    if (state.taskPageDescriptionSaveTimer) {
      clearTimeout(state.taskPageDescriptionSaveTimer);
      state.taskPageDescriptionSaveTimer = null;
    }
    await flushTaskPageDraft({
      description: String(state.taskPageDraft.description || "").trim(),
    });
    return;
  }
  if (field === "notes") {
    if (state.taskPageNotesSaveTimer) {
      clearTimeout(state.taskPageNotesSaveTimer);
      state.taskPageNotesSaveTimer = null;
    }
    await flushTaskPageDraft({
      notes: String(state.taskPageDraft.notes || "").trim() || null,
    });
    return;
  }
  // Generic blur-save text fields
  const blurFields = {
    firstStep: "firstStep",
    context: "context",
    waitingOn: "waitingOn",
    tags: "tagsText",
    category: "categoryDetail",
  };
  if (blurFields[field]) {
    const timer = state.taskPageTextFieldSaveTimers[field];
    if (timer) {
      clearTimeout(timer);
      delete state.taskPageTextFieldSaveTimers[field];
    }
    const draftKey = blurFields[field];
    const value = String(state.taskPageDraft[draftKey] || "").trim();

    if (field === "tags") {
      const tags = value
        ? value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      await flushTaskPageDraft({ tags });
    } else if (field === "category") {
      const projectId = hooks.getProjectRecordByName?.(value || "")?.id || null;
      await flushTaskPageDraft({
        category: value || null,
        projectId,
      });
    } else {
      await flushTaskPageDraft({ [field]: value || null });
    }
    return;
  }
  if (field === "estimateMinutes") {
    const raw = state.taskPageDraft.estimateMinutes;
    const parsed = Number.parseInt(raw, 10);
    await flushTaskPageDraft({
      estimateMinutes: Number.isFinite(parsed) ? parsed : null,
    });
    return;
  }
  if (field === "recurrenceInterval") {
    const raw = state.taskPageDraft.recurrenceInterval;
    const parsed = Number.parseInt(raw, 10);
    if (state.taskPageDraft.recurrenceType !== "none") {
      await flushTaskPageDraft({
        recurrence: {
          type: state.taskPageDraft.recurrenceType,
          interval: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
        },
      });
    }
  }
}

async function onTaskPageChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !state.taskPageDraft) return;

  if (target.id === "taskPageCompletedToggle") {
    const input = target;
    state.taskPageDraft.completed = !!input.checked;
    state.taskPageDraft.status = input.checked
      ? "done"
      : state.taskPageDraft.status === "done"
        ? "next"
        : state.taskPageDraft.status;
    await flushTaskPageDraft({
      completed: !!input.checked,
      status: state.taskPageDraft.status,
    });
    return;
  }

  if (
    target.id === "taskPageStatusSelect" &&
    target instanceof HTMLSelectElement
  ) {
    state.taskPageDraft.status = target.value;
    state.taskPageDraft.completed = target.value === "done";
    await flushTaskPageDraft({
      status: target.value,
      completed: target.value === "done",
    });
    return;
  }

  if (
    target.id === "taskPageDueDateInput" &&
    target instanceof HTMLInputElement
  ) {
    state.taskPageDraft.dueDate = target.value;
    await flushTaskPageDraft({
      dueDate: hooks.toIsoFromDateInput?.(target.value) || null,
    });
    return;
  }

  if (
    target.id === "taskPageProjectSelect" &&
    target instanceof HTMLSelectElement
  ) {
    state.taskPageDraft.project = target.value;
    await flushTaskPageDraft({
      category: target.value || null,
      projectId: hooks.getProjectRecordByName?.(target.value || "")?.id || null,
    });
    return;
  }

  if (
    target.id === "taskPagePrioritySelect" &&
    target instanceof HTMLSelectElement
  ) {
    state.taskPageDraft.priority = target.value;
    await flushTaskPageDraft({ priority: target.value });
    return;
  }

  // --- Planning fields ---
  if (
    target.id === "taskPageEnergySelect" &&
    target instanceof HTMLSelectElement
  ) {
    state.taskPageDraft.energy = target.value;
    await flushTaskPageDraft({ energy: target.value || null });
    return;
  }

  if (
    target.id === "taskPageEffortSelect" &&
    target instanceof HTMLSelectElement
  ) {
    state.taskPageDraft.effortScore = target.value;
    await flushTaskPageDraft({
      effortScore: target.value ? Number(target.value) : null,
    });
    return;
  }

  // --- Date fields ---
  if (
    target.id === "taskPageStartDateInput" &&
    target instanceof HTMLInputElement
  ) {
    state.taskPageDraft.startDate = target.value;
    await flushTaskPageDraft({
      startDate: toIsoFromDateTimeLocal(target.value) || null,
    });
    return;
  }

  if (
    target.id === "taskPageScheduledDateInput" &&
    target instanceof HTMLInputElement
  ) {
    state.taskPageDraft.scheduledDate = target.value;
    await flushTaskPageDraft({
      scheduledDate: toIsoFromDateTimeLocal(target.value) || null,
    });
    return;
  }

  if (
    target.id === "taskPageReviewDateInput" &&
    target instanceof HTMLInputElement
  ) {
    state.taskPageDraft.reviewDate = target.value;
    await flushTaskPageDraft({
      reviewDate: toIsoFromDateTimeLocal(target.value) || null,
    });
    return;
  }

  if (
    target.id === "taskPageRecurrenceType" &&
    target instanceof HTMLSelectElement
  ) {
    state.taskPageDraft.recurrenceType = target.value;
    const patch =
      target.value === "none"
        ? { recurrence: null }
        : {
            recurrence: {
              type: target.value,
              interval: Number(state.taskPageDraft.recurrenceInterval) || 1,
            },
          };
    await flushTaskPageDraft(patch);
    hooks.renderTodos?.();
    return;
  }

  // --- Metadata fields ---
  if (
    target.id === "taskPageEmotionalStateSelect" &&
    target instanceof HTMLSelectElement
  ) {
    state.taskPageDraft.emotionalState = target.value;
    await flushTaskPageDraft({ emotionalState: target.value || null });
    return;
  }

  if (
    target.id === "taskPageArchivedToggle" &&
    target instanceof HTMLInputElement
  ) {
    state.taskPageDraft.archived = !!target.checked;
    await flushTaskPageDraft({ archived: !!target.checked });
  }
}

export function bindTaskDetailSurfaceHandlers() {
  if (window.__taskDetailSurfaceHandlersBound) return;
  window.__taskDetailSurfaceHandlersBound = true;

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.inlineTitleInput) {
      onInlineTitleInput(event);
      return;
    }
    if (
      target instanceof HTMLTextAreaElement &&
      target.dataset.inlineDescriptionInput
    ) {
      onInlineDescriptionInput(event);
      return;
    }
    if (
      target instanceof HTMLInputElement &&
      target.id === "taskPageTitleInput"
    ) {
      onTaskPageTitleInput(event);
      return;
    }
    if (
      target instanceof HTMLTextAreaElement &&
      target.id === "taskPageDescriptionTextarea"
    ) {
      onTaskPageDescriptionInput(event);
      return;
    }
    if (
      target instanceof HTMLTextAreaElement &&
      target.id === "taskPageNotesTextarea"
    ) {
      onTaskPageNotesInput(event);
      return;
    }
    // Track draft changes for blur-save text fields on the task page
    const taskPageTextFields = {
      taskPageFirstStepInput: "firstStep",
      taskPageContextInput: "context",
      taskPageWaitingOnInput: "waitingOn",
      taskPageTagsInput: "tagsText",
      taskPageCategoryInput: "categoryDetail",
      taskPageEstimateInput: "estimateMinutes",
      taskPageRecurrenceInterval: "recurrenceInterval",
    };
    if (
      target instanceof HTMLInputElement &&
      taskPageTextFields[target.id] &&
      state.taskPageDraft
    ) {
      state.taskPageDraft[taskPageTextFields[target.id]] = target.value;
      setTaskPageSaveState("idle");
    }
  });

  document.addEventListener(
    "blur",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target instanceof HTMLInputElement &&
        target.dataset.inlineTitleInput
      ) {
        const todoId = String(target.dataset.inlineTitleInput || "");
        if (state.inlineTaskEditorSaveTimer) {
          clearTimeout(state.inlineTaskEditorSaveTimer);
          state.inlineTaskEditorSaveTimer = null;
        }
        if (isInlineDraftDirty(todoId)) {
          void saveInlineTaskDraft(todoId);
        }
        return;
      }
      if (
        target instanceof HTMLTextAreaElement &&
        target.dataset.inlineDescriptionInput
      ) {
        const todoId = String(target.dataset.inlineDescriptionInput || "");
        if (state.inlineTaskEditorSaveTimer) {
          clearTimeout(state.inlineTaskEditorSaveTimer);
          state.inlineTaskEditorSaveTimer = null;
        }
        if (isInlineDraftDirty(todoId)) {
          void saveInlineTaskDraft(todoId);
        }
        return;
      }
      if (target.id === "taskPageTitleInput") {
        void flushTaskPageTextField("title");
        return;
      }
      if (target.id === "taskPageDescriptionTextarea") {
        void flushTaskPageTextField("description");
        return;
      }
      if (target.id === "taskPageNotesTextarea") {
        void flushTaskPageTextField("notes");
        return;
      }
      // Blur-save for promoted task page fields
      const blurSaveMap = {
        taskPageFirstStepInput: "firstStep",
        taskPageContextInput: "context",
        taskPageWaitingOnInput: "waitingOn",
        taskPageTagsInput: "tags",
        taskPageCategoryInput: "category",
        taskPageEstimateInput: "estimateMinutes",
        taskPageRecurrenceInterval: "recurrenceInterval",
      };
      if (blurSaveMap[target.id]) {
        void flushTaskPageTextField(blurSaveMap[target.id]);
      }
    },
    true,
  );

  document.addEventListener("change", (event) => {
    void onTaskPageChange(event);
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target instanceof HTMLInputElement && target.dataset.inlineTitleInput) {
      const todoId = String(target.dataset.inlineTitleInput || "");
      if (event.key === "Escape") {
        event.preventDefault();
        closeInlineDescriptionEditor(todoId);
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (state.inlineTaskEditorSaveTimer) {
          clearTimeout(state.inlineTaskEditorSaveTimer);
          state.inlineTaskEditorSaveTimer = null;
        }
        void saveInlineTaskDraft(todoId);
      }
      return;
    }

    if (
      target instanceof HTMLTextAreaElement &&
      target.dataset.inlineDescriptionInput
    ) {
      const todoId = String(target.dataset.inlineDescriptionInput || "");
      if (event.key === "Escape") {
        event.preventDefault();
        closeInlineDescriptionEditor(todoId);
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (state.inlineTaskEditorSaveTimer) {
          clearTimeout(state.inlineTaskEditorSaveTimer);
          state.inlineTaskEditorSaveTimer = null;
        }
        void saveInlineTaskDraft(todoId);
      }
      return;
    }

    if (
      target.id === "taskPageTitleInput" ||
      target.id === "taskPageDescriptionTextarea" ||
      target.id === "taskPageNotesTextarea"
    ) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTaskPage();
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const fieldMap = {
          taskPageTitleInput: "title",
          taskPageDescriptionTextarea: "description",
          taskPageNotesTextarea: "notes",
        };
        void flushTaskPageTextField(fieldMap[target.id] || "title");
      }
    }
  });

  window.addEventListener("popstate", () => {
    syncTaskPageRouteFromLocation();
  });
}

// --- Delete from task page ---

async function deleteTaskFromTaskPage(todoId) {
  if (!todoId) return;
  try {
    await hooks.deleteTodo?.(todoId);
    closeTaskPage();
  } catch (error) {
    console.error("Failed to delete task:", error);
  }
}

// --- Subtask management on task page ---

async function addSubtaskFromTaskPage(todoId) {
  const input = document.getElementById("taskPageSubtaskInput");
  if (!(input instanceof HTMLInputElement)) return;
  const title = input.value.trim();
  if (!title) return;
  input.value = "";
  try {
    await hooks.addSubtask?.(todoId, title);
    await hooks.loadTodos?.();
    hooks.renderTodos?.();
  } catch (error) {
    console.error("Failed to add subtask:", error);
  }
}

async function deleteSubtaskFromTaskPage(todoId, subtaskId) {
  try {
    await hooks.deleteSubtask?.(todoId, subtaskId);
    await hooks.loadTodos?.();
    hooks.renderTodos?.();
  } catch (error) {
    console.error("Failed to delete subtask:", error);
  }
}

// --- Task picker mount for dependencies ---

export function mountTaskPageDependsPicker() {
  const container = document.getElementById("taskPageDependsOnPicker");
  if (!container || !state.taskPageDraft || !state.taskPageTodoId) return;
  if (activeTaskPageDepPicker) {
    activeTaskPageDepPicker.destroy?.();
    activeTaskPageDepPicker = null;
  }
  const selectedIds = (state.taskPageDraft.dependsOnTaskIdsText || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  activeTaskPageDepPicker = mountTaskPicker(container, {
    selectedIds,
    getTodos: () => state.todos || [],
    excludeId: state.taskPageTodoId,
    onChange: (ids) => {
      if (state.taskPageDraft) {
        state.taskPageDraft.dependsOnTaskIdsText = ids.join(", ");
      }
      void flushTaskPageDraft({ dependsOnTaskIds: ids });
    },
  });
}

function registerWindowBridge() {
  window.openTodoFromRow = openTodoFromRow;
  window.openInlineTaskEditor = openInlineTaskEditor;
  window.openInlineDescriptionEditor = openInlineDescriptionEditor;
  window.closeInlineDescriptionEditor = closeInlineDescriptionEditor;
  window.openDrawerFromInline = openDrawerFromInline;
  window.openTaskPage = openTaskPage;
  window.openTaskPageFromInline = openTaskPageFromInline;
  window.openTaskPageFromDrawer = openTaskPageFromDrawer;
  window.closeTaskPage = closeTaskPage;
  window.openDrawerFromTaskPage = openDrawerFromTaskPage;
  window.addSubtaskFromTaskPage = addSubtaskFromTaskPage;
  window.deleteSubtaskFromTaskPage = deleteSubtaskFromTaskPage;
  window.deleteTaskFromTaskPage = deleteTaskFromTaskPage;
}

export function initTaskDetailSurface() {
  registerWindowBridge();
  syncTaskPageRouteFromLocation();
}
