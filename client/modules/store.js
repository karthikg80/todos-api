// =============================================================================
// store.js — Shared mutable state module.
// All domain modules import { state, hooks } from './store.js'.
// Modules READ and WRITE state.varName directly (no setters needed because
// state is an exported const object — its *properties* are mutable).
// =============================================================================
import { STORAGE_KEYS } from "../utils/storageKeys.js";
// Runtime UI state module — exports { state, hooks }. All domain modules import from here. Do not import from authSession.js.

// ---------------------------------------------------------------------------
// Factory helpers — called during initialization so they live here too.
// ---------------------------------------------------------------------------
export function createInitialTaskDrawerAssistState() {
  // FEATURE_TASK_DRAWER_DECISION_ASSIST is read from window to avoid importing
  // the feature-flag evaluation (which depends on window at module parse time).
  const featureEnabled = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("taskDrawerAssist");
      if (q === "1" || q === "true") return true;
      if (q === "0" || q === "false") return false;
      const raw = window.localStorage.getItem(
        STORAGE_KEYS.FEATURE_TASK_DRAWER_ASSIST,
      );
      return raw === "1" || raw === "true";
    } catch {
      return false;
    }
  })();
  return {
    todoId: "",
    loading: false,
    unavailable: !featureEnabled,
    error: "",
    aiSuggestionId: "",
    mustAbstain: false,
    suggestions: [],
    applyingSuggestionId: "",
    confirmSuggestionId: "",
    undoBySuggestionId: {},
    lastUndoSuggestionId: "",
    showFullAssist: false,
  };
}

export function createInitialOnCreateAssistState() {
  return {
    titleBasis: "",
    envelope: null,
    suggestions: [],
    showAll: false,
    aiSuggestionId: "",
    liveTodoId: "",
    loading: false,
    error: "",
    unavailable: false,
    mode: "mock",
    dismissedTodoIds: new Set(),
    showFullAssist: false,
    lintIssue: null,
  };
}

export function createInitialHomeAiState() {
  return {
    status: "idle",
    aiSuggestionId: "",
    requestKey: "",
    suggestions: [],
    lastLoadedAt: null,
    error: null,
    unavailable: false,
    applyingSuggestionId: "",
    dismissingSuggestionId: "",
  };
}

export function createInitialBreakDownState() {
  return {
    todoId: "",
    loading: false,
    suggestions: [], // [{ title, order }]
    checkedIndexes: new Set(),
    applying: false,
    error: "",
    isOpen: false,
  };
}

export function createInitialFollowUpState() {
  return {
    todoId: "",
    loading: false,
    suggestion: null, // { title, ... } from mode=suggest
    applying: false,
    applied: false,
    error: "",
    isOpen: false,
  };
}

export function createInitialInboxState() {
  return {
    items: [],
    loading: false,
    error: "",
    hasLoaded: false,
    triagingIds: new Set(),
  };
}

export function createInitialWeeklyReviewState() {
  return {
    loading: false,
    error: "",
    hasRun: false,
    summary: null,
    findings: [],
    actions: [],
    rolloverGroups: [],
    anchorSuggestions: [],
    behaviorAdjustment: "",
    reflectionSummary: "",
    mode: "suggest",
  };
}

export function createInitialCleanupState() {
  return {
    loading: false,
    error: "",
    duplicates: [],
    staleItems: [],
    qualityResults: [],
    taxonomySuggestions: [],
  };
}

