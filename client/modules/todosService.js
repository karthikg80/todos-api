// =============================================================================
// todosService.js — Todo CRUD, undo, reorder, bulk operations.
// Imports state from store.js. Cross-module calls go through hooks.
// =============================================================================
import { state, hooks, createInitialHomeAiState } from "./store.js";
import {
  hasTodoRow,
  patchBulkToolbar,
  patchHeaderCountsFromVisibleTodos,
  patchProjectsRailCounts,
  patchTodoById,
  patchTodoBulkSelected,
  patchVisibleCategoryGroupStats,
} from "./todosViewPatches.js";
import { EventBus } from "./eventBus.js";

// ---------------------------------------------------------------------------
// Helpers — apiCall, API_URL, normalizeProjectPath, parseApiBody are injected
// by app.js onto the hooks object after all modules load.
// ---------------------------------------------------------------------------

const visibleTodosState = {
  items: null,
  queryKey: "",
  pendingQueryKey: "",
  loading: false,
  requestSeq: 0,
};

function buildTodosQueryParams() {
  const params = {};
  params.sortBy = "order";
  params.sortOrder = "asc";
  return params;
}

function getSearchInputValue() {
  const primary = document.getElementById("searchInput");
  const sheet = document.getElementById("searchInputSheet");
  const raw =
    (primary instanceof HTMLInputElement && primary.value) ||
    (sheet instanceof HTMLInputElement && sheet.value) ||
    "";
  return raw.trim();
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function buildVisibleTodosQueryParams() {
  const params = buildTodosQueryParams();
  if (state.currentWorkspaceView === "home" || state.homeListDrilldownKey) {
    return params;
  }

  const selectedProject = hooks.getSelectedProjectKey?.() || "";
  if (selectedProject) {
    params.project = selectedProject;
  }

  if (state.currentWorkspaceView === "unsorted") {
    params.unsorted = true;
  }

  const search = getSearchInputValue();
  if (search) {
    params.search = search;
  }

  const now = new Date();
  if (state.currentDateView === "completed") {
    params.completed = true;
  } else if (state.currentDateView === "today") {
    params.dueDateFrom = startOfLocalDay(now).toISOString();
    params.dueDateTo = endOfLocalDay(now).toISOString();
  } else if (state.currentDateView === "upcoming") {
    params.dueDateAfter = endOfLocalDay(now).toISOString();
    params.dueDateTo = new Date(
      endOfLocalDay(now).getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
  } else if (state.currentDateView === "next_month") {
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthAfterNextStart = new Date(
      nextMonthStart.getFullYear(),
      nextMonthStart.getMonth() + 1,
      1,
    );
    params.dueDateFrom = nextMonthStart.toISOString();
    params.dueDateBefore = monthAfterNextStart.toISOString();
  } else if (state.currentDateView === "someday") {
    params.dueDateIsNull = true;
  }

  return params;
}

function getVisibleTodosQueryKey(params = buildVisibleTodosQueryParams()) {
  return new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
}

function shouldUseServerVisibleTodos(params = buildVisibleTodosQueryParams()) {
  return Object.keys(params).some(
    (key) => key !== "sortBy" && key !== "sortOrder",
  );
}

function clearVisibleTodosState() {
  visibleTodosState.items = null;
  visibleTodosState.queryKey = "";
  visibleTodosState.pendingQueryKey = "";
  visibleTodosState.loading = false;
}

function getVisibleTodosOverride() {
  const queryParams = buildVisibleTodosQueryParams();
  if (!shouldUseServerVisibleTodos(queryParams)) {
    return null;
  }
  const queryKey = getVisibleTodosQueryKey(queryParams);
  if (visibleTodosState.queryKey !== queryKey) {
    return null;
  }
  return Array.isArray(visibleTodosState.items)
    ? visibleTodosState.items
    : null;
}

function isVisibleTodosLoading() {
  if (!shouldUseServerVisibleTodos()) {
    return false;
  }
  return (
    visibleTodosState.loading &&
    visibleTodosState.pendingQueryKey === getVisibleTodosQueryKey()
  );
}

async function loadVisibleTodos({ force = false } = {}) {
  const queryParams = buildVisibleTodosQueryParams();
  if (!shouldUseServerVisibleTodos(queryParams)) {
    clearVisibleTodosState();
    return false;
  }

  const queryKey = getVisibleTodosQueryKey(queryParams);
  if (
    !force &&
    visibleTodosState.queryKey === queryKey &&
    Array.isArray(visibleTodosState.items) &&
    !visibleTodosState.loading
  ) {
    return true;
  }

  const requestSeq = visibleTodosState.requestSeq + 1;
  visibleTodosState.requestSeq = requestSeq;
  visibleTodosState.loading = true;
  visibleTodosState.pendingQueryKey = queryKey;
  EventBus.dispatch("todos:changed", { reason: "todos-loading" });

  try {
    const todosUrl = hooks.buildUrl(`${hooks.API_URL}/todos`, queryParams);
    const response = await hooks.apiCall(todosUrl);
    if (requestSeq !== visibleTodosState.requestSeq) {
      return true;
    }
    if (response && response.ok) {
      visibleTodosState.items = await response.json();
      visibleTodosState.queryKey = queryKey;
      visibleTodosState.loading = false;
      EventBus.dispatch("todos:changed", { reason: "todos-loaded" });
      return true;
    }
  } catch (error) {
    console.error("Visible todos query failed:", error);
  }

  if (requestSeq === visibleTodosState.requestSeq) {
    clearVisibleTodosState();
    EventBus.dispatch("todos:changed", { reason: "todos-load-error" });
  }
  return false;
}

async function refreshVisibleTodosIfNeeded() {
  if (!shouldUseServerVisibleTodos()) {
    clearVisibleTodosState();
    return;
  }
  await loadVisibleTodos({ force: true });
}

async function loadTodos() {
  state.todosLoadState = "loading";
  state.todosLoadErrorMessage = "";
  EventBus.dispatch("todos:changed", { reason: "todos-loading" });

  try {
    const queryParams = buildTodosQueryParams();
    const todosUrl = hooks.buildUrl(`${hooks.API_URL}/todos`, queryParams);
    const response = await hooks.apiCall(todosUrl);
    if (response && response.ok) {
      state.todos = await response.json();
      state.todosLoadState = "ready";
      state.todosLoadErrorMessage = "";
      state.homeAi = createInitialHomeAiState();
      await refreshVisibleTodosIfNeeded();
      EventBus.dispatch("todos:changed", { reason: "todos-loaded" });
      hooks.refreshProjectCatalog?.();
    } else {
      state.todos = [];
      state.selectedTodos.clear();
      state.homeAi = createInitialHomeAiState();
      clearVisibleTodosState();
      state.todosLoadState = "error";
      state.todosLoadErrorMessage = "Couldn't load tasks";
      EventBus.dispatch("todos:changed", { reason: "todos-load-error" });
      hooks.refreshProjectCatalog?.();
      hooks.showMessage?.("todosMessage", "Failed to load todos", "error");
    }
  } catch (error) {
    state.todos = [];
    state.selectedTodos.clear();
    state.homeAi = createInitialHomeAiState();
    clearVisibleTodosState();
    state.todosLoadState = "error";
    state.todosLoadErrorMessage = "Couldn't load tasks";
    EventBus.dispatch("todos:changed", { reason: "todos-load-error" });
    hooks.refreshProjectCatalog?.();
    console.error("Load todos error:", error);
  }
}

function retryLoadTodos() {
  loadTodos();
}

async function addTodo() {
  const input = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const notesInput = document.getElementById("todoNotesInput");
  const statusSelect = document.getElementById("todoStatusSelect");
  const startDateInput = document.getElementById("todoStartDateInput");
  const scheduledDateInput = document.getElementById("todoScheduledDateInput");
  const reviewDateInput = document.getElementById("todoReviewDateInput");
  const contextInput = document.getElementById("todoContextInput");
  const energySelect = document.getElementById("todoEnergySelect");
  const estimateInput = document.getElementById("todoEstimateInput");
  const tagsInput = document.getElementById("todoTagsInput");
  const waitingOnInput = document.getElementById("todoWaitingOnInput");
  const dependsOnInput = document.getElementById("todoDependsOnInput");

  if (state.quickEntryNaturalDateState.parseTimer) {
    clearTimeout(state.quickEntryNaturalDateState.parseTimer);
    state.quickEntryNaturalDateState.parseTimer = null;
  }
  await hooks.processQuickEntryNaturalDate?.({
    trigger: "submit",
    cleanupTitle: true,
  });

  const title = input.value.trim();
  if (!title) return;

  const payload = {
    title,
    priority: state.currentPriority,
  };

  const parseCommaSeparatedList = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const projectPath = hooks.normalizeProjectPath(projectSelect.value);
  if (projectPath) {
    payload.category = projectPath;
    const projectRecord = hooks.getProjectRecordByName?.(projectPath);
    if (projectRecord?.id) {
      payload.projectId = projectRecord.id;
    }
  }
  if (statusSelect instanceof HTMLSelectElement && statusSelect.value) {
    payload.status = statusSelect.value;
  }
  if (dueDateInput.value) {
    payload.dueDate = new Date(dueDateInput.value).toISOString();
  }
  if (
    startDateInput instanceof HTMLInputElement &&
    startDateInput.value.trim()
  ) {
    payload.startDate = new Date(startDateInput.value).toISOString();
  }
  if (
    scheduledDateInput instanceof HTMLInputElement &&
    scheduledDateInput.value.trim()
  ) {
    payload.scheduledDate = new Date(scheduledDateInput.value).toISOString();
  }
  if (
    reviewDateInput instanceof HTMLInputElement &&
    reviewDateInput.value.trim()
  ) {
    payload.reviewDate = new Date(reviewDateInput.value).toISOString();
  }
  if (contextInput instanceof HTMLInputElement && contextInput.value.trim()) {
    payload.context = contextInput.value.trim();
  }
  if (
    energySelect instanceof HTMLSelectElement &&
    String(energySelect.value || "").trim()
  ) {
    payload.energy = energySelect.value;
  }
  if (
    estimateInput instanceof HTMLInputElement &&
    estimateInput.value.trim() !== ""
  ) {
    payload.estimateMinutes = Number.parseInt(estimateInput.value, 10);
  }
  if (tagsInput instanceof HTMLInputElement && tagsInput.value.trim()) {
    payload.tags = parseCommaSeparatedList(tagsInput.value);
  }
  if (
    waitingOnInput instanceof HTMLInputElement &&
    waitingOnInput.value.trim()
  ) {
    payload.waitingOn = waitingOnInput.value.trim();
  }
  if (
    dependsOnInput instanceof HTMLTextAreaElement &&
    dependsOnInput.value.trim()
  ) {
    payload.dependsOnTaskIds = parseCommaSeparatedList(dependsOnInput.value);
  }
  if (notesInput.value.trim()) {
    payload.notes = notesInput.value.trim();
  }

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response && response.ok) {
      const newTodo = await response.json();
      state.todos.unshift(newTodo);
      await refreshVisibleTodosIfNeeded();
      EventBus.dispatch("todos:changed", { reason: "todo-added" });
      hooks.updateCategoryFilter?.();
      hooks.clearOnCreateDismissed?.(newTodo.id);

      // Clear form
      input.value = "";
      projectSelect.value = "";
      dueDateInput.value = "";
      if (statusSelect instanceof HTMLSelectElement) {
        statusSelect.value = "next";
      }
      if (startDateInput instanceof HTMLInputElement) {
        startDateInput.value = "";
      }
      if (scheduledDateInput instanceof HTMLInputElement) {
        scheduledDateInput.value = "";
      }
      if (reviewDateInput instanceof HTMLInputElement) {
        reviewDateInput.value = "";
      }
      if (contextInput instanceof HTMLInputElement) {
        contextInput.value = "";
      }
      if (energySelect instanceof HTMLSelectElement) {
        energySelect.value = "";
      }
      if (estimateInput instanceof HTMLInputElement) {
        estimateInput.value = "";
      }
      if (tagsInput instanceof HTMLInputElement) {
        tagsInput.value = "";
      }
      if (waitingOnInput instanceof HTMLInputElement) {
        waitingOnInput.value = "";
      }
      if (dependsOnInput instanceof HTMLTextAreaElement) {
        dependsOnInput.value = "";
      }
      notesInput.value = "";
      hooks.resetQuickEntryNaturalDueState?.();
      hooks.setQuickEntryPropertiesOpen?.(false, { persist: false });
      hooks.syncQuickEntryProjectActions?.();

      // Reset priority to medium
      hooks.setPriority?.("medium");
      hooks.updateQuickEntryPropertiesSummary?.();

      // Hide notes input
      notesInput.style.display = "none";
      document.getElementById("notesExpandIcon")?.classList.remove("expanded");
      hooks.updateTaskComposerDueClearButton?.();
      hooks.closeTaskComposer?.({ restoreFocus: false, force: true });

      const { createInitialOnCreateAssistState } = await import("./store.js");
      state.onCreateAssistState = {
        ...createInitialOnCreateAssistState(),
        dismissedTodoIds: state.onCreateAssistState.dismissedTodoIds,
      };
      state.onCreateAssistState.mode = "live";
      state.onCreateAssistState.liveTodoId = newTodo.id;
      state.onCreateAssistState.showFullAssist = true;
      state.onCreateAssistState.loading = true;
      hooks.renderOnCreateAssistRow?.();
      await hooks.loadOnCreateDecisionAssist?.(newTodo);

      if (
        state.onCreateAssistState.suggestions.length > 0 &&
        !state.isTaskComposerOpen
      ) {
        hooks.openTaskComposer?.();
      }

      hooks.refreshProjectCatalog?.();
    }
  } catch (error) {
    console.error("Add todo error:", error);
  }
}

