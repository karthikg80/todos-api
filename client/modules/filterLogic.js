// =============================================================================
// filterLogic.js — Filter pipeline, rendering, date/workspace views.
// Imports state from store.js. Cross-module calls go through hooks.
// =============================================================================
/**
 * filterLogic.js — Filter/sort entry point and project selection API.
 *
 * DOM Coupling Policy:
 * Functions in the "DOM Boundary Layer" section below intentionally read or
 * write DOM elements. This is acceptable for view-controller glue.
 *
 * Functions OUTSIDE that section must not contain getElementById/querySelector.
 * Pass values as parameters instead so they remain unit-testable.
 */
import { state, hooks } from "./store.js";
import { applyDomainAction } from "./stateActions.js";
import { renderTodoRowTemplate } from "./uiTemplates.js";
import {
  buildVisibleTodosQueryParams,
  clearVisibleTodosState,
  getVisibleTodosOverride,
  loadVisibleTodos,
  shouldUseServerVisibleTodos,
} from "./todosService.js";

// ---------------------------------------------------------------------------
// Utility functions injected via hooks by app.js:
//   hooks.normalizeProjectPath, hooks.PROJECT_PATH_SEPARATOR
//   hooks.isInternalCategoryPath, hooks.escapeHtml
//   hooks.getProjectHeadings (from projectsState)
//   hooks.renderProjectOptions (from projectsState)
//   hooks.renderTodoChips, hooks.renderSubtasks (from app.js)
//   hooks.buildHomeTileListByKey (from app.js)
//   hooks.buildIcsContentForTodos, hooks.buildIcsFilename (from utils/icsExport.js)
//   hooks.showMessage (from utils/utils.js)
// ---------------------------------------------------------------------------

// =============================================================================
// DOM Boundary Layer — functions below intentionally read/write DOM elements.
// This is acceptable view-controller glue. Do not add getElementById calls
// outside this section.
// =============================================================================
function setDateView(view, { skipApply = false } = {}) {
  state.currentDateView = view;
  const ids = {
    all: "dateViewAll",
    today: "dateViewToday",
    upcoming: "dateViewUpcoming",
    next_month: "dateViewNextMonth",
    someday: "dateViewSomeday",
    waiting: "dateViewWaiting",
    scheduled: "dateViewScheduled",
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
      applyDomainAction("workspace/view:set", { view });
    } else {
      applyDomainAction("workspace/view:set", { view: "all" });
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
// =============================================================================
// End DOM Boundary Layer
// =============================================================================

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
  applyDomainAction("homeDrilldown:clear");
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
    "inbox",
    "weekly-review",
    "cleanup",
    "project",
    "settings",
    "admin",
    "profile",
    "todos",
  ]);
  return valid.has(view) ? view : "home";
}

