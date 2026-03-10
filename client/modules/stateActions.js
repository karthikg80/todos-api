// =============================================================================
// stateActions.js — Minimal explicit state transitions for hot UI/domain flows.
// =============================================================================

import {
  state,
  hooks,
  createInitialTaskDrawerAssistState,
  createInitialOnCreateAssistState,
  createInitialTodayPlanState,
} from "./store.js";

function getNormalizedProjectKey(value) {
  const raw = String(value || "");
  if (typeof hooks.normalizeProjectPath === "function") {
    return hooks.normalizeProjectPath(raw);
  }
  return raw.trim();
}

function createTaskDrawerAssistState(todoId = "") {
  return {
    ...createInitialTaskDrawerAssistState(),
    todoId: String(todoId || ""),
  };
}

function createOnCreateAssistState() {
  const dismissedTodoIds =
    state.onCreateAssistState?.dismissedTodoIds || new Set();
  return {
    ...createInitialOnCreateAssistState(),
    dismissedTodoIds,
  };
}

export function applyUiAction(type, payload = {}) {
  switch (type) {
    case "quickEntry/properties:set":
      state.isQuickEntryPropertiesOpen = !!payload.isOpen;
      return state.isQuickEntryPropertiesOpen;
    case "taskComposer/open":
      state.lastTaskComposerTrigger =
        payload.triggerEl instanceof HTMLElement
          ? payload.triggerEl
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      state.taskComposerDefaultProject = String(payload.defaultProject || "");
      state.isTaskComposerOpen = true;
      return state.isTaskComposerOpen;
    case "taskComposer/close":
      state.isTaskComposerOpen = false;
      if (payload.clearTrigger !== false) {
        state.lastTaskComposerTrigger = null;
      }
      return state.isTaskComposerOpen;
    case "commandPalette/open":
      state.lastFocusedBeforePalette =
        payload.opener instanceof HTMLElement
          ? payload.opener
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      state.commandPaletteItems = Array.isArray(payload.items)
        ? payload.items
        : [];
      state.commandPaletteSelectableItems = [];
      state.commandPaletteQuery = "";
      state.commandPaletteIndex = 0;
      state.isCommandPaletteOpen = true;
      return state.isCommandPaletteOpen;
    case "commandPalette/close":
      state.isCommandPaletteOpen = false;
      state.commandPaletteQuery = "";
      state.commandPaletteIndex = 0;
      state.commandPaletteSelectableItems = [];
      return state.isCommandPaletteOpen;
    case "commandPalette/query:set":
      state.commandPaletteQuery = String(payload.query || "");
      state.commandPaletteIndex = 0;
      return state.commandPaletteQuery;
    case "todoDrawer/open":
      state.selectedTodoId = String(payload.todoId || "");
      state.isDrawerDetailsOpen = false;
      state.openTodoKebabId = null;
      state.lastFocusedTodoTrigger =
        payload.triggerEl instanceof HTMLElement ? payload.triggerEl : null;
      state.lastFocusedTodoId =
        payload.triggerEl instanceof HTMLElement
          ? payload.triggerEl.dataset.todoId || String(payload.todoId || "")
          : String(payload.todoId || "");
      state.isTodoDrawerOpen = true;
      return state.isTodoDrawerOpen;
    case "todoDrawer/close":
      state.isTodoDrawerOpen = false;
      state.selectedTodoId = null;
      state.isDrawerDetailsOpen = false;
      state.openTodoKebabId = null;
      state.lastFocusedTodoTrigger = null;
      state.lastFocusedTodoId = null;
      return state.isTodoDrawerOpen;
    case "todoDrawer/details:set":
      state.isDrawerDetailsOpen = !!payload.isOpen;
      return state.isDrawerDetailsOpen;
    case "todoKebab:set":
      state.openTodoKebabId = payload.todoId ? String(payload.todoId) : null;
      return state.openTodoKebabId;
    case "railSheet/open":
      state.isRailSheetOpen = true;
      state.lastFocusedRailTrigger =
        payload.triggerEl instanceof HTMLElement ? payload.triggerEl : null;
      return state.isRailSheetOpen;
    case "railSheet/close":
      state.isRailSheetOpen = false;
      if (payload.clearTrigger !== false) {
        state.lastFocusedRailTrigger = null;
      }
      return state.isRailSheetOpen;
    case "moreFilters:set":
      state.isMoreFiltersOpen = !!payload.isOpen;
      return state.isMoreFiltersOpen;
    case "rail/collapsed:set":
      state.isRailCollapsed = !!payload.collapsed;
      return state.isRailCollapsed;
    case "rail/presentation:set":
      state.railPresentationMode =
        payload.mode === "sheet" ? "sheet" : "sidebar";
      return state.railPresentationMode;
    case "viewport/mode:set":
      state.viewportMode = payload.mode === "mobile" ? "mobile" : "desktop";
      return state.viewportMode;
    case "projectCrud/open":
      state.isProjectCrudModalOpen = true;
      state.projectCrudMode = payload.mode === "rename" ? "rename" : "create";
      state.projectCrudTargetProject = String(payload.initialProjectName || "");
      state.lastProjectCrudOpener =
        payload.opener instanceof HTMLElement ? payload.opener : null;
      return state.isProjectCrudModalOpen;
    case "projectCrud/close":
      state.isProjectCrudModalOpen = false;
      state.projectCrudMode = "create";
      state.projectCrudTargetProject = "";
      if (payload.clearOpener !== false) {
        state.lastProjectCrudOpener = null;
      }
      return state.isProjectCrudModalOpen;
    case "projectEdit/open":
      state.isProjectEditDrawerOpen = true;
      state.projectEditTargetProject = String(payload.projectName || "");
      state.lastProjectEditOpener =
        payload.opener instanceof HTMLElement ? payload.opener : null;
      return state.isProjectEditDrawerOpen;
    case "projectEdit/close":
      state.isProjectEditDrawerOpen = false;
      state.projectEditTargetProject = "";
      if (payload.clearOpener !== false) {
        state.lastProjectEditOpener = null;
      }
      return state.isProjectEditDrawerOpen;
    case "aiWorkspace/visible:set":
      state.isAiWorkspaceVisible = payload.debugEnabled
        ? true
        : !!payload.visible;
      return state.isAiWorkspaceVisible;
    case "aiWorkspace/collapsed:set":
      state.isAiWorkspaceCollapsed = !!payload.collapsed;
      return state.isAiWorkspaceCollapsed;
    default:
      return undefined;
  }
}

