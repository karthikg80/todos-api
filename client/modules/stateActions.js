// =============================================================================
// stateActions.js — Minimal explicit state transitions for hot UI/domain flows.
// =============================================================================

import {
  state,
  hooks,
  createInitialTaskDrawerAssistState,
  createInitialOnCreateAssistState,
  createInitialHomeAiState,
  createInitialBreakDownState,
  createInitialFollowUpState,
  createInitialInboxState,
  createInitialWeeklyReviewState,
  createInitialCleanupState,
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

function createHomeAiState(requestKey = "") {
  return {
    ...createInitialHomeAiState(),
    requestKey: String(requestKey || ""),
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
      if (!state.taskPageTodoId && !state.inlineTaskEditorTodoId) {
        state.selectedTodoId = null;
      }
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
    case "taskInline/open":
      state.inlineTaskEditorTodoId = String(payload.todoId || "");
      state.inlineTaskEditorDraft = payload.draft ? { ...payload.draft } : null;
      state.inlineTaskEditorSaveState = "idle";
      state.inlineTaskEditorSaveMessage = "";
      state.selectedTodoId = state.inlineTaskEditorTodoId || null;
      if (payload.closeDrawer !== false) {
        state.isTodoDrawerOpen = false;
        state.isDrawerDetailsOpen = false;
      }
      return state.inlineTaskEditorTodoId;
    case "taskInline/close":
      state.inlineTaskEditorTodoId = null;
      state.inlineTaskEditorDraft = null;
      state.inlineTaskEditorSaveState = "idle";
      state.inlineTaskEditorSaveMessage = "";
      if (!state.isTodoDrawerOpen && !state.taskPageTodoId) {
        state.selectedTodoId = null;
      }
      return state.inlineTaskEditorTodoId;
    case "taskPage/open":
      state.taskPageTodoId = String(payload.todoId || "");
      state.taskPageDraft = payload.draft ? { ...payload.draft } : null;
      state.taskPageSaveState = "idle";
      state.taskPageSaveMessage = "";
      state.selectedTodoId = state.taskPageTodoId || null;
      if (payload.closeInline !== false) {
        state.inlineTaskEditorTodoId = null;
        state.inlineTaskEditorDraft = null;
        state.inlineTaskEditorSaveState = "idle";
        state.inlineTaskEditorSaveMessage = "";
      }
      if (payload.closeDrawer !== false) {
        state.isTodoDrawerOpen = false;
        state.isDrawerDetailsOpen = false;
      }
      state.openTodoKebabId = null;
      return state.taskPageTodoId;
    case "taskPage/close":
      state.taskPageTodoId = null;
      state.taskPageDraft = null;
      state.taskPageSaveState = "idle";
      state.taskPageSaveMessage = "";
      if (!state.isTodoDrawerOpen && !state.inlineTaskEditorTodoId) {
        state.selectedTodoId = null;
      }
      return state.taskPageTodoId;
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
      // Clear bulk selection when switching views so toolbar doesn't persist.
      state.selectedTodos.clear();
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
    case "homeAi/reset":
      state.homeAi = createHomeAiState(payload.requestKey);
      return state.homeAi;
    case "homeAi/start":
      state.homeAi =
        state.homeAi?.requestKey === String(payload.requestKey || "")
          ? {
              ...state.homeAi,
              status: "loading",
              error: null,
              unavailable: false,
              applyingSuggestionId: "",
              dismissingSuggestionId: "",
            }
          : {
              ...createHomeAiState(payload.requestKey),
              status: "loading",
            };
      return state.homeAi;
    case "homeAi/unavailable":
      state.homeAi = {
        ...state.homeAi,
        status: "unavailable",
        aiSuggestionId: "",
        suggestions: [],
        error: null,
        unavailable: true,
        lastLoadedAt: new Date().toISOString(),
        applyingSuggestionId: "",
        dismissingSuggestionId: "",
      };
      return state.homeAi;
    case "homeAi/empty":
      state.homeAi = {
        ...state.homeAi,
        status: "ready",
        aiSuggestionId: "",
        suggestions: [],
        error: null,
        unavailable: false,
        lastLoadedAt: new Date().toISOString(),
        applyingSuggestionId: "",
        dismissingSuggestionId: "",
      };
      return state.homeAi;
    case "homeAi/success":
      state.homeAi = {
        ...state.homeAi,
        status: "ready",
        aiSuggestionId: String(payload.aiSuggestionId || ""),
        suggestions: Array.isArray(payload.suggestions)
          ? payload.suggestions
          : [],
        error: null,
        unavailable: false,
        lastLoadedAt: new Date().toISOString(),
        applyingSuggestionId: "",
        dismissingSuggestionId: "",
      };
      return state.homeAi;
    case "homeAi/failure":
      state.homeAi = {
        ...state.homeAi,
        status: "error",
        aiSuggestionId: "",
        suggestions: [],
        error: String(payload.error || "Could not load home focus."),
        unavailable: false,
        lastLoadedAt: new Date().toISOString(),
        applyingSuggestionId: "",
        dismissingSuggestionId: "",
      };
      return state.homeAi;
    case "homeAi/error:set":
      state.homeAi.error = String(payload.error || "");
      return state.homeAi;
    case "homeAi/apply:start":
      state.homeAi.applyingSuggestionId = String(payload.suggestionId || "");
      state.homeAi.error = null;
      return state.homeAi;
    case "homeAi/apply:complete":
      state.homeAi.applyingSuggestionId = "";
      return state.homeAi;
    case "homeAi/dismiss:start":
      state.homeAi.dismissingSuggestionId = String(payload.suggestionId || "");
      state.homeAi.error = null;
      return state.homeAi;
    case "homeAi/dismiss:complete":
      state.homeAi.dismissingSuggestionId = "";
      return state.homeAi;

    // ── Break down task ────────────────────────────────────────────────────
    case "breakDown/reset":
      state.breakDownState = {
        ...createInitialBreakDownState(),
        todoId: String(payload.todoId || ""),
      };
      return state.breakDownState;
    case "breakDown/start":
      state.breakDownState = {
        ...createInitialBreakDownState(),
        todoId: String(payload.todoId || ""),
        loading: true,
        isOpen: true,
      };
      return state.breakDownState;
    case "breakDown/success":
      state.breakDownState.loading = false;
      state.breakDownState.error = "";
      state.breakDownState.suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions
        : [];
      state.breakDownState.checkedIndexes = new Set(
        state.breakDownState.suggestions.map((_, i) => i),
      );
      return state.breakDownState;
    case "breakDown/failure":
      state.breakDownState.loading = false;
      state.breakDownState.applying = false;
      state.breakDownState.error = String(
        payload.error || "Could not suggest subtasks.",
      );
      return state.breakDownState;
    case "breakDown/toggle:checked": {
      const idx = payload.index;
      if (state.breakDownState.checkedIndexes.has(idx)) {
        state.breakDownState.checkedIndexes.delete(idx);
      } else {
        state.breakDownState.checkedIndexes.add(idx);
      }
      return state.breakDownState;
    }
    case "breakDown/apply:start":
      state.breakDownState.applying = true;
      state.breakDownState.error = "";
      return state.breakDownState;
    case "breakDown/apply:complete":
      state.breakDownState = createInitialBreakDownState();
      return state.breakDownState;

    // ── Follow-up for waiting task ─────────────────────────────────────────
    case "followUp/reset":
      state.followUpState = {
        ...createInitialFollowUpState(),
        todoId: String(payload.todoId || ""),
      };
      return state.followUpState;
    case "followUp/start":
      state.followUpState = {
        ...createInitialFollowUpState(),
        todoId: String(payload.todoId || ""),
        loading: true,
        isOpen: true,
      };
      return state.followUpState;
    case "followUp/suggest:success":
      state.followUpState.loading = false;
      state.followUpState.error = "";
      state.followUpState.suggestion = payload.suggestion || null;
      return state.followUpState;
    case "followUp/failure":
      state.followUpState.loading = false;
      state.followUpState.applying = false;
      state.followUpState.error = String(
        payload.error || "Could not create follow-up.",
      );
      return state.followUpState;
    case "followUp/apply:start":
      state.followUpState.applying = true;
      state.followUpState.error = "";
      return state.followUpState;
    case "followUp/apply:complete":
      state.followUpState.applying = false;
      state.followUpState.applied = true;
      state.followUpState.suggestion = null;
      return state.followUpState;

    // ── Inbox (Phase 3) ────────────────────────────────────────────────────
    case "inbox/reset":
      state.inboxState = createInitialInboxState();
      return state.inboxState;
    case "inbox/start":
      state.inboxState.loading = true;
      state.inboxState.error = "";
      return state.inboxState;
    case "inbox/success":
      state.inboxState.loading = false;
      state.inboxState.error = "";
      state.inboxState.hasLoaded = true;
      state.inboxState.items = Array.isArray(payload.items)
        ? payload.items
        : [];
      return state.inboxState;
    case "inbox/failure":
      state.inboxState.loading = false;
      state.inboxState.error = String(payload.error || "Could not load inbox.");
      state.inboxState.hasLoaded = true;
      return state.inboxState;

    // ── Weekly review (Phase 5) ────────────────────────────────────────────
    case "weeklyReview/reset":
      state.weeklyReviewState = createInitialWeeklyReviewState();
      return state.weeklyReviewState;
    case "weeklyReview/start":
      state.weeklyReviewState.loading = true;
      state.weeklyReviewState.error = "";
      return state.weeklyReviewState;
    case "weeklyReview/success":
      state.weeklyReviewState.loading = false;
      state.weeklyReviewState.error = "";
      state.weeklyReviewState.hasRun = true;
      state.weeklyReviewState.summary = payload.summary || null;
      state.weeklyReviewState.findings = Array.isArray(payload.findings)
        ? payload.findings
        : [];
      state.weeklyReviewState.actions = Array.isArray(payload.actions)
        ? payload.actions
        : [];
      state.weeklyReviewState.rolloverGroups = Array.isArray(
        payload.rolloverGroups,
      )
        ? payload.rolloverGroups
        : [];
      state.weeklyReviewState.anchorSuggestions = Array.isArray(
        payload.anchorSuggestions,
      )
        ? payload.anchorSuggestions
        : [];
      state.weeklyReviewState.behaviorAdjustment = String(
        payload.behaviorAdjustment || "",
      );
      state.weeklyReviewState.reflectionSummary = String(
        payload.reflectionSummary || "",
      );
      return state.weeklyReviewState;
    case "weeklyReview/failure":
      state.weeklyReviewState.loading = false;
      state.weeklyReviewState.error = String(
        payload.error || "Could not run weekly review.",
      );
      return state.weeklyReviewState;
    case "weeklyReview/mode:set":
      state.weeklyReviewState.mode =
        payload.mode === "apply" ? "apply" : "suggest";
      return state.weeklyReviewState;

    // ── Cleanup / anti-entropy (Phase 6) ──────────────────────────────────
    case "cleanup/reset":
      state.cleanupState = createInitialCleanupState();
      return state.cleanupState;
    case "cleanup/start":
      state.cleanupState.loading = true;
      state.cleanupState.error = "";
      return state.cleanupState;
    case "cleanup/success":
      state.cleanupState.loading = false;
      state.cleanupState.error = "";
      state.cleanupState.duplicates = Array.isArray(payload.duplicates)
        ? payload.duplicates
        : [];
      state.cleanupState.staleItems = Array.isArray(payload.staleItems)
        ? payload.staleItems
        : [];
      state.cleanupState.qualityResults = Array.isArray(payload.qualityResults)
        ? payload.qualityResults
        : [];
      state.cleanupState.taxonomySuggestions = Array.isArray(
        payload.taxonomySuggestions,
      )
        ? payload.taxonomySuggestions
        : [];
      return state.cleanupState;
    case "cleanup/failure":
      state.cleanupState.loading = false;
      state.cleanupState.error = String(
        payload.error || "Could not run cleanup analysis.",
      );
      return state.cleanupState;

    default:
      return undefined;
  }
}
