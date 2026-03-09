// =============================================================================
// filterLogic.js — Filter pipeline, rendering, date/workspace views.
// Imports state from store.js. Cross-module calls go through hooks.
// =============================================================================
import { state, hooks } from "./store.js";

// ---------------------------------------------------------------------------
// Utility functions injected via hooks by app.js:
//   hooks.normalizeProjectPath, hooks.PROJECT_PATH_SEPARATOR
//   hooks.isInternalCategoryPath, hooks.escapeHtml
//   hooks.getProjectHeadings (from projectsState)
//   hooks.renderProjectOptions (from projectsState)
//   hooks.renderTodoChips, hooks.renderSubtasks (from app.js)
//   hooks.buildHomeTileListByKey (from app.js)
//   hooks.buildIcsContentForTodos, hooks.buildIcsFilename (from icsExport.js)
//   hooks.showMessage (from utils.js)
// ---------------------------------------------------------------------------

function setDateView(view, { skipApply = false } = {}) {
  state.currentDateView = view;
  const ids = {
    all: "dateViewAll",
    today: "dateViewToday",
    upcoming: "dateViewUpcoming",
    next_month: "dateViewNextMonth",
    someday: "dateViewSomeday",
    completed: "",
  };
  const suffixes = ["", "Sheet"];
  Object.values(ids)
    .filter(Boolean)
    .forEach((id) => {
      suffixes.forEach((suffix) => {
        document.getElementById(id + suffix)?.classList.remove("active");
      });
    });
  if (view !== "completed") {
    const activeId = ids[view] || ids.all;
    suffixes.forEach((suffix) => {
      document.getElementById(activeId + suffix)?.classList.add("active");
    });
  }
  if (!skipApply && !getSelectedProjectKey()) {
    if (view === "today" || view === "upcoming" || view === "completed") {
      state.currentWorkspaceView = view;
    } else {
      state.currentWorkspaceView = "all";
    }
    clearHomeListDrilldown();
  }
  syncWorkspaceViewState();
  if (!skipApply) {
    applyFiltersAndRender({ reason: "date-view" });
  }
}

function matchesWorkspaceView(view) {
  if (view === "home") {
    return !getSelectedProjectKey() && state.currentWorkspaceView === "home";
  }
  if (view === "unsorted") {
    return (
      !getSelectedProjectKey() && state.currentWorkspaceView === "unsorted"
    );
  }
  if (view === "all") {
    return (
      getSelectedProjectKey() === "" &&
      state.currentDateView === "all" &&
      state.currentWorkspaceView === "all" &&
      !hasHomeListDrilldown()
    );
  }
  if (view === "completed") {
    return (
      getSelectedProjectKey() === "" &&
      state.currentDateView === "completed" &&
      state.currentWorkspaceView === "completed"
    );
  }
  return (
    getSelectedProjectKey() === "" &&
    state.currentDateView === view &&
    state.currentWorkspaceView === view
  );
}

function syncWorkspaceViewState() {
  document
    .querySelectorAll(".workspace-view-item[data-workspace-view]")
    .forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      const view = item.getAttribute("data-workspace-view") || "all";
      const isActive = matchesWorkspaceView(view);
      item.classList.toggle("projects-rail-item--active", isActive);
      item.setAttribute("aria-selected", "false");
      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
}

function isHomeWorkspaceActive() {
  return !getSelectedProjectKey() && state.currentWorkspaceView === "home";
}

function isUnsortedWorkspaceActive() {
  return !getSelectedProjectKey() && state.currentWorkspaceView === "unsorted";
}

function hasHomeListDrilldown() {
  return !!state.homeListDrilldownKey;
}

function clearHomeListDrilldown() {
  state.homeListDrilldownKey = "";
}

function normalizeWorkspaceView(view) {
  const valid = new Set([
    "home",
    "unsorted",
    "all",
    "today",
    "upcoming",
    "next_month",
    "someday",
    "completed",
    "project",
    "settings",
    "admin",
    "profile",
    "todos",
  ]);
  return valid.has(view) ? view : "home";
}