async function toggleTodo(id, forceValue = null) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;

  const newCompletedValue = forceValue !== null ? forceValue : !todo.completed;

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: newCompletedValue }),
    });

    if (response && response.ok) {
      const updatedTodo = await response.json();
      state.todos = state.todos.map((t) => (t.id === id ? updatedTodo : t));
      const canPatchInPlace =
        !hooks.shouldUseServerVisibleTodos?.() &&
        state.currentWorkspaceView === "all" &&
        !state.homeListDrilldownKey &&
        hasTodoRow(id);

      if (canPatchInPlace) {
        patchTodoById(id, updatedTodo);
        patchVisibleCategoryGroupStats();
        patchProjectsRailCounts();
        patchHeaderCountsFromVisibleTodos();
        hooks.syncTodoDrawerStateWithRender?.();
      } else {
        await refreshVisibleTodosIfNeeded();
        EventBus.dispatch("todos:changed", { reason: "todo-toggled" });
      }

      if (forceValue === null && newCompletedValue) {
        addUndoAction("complete", { id }, "Todo marked as complete");
      }
    }
  } catch (error) {
    console.error("Toggle todo error:", error);
  }
}

async function deleteTodo(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return false;

  if (!(await hooks.showConfirmDialog?.("Delete this todo?"))) return false;

  const todoData = { ...todo };

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/todos/${id}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      state.todos = state.todos.filter((t) => t.id !== id);
      state.selectedTodos.delete(id);
      EventBus.dispatch("todos:changed", { reason: "todo-deleted" });
      hooks.updateCategoryFilter?.();

      addUndoAction("delete", todoData, "Todo deleted");
      await loadTodos();
      return true;
    }

    const errorData = response ? await response.json().catch(() => ({})) : {};
    hooks.showMessage?.(
      "todosMessage",
      errorData.error || "Failed to delete todo",
      "error",
    );
    return false;
  } catch (error) {
    hooks.showMessage?.(
      "todosMessage",
      "Network error while deleting todo",
      "error",
    );
    console.error("Delete todo error:", error);
    return false;
  }
}