export function applyDomainAction(type, payload = {}) {
  switch (type) {
    case "workspace/view:set":
      state.currentWorkspaceView = String(payload.view || "all");
      return state.currentWorkspaceView;
    case "homeDrilldown:set":
      state.homeListDrilldownKey = String(payload.tileKey || "");
      return state.homeListDrilldownKey;
    case "homeDrilldown:clear":
      state.homeListDrilldownKey = "";
      return state.homeListDrilldownKey;
    case "projectSelection:set": {
      const nextValue = getNormalizedProjectKey(payload.projectName);
      if (nextValue) {
        state.currentWorkspaceView = "project";
        state.homeListDrilldownKey = "";
      } else if (state.currentWorkspaceView === "project") {
        state.currentWorkspaceView = "all";
      }
      state.railRovingFocusKey = nextValue || "";
      return nextValue;
    }
    case "todayPlan/goal:set":
      state.todayPlanState.goalText = String(payload.goalText || "");
      return state.todayPlanState.goalText;
    case "todayPlan/selection:set": {
      const todoId = String(payload.todoId || "");
      if (!todoId) return state.todayPlanState.selectedTodoIds;
      if (payload.selected) {
        state.todayPlanState.selectedTodoIds.add(todoId);
      } else {
        state.todayPlanState.selectedTodoIds.delete(todoId);
      }
      return state.todayPlanState.selectedTodoIds;
    }
    case "todayPlan/selections:replace":
      state.todayPlanState.selectedTodoIds = new Set(
        Array.isArray(payload.todoIds) ? payload.todoIds.map(String) : [],
      );
      return state.todayPlanState.selectedTodoIds;
    default:
      return undefined;
  }
}