function isTodoUnsorted(todo) {
  return !todo.category || String(todo.category).trim() === "";
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function matchesDateView(todo) {
  if (state.currentDateView === "all") return true;
  if (state.currentDateView === "completed") return !!todo.completed;

  const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  if (state.currentDateView === "someday") return !dueDate;
  if (!dueDate) return false;
  if (state.currentDateView === "today") return isSameLocalDay(dueDate, now);
  if (state.currentDateView === "upcoming") {
    const upcomingEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate > todayEnd && dueDate <= upcomingEnd;
  }
  if (state.currentDateView === "next_month") {
    const nextMonth = (now.getMonth() + 1) % 12;
    const nextMonthYear =
      now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    return (
      dueDate.getFullYear() === nextMonthYear &&
      dueDate.getMonth() === nextMonth
    );
  }
  return dueDate >= todayStart;
}

function getVisibleTodos() {
  return filterTodosList(state.todos);
}

function getVisibleDueDatedTodos() {
  return getVisibleTodos().filter((todo) => !!todo.dueDate);
}

function updateIcsExportButtonState() {
  const hasExportableTodos = getVisibleDueDatedTodos().length > 0;
  for (const id of ["exportIcsButton", "exportIcsButtonSheet"]) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !hasExportableTodos;
  }
}

function exportVisibleTodosToIcs() {
  const exportableTodos = getVisibleDueDatedTodos();
  if (!exportableTodos.length) {
    hooks.showMessage?.(
      "todosMessage",
      "No due-dated tasks in the current filtered view to export",
      "warning",
    );
    updateIcsExportButtonState();
    return;
  }

  const content = hooks.buildIcsContentForTodos(exportableTodos);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = hooks.buildIcsFilename();
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);

  hooks.showMessage?.(
    "todosMessage",
    `Exported ${exportableTodos.length} events.`,
    "success",
  );
}

function filterTodosList(todosList) {
  let filtered = todosList;

  if (isUnsortedWorkspaceActive()) {
    filtered = filtered.filter((todo) => isTodoUnsorted(todo));
  }

  const categoryFilter = getSelectedProjectKey();
  if (categoryFilter) {
    filtered = filtered.filter((todo) => {
      const todoProject = hooks.normalizeProjectPath(todo.category);
      if (!todoProject) return false;
      return (
        todoProject === categoryFilter ||
        todoProject.startsWith(
          `${categoryFilter}${hooks.PROJECT_PATH_SEPARATOR}`,
        )
      );
    });
  }

  const searchQuery = document
    .getElementById("searchInput")
    ?.value.toLowerCase()
    .trim();
  if (searchQuery) {
    filtered = filtered.filter(
      (todo) =>
        todo.title.toLowerCase().includes(searchQuery) ||
        (todo.description &&
          todo.description.toLowerCase().includes(searchQuery)) ||
        (todo.category && todo.category.toLowerCase().includes(searchQuery)),
    );
  }

  filtered = filtered.filter((todo) => matchesDateView(todo));

  if (hasHomeListDrilldown()) {
    const drilldownIds = new Set(
      (hooks.buildHomeTileListByKey?.(state.homeListDrilldownKey) ?? []).map(
        (todo) => String(todo.id),
      ),
    );
    filtered = filtered.filter((todo) => drilldownIds.has(String(todo.id)));
  }

  return filtered;
}

function applyFiltersAndRender({ reason = "unknown" } = {}) {
  if (state.isApplyingFiltersPipeline) return;
  state.isApplyingFiltersPipeline = true;
  try {
    filterTodos({ skipPipeline: true, reason });
    renderTodos();
    updateHeaderFromVisibleTodos(getVisibleTodos());
    hooks.syncTodoDrawerStateWithRender?.();
  } finally {
    state.isApplyingFiltersPipeline = false;
  }
}

function filterTodos({ skipPipeline = false, reason = "manual" } = {}) {
  if (skipPipeline) {
    return getVisibleTodos();
  }
  applyFiltersAndRender({ reason });
  return getVisibleTodos();
}

function clearFilters() {
  state.currentWorkspaceView = "all";
  clearHomeListDrilldown();
  setSelectedProjectKey("", {
    reason: "clear-filters-reset-project",
    skipApply: true,
  });
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  const sheetSearch = document.getElementById("searchInputSheet");
  if (sheetSearch) sheetSearch.value = "";
  setDateView("all", { skipApply: true });
  applyFiltersAndRender({ reason: "clear-filters" });
}

