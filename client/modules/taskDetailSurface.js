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

const TASK_ROUTE_PREFIX = "#task/";

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
    description:
      typeof override.description === "string"
        ? override.description
        : String(todo?.description || ""),
  };
}

function buildTaskPageDraft(todo, override = {}) {
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
    status: String(
      override.status || todo?.status || (todo?.completed ? "done" : "next"),
    ),
    completed:
      typeof override.completed === "boolean"
        ? override.completed
        : !!todo?.completed,
    dueDate:
      typeof hooks.toDateInputValue === "function"
        ? hooks.toDateInputValue(override.dueDate ?? todo?.dueDate)
        : String((override.dueDate ?? todo?.dueDate) || ""),
    project: String(
      override.project ??
        override.category ??
        todo?.category ??
        todo?.project ??
        "",
    ),
    priority: String(override.priority || todo?.priority || "medium"),
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
    }, 1200);
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
    }, 1200);
  }
}

function renderSaveStateLabel(saveState, message = "") {
  if (saveState === "saving") return "Saving...";
  if (saveState === "saved") return "Saved";
  if (saveState === "error") return message || "Save failed";
  return "Ready";
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
            <li class="task-page__subtask ${subtask?.completed ? "task-page__subtask--done" : ""}">
              <label>
                <input
                  type="checkbox"
                  ${subtask?.completed ? "checked" : ""}
                  data-onchange="toggleSubtask('${todoId}', '${subtaskId}')"
                />
                <span>${title}</span>
              </label>
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
          <div class="todo-inline-editor__title">Description</div>
        </div>
        <div class="todo-inline-editor__status" data-state="${escapeHtml(state.inlineTaskEditorSaveState)}">${saveLabel}</div>
      </div>
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

  return `
    <section class="task-page" data-task-page-for="${todoId}">
      <div class="task-page__hero">
        <div class="task-page__hero-main">
          <button type="button" class="mini-btn task-page__back-btn" data-onclick="closeTaskPage()">Back to list</button>
          <div class="task-page__save-state" data-state="${escapeHtml(state.taskPageSaveState)}">${saveLabel}</div>
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
            <textarea
              id="taskPageDescriptionTextarea"
              class="task-page__description"
              maxlength="1000"
              placeholder="Add context, notes, or acceptance criteria"
            >${escapeHtml(draft.description)}</textarea>
          </section>
          <section class="task-page__section">
            <div class="task-page__section-header">
              <div class="task-page__section-title">Subtasks</div>
              <button type="button" class="mini-btn" data-onclick="openDrawerFromTaskPage('${todoId}')">Manage in quick panel</button>
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
                <option value="inbox" ${draft.status === "inbox" ? "selected" : ""}>Inbox</option>
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
        </aside>
      </div>
    </section>
  `;
}

async function saveInlineDescription(todoId) {
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

export function openInlineDescriptionEditor(todoId) {
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
      `[data-inline-description-input="${String(todoId).replace(/["\\]/g, "\\$&")}"]`,
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

export function closeInlineDescriptionEditor(todoId = "") {
  if (todoId && state.inlineTaskEditorTodoId !== todoId) return;
  if (state.inlineTaskEditorSaveTimer) {
    clearTimeout(state.inlineTaskEditorSaveTimer);
    state.inlineTaskEditorSaveTimer = null;
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
    state.inlineTaskEditorDraft.description =
      readInlineDescriptionValue(todoId);
  }
  const saved = await saveInlineDescription(todoId);
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
    state.inlineTaskEditorDraft.description =
      readInlineDescriptionValue(todoId);
  }
  const saved = await saveInlineDescription(todoId);
  if (!saved) return;
  const todo = getTodoById(todoId);
  if (!todo) return;
  const draft = buildTaskPageDraft(todo, {
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
    void saveInlineDescription(todoId);
  }, 450);
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
  }, 450);
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
    await flushTaskPageDraft({
      priority: target.value,
    });
  }
}

export function bindTaskDetailSurfaceHandlers() {
  if (window.__taskDetailSurfaceHandlersBound) return;
  window.__taskDetailSurfaceHandlersBound = true;

  document.addEventListener("input", (event) => {
    const target = event.target;
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
    }
  });

  document.addEventListener(
    "blur",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target instanceof HTMLTextAreaElement &&
        target.dataset.inlineDescriptionInput
      ) {
        const todoId = String(target.dataset.inlineDescriptionInput || "");
        if (state.inlineTaskEditorSaveTimer) {
          clearTimeout(state.inlineTaskEditorSaveTimer);
          state.inlineTaskEditorSaveTimer = null;
        }
        void saveInlineDescription(todoId);
        return;
      }
      if (target.id === "taskPageTitleInput") {
        void flushTaskPageTextField("title");
        return;
      }
      if (target.id === "taskPageDescriptionTextarea") {
        void flushTaskPageTextField("description");
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
        void saveInlineDescription(todoId);
      }
      return;
    }

    if (
      target.id === "taskPageTitleInput" ||
      target.id === "taskPageDescriptionTextarea"
    ) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTaskPage();
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void flushTaskPageTextField(
          target.id === "taskPageTitleInput" ? "title" : "description",
        );
      }
    }
  });

  window.addEventListener("popstate", () => {
    syncTaskPageRouteFromLocation();
  });
}

function registerWindowBridge() {
  window.openInlineDescriptionEditor = openInlineDescriptionEditor;
  window.closeInlineDescriptionEditor = closeInlineDescriptionEditor;
  window.openDrawerFromInline = openDrawerFromInline;
  window.openTaskPage = openTaskPage;
  window.openTaskPageFromInline = openTaskPageFromInline;
  window.openTaskPageFromDrawer = openTaskPageFromDrawer;
  window.closeTaskPage = closeTaskPage;
  window.openDrawerFromTaskPage = openDrawerFromTaskPage;
}

export function initTaskDetailSurface() {
  registerWindowBridge();
  syncTaskPageRouteFromLocation();
}
