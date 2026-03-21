// =============================================================================
// workspaceController.js — Workspace-level view orchestration.
// Keeps app.js focused on composition while preserving the existing DOM-driven
// navigation behavior for todos/settings/admin shells and workspace views.
// =============================================================================

import { state } from "./store.js";

export function createWorkspaceController({
  normalizeWorkspaceView,
  clearHomeListDrilldown,
  setSelectedProjectKey,
  setDateView,
  dispatchTodosChanged,
  closeProjectEditDrawer,
  closeProjectDeleteDialog,
  closeProjectsRailSheet,
  closeCommandPalette,
  closeProjectCrudModal,
  closeMoreFilters,
  closeTodoDrawer,
  updateUserDisplay,
  setTodosViewBodyState,
  setSettingsPaneVisible,
  setFeedbackPaneVisible,
  syncSidebarNavState,
  readStoredAiWorkspaceCollapsedState,
  setAiWorkspaceCollapsed,
  loadTodos,
  loadAiSuggestions,
  loadAiUsage,
  loadAiInsights,
  loadAiFeedbackSummary,
  loadAdminUsers,
  prepareFeedbackView,
}) {
  function switchView(view, triggerEl = null) {
    const requestedView = view === "profile" ? "settings" : view;
    const isSettingsView = requestedView === "settings";
    const isFeedbackView = requestedView === "feedback";
    const primaryView =
      isSettingsView || isFeedbackView ? "todos" : requestedView;

    document
      .querySelectorAll(".view")
      .forEach((element) => element.classList.remove("active"));
    document
      .querySelectorAll(".nav-tab")
      .forEach((element) => element.classList.remove("active"));

    const targetView = document.getElementById(`${primaryView}View`);
    if (!(targetView instanceof HTMLElement)) {
      return;
    }

    targetView.classList.add("active");
    if (triggerEl) {
      triggerEl.classList.add("active");
    }

    if (
      !(triggerEl instanceof HTMLElement) ||
      !triggerEl.classList.contains("nav-tab")
    ) {
      const matchingTab = document.querySelector(
        `.nav-tab[data-onclick*="switchView('${requestedView}'"]`,
      );
      if (matchingTab instanceof HTMLElement) {
        matchingTab.classList.add("active");
      }
    }

    setTodosViewBodyState(primaryView === "todos");
    setSettingsPaneVisible(isSettingsView);
    setFeedbackPaneVisible(isFeedbackView);
    syncSidebarNavState(requestedView);

    if (isSettingsView) {
      closeCommandPalette({ restoreFocus: false });
      closeProjectCrudModal({ restoreFocus: false });
      closeProjectEditDrawer({ restoreFocus: false });
      closeProjectDeleteDialog();
      closeMoreFilters();
      closeProjectsRailSheet({ restoreFocus: false });
      closeTodoDrawer({ restoreFocus: false });
      updateUserDisplay();
      return;
    }

    if (requestedView === "todos") {
      closeCommandPalette({ restoreFocus: false });
      closeProjectCrudModal({ restoreFocus: false });
      closeProjectEditDrawer({ restoreFocus: false });
      closeProjectDeleteDialog();
      closeMoreFilters();
      closeProjectsRailSheet({ restoreFocus: false });
      setAiWorkspaceCollapsed(readStoredAiWorkspaceCollapsedState(), {
        persist: false,
      });
      loadTodos();
      loadAiSuggestions();
      loadAiUsage();
      loadAiInsights();
      loadAiFeedbackSummary();
      return;
    }

    if (requestedView === "admin") {
      closeCommandPalette({ restoreFocus: false });
      closeProjectCrudModal({ restoreFocus: false });
      closeProjectEditDrawer({ restoreFocus: false });
      closeProjectDeleteDialog();
      closeMoreFilters();
      closeProjectsRailSheet({ restoreFocus: false });
      closeTodoDrawer({ restoreFocus: false });
      loadAdminUsers();
      return;
    }

    if (requestedView === "feedback") {
      closeCommandPalette({ restoreFocus: false });
      closeProjectCrudModal({ restoreFocus: false });
      closeProjectEditDrawer({ restoreFocus: false });
      closeProjectDeleteDialog();
      closeMoreFilters();
      closeProjectsRailSheet({ restoreFocus: false });
      closeTodoDrawer({ restoreFocus: false });
      prepareFeedbackView?.();
    }
  }

  function ensureTodosShellActive() {
    const todosView = document.getElementById("todosView");
    const shouldSwitchToTodos =
      !(todosView instanceof HTMLElement) ||
      !todosView.classList.contains("active") ||
      todosView.classList.contains("todos-view--settings-active");

    if (!shouldSwitchToTodos) return;

    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    switchView("todos", todosTab instanceof HTMLElement ? todosTab : null);
  }

  function selectWorkspaceView(view, triggerEl = null) {
    const normalizedView = normalizeWorkspaceView(view);
    const nextView =
      normalizedView === "today" ||
      normalizedView === "upcoming" ||
      normalizedView === "completed"
        ? normalizedView
        : "all";

    if (triggerEl instanceof HTMLElement) {
      triggerEl.blur();
    }
    if (state.isProjectEditDrawerOpen) {
      closeProjectEditDrawer({ restoreFocus: false });
    }
    if (state.projectDeleteDialogState) {
      closeProjectDeleteDialog();
    }

    ensureTodosShellActive();

    state.currentWorkspaceView = normalizedView;
    clearHomeListDrilldown();
    setSelectedProjectKey("", { reason: "workspace-view", skipApply: true });
    setDateView(nextView, { skipApply: true });
    dispatchTodosChanged({ reason: "workspace-view" });

    if (state.isRailSheetOpen) {
      closeProjectsRailSheet({
        restoreFocus: !(triggerEl instanceof HTMLElement),
      });
    }
  }

  return {
    ensureTodosShellActive,
    selectWorkspaceView,
    switchView,
  };
}