function getSelectedProjectFilterValue() {
  const filter = document.getElementById("categoryFilter");
  if (!(filter instanceof HTMLSelectElement)) return "";
  const normalized = hooks.normalizeProjectPath(filter.value);
  return hooks.isInternalCategoryPath?.(normalized) ? "" : normalized;
}

function getSelectedProjectKey() {
  return getSelectedProjectFilterValue();
}

function setSelectedProjectKey(
  value = "",
  { reason = "project-selection", skipApply = false } = {},
) {
  const filterSelect = document.getElementById("categoryFilter");
  if (!(filterSelect instanceof HTMLSelectElement)) return "";

  const normalizedValue =
    typeof value === "string" ? hooks.normalizeProjectPath(value) : "";
  const nextValue =
    normalizedValue && !hooks.isInternalCategoryPath?.(normalizedValue)
      ? normalizedValue
      : "";

  if (
    nextValue &&
    !Array.from(filterSelect.options).some((opt) => opt.value === nextValue)
  ) {
    hooks.updateCategoryFilter?.();
  }

  if (filterSelect.value !== nextValue) {
    filterSelect.value = nextValue;
  }

  if (nextValue) {
    state.currentWorkspaceView = "project";
    clearHomeListDrilldown();
  } else if (state.currentWorkspaceView === "project") {
    state.currentWorkspaceView = "all";
  }

  state.railRovingFocusKey = nextValue || "";
  syncWorkspaceViewState();
  if (!skipApply) {
    applyFiltersAndRender({ reason });
  }
  hooks.renderProjectHeadingCreateButton?.();
  hooks.scheduleLoadSelectedProjectHeadings?.();
  return nextValue;
}

function getSelectedProjectName() {
  return getSelectedProjectLabel(getSelectedProjectKey());
}

function getVisibleTodosCount(visibleTodos = []) {
  return Array.isArray(visibleTodos) ? visibleTodos.length : 0;
}

function getCurrentDateViewLabel() {
  const labels = {
    all: "",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed",
    next_month: "Next month",
    someday: "Someday",
  };
  return labels[state.currentDateView] || "";
}

function getSelectedProjectLabel(selectedProject) {
  if (!selectedProject && state.currentWorkspaceView === "home") return "Home";
  if (!selectedProject && state.currentWorkspaceView === "unsorted")
    return "Unsorted";
  if (!selectedProject) return "All tasks";
  return hooks.getProjectLeafName(selectedProject);
}

function formatVisibleTaskCount(taskCount) {
  return `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`;
}

function updateHeaderAndContextUI({
  projectName = "All tasks",
  visibleCount = 0,
  dateLabel = "",
} = {}) {
  const todosView = document.getElementById("todosView");
  const headerEl = document.getElementById("todosListHeader");
  const titleEl = document.getElementById("todosListHeaderTitle");
  const countEl = document.getElementById("todosListHeaderCount");
  const dateBadgeEl = document.getElementById("todosListHeaderDateBadge");
  if (
    !(headerEl instanceof HTMLElement) ||
    !(titleEl instanceof HTMLElement) ||
    !(countEl instanceof HTMLElement) ||
    !(dateBadgeEl instanceof HTMLElement)
  ) {
    return;
  }

  const surfaceMode = isHomeWorkspaceActive()
    ? "home"
    : getSelectedProjectKey()
      ? "project"
      : "list";
  const shouldShowHeader = surfaceMode === "list" || surfaceMode === "project";
  headerEl.hidden = !shouldShowHeader;
  headerEl.setAttribute("aria-hidden", String(!shouldShowHeader));
  if (todosView instanceof HTMLElement) {
    todosView.dataset.surfaceMode = surfaceMode;
  }

  titleEl.textContent = projectName;
  titleEl.setAttribute("title", projectName);
  countEl.textContent = formatVisibleTaskCount(visibleCount);

  if (dateLabel) {
    dateBadgeEl.hidden = false;
    dateBadgeEl.textContent = dateLabel;
  } else {
    dateBadgeEl.hidden = true;
    dateBadgeEl.textContent = "";
  }

  hooks.syncProjectHeaderActions?.();
  hooks.updateTopbarProjectsButton?.(projectName);
}