async function moveTodoToProject(todoId, projectValue) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  const category =
    typeof projectValue === "string"
      ? hooks.normalizeProjectPath(projectValue)
      : "";

  try {
    const movePayload = { category: category || null };
    if (category) {
      const projectRecord = hooks.getProjectRecordByName?.(category);
      if (projectRecord?.id) {
        movePayload.projectId = projectRecord.id;
      }
    }
    const response = await hooks.apiCall(`${hooks.API_URL}/todos/${todoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movePayload),
    });
    if (!response || !response.ok) {
      throw new Error("Update failed");
    }
    const updated = await response.json();
    state.todos = state.todos.map((item) =>
      item.id === todoId ? updated : item,
    );
    if (category && !state.customProjects.includes(category)) {
      state.customProjects.push(category);
    }
    hooks.refreshProjectCatalog?.();
    await hooks.loadProjects?.();
    await refreshVisibleTodosIfNeeded();
    EventBus.dispatch("todos:changed", { reason: "todo-updated" });
  } catch (error) {
    console.error("Move todo project failed:", error);
    hooks.showMessage?.(
      "todosMessage",
      "Failed to move task to project",
      "error",
    );
  }
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoFromDateInput(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function validateTodoTitle(title) {
  if (!title || !title.trim()) {
    return "Task title is required";
  }
  return null;
}

async function applyTodoPatch(todoId, patch) {
  const response = await hooks.apiCall(`${hooks.API_URL}/todos/${todoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response || !response.ok) {
    const data = response ? await hooks.parseApiBody(response) : {};
    throw new Error(data.error || "Failed to update task");
  }

  const updatedTodo = await response.json();
  state.todos = state.todos.map((todo) =>
    todo.id === todoId ? updatedTodo : todo,
  );

  const projectIdentifier = updatedTodo?.projectId
    ? (state.projectRecords?.find(
        (r) => String(r.id) === String(updatedTodo.projectId),
      )?.name ??
      updatedTodo?.category ??
      "")
    : (updatedTodo?.category ?? "");
  const projectPath = hooks.normalizeProjectPath(projectIdentifier);
  if (projectPath && !state.customProjects.includes(projectPath)) {
    state.customProjects.push(projectPath);
  }
  hooks.refreshProjectCatalog?.();
  await hooks.loadProjects?.();
  await refreshVisibleTodosIfNeeded();

  return updatedTodo;
}

async function reorderTodos(draggedId, targetId, options = {}) {
  const { nextHeadingId = undefined, placement = "before" } = options;
  const draggedIndex = state.todos.findIndex((t) => t.id === draggedId);
  const targetIndex = state.todos.findIndex((t) => t.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  const [draggedTodo] = state.todos.splice(draggedIndex, 1);
  let insertIndex = targetIndex + (placement === "after" ? 1 : 0);
  if (draggedIndex < insertIndex) {
    insertIndex -= 1;
  }
  insertIndex = Math.max(0, Math.min(insertIndex, state.todos.length));
  state.todos.splice(insertIndex, 0, draggedTodo);

  if (nextHeadingId !== undefined) {
    draggedTodo.headingId = nextHeadingId;
  }

  state.todos.forEach((todo, index) => {
    todo.order = index;
  });

  EventBus.dispatch("todos:changed", { reason: "todos-reordered" });

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/todos/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        state.todos.map((todo) => ({
          id: todo.id,
          order: todo.order,
          ...(todo.id === draggedId &&
            nextHeadingId !== undefined && { headingId: nextHeadingId }),
        })),
      ),
    });

    if (!response || !response.ok) {
      console.error(
        "Failed to persist full todo ordering, reloading from server",
      );
      await loadTodos();
    } else {
      await refreshVisibleTodosIfNeeded();
    }
  } catch (error) {
    console.error("Failed to update todo order:", error);
    await loadTodos();
  }
}

