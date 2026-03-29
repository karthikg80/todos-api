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
import { SOUL_COPY } from "./soulConfig.js";
import {
  buildVisibleTodosQueryParams,
  clearVisibleTodosState,
  getVisibleTodosOverride,
  loadVisibleTodos,
  shouldUseServerVisibleTodos,
} from "./todosService.js";
import {
  illustrationNoTasks,
  illustrationNoMatches,
  illustrationTodayClear,
  illustrationUpcomingEmpty,
  illustrationCompletedEmpty,
  illustrationLaterEmpty,
} from "../utils/illustrations.js";

// ---------------------------------------------------------------------------
// Submodule imports — pure predicates, workspace semantics, DOM header writes,
// and row/heading renderers extracted from this file.
// ---------------------------------------------------------------------------
import {
  isTodoUnsorted,
  isTodoNeedsOrganizing,
  isTodoNeedingTriage,
  isSameLocalDay,
  matchesDateView,
  getOpenTodos,
  getUniqueTagsWithCounts,
  getVisibleTodosCount,
} from "./filtering/todoSelectors.js";
import {
  normalizeWorkspaceView,
  hasHomeListDrilldown,
  clearHomeListDrilldown,
  isHomeWorkspaceActive,
  isTriageWorkspaceActive,
  isUnsortedWorkspaceActive,
  matchesWorkspaceView,
  getSelectedProjectFilterValue,
  getSelectedProjectKey,
  getCurrentDateViewLabel,
  getSelectedProjectLabel,
  getSelectedProjectName,
  formatVisibleTaskCount,
} from "./filtering/workspaceSemantics.js";
import {
  syncWorkspaceViewState,
  updateHeaderAndContextUI,
  updateHeaderFromVisibleTodos,
  assertNoHorizontalOverflow,
} from "./filtering/headerUi.js";
import {
  renderHeadingMoveOptions,
  renderTodoRowHtml,
  renderProjectHeadingGroupedRows,
} from "./filtering/todoListRenderer.js";

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
// =============================================================================
// End DOM Boundary Layer
// =============================================================================

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

  if (isTriageWorkspaceActive()) {
    filtered = filtered.filter((todo) => isTodoNeedsOrganizing(todo));
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

  if (state.activeTagFilter) {
    filtered = filtered.filter(
      (todo) =>
        Array.isArray(todo.tags) && todo.tags.includes(state.activeTagFilter),
    );
  }

  filtered = filtered.filter((todo) => matchesDateView(todo));

  // TODO(plan-filter): inject plan task IDs into filter pipeline
  // When state.currentDateView === "today" and planTodayTaskIds.length > 0,
  // filter filtered to only tasks whose id is in planTodayTaskIds, preserving
  // the plan's rank order. Import planTodayTaskIds from planTodayAgent.js and
  // add: if (state.currentDateView === "today" && planTodayTaskIds.length > 0) {
  //   const idSet = new Set(planTodayTaskIds);
  //   const byId = new Map(filtered.map(t => [String(t.id), t]));
  //   filtered = planTodayTaskIds.map(id => byId.get(id)).filter(Boolean);
  // }

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

function setActiveTagFilter(tag) {
  state.activeTagFilter = tag || "";
  filterTodos({ reason: "tag-filter" });
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
  state.activeTagFilter = "";
  setDateView("all", { skipApply: true });
  applyFiltersAndRender({ reason: "clear-filters" });
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

// =============================================================================
// DOM Boundary Layer — functions below intentionally read/write DOM elements.
// This is acceptable view-controller glue. Do not add getElementById calls
// outside this section.
// =============================================================================
function renderTodos() {
  const container = document.getElementById("todosContent");
  if (!container) return;

  hooks.patchProjectsRailView?.();
  const scrollRegion = document.getElementById("todosScrollRegion");
  hooks.syncTaskPageRouteFromLocation?.();

  if (state.taskPageTodoId) {
    const taskTodo = hooks.getTodoById?.(state.taskPageTodoId) || null;
    updateHeaderAndContextUI({
      projectName: taskTodo?.title || "Task",
      visibleCount: 1,
      dateLabel: "",
    });
    container.innerHTML = hooks.renderTaskPageSurface?.(taskTodo) ?? ""; // eslint-disable-line -- hardcoded HTML only, no user input
    hooks.mountTaskPageDependsPicker?.();
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (state.todosLoadState !== "loading" && state.todos.length > 0) {
    state.todosLoadState = "ready";
    state.todosLoadErrorMessage = "";
  }

  if (state.todosLoadState === "loading") {
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
    `; // eslint-disable-line -- hardcoded HTML only, no user input
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (state.todosLoadState === "error" && state.todos.length === 0) {
    updateHeaderFromVisibleTodos([]);
    state.isTodoDrawerOpen = false;
    state.selectedTodoId = null;
    state.openTodoKebabId = null;
    container.innerHTML = `
      <div id="todosErrorState" class="todo-list-state todo-list-state--error" role="status" aria-live="polite">
        <div class="empty-state-icon">&#x26A0;&#xFE0F;</div>
        <h3>Couldn't load tasks</h3>
        <p>${hooks.escapeHtml?.(state.todosLoadErrorMessage || "Please check your connection and try again.")}</p>
        <button id="todosRetryLoadButton" class="mini-btn" data-onclick="retryLoadTodos()">Retry</button>
      </div>
    `; // eslint-disable-line -- only escapeHtml'd user content used here
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (isTriageWorkspaceActive()) {
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
    container.innerHTML = hooks.renderHomeDashboard?.() ?? ""; // eslint-disable-line -- trusted hook output
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (state.todos.length === 0 && !getSelectedProjectKey()) {
    updateHeaderFromVisibleTodos([]);
    state.isTodoDrawerOpen = false;
    state.selectedTodoId = null;
    state.openTodoKebabId = null;
    // View-aware empty states — show contextual illustration even with zero
    // tasks so each sidebar view hints at its purpose.
    const zeroTaskMessages = {
      today: {
        illus: illustrationTodayClear,
        heading: "Nothing due today",
        sub: "Add a task and set it for today to see it here.",
      },
      upcoming: {
        illus: illustrationUpcomingEmpty,
        heading: "Nothing planned ahead",
        sub: "Plan something for later this week to stay on track.",
      },
      completed: {
        illus: illustrationCompletedEmpty,
        heading: "No completed tasks yet",
        sub: "Check one off to see it here.",
      },
      someday: {
        illus: illustrationLaterEmpty,
        heading: "No later tasks",
        sub: "Set something aside here until the time is right.",
      },
    };
    const zeroMsg = zeroTaskMessages[state.currentDateView];
    // All content below is hardcoded — no user input, safe for innerHTML
    container.innerHTML = zeroMsg // eslint-disable-line -- hardcoded HTML only, no user input
      ? `<div id="todosEmptyState" class="empty-state">
            ${zeroMsg.illus()}
            <h3>${zeroMsg.heading}</h3>
            <p>${zeroMsg.sub}</p>
          </div>`
      : `<div id="todosEmptyState" class="empty-state">
            ${illustrationNoTasks()}
            <h3>Ready when you are</h3>
            <p>Capture your first task and let the planning begin.</p>
            <p class="empty-state-hint">Tip: press Ctrl/Cmd + N to create a task.</p>
          </div>`;
    hooks.syncTodoDrawerStateWithRender?.();
    hooks.updateBulkActionsVisibility?.();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  const filteredTodos = getVisibleTodos();
  updateHeaderFromVisibleTodos(filteredTodos);
  const rolledOverTodos =
    state.currentDateView === "today"
      ? filteredTodos.filter((todo) => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          if (Number.isNaN(dueDate.getTime())) return false;
          const now = new Date();
          const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          return dueDate < todayStart;
        })
      : [];
  const firstRolledOverTodo = rolledOverTodos[0] || null;
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

  // Upcoming view: sort by due date and prepare day group headers
  const isUpcomingView = state.currentDateView === "upcoming";
  let upcomingLastDate = "";
  if (isUpcomingView) {
    categorizedTodos.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }

  // Today view: build overdue/today section label lookup
  const isTodayView = state.currentDateView === "today";
  let todaySectionState = null;
  if (isTodayView && filteredTodos.length > 0) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const hasOverdue = filteredTodos.some(
      (t) => t.dueDate && new Date(t.dueDate) < todayStart,
    );
    const hasDueToday = filteredTodos.some(
      (t) => !t.dueDate || new Date(t.dueDate) >= todayStart,
    );
    if (hasOverdue) {
      // Sort the rendered array (categorizedTodos) so overdue tasks appear first
      categorizedTodos.sort((a, b) => {
        const aOver = a.dueDate && new Date(a.dueDate) < todayStart ? 0 : 1;
        const bOver = b.dueDate && new Date(b.dueDate) < todayStart ? 0 : 1;
        return aOver - bOver;
      });
      todaySectionState = {
        todayStart,
        hasOverdue,
        hasBoth: hasOverdue && hasDueToday,
        injectedOverdue: false,
        injectedToday: false,
      };
    }
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
          // Suppress category headers in Today/Upcoming views — section
          // labels (Overdue/Due today/date headers) provide sufficient grouping
          const suppressCategoryHeaders = isTodayView || isUpcomingView;
          const categoryHeader =
            !suppressCategoryHeaders && categoryChanged
              ? `
          <li class="todo-group-header" data-category-group-key="${hooks.escapeHtml?.(categoryLabel)}">
            <span>&#x1F4C1; ${hooks.escapeHtml?.(categoryLabel)}</span>
            <span data-category-group-stats="true">${stats.done}/${stats.total} done</span>
          </li>
        `
              : "";
          // Upcoming view: inject date group headers
          let dateHeader = "";
          if (isUpcomingView && todo.dueDate) {
            const d = new Date(todo.dueDate);
            const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (dateKey !== upcomingLastDate) {
              upcomingLastDate = dateKey;
              const dayLabel = d.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              });
              dateHeader = `<li class="todo-section-label">${hooks.escapeHtml?.(dayLabel) || dayLabel}</li>`;
            }
          }
          // Today view: inject overdue/today section labels
          let sectionLabel = "";
          if (todaySectionState) {
            const isOverdue =
              todo.dueDate &&
              new Date(todo.dueDate) < todaySectionState.todayStart;
            if (isOverdue && !todaySectionState.injectedOverdue) {
              todaySectionState.injectedOverdue = true;
              sectionLabel =
                '<li class="todo-section-label todo-section-label--overdue">Still waiting</li>';
            } else if (
              !isOverdue &&
              !todaySectionState.injectedToday &&
              todaySectionState.hasBoth
            ) {
              todaySectionState.injectedToday = true;
              sectionLabel =
                '<li class="todo-section-label">Worth your energy today</li>';
            }
          }
          return `${dateHeader}${sectionLabel}${categoryHeader}${renderTodoRowHtml(todo)}`;
        })
        .join("");

  // View-specific empty state when filter yields no results
  // All content below is hardcoded — no user input, safe for innerHTML
  if (filteredTodos.length === 0 && state.todos.length > 0) {
    const viewMessages = {
      today: {
        heading: SOUL_COPY.todayEmptyHeading,
        sub: SOUL_COPY.todayEmptySubheading,
      },
      upcoming: {
        heading: "Nothing coming up",
        sub: "No tasks due in the next two weeks.",
      },
      completed: {
        heading: "No completed tasks yet",
        sub: "Completed tasks will appear here.",
      },
      someday: {
        heading: "No later tasks",
        sub: "Tasks without a due date appear here.",
      },
    };
    const msg = viewMessages[state.currentDateView] || {
      heading: "No matching tasks",
      sub: "Try adjusting your filters.",
    };
    const viewIllustrations = {
      today: illustrationTodayClear,
      upcoming: illustrationUpcomingEmpty,
      completed: illustrationCompletedEmpty,
      someday: illustrationLaterEmpty,
    };
    const illustrationFn =
      viewIllustrations[state.currentDateView] || illustrationNoMatches;
    container.innerHTML = // eslint-disable-line -- hardcoded HTML only, no user input
      '<div class="empty-state">' +
      illustrationFn() +
      "<h3>" +
      msg.heading +
      "</h3><p>" +
      msg.sub +
      "</p></div>";
  } else {
    const recoveryBanner =
      state.currentDateView === "today" && firstRolledOverTodo
        ? `
          <div class="today-recovery-banner" data-testid="today-recovery-banner">
            <div class="today-recovery-banner__copy">
              <h3>${hooks.escapeHtml?.(SOUL_COPY.rolledOverHeading) || SOUL_COPY.rolledOverHeading}</h3>
              <p>${hooks.escapeHtml?.(SOUL_COPY.rolledOverSubheading) || SOUL_COPY.rolledOverSubheading}</p>
            </div>
            <div class="today-recovery-banner__actions">
              <button type="button" class="mini-btn" data-onclick="startSmallerForTodo('${hooks.escapeHtml?.(String(firstRolledOverTodo.id)) || firstRolledOverTodo.id}')">Start smaller</button>
              <button type="button" class="mini-btn" data-onclick="moveTodoLater('${hooks.escapeHtml?.(String(firstRolledOverTodo.id)) || firstRolledOverTodo.id}')">Move later</button>
              <button type="button" class="mini-btn" data-onclick="markTodoNotNow('${hooks.escapeHtml?.(String(firstRolledOverTodo.id)) || firstRolledOverTodo.id}')">Not now</button>
              <button type="button" class="mini-btn" data-onclick="dropTodoFromList('${hooks.escapeHtml?.(String(firstRolledOverTodo.id)) || firstRolledOverTodo.id}')">Drop from list</button>
            </div>
          </div>`
        : "";
    container.innerHTML = `${recoveryBanner}<ul class="todos-list">${rows}</ul>`; // eslint-disable-line -- trusted rendered rows + recovery banner
  }

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
  // Local functions
  setDateView,
  getVisibleTodos,
  getVisibleDueDatedTodos,
  updateIcsExportButtonState,
  exportVisibleTodosToIcs,
  filterTodosList,
  applyFiltersAndRender,
  filterTodos,
  setActiveTagFilter,
  clearFilters,
  setSelectedProjectKey,
  renderTodos,
  // Re-exported from filtering/todoSelectors.js
  isTodoUnsorted,
  isTodoNeedsOrganizing,
  isTodoNeedingTriage,
  isSameLocalDay,
  matchesDateView,
  getOpenTodos,
  getUniqueTagsWithCounts,
  getVisibleTodosCount,
  // Re-exported from filtering/workspaceSemantics.js
  normalizeWorkspaceView,
  hasHomeListDrilldown,
  clearHomeListDrilldown,
  isHomeWorkspaceActive,
  isTriageWorkspaceActive,
  isUnsortedWorkspaceActive,
  matchesWorkspaceView,
  getSelectedProjectFilterValue,
  getSelectedProjectKey,
  getCurrentDateViewLabel,
  getSelectedProjectLabel,
  getSelectedProjectName,
  formatVisibleTaskCount,
  // Re-exported from filtering/headerUi.js
  syncWorkspaceViewState,
  updateHeaderAndContextUI,
  updateHeaderFromVisibleTodos,
  assertNoHorizontalOverflow,
  // Re-exported from filtering/todoListRenderer.js
  renderHeadingMoveOptions,
  renderTodoRowHtml,
  renderProjectHeadingGroupedRows,
};