function getOpenTodos() {
  return state.todos.filter((todo) => !todo.completed);
}

function updateHeaderFromVisibleTodos(visibleTodos = []) {
  if (isHomeWorkspaceActive()) {
    updateHeaderAndContextUI({
      projectName: "Home",
      visibleCount: getOpenTodos().length,
      dateLabel: "",
    });
    return;
  }
  if (isUnsortedWorkspaceActive()) {
    updateHeaderAndContextUI({
      projectName: "Unsorted",
      visibleCount: getVisibleTodosCount(visibleTodos),
      dateLabel: "",
    });
    return;
  }
  if (hasHomeListDrilldown()) {
    updateHeaderAndContextUI({
      projectName: hooks.getHomeDrilldownLabel?.() || "Home",
      visibleCount: getVisibleTodosCount(visibleTodos),
      dateLabel: "",
    });
    return;
  }

  updateHeaderAndContextUI({
    projectName: getSelectedProjectName(),
    visibleCount: getVisibleTodosCount(visibleTodos),
    dateLabel: getCurrentDateViewLabel(),
  });
}

function assertNoHorizontalOverflow(container) {
  if (!(container instanceof HTMLElement)) return;
  const isOverflowing = container.scrollWidth > container.clientWidth;
  if (isOverflowing) {
    console.warn(
      "Horizontal overflow detected in",
      container.id || container.className,
    );
  }
}

function renderHeadingMoveOptions(todo) {
  const selectedProject = getSelectedProjectKey();
  if (!selectedProject) return "";
  const headings = hooks.getProjectHeadings?.(selectedProject) ?? [];
  if (!headings.length) return "";

  const options = headings
    .map(
      (h) =>
        `<option value="${h.id}"${String(todo.headingId) === String(h.id) ? " selected" : ""}>${hooks.escapeHtml?.(h.name)}</option>`,
    )
    .join("");

  return `
    <label class="todo-kebab-project-label">
      Move to heading
      <select data-onclick="event.stopPropagation()" data-onchange="moveTodoToHeading('${todo.id}', this.value)">
        <option value="">No heading</option>
        ${options}
      </select>
    </label>
  `;
}