export function applyAsyncAction(type, payload = {}) {
  switch (type) {
    case "taskDrawerAssist/reset":
      state.taskDrawerAssistState = createTaskDrawerAssistState(payload.todoId);
      return state.taskDrawerAssistState;
    case "taskDrawerAssist/start":
      if (
        state.taskDrawerAssistState?.todoId !== String(payload.todoId || "")
      ) {
        state.taskDrawerAssistState = createTaskDrawerAssistState(
          payload.todoId,
        );
      }
      state.taskDrawerAssistState.loading = true;
      state.taskDrawerAssistState.error = "";
      state.taskDrawerAssistState.unavailable = false;
      return state.taskDrawerAssistState;
    case "taskDrawerAssist/unavailable":
      state.taskDrawerAssistState.loading = false;
      state.taskDrawerAssistState.unavailable = true;
      state.taskDrawerAssistState.error = "";
      return state.taskDrawerAssistState;
    case "taskDrawerAssist/abstain":
      state.taskDrawerAssistState.loading = false;
      state.taskDrawerAssistState.error = "";
      state.taskDrawerAssistState.unavailable = false;
      state.taskDrawerAssistState.mustAbstain = true;
      state.taskDrawerAssistState.suggestions = [];
      state.taskDrawerAssistState.confirmSuggestionId = "";
      state.taskDrawerAssistState.applyingSuggestionId = "";
      return state.taskDrawerAssistState;
    case "taskDrawerAssist/success":
      state.taskDrawerAssistState.loading = false;
      state.taskDrawerAssistState.error = "";
      state.taskDrawerAssistState.unavailable = false;
      state.taskDrawerAssistState.aiSuggestionId = String(
        payload.aiSuggestionId || "",
      );
      state.taskDrawerAssistState.mustAbstain = !!payload.mustAbstain;
      state.taskDrawerAssistState.contractVersion = payload.contractVersion;
      state.taskDrawerAssistState.requestId = payload.requestId;
      state.taskDrawerAssistState.generatedAt = payload.generatedAt;
      state.taskDrawerAssistState.suggestions = Array.isArray(
        payload.suggestions,
      )
        ? payload.suggestions
        : [];
      state.taskDrawerAssistState.confirmSuggestionId = "";
      state.taskDrawerAssistState.applyingSuggestionId = "";
      return state.taskDrawerAssistState;
    case "taskDrawerAssist/failure":
      state.taskDrawerAssistState.loading = false;
      state.taskDrawerAssistState.error = String(
        payload.error || "Could not load suggestions.",
      );
      state.taskDrawerAssistState.unavailable = false;
      return state.taskDrawerAssistState;
    case "onCreateAssist/reset":
      state.onCreateAssistState = createOnCreateAssistState();
      return state.onCreateAssistState;
    case "onCreateAssist/mock":
      state.onCreateAssistState = {
        ...createOnCreateAssistState(),
        titleBasis: String(payload.titleBasis || ""),
        envelope: payload.envelope || null,
        suggestions: Array.isArray(payload.suggestions)
          ? payload.suggestions
          : [],
        mode: "mock",
        showAll: false,
      };
      return state.onCreateAssistState;
    case "onCreateAssist/start":
      state.onCreateAssistState = {
        ...state.onCreateAssistState,
        dismissedTodoIds:
          state.onCreateAssistState?.dismissedTodoIds || new Set(),
        loading: true,
        error: "",
        unavailable: false,
        mode: "live",
        liveTodoId: String(payload.todoId || ""),
        aiSuggestionId: "",
        envelope: null,
        suggestions: [],
        showAll: false,
      };
      return state.onCreateAssistState;
    case "onCreateAssist/unavailable":
      state.onCreateAssistState.loading = false;
      state.onCreateAssistState.unavailable = true;
      state.onCreateAssistState.error = "";
      return state.onCreateAssistState;
    case "onCreateAssist/empty":
      state.onCreateAssistState.loading = false;
      state.onCreateAssistState.error = "";
      state.onCreateAssistState.unavailable = false;
      state.onCreateAssistState.envelope = payload.envelope || null;
      state.onCreateAssistState.suggestions = [];
      return state.onCreateAssistState;
    case "onCreateAssist/success":
      state.onCreateAssistState.loading = false;
      state.onCreateAssistState.error = "";
      state.onCreateAssistState.unavailable = false;
      state.onCreateAssistState.mode = "live";
      state.onCreateAssistState.liveTodoId = String(payload.todoId || "");
      state.onCreateAssistState.aiSuggestionId = String(
        payload.aiSuggestionId || "",
      );
      state.onCreateAssistState.envelope = payload.envelope || null;
      state.onCreateAssistState.suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions
        : [];
      state.onCreateAssistState.showAll = false;
      return state.onCreateAssistState;
    case "onCreateAssist/failure":
      state.onCreateAssistState.loading = false;
      state.onCreateAssistState.error = String(
        payload.error || "Could not load suggestions.",
      );
      state.onCreateAssistState.unavailable = false;
      return state.onCreateAssistState;
    case "todayPlan/reset":
      state.todayPlanState = createInitialTodayPlanState();
      return state.todayPlanState;
    case "todayPlan/start":
      state.todayPlanState.loading = true;
      state.todayPlanState.error = "";
      state.todayPlanState.unavailable = false;
      state.todayPlanState.generating = !!payload.generating;
      if (typeof payload.loadingMessage === "string") {
        state.todayPlanState.loadingMessage = payload.loadingMessage;
      }
      return state.todayPlanState;
    case "todayPlan/unavailable":
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.unavailable = true;
      state.todayPlanState.error = "";
      state.todayPlanState.hasLoaded = true;
      state.todayPlanState.loadingMessage = "";
      return state.todayPlanState;
    case "todayPlan/empty":
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.error = "";
      state.todayPlanState.unavailable = false;
      state.todayPlanState.hasLoaded = true;
      state.todayPlanState.aiSuggestionId = "";
      state.todayPlanState.envelope = payload.envelope || null;
      state.todayPlanState.selectedTodoIds = new Set(
        Array.isArray(payload.selectedTodoIds)
          ? payload.selectedTodoIds.map(String)
          : [],
      );
      state.todayPlanState.dismissedSuggestionIds = new Set();
      state.todayPlanState.loadingMessage = "";
      return state.todayPlanState;
    case "todayPlan/success":
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.error = "";
      state.todayPlanState.unavailable = false;
      state.todayPlanState.hasLoaded = true;
      state.todayPlanState.aiSuggestionId = String(
        payload.aiSuggestionId || "",
      );
      state.todayPlanState.envelope = payload.envelope || null;
      state.todayPlanState.dismissedSuggestionIds = new Set();
      state.todayPlanState.selectedTodoIds = new Set(
        Array.isArray(payload.selectedTodoIds)
          ? payload.selectedTodoIds.map(String)
          : [],
      );
      state.todayPlanState.loadingMessage = "";
      return state.todayPlanState;
    case "todayPlan/failure":
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.unavailable = false;
      state.todayPlanState.error = String(
        payload.error || "Could not load suggestions.",
      );
      state.todayPlanState.hasLoaded = true;
      state.todayPlanState.loadingMessage = "";
      return state.todayPlanState;
    case "todayPlan/generate:complete":
      state.todayPlanState.loadingMessage = "";
      state.todayPlanState.lastApplyBatch = null;
      return state.todayPlanState;
    default:
      return undefined;
  }
}