function toggleSelectTodo(todoId) {
  if (state.selectedTodos.has(todoId)) {
    state.selectedTodos.delete(todoId);
  } else {
    state.selectedTodos.add(todoId);
  }
  patchTodoBulkSelected(todoId, state.selectedTodos.has(todoId));
  patchBulkToolbar();
}

function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  if (!(selectAllCheckbox instanceof HTMLInputElement)) return;
  const filteredTodos = hooks.getVisibleTodos?.() ?? [];

  if (selectAllCheckbox.checked) {
    filteredTodos.forEach((todo) => state.selectedTodos.add(todo.id));
  } else {
    filteredTodos.forEach((todo) => state.selectedTodos.delete(todo.id));
  }

  filteredTodos.forEach((todo) => {
    patchTodoBulkSelected(todo.id, state.selectedTodos.has(todo.id));
  });
  patchBulkToolbar();
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  if (!selectAllCheckbox) return;
  const filteredTodos = hooks.getVisibleTodos?.() ?? [];
  const allSelected =
    filteredTodos.length > 0 &&
    filteredTodos.every((todo) => state.selectedTodos.has(todo.id));

  selectAllCheckbox.checked = allSelected;
}

function updateBulkActionsVisibility() {
  patchBulkToolbar();
}

async function completeSelected() {
  if (state.selectedTodos.size === 0) return;

  const selectedIds = Array.from(state.selectedTodos);
  const completedIds = [];

  for (const todoId of selectedIds) {
    try {
      const response = await hooks.apiCall(`${hooks.API_URL}/todos/${todoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      if (response && response.ok) {
        const todo = state.todos.find((t) => t.id === todoId);
        if (todo) {
          todo.completed = true;
          completedIds.push(todoId);
        }
      }
    } catch (error) {
      console.error("Failed to complete todo:", error);
    }
  }

  if (completedIds.length > 0) {
    addUndoAction(
      "bulk-complete",
      completedIds,
      `${completedIds.length} todos marked as complete`,
    );
  }

  state.selectedTodos.clear();
  await refreshVisibleTodosIfNeeded();
  EventBus.dispatch("todos:changed", { reason: "bulk-action" });
}

async function deleteSelected() {
  if (state.selectedTodos.size === 0) return;

  if (
    !(await hooks.showConfirmDialog?.(
      `Delete ${state.selectedTodos.size} selected todo(s)?`,
    ))
  )
    return;

  const selectedIds = Array.from(state.selectedTodos);
  const deletedTodos = [];
  let deletedCount = 0;

  for (const todoId of selectedIds) {
    try {
      const response = await hooks.apiCall(`${hooks.API_URL}/todos/${todoId}`, {
        method: "DELETE",
      });

      if (response && response.ok) {
        const todo = state.todos.find((t) => t.id === todoId);
        if (todo) {
          deletedTodos.push({ ...todo });
        }
        state.todos = state.todos.filter((t) => t.id !== todoId);
        deletedCount += 1;
      } else {
        const errorData = response
          ? await response.json().catch(() => ({}))
          : {};
        console.error(
          "Failed to delete todo:",
          todoId,
          errorData.error || "Unknown error",
        );
      }
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  }

  if (deletedTodos.length > 0) {
    addUndoAction(
      "bulk-delete",
      deletedTodos,
      `${deletedTodos.length} todos deleted`,
    );
  }

  state.selectedTodos.clear();
  EventBus.dispatch("todos:changed", { reason: "bulk-action" });
  hooks.updateCategoryFilter?.();
  if (deletedCount > 0) {
    await loadTodos();
  }
}

function addUndoAction(action, data, message) {
  state.undoStack.push({ action, data, timestamp: Date.now() });

  if (state.undoStack.length > 10) {
    state.undoStack.shift();
  }

  showUndoToast(message);
}

function showUndoToast(message) {
  const toast = document.getElementById("undoToast");
  const messageEl = document.getElementById("undoMessage");

  if (messageEl) messageEl.textContent = message;
  if (toast) toast.classList.add("active");

  if (state.undoTimeout) {
    clearTimeout(state.undoTimeout);
  }

  state.undoTimeout = setTimeout(() => {
    if (toast) toast.classList.remove("active");
  }, 5000);
}

function performUndo() {
  if (state.undoStack.length === 0) return;

  const lastAction = state.undoStack.pop();
  const toast = document.getElementById("undoToast");
  if (toast) toast.classList.remove("active");

  switch (lastAction.action) {
    case "delete":
      restoreTodo(lastAction.data);
      break;
    case "complete":
      toggleTodo(lastAction.data.id, false);
      break;
    case "bulk-delete":
      lastAction.data.forEach((todo) => restoreTodo(todo));
      break;
    case "bulk-complete":
      lastAction.data.forEach((todoId) => toggleTodo(todoId, false));
      break;
  }
}

async function restoreTodo(todoData) {
  try {
    const createPayload = {
      title: todoData.title,
      description: todoData.description,
      category: todoData.category,
      projectId: todoData.projectId || null,
      dueDate: todoData.dueDate,
      priority: todoData.priority,
      notes: todoData.notes,
    };

    const response = await hooks.apiCall(`${hooks.API_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });

    if (response && response.ok) {
      const newTodo = await response.json();
      let todoToRender = newTodo;

      if (todoData.completed === true || Number.isInteger(todoData.order)) {
        const updateResponse = await hooks.apiCall(
          `${hooks.API_URL}/todos/${newTodo.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              completed: !!todoData.completed,
              ...(Number.isInteger(todoData.order)
                ? { order: todoData.order }
                : {}),
            }),
          },
        );

        if (updateResponse && updateResponse.ok) {
          todoToRender = await updateResponse.json();
        }
      }

      state.todos.push(todoToRender);
      state.todos.sort((a, b) => {
        const aOrder = Number.isInteger(a.order)
          ? a.order
          : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isInteger(b.order)
          ? b.order
          : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
      await refreshVisibleTodosIfNeeded();
      EventBus.dispatch("todos:changed", { reason: "undo-applied" });
      hooks.updateCategoryFilter?.();
    }
  } catch (error) {
    console.error("Failed to restore todo:", error);
  }
}

export {
  buildTodosQueryParams,
  buildVisibleTodosQueryParams,
  clearVisibleTodosState,
  getVisibleTodosOverride,
  isVisibleTodosLoading,
  loadVisibleTodos,
  shouldUseServerVisibleTodos,
  loadTodos,
  retryLoadTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  moveTodoToProject,
  toDateTimeLocalValue,
  toDateInputValue,
  toIsoFromDateInput,
  validateTodoTitle,
  applyTodoPatch,
  reorderTodos,
  toggleSelectTodo,
  toggleSelectAll,
  updateSelectAllCheckbox,
  updateBulkActionsVisibility,
  completeSelected,
  deleteSelected,
  addUndoAction,
  showUndoToast,
  performUndo,
  restoreTodo,
};