function renderTodoRowHtml(todo) {
  const isOverdue =
    todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date();
  const dueDateStr = todo.dueDate
    ? new Date(todo.dueDate).toLocaleString()
    : "";
  const isSelected = state.selectedTodos.has(todo.id);
  const hasSubtasks = !!(todo.subtasks && todo.subtasks.length > 0);

  return `
    <li class="todo-item ${todo.completed ? "completed" : ""} ${state.selectedTodoId === todo.id ? "todo-item--active" : ""} ${isSelected ? "todo-item--bulk-selected" : ""}"
        draggable="true"
        data-todo-id="${todo.id}"
        tabindex="0"
        data-ondragstart="handleDragStart(event, this)"
        data-ondragover="handleDragOver(event, this)"
        data-ondrop="handleDrop(event, this)"
        data-ondragend="handleDragEnd(event, this)">
        <input
            type="checkbox"
            class="bulk-checkbox"
            aria-label="Select todo ${hooks.escapeHtml?.(todo.title)}"
            ${isSelected ? "checked" : ""}
            data-onchange="toggleSelectTodo('${todo.id}')"
            data-onclick="event.stopPropagation()"
        >
        <span class="drag-handle">\u22ee\u22ee</span>
        <input
            type="checkbox"
            class="todo-checkbox"
            aria-label="Mark todo ${hooks.escapeHtml?.(todo.title)} complete"
            ${todo.completed ? "checked" : ""}
            data-onchange="toggleTodo('${todo.id}')"
        >
        <div class="todo-content">
            <div class="todo-title" title="${hooks.escapeHtml?.(todo.title)}">${hooks.escapeHtml?.(todo.title)}</div>
            ${todo.description ? `<div class="todo-description">${hooks.escapeHtml?.(todo.description)}</div>` : ""}
            <div class="todo-meta">
                ${hooks.renderTodoChips?.(todo, { isOverdue, dueDateStr }) ?? ""}
            </div>
            ${hasSubtasks ? (hooks.renderSubtasks?.(todo) ?? "") : ""}
            ${
              todo.notes && todo.notes.trim()
                ? `
                <div class="notes-section">
                    <button class="notes-toggle" data-onclick="toggleNotes('${todo.id}', event)">
                        <span class="expand-icon" id="notes-icon-${todo.id}">\u25b6</span>
                        <span>\u{1F4DD} Notes</span>
                    </button>
                    <div class="notes-content" id="notes-content-${todo.id}" style="display: none;">
                        ${hooks.escapeHtml?.(String(todo.notes))}
                    </div>
                </div>
            `
                : ""
            }
        </div>
        <div class="todo-row-actions">
          <button
            type="button"
            class="todo-kebab"
            aria-label="More actions for ${hooks.escapeHtml?.(todo.title)}"
            aria-expanded="${state.openTodoKebabId === todo.id ? "true" : "false"}"
            data-onclick="toggleTodoKebab('${todo.id}', event)"
          >
            \u22ef
          </button>
          <div
            class="todo-kebab-menu ${state.openTodoKebabId === todo.id ? "todo-kebab-menu--open" : ""}"
            role="menu"
            aria-label="Actions for ${hooks.escapeHtml?.(todo.title)}"
          >
            <button type="button" class="todo-kebab-item" role="menuitem" data-onclick="openTodoFromKebab('${todo.id}', event)">
              Open details
            </button>
            <button type="button" class="todo-kebab-item" role="menuitem" data-onclick="openEditTodoFromKebab('${todo.id}', event)">
              Edit modal
            </button>
            <label class="todo-kebab-project-label">
              Move to project
              <select data-onclick="event.stopPropagation()" data-onchange="moveTodoToProject('${todo.id}', this.value)">
                ${hooks.renderProjectOptions?.(String(todo.category || "")) ?? ""}
              </select>
            </label>
            ${renderHeadingMoveOptions(todo)}
            <button
              type="button"
              class="todo-kebab-item"
              role="menuitem"
              ${hasSubtasks ? "disabled" : ""}
              data-onclick="aiBreakdownTodo('${todo.id}')"
            >
              ${hasSubtasks ? "AI Subtasks Generated" : "AI Break Down Into Subtasks"}
            </button>
            <button type="button" class="todo-kebab-item todo-kebab-item--danger" role="menuitem" data-onclick="openDrawerDangerZone('${todo.id}', event)">
              Delete
            </button>
          </div>
        </div>
    </li>
  `;
}

function renderProjectHeadingGroupedRows(projectTodos, projectName) {
  const headings = hooks.getProjectHeadings?.(projectName) ?? [];
  const normalizedProject = hooks.normalizeProjectPath(projectName);
  const todosForProject = [...projectTodos].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
  const headingsById = new Map(
    headings.map((heading) => [String(heading.id), heading]),
  );
  const unheaded = [];
  const grouped = new Map();
  headings.forEach((heading) => grouped.set(String(heading.id), []));

  todosForProject.forEach((todo) => {
    const todoProject = hooks.normalizeProjectPath(todo.category || "");
    if (normalizedProject && todoProject && todoProject !== normalizedProject) {
      unheaded.push(todo);
      return;
    }
    const headingId = String(todo.headingId || "");
    if (!headingId || !headingsById.has(headingId)) {
      unheaded.push(todo);
      return;
    }
    grouped.get(headingId).push(todo);
  });

  let rows = `
    <li class="project-inline-actions" aria-label="Project actions">
      <button
        type="button"
        class="project-inline-actions__task add-btn"
        data-onclick="openTaskComposer()"
      >
        New Task
      </button>
      <button
        type="button"
        class="project-inline-actions__heading mini-btn"
        data-onclick="createHeadingForSelectedProject()"
      >
        Add Heading
      </button>
    </li>
  `;
  if (!unheaded.length && !headings.length) {
    rows += `
      <li class="project-inline-empty">
        Start with a task or a heading. The project stays intentionally quiet until you add structure.
      </li>
    `;
  }
  rows += unheaded.map((todo) => renderTodoRowHtml(todo)).join("");
  headings.forEach((heading, headingIndex) => {
    const items = grouped.get(String(heading.id)) || [];
    const moveUpDisabled = headingIndex === 0;
    const moveDownDisabled = headingIndex === headings.length - 1;
    rows += `
      <li
        class="todo-heading-divider"
        data-heading-id="${hooks.escapeHtml?.(String(heading.id))}"
        draggable="true"
        data-ondragstart="handleHeadingDragStart(event, this)"
        data-ondragover="handleHeadingDragOver(event, this)"
        data-ondrop="handleHeadingDrop(event, this)"
        data-ondragend="handleHeadingDragEnd(event, this)"
      >
        <span class="todo-heading-divider__title">${hooks.escapeHtml?.(String(heading.name))}</span>
        <span class="todo-heading-divider__meta">
          <span class="todo-heading-divider__drag-handle" aria-hidden="true">⋮⋮</span>
          <span class="todo-heading-divider__count">${items.length}</span>
          <button
            type="button"
            class="todo-heading-divider__move-btn"
            aria-label="Move heading up"
            title="Move heading up"
            ${moveUpDisabled ? "disabled" : ""}
            data-onclick="moveProjectHeading('${hooks.escapeHtml?.(String(heading.id))}', -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="todo-heading-divider__move-btn"
            aria-label="Move heading down"
            title="Move heading down"
            ${moveDownDisabled ? "disabled" : ""}
            data-onclick="moveProjectHeading('${hooks.escapeHtml?.(String(heading.id))}', 1)"
          >
            ↓
          </button>
        </span>
      </li>
    `;
    rows += items.map((todo) => renderTodoRowHtml(todo)).join("");
  });
  return rows;
}

