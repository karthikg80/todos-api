// =============================================================================
// headerUi.js — DOM writes for the todos list header and workspace nav state.
// All functions here intentionally read/write DOM elements.
// =============================================================================
import { state, hooks } from "../store.js";
import {
  isHomeWorkspaceActive,
  isTriageWorkspaceActive,
  hasHomeListDrilldown,
  getSelectedProjectKey,
  matchesWorkspaceView,
  getCurrentWorkspaceHeaderConfig,
  formatVisibleTaskCount,
} from "./workspaceSemantics.js";
import { getOpenTodos, getVisibleTodosCount } from "./todoSelectors.js";

export function syncWorkspaceViewState() {
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

export function updateHeaderAndContextUI({
  projectName = "Everything",
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

  const surfaceMode = state.taskPageTodoId
    ? "task-detail"
    : isHomeWorkspaceActive()
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

  const tagIndicator = document.getElementById("tagFilterIndicator");
  if (tagIndicator instanceof HTMLElement) {
    if (state.activeTagFilter) {
      tagIndicator.hidden = false;
      tagIndicator.textContent = `#${state.activeTagFilter} ✕`;
    } else {
      tagIndicator.hidden = true;
      tagIndicator.textContent = "";
    }
  }

  // Done-today badge
  const doneBadge = document.getElementById("doneTodayBadge");
  if (doneBadge instanceof HTMLElement) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    // Count tasks completed today. Prefer completedAt if available;
    // fall back to updatedAt for tasks that don't have it yet.
    const doneToday = state.todos.filter((t) => {
      if (!t.completed) return false;
      const ts = t.completedAt || t.updatedAt;
      if (!ts) return false;
      return new Date(ts) >= todayStart;
    }).length;
    if (doneToday > 0) {
      doneBadge.textContent = `✓ ${doneToday} done today`;
      doneBadge.hidden = false;
    } else {
      doneBadge.hidden = true;
    }
  }
}

export function updateHeaderFromVisibleTodos(visibleTodos = []) {
  if (isHomeWorkspaceActive()) {
    updateHeaderAndContextUI({
      projectName: "Focus",
      visibleCount: getOpenTodos().length,
      dateLabel: "",
    });
    return;
  }
  if (isTriageWorkspaceActive()) {
    updateHeaderAndContextUI({
      projectName: "Desk",
      visibleCount: getVisibleTodosCount(visibleTodos),
      dateLabel: "",
    });
    return;
  }
  if (hasHomeListDrilldown()) {
    updateHeaderAndContextUI({
      projectName: hooks.getHomeDrilldownLabel?.() || "Focus",
      visibleCount: getVisibleTodosCount(visibleTodos),
      dateLabel: "",
    });
    return;
  }

  const headerConfig = getCurrentWorkspaceHeaderConfig();

  updateHeaderAndContextUI({
    projectName: headerConfig.projectName,
    visibleCount: getVisibleTodosCount(visibleTodos),
    dateLabel: headerConfig.dateLabel,
  });
}

export function assertNoHorizontalOverflow(container) {
  if (!(container instanceof HTMLElement)) return;
  const isOverflowing = container.scrollWidth > container.clientWidth;
  if (isOverflowing) {
    console.warn(
      "Horizontal overflow detected in",
      container.id || container.className,
    );
  }
}