// ---------------------------------------------------------------------------
// Shared mutable state — all modules import this object and access
// state.propertyName directly (reads + writes).
// ---------------------------------------------------------------------------
export const state = {
  // Auth
  currentUser: null,
  authToken: null,
  refreshToken: null,
  authState: null, // set after AUTH_STATE is loaded from AppState
  userPlanningPreferences: null,
  currentDayContext: {
    mode: "normal",
    energy: "",
    notes: "",
    contextDate: "",
  },

  // Todos
  todos: [],
  todosLoadState: "idle",
  todosLoadErrorMessage: "",

  // Users / admin
  users: [],
  adminBootstrapAvailable: false,
  adminFeedbackItems: [],
  adminFeedbackSelectedId: "",
  adminFeedbackDetail: null,
  adminFeedbackFilters: {
    status: "",
    type: "",
  },
  adminFeedbackListLoading: false,
  adminFeedbackDetailLoading: false,
  adminFeedbackFailures: [],
  adminFeedbackFailuresLoading: false,
  adminFeedbackPromotionPreview: null,
  adminFeedbackPromotionPreviewLoading: false,
  adminFeedbackPromotionPreviewError: "",
  adminFeedbackAutomationConfig: null,
  adminFeedbackAutomationConfigLoading: false,
  adminFeedbackAutomationSaving: false,
  adminFeedbackAutomationRunLoading: false,
  adminFeedbackAutomationDecisions: [],
  adminFeedbackAutomationDecisionsLoading: false,

  // AI
  aiSuggestions: [],
  aiUsage: null,
  aiInsights: null,
  aiFeedbackSummary: null,
  latestCritiqueSuggestionId: null,
  latestCritiqueResult: null,
  latestCritiqueRequestId: 0,
  critiqueRequestsInFlight: 0,
  latestPlanSuggestionId: null,
  latestPlanResult: null,
  planDraftState: null,
  isPlanGenerateInFlight: false,
  isPlanApplyInFlight: false,
  isPlanDismissInFlight: false,
  planGenerateSource: null,

  // Projects
  customProjects: [],
  projectRecords: [],
  projectHeadingsByProjectId: new Map(),
  projectHeadingsLoadSeq: 0,

  // Edit todo modal
  editingTodoId: null,

  // Date / workspace view
  currentDateView: "all",
  currentWorkspaceView: "home",
  homeListDrilldownKey: "",
  activeTagFilter: "",
  isMoreFiltersOpen: false,
  viewportMode: "desktop",
  railPresentationMode: "sidebar",

  // Todo drawer
  selectedTodoId: null,
  lastFocusedTodoTrigger: null,
  isTodoDrawerOpen: false,
  isDrawerDetailsOpen: false,
  openTodoKebabId: null,
  drawerSaveState: "idle",
  drawerSaveMessage: "",
  drawerDraft: null,
  drawerSaveSequence: 0,
  drawerDescriptionSaveTimer: null,
  drawerSaveResetTimer: null,
  drawerScrollLockY: 0,
  isDrawerBodyLocked: false,
  taskDrawerAssistState: null, // initialized in init below
  lastFocusedTodoId: null,

  // Progressive task detail surfaces
  inlineTaskEditorTodoId: null,
  inlineTaskEditorDraft: null,
  inlineTaskEditorSaveState: "idle",
  inlineTaskEditorSaveMessage: "",
  inlineTaskEditorSaveTimer: null,
  inlineTaskEditorResetTimer: null,
  taskPageTodoId: null,
  taskPageDraft: null,
  taskPageSaveState: "idle",
  taskPageSaveMessage: "",
  taskPageDescriptionSaveTimer: null,
  taskPageSaveResetTimer: null,

  // Rail
  isRailCollapsed: false,
  isRailSheetOpen: false,
  railRovingFocusKey: "",
  railScrollLockY: 0,
  isRailBodyLocked: false,
  lastFocusedRailTrigger: null,
  openRailProjectMenuKey: null,

  // Project CRUD modal
  isProjectCrudModalOpen: false,
  projectCrudMode: "create",
  projectCrudTargetProject: "",
  lastProjectCrudOpener: null,

  // Project edit drawer
  isProjectEditDrawerOpen: false,
  projectEditTargetProject: "",
  lastProjectEditOpener: null,
  isProjectEditBodyLocked: false,
  projectEditScrollLockY: 0,

  // Project delete dialog
  projectDeleteDialogState: null,
  isProjectDeletePending: false,

  // Command palette
  isCommandPaletteOpen: false,
  commandPaletteQuery: "",
  isProfilePanelOpen: false,
  commandPaletteIndex: 0,
  commandPaletteItems: [],
  commandPaletteSelectableItems: [],
  lastFocusedBeforePalette: null,

  // Filter pipeline guard
  isApplyingFiltersPipeline: false,

  // AI Workspace
  isAiWorkspaceCollapsed: true,
  isAiWorkspaceVisible: false, // set properly after AI_DEBUG_ENABLED loaded

  // On-create assist
  onCreateAssistState: null, // initialized below
  suppressOnCreateAssistInput: false,

  // Quick entry
  isQuickEntryPropertiesOpen: false,
  isTaskComposerOpen: false,
  lastTaskComposerTrigger: null,
  taskComposerDefaultProject: "",

  // Home AI
  homeAi: null, // initialized below

  // Chrono natural date
  chronoNaturalDateModulePromise: null,
  quickEntryNaturalDateState: {
    parseTimer: null,
    parseSeq: 0,
    dueSource: "none",
    dueInputProgrammatic: false,
    suppressNextTitleInputParse: false,
    appliedPreview: null,
    suggestionPreview: null,
    lastDetected: null,
    lastSuppressedTextSignature: "",
    lastSuppressedDetectedSignature: "",
  },

  // Priority (task composer)
  currentPriority: "medium",

  // Drag & drop
  draggedTodoId: null,

  // Bulk select
  selectedTodos: new Set(),

  // Undo stack
  undoStack: [],
  undoTimeout: null,
};

// Initialize sub-states that depend on factory functions
state.taskDrawerAssistState = createInitialTaskDrawerAssistState();
state.onCreateAssistState = createInitialOnCreateAssistState();
state.homeAi = createInitialHomeAiState();
state.breakDownState = createInitialBreakDownState();
state.followUpState = createInitialFollowUpState();
state.inboxState = createInitialInboxState();
state.weeklyReviewState = createInitialWeeklyReviewState();
state.cleanupState = createInitialCleanupState();

// ---------------------------------------------------------------------------
// Cross-module hooks — app.js wires all hooks after all modules are loaded.
// This breaks circular import chains without changing call semantics.
// ---------------------------------------------------------------------------
export const hooks = {
  // drawerUi → filterLogic (filterLogic calls this after render)
  syncTodoDrawerStateWithRender: null,
  // todosService/projectsState → filterLogic (call after mutations)
  applyFiltersAndRender: null,
  renderTodos: null,
  updateCategoryFilter: null,
  refreshProjectCatalog: null,
  // todosService/filterLogic → projectsState
  loadProjects: null,
  // todosService → overlayManager
  showConfirmDialog: null,
  // app.js orchestrator callbacks
  updateHeaderAndContextUI: null,
};