function renderTodos() {
  const container = document.getElementById("todosContent");
  if (!container) return;

  hooks.renderProjectsRail?.();
  hooks.renderTodayPlanPanel?.();
  const scrollRegion = document.getElementById("todosScrollRegion");

  if (state.todosLoadState !== "loading" && state.todos.length > 0) {
    state.todosLoadState = "ready";
    state.todosLoadErrorMessage = "";
  }

  if (state.todosLoadState === "loading") {
    hooks.clearHomeFocusDashboard?.();
    updateHeaderFromVisibleTodos([]);
    const skeletonRows = Array.from({ length: 6 })
      .map(
        () => `
          <li class="todo-item todo-skeleton-row" aria-hidden="true">
            <span class="skeleton-block skeleton-block--checkbox"></span>
            <span class="skeleton-block skeleton-block--drag"></span>
            <span class="skeleton-block skeleton-block--checkbox"></span>
            <div class="todo-content">
              <span class="skeleton-line"></span>
              <span class="skeleton-line skeleton-line--short"></span>
              <div class="todo-meta">
                <span class="skeleton-chip"></span>
                <span class="skeleton-chip"></span>
                <span class="skeleton-chip"></span>
              </div>
            </div>
            <div class="todo-row-actions">
              <span class="skeleton-block skeleton-block--kebab"></span>
            </div>
          </li>
        `,
      )
      .join("");

    container.innerHTML = `
      <div id="todosLoadingState" class="todo-list-state todo-list-state--loading" role="status" aria-live="polite">
        <p>Loading tasks...</p>
      </div>
      <ul class="todos-list todos-list--skeleton">
        ${skeletonRows}
      </ul>
    `;
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (state.todosLoadState === "error" && state.todos.length === 0) {
    hooks.clearHomeFocusDashboard?.();
    updateHeaderFromVisibleTodos([]);
    state.isTodoDrawerOpen = false;
    state.selectedTodoId = null;
    state.openTodoKebabId = null;
    container.innerHTML = `
      <div id="todosErrorState" class="todo-list-state todo-list-state--error" role="status" aria-live="polite">
        <div class="empty-state-icon">\u26a0\ufe0f</div>
        <h3>Couldn't load tasks</h3>
        <p>${hooks.escapeHtml?.(state.todosLoadErrorMessage || "Please check your connection and try again.")}</p>
        <button id="todosRetryLoadButton" class="mini-btn" data-onclick="retryLoadTodos()">Retry</button>
      </div>
    `;
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (isHomeWorkspaceActive()) {
    updateHeaderFromVisibleTodos([]);
    container.innerHTML = hooks.renderHomeDashboard?.() ?? "";
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (state.todos.length === 0 && !getSelectedProjectKey()) {
    hooks.clearHomeFocusDashboard?.();
    updateHeaderFromVisibleTodos([]);
    state.isTodoDrawerOpen = false;
    state.selectedTodoId = null;
    state.openTodoKebabId = null;
    container.innerHTML = `
                    <div id="todosEmptyState" class="empty-state">
                        <div class="empty-state-icon">\u2728</div>
                        <h3>No tasks yet</h3>
                        <p>Add your first task to get started with a calm, focused list.</p>
                        <p class="empty-state-hint">Tip: press Ctrl/Cmd + N to create a task.</p>
                    </div>
                `;
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  const filteredTodos = getVisibleTodos();
  hooks.renderHomeFocusDashboard?.([]);
  updateHeaderFromVisibleTodos(filteredTodos);
  if (
    state.openTodoKebabId &&
    !filteredTodos.some(
      (todo) => String(todo.id) === String(state.openTodoKebabId),
    )
  ) {
    state.openTodoKebabId = null;
  }
  const categorizedTodos = [...filteredTodos].sort((a, b) => {
    const categoryA = String(a.category || "Uncategorized");
    const categoryB = String(b.category || "Uncategorized");
    const categoryCompare = categoryA.localeCompare(categoryB);
    if (categoryCompare !== 0) return categoryCompare;
    return (a.order || 0) - (b.order || 0);
  });
  const categoryStats = new Map();
  for (const todo of categorizedTodos) {
    const key = String(todo.category || "Uncategorized");
    const stats = categoryStats.get(key) || { total: 0, done: 0 };
    stats.total += 1;
    if (todo.completed) stats.done += 1;
    categoryStats.set(key, stats);
  }

  let activeCategory = "";
  const selectedProjectKey = getSelectedProjectKey();
  const shouldGroupByHeading = !!selectedProjectKey;
  const rows = shouldGroupByHeading
    ? renderProjectHeadingGroupedRows(filteredTodos, selectedProjectKey)
    : categorizedTodos
        .map((todo) => {
          const categoryLabel = String(todo.category || "Uncategorized");
          const categoryChanged = categoryLabel !== activeCategory;
          if (categoryChanged) activeCategory = categoryLabel;
          const stats = categoryStats.get(categoryLabel) || {
            total: 0,
            done: 0,
          };
          const categoryHeader = categoryChanged
            ? `
          <li class="todo-group-header">
            <span>\u{1F4C1} ${hooks.escapeHtml?.(categoryLabel)}</span>
            <span>${stats.done}/${stats.total} done</span>
          </li>
        `
            : "";
          return `${categoryHeader}${renderTodoRowHtml(todo)}`;
        })
        .join("");

  container.innerHTML = `
                <ul class="todos-list">
                    ${rows}
                </ul>
            `;

  if (state.selectedTodoId && !hooks.getTodoById?.(state.selectedTodoId)) {
    state.isTodoDrawerOpen = false;
    state.selectedTodoId = null;
  }
  hooks.syncTodoDrawerStateWithRender?.();
  hooks.updateBulkActionsVisibility?.();
  updateIcsExportButtonState();
  assertNoHorizontalOverflow(scrollRegion);
}

export {
  setDateView,
  matchesWorkspaceView,
  syncWorkspaceViewState,
  isHomeWorkspaceActive,
  isUnsortedWorkspaceActive,
  hasHomeListDrilldown,
  clearHomeListDrilldown,
  normalizeWorkspaceView,
  isTodoUnsorted,
  isSameLocalDay,
  matchesDateView,
  getVisibleTodos,
  getVisibleDueDatedTodos,
  updateIcsExportButtonState,
  exportVisibleTodosToIcs,
  filterTodosList,
  applyFiltersAndRender,
  filterTodos,
  clearFilters,
  getSelectedProjectFilterValue,
  getSelectedProjectKey,
  setSelectedProjectKey,
  getSelectedProjectName,
  getVisibleTodosCount,
  getCurrentDateViewLabel,
  getSelectedProjectLabel,
  formatVisibleTaskCount,
  updateHeaderAndContextUI,
  getOpenTodos,
  updateHeaderFromVisibleTodos,
  assertNoHorizontalOverflow,
  renderHeadingMoveOptions,
  renderTodoRowHtml,
  renderProjectHeadingGroupedRows,
  renderTodos,
};