function isTodoUnsorted(todo) {
  const hasCategory = !!(todo.category && String(todo.category).trim());
  const hasProjectId = !!(todo.projectId && String(todo.projectId).trim());
  return !hasCategory && !hasProjectId;
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
  if (state.currentDateView === "waiting")
    return (
      !todo.completed && String(todo.status || "").toLowerCase() === "waiting"
    );
  if (state.currentDateView === "scheduled")
    return !todo.completed && !!todo.scheduledDate;

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

function getVisibleTodos({ searchQuery } = {}) {
  const currentSearchQuery =
    typeof searchQuery === "string" ? searchQuery : getSearchInputValue();
  const queryParams = buildVisibleTodosQueryParams();
  if (shouldUseServerVisibleTodos(queryParams)) {
    const override = getVisibleTodosOverride();
    if (Array.isArray(override)) {
      return filterTodosList(override, { searchQuery: currentSearchQuery });
    }
  }
  return filterTodosList(state.todos, { searchQuery: currentSearchQuery });
}

function getVisibleDueDatedTodos(options) {
  return getVisibleTodos(options).filter((todo) => !!todo.dueDate);
}

// =============================================================================
// DOM Boundary Layer — functions below intentionally read/write DOM elements.
// This is acceptable view-controller glue. Do not add getElementById calls
// outside this section.
// =============================================================================
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
// =============================================================================
// End DOM Boundary Layer
// =============================================================================

function filterTodosList(todosList, { searchQuery = "" } = {}) {
  let filtered = todosList;

  if (isUnsortedWorkspaceActive()) {
    filtered = filtered.filter((todo) => isTodoUnsorted(todo));
  }

  const categoryFilter = getSelectedProjectKey();
  if (categoryFilter) {
    const filterProjectRecord = hooks.getProjectRecordByName?.(categoryFilter);
    const filterProjectId = filterProjectRecord?.id
      ? String(filterProjectRecord.id)
      : null;
    filtered = filtered.filter((todo) => {
      // Check by canonical projectId first
      if (
        filterProjectId &&
        todo.projectId &&
        String(todo.projectId) === filterProjectId
      ) {
        return true;
      }
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

  const normalizedSearchQuery = String(searchQuery).toLowerCase().trim();
  if (normalizedSearchQuery) {
    filtered = filtered.filter(
      (todo) =>
        todo.title.toLowerCase().includes(normalizedSearchQuery) ||
        (todo.description &&
          todo.description.toLowerCase().includes(normalizedSearchQuery)) ||
        (todo.category &&
          todo.category.toLowerCase().includes(normalizedSearchQuery)),
    );
  }

  filtered = filtered.filter((todo) => matchesDateView(todo));

  // Exclude archived todos by default (unless viewing completed)
  if (state.currentDateView !== "completed") {
    filtered = filtered.filter((todo) => !todo.archived);
  }

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
    const queryParams = buildVisibleTodosQueryParams();
    if (shouldUseServerVisibleTodos(queryParams)) {
      void loadVisibleTodos();
    } else {
      clearVisibleTodosState();
    }
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

// =============================================================================
// DOM Boundary Layer — functions below intentionally read/write DOM elements.
// This is acceptable view-controller glue. Do not add getElementById calls
// outside this section.
// =============================================================================
function getSearchInputValue() {
  // DOM read: intentional boundary — reads current filter state from DOM
  const searchInput = document.getElementById("searchInput");
  if (searchInput instanceof HTMLInputElement) {
    return searchInput.value;
  }

  // DOM read: intentional boundary — reads current filter state from DOM
  const sheetSearch = document.getElementById("searchInputSheet");
  if (sheetSearch instanceof HTMLInputElement) {
    return sheetSearch.value;
  }

  return "";
}

function clearFilters() {
  applyDomainAction("workspace/view:set", { view: "all" });
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
  // DOM read: intentional boundary — reads current filter state from DOM
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

  applyDomainAction("projectSelection:set", { projectName: nextValue });
  syncWorkspaceViewState();
  if (!skipApply) {
    applyFiltersAndRender({ reason });
  }
  hooks.renderProjectHeadingCreateButton?.();
  hooks.scheduleLoadSelectedProjectHeadings?.();
  return nextValue;
}
// =============================================================================
// End DOM Boundary Layer
// =============================================================================

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
    waiting: "Waiting",
    scheduled: "Scheduled",
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

// =============================================================================
// DOM Boundary Layer — functions below intentionally read/write DOM elements.
// This is acceptable view-controller glue. Do not add getElementById calls
// outside this section.
// =============================================================================
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

  return renderTodoRowTemplate({
    todo,
    isSelected,
    isActive: state.selectedTodoId === todo.id,
    kebabExpanded: state.openTodoKebabId === todo.id,
    descriptionHtml: todo.description
      ? `<div class="todo-description">${hooks.escapeHtml?.(todo.description)}</div>`
      : "",
    metaHtml: hooks.renderTodoChips?.(todo, { isOverdue, dueDateStr }) ?? "",
    subtasksHtml:
      todo.subtasks && todo.subtasks.length > 0
        ? (hooks.renderSubtasks?.(todo) ?? "")
        : "",
    notesHtml:
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
        : "",
    projectOptionsHtml:
      hooks.renderProjectOptions?.(String(todo.category || "")) ?? "",
    headingMoveOptionsHtml: renderHeadingMoveOptions(todo),
  });
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

  hooks.patchProjectsRailView?.();
  hooks.renderTodayPlanPanel?.();
  hooks.renderDayPlanAgentPanel?.();
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

  if (state.currentWorkspaceView === "inbox") {
    updateHeaderFromVisibleTodos([]);
    hooks.renderInboxView?.();
    if (!state.inboxState.hasLoaded && !state.inboxState.loading) {
      hooks.loadInboxItems?.();
    }
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (state.currentWorkspaceView === "weekly-review") {
    updateHeaderFromVisibleTodos([]);
    hooks.renderWeeklyReviewView?.();
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (state.currentWorkspaceView === "cleanup") {
    updateHeaderFromVisibleTodos([]);
    hooks.renderCleanupView?.();
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
          <li class="todo-group-header" data-category-group-key="${hooks.escapeHtml?.(categoryLabel)}">
            <span>\u{1F4C1} ${hooks.escapeHtml?.(categoryLabel)}</span>
            <span data-category-group-stats="true">${stats.done}/${stats.total} done</span>
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
// =============================================================================
// End DOM Boundary Layer
// =============================================================================

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
