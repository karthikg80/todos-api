// =============================================================================
// workspaceSemantics.js — Workspace/project state readers and label mapping.
// Pure state reads plus the DOM boundary for #categoryFilter.
// No DOM writes. No rendering.
// =============================================================================
import { state, hooks } from "../store.js";
import { applyDomainAction } from "../stateActions.js";

export function normalizeWorkspaceView(view) {
  if (view === "inbox" || view === "unsorted") {
    return "triage";
  }
  const valid = new Set([
    "home",
    "triage",
    "all",
    "today",
    "upcoming",
    "next_month",
    "someday",
    "completed",
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

export function hasHomeListDrilldown() {
  return !!state.homeListDrilldownKey;
}

export function clearHomeListDrilldown() {
  applyDomainAction("homeDrilldown:clear");
}

export function isHomeWorkspaceActive() {
  return !getSelectedProjectKey() && state.currentWorkspaceView === "home";
}

export function isTriageWorkspaceActive() {
  if (getSelectedProjectKey()) return false;
  return (
    state.currentWorkspaceView === "triage" ||
    state.currentWorkspaceView === "inbox" ||
    state.currentWorkspaceView === "unsorted"
  );
}

export function isUnsortedWorkspaceActive() {
  return !getSelectedProjectKey() && state.currentWorkspaceView === "unsorted";
}

export function matchesWorkspaceView(view) {
  if (view === "home") {
    return !getSelectedProjectKey() && state.currentWorkspaceView === "home";
  }
  if (view === "triage") {
    return (
      !getSelectedProjectKey() &&
      (state.currentWorkspaceView === "triage" ||
        state.currentWorkspaceView === "inbox" ||
        state.currentWorkspaceView === "unsorted")
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

// DOM read: intentional boundary — reads current filter state from DOM
export function getSelectedProjectFilterValue() {
  const filter = document.getElementById("categoryFilter");
  if (!(filter instanceof HTMLSelectElement)) return "";
  const normalized = hooks.normalizeProjectPath(filter.value);
  return hooks.isInternalCategoryPath?.(normalized) ? "" : normalized;
}

export function getSelectedProjectKey() {
  return getSelectedProjectFilterValue();
}

export function getCurrentDateViewLabel() {
  const labels = {
    all: "",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed",
    next_month: "Next month",
    someday: "Later",
    waiting: "Pending",
    scheduled: "Planned",
  };
  return labels[state.currentDateView] || "";
}

export function getSelectedProjectLabel(selectedProject) {
  if (!selectedProject && state.currentWorkspaceView === "home") return "Focus";
  if (!selectedProject && isTriageWorkspaceActive()) return "Desk";
  if (!selectedProject) return "Everything";
  return hooks.getProjectLeafName(selectedProject);
}

export function getSelectedProjectName() {
  return getSelectedProjectLabel(getSelectedProjectKey());
}

export function getCurrentWorkspaceHeaderConfig() {
  const workspaceTitleMap = {
    inbox: "Desk",
    triage: "Desk",
    unsorted: "Desk",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed",
  };
  const explicitTitle = workspaceTitleMap[state.currentWorkspaceView];
  if (explicitTitle) {
    return {
      projectName: explicitTitle,
      dateLabel: "",
    };
  }

  return {
    projectName: getSelectedProjectName(),
    dateLabel: getCurrentDateViewLabel(),
  };
}

export function formatVisibleTaskCount(taskCount) {
  return `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`;
}
