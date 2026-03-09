// =============================================================================
// ES6 Module Imports
// =============================================================================
import {
  state,
  hooks,
  createInitialTaskDrawerAssistState,
  createInitialOnCreateAssistState,
  createInitialTodayPlanState,
  createInitialHomeTopFocusState,
} from "./store.js";
import {
  buildTodosQueryParams,
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
} from "./todosService.js";
import {
  projectStorageKey,
  loadCustomProjects,
  saveCustomProjects,
  loadProjects,
  getProjectRecordByName,
  getSelectedProjectRecord,
  getProjectHeadings,
  renderProjectHeadingCreateButton,
  loadHeadingsForProject,
  scheduleLoadSelectedProjectHeadings,
  createHeadingForSelectedProject,
  ensureProjectExists,
  getAllProjects,
  buildOpenTodoCountMapByProject,
  getProjectsForRail,
  refreshProjectCatalog,
  updateProjectSelectOptions,
  validateProjectNameInput,
  getProjectEditDrawerElements,
  getProjectDeleteDialogElements,
  isProjectSurfaceActive,
  lockBodyScrollForProjectEditDrawer,
  unlockBodyScrollForProjectEditDrawer,
  renderProjectDeleteDialog,
  openProjectDeleteDialog,
  closeProjectDeleteDialog,
  renderProjectEditDrawer,
  openProjectEditDrawer,
  closeProjectEditDrawer,
  syncProjectHeaderActions,
  replaceProjectRecord,
  renameProjectLocally,
  removeProjectLocally,
  getProjectCrudModalElements,
  openProjectCrudModal,
  closeProjectCrudModal,
  submitProjectCrudModal,
  createProjectByName,
  renameProjectByName,
  deleteProjectByName,
  createProject,
  submitProjectEditDrawer,
  confirmDeleteSelectedProject,
  handleProjectDeleteDialogAction,
  createSubproject,
  renameProjectTree,
  renderProjectOptions,
  updateCategoryFilter,
} from "./projectsState.js";
import {
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
} from "./filterLogic.js";
import {
  showConfirmDialog,
  showInputDialog,
  openEditTodoModal,
  closeEditTodoModal,
  saveEditedTodo,
} from "./overlayManager.js";
import {
  readBooleanFeatureFlag,
  isEnhancedTaskCriticEnabled,
  isTaskDrawerDecisionAssistEnabled,
} from "./featureFlags.js";
import {
  syncProjectsRailHost,
  renderSidebarNavigation,
  setSettingsPaneVisible,
  setTodosViewBodyState,
  readStoredRailCollapsedState,
  persistRailCollapsedState,
  readStoredAiWorkspaceCollapsedState,
  readStoredAiWorkspaceVisibleState,
  persistAiWorkspaceCollapsedState,
  persistAiWorkspaceVisibleState,
  getProjectsRailElements,
  openProjectsFromCollapsedRail,
  isMobileRailViewport,
  getProjectTodoCount,
  updateTopbarProjectsButton,
  setProjectsRailActiveState,
  renderProjectsRail,
  setProjectsRailCollapsed,
  closeRailProjectMenu,
  toggleRailProjectMenu,
  lockBodyScrollForProjectsRail,
  unlockBodyScrollForProjectsRail,
  openProjectsRailSheet,
  closeProjectsRailSheet,
  selectProjectFromRail,
  getMoreFiltersElements,
  getFirstFocusableInMoreFilters,
  openMoreFilters,
  closeMoreFilters,
  toggleMoreFilters,
  syncSheetSearch,
  bindRailSearchFocusBehavior,
  renderProjectsRailListHtml,
  getRailOptionElements,
  getCurrentRailFocusKey,
  moveRailOptionFocus,
  syncRailA11yState,
  focusActiveProjectItem,
  openProjectsFromTopbar,
  syncSidebarNavState,
  bindProjectsRailHandlers,
} from "./railUi.js";
import {
  setAuthState,
  handleAuthFailure,
  handleAuthTokens,
  handleVerificationStatusFromUrl,
  switchAuthTab,
  showForgotPassword,
  showLogin,
  showResetPassword,
  handleLogin,
  handleRegister,
  handleForgotPassword,
  handleResetPassword,
  loadUserProfile,
  updateUserDisplay,
  loadAdminBootstrapStatus,
  handleAdminBootstrap,
  resendVerification,
  handleUpdateProfile,
  logout,
  showAppView,
  showAuthView,
} from "./authUi.js";
import {
  readStoredQuickEntryPropertiesOpenState,
  persistQuickEntryPropertiesOpenState,
  setQuickEntryPropertiesOpen,
  formatQuickEntryDueSummary,
  updateQuickEntryPropertiesSummary,
  getQuickEntryNaturalDateElements,
  normalizeQuickEntryTextSignature,
  toLocalDateTimeInputValue,
  formatQuickEntryNaturalDueLabel,
  loadChronoNaturalDateModule,
  removeMatchedDatePhraseFromTitle,
  parseQuickEntryNaturalDue,
  setQuickEntryDueInputValue,
  clearQuickEntryNaturalSuggestionPreview,
  renderQuickEntryNaturalDueChip,
  resetQuickEntryNaturalDueState,
  applyQuickEntryNaturalDueDetection,
  shouldSuppressQuickEntryNaturalAutoApply,
  processQuickEntryNaturalDate,
  scheduleQuickEntryNaturalDateParse,
  onQuickEntryTitleInputForNaturalDate,
  onQuickEntryDueInputChangedByUser,
  handleQuickEntryNaturalDueChipClick,
  bindQuickEntryNaturalDateHandlers,
  syncQuickEntryProjectActions,
  getTaskComposerElements,
  updateTaskComposerDueClearButton,
  inferTaskComposerDefaultProject,
  openTaskComposer,
  closeTaskComposer,
  cancelTaskComposer,
  resetTaskComposerFields,
  clearTaskComposerDueDate,
  bindTaskComposerHandlers,
} from "./quickEntry.js";
import {
  getTodoDueDate,
  getStartOfToday,
  getEndOfDay,
  formatHomeDueBadge,
  createHomeTodoIdSet,
  takeExclusiveTodos,
  getHomeTodoDaysSinceRecentActivity,
  getHomeTopFocusDeterministicReason,
  getHomeTopFocusReason,
  getHomeDueSoonGroupKey,
  buildHomeDueSoonGroups,
  getDueSoonTodos,
  getStaleRiskTodos,
  getQuickWinTodos,
  getProjectsToNudge,
  getTopFocusFallbackTodos,
  getHomeDashboardModel,
  buildHomeTileListByKey,
  buildHomeTopFocusCandidates,
  getHomeTopFocusRequestKey,
  readCachedHomeTopFocus,
  writeCachedHomeTopFocus,
  applyHomeTopFocusResult,
  hydrateHomeTopFocusIfNeeded,
  renderHomeTaskRow,
  renderHomeTaskTile,
  renderProjectsToNudgeTile,
  renderHomeDashboard,
  openHomeTileList,
  openHomeProject,
  openTodoFromHomeTile,
  getHomeDrilldownLabel,
  clearHomeFocusDashboard,
  startOfLocalDay,
  getTodoDueSummary,
  formatDashboardDueChip,
  getDashboardReasonLine,
  getTodoRecencyDays,
  renderTopFocusRow,
  renderHomeFocusDashboard,
} from "./homeDashboard.js";
import {
  getAiWorkspaceElements,
  getAiWorkspaceStatusLabel,
  updateAiWorkspaceStatusChip,
  syncAiWorkspaceVisibility,
  setAiWorkspaceVisible,
  setAiWorkspaceCollapsed,
  toggleAiWorkspace,
  focusAiWorkspaceTarget,
  openAiWorkspaceForBrainDump,
  openAiWorkspaceForGoalPlan,
  loadAiSuggestions,
  loadAiUsage,
  loadAiFeedbackSummary,
  loadAiInsights,
  renderAiUsageSummary,
  renderAiPerformanceInsights,
  renderAiFeedbackInsights,
  renderAiSuggestionHistory,
  updateSuggestionStatus,
  getFeedbackReason,
  toPlanDateInputValue,
  normalizePlanDraftPriority,
  clonePlanDraftTask,
  initPlanDraftState,
  clearPlanDraftState,
  removeAppliedPlanDraftTasks,
  isPlanActionBusy,
  updatePlanGenerateButtonState,
  getSelectedPlanDraftTasks,
  buildPlanTaskCreatePayload,
  renderCritiquePanel,
  renderLegacyCritiquePanel,
  getCritiqueSuggestions,
  renderEnhancedCritiquePanel,
  updateCritiqueDraftButtonState,
  setCritiqueFeedbackReason,
  renderPlanPanel,
  setPlanDraftTaskSelected,
  updatePlanDraftTaskTitle,
  updatePlanDraftTaskDescription,
  updatePlanDraftTaskDueDate,
  updatePlanDraftTaskProject,
  updatePlanDraftTaskPriority,
  selectAllPlanDraftTasks,
  selectNoPlanDraftTasks,
  resetPlanDraft,
  retryMarkPlanSuggestionAccepted,
  critiqueDraftWithAi,
  applyCritiqueSuggestion,
  applyCritiqueSuggestionMode,
  dismissCritiqueSuggestion,
  generatePlanWithAi,
  clearBrainDumpInput,
  handlePlanFromGoalSuccess,
  draftPlanFromBrainDumpWithAi,
  addPlanTasksToTodos,
  dismissPlanSuggestion,
} from "./aiWorkspace.js";
import {
  markTaskDrawerDismissed,
  clearTaskDrawerDismissed,
  isTaskDrawerDismissed,
  resetTaskDrawerAssistState,
  getTodoDrawerElements,
  initializeDrawerDraft,
  setDrawerSaveState,
  lockBodyScrollForDrawer,
  unlockBodyScrollForDrawer,
  saveDrawerPatch,
  onDrawerTitleInput,
  onDrawerTitleBlur,
  onDrawerTitleKeydown,
  onDrawerCompletedChange,
  onDrawerDueDateChange,
  onDrawerProjectChange,
  onDrawerPriorityChange,
  onDrawerDescriptionInput,
  onDrawerDescriptionBlur,
  onDrawerDescriptionKeydown,
  onDrawerNotesInput,
  onDrawerNotesBlur,
  onDrawerNotesKeydown,
  onDrawerCategoryInput,
  onDrawerCategoryBlur,
  renderTodoDrawerContent,
  loadTaskDrawerDecisionAssist,
  applyTaskDrawerSuggestion,
  dismissTaskDrawerSuggestions,
  undoTaskDrawerSuggestion,
  openTodoDrawer,
  closeTodoDrawer,
  syncTodoDrawerStateWithRender,
  toggleDrawerDetailsPanel,
  deleteTodoFromDrawer,
  getKebabTriggerForTodo,
  closeTodoKebabMenu,
  toggleTodoKebab,
  openTodoFromKebab,
  openEditTodoFromKebab,
  openDrawerDangerZone,
  bindTodoDrawerHandlers,
} from "./drawerUi.js";

// =============================================================================
// EventBus — minimal pub-sub for decoupled state→render wiring.
// =============================================================================
const EventBus = (() => {
  const subs = {};
  return {
    subscribe(event, handler) {
      (subs[event] ??= []).push(handler);
    },
    unsubscribe(event, handler) {
      if (subs[event]) subs[event] = subs[event].filter((h) => h !== handler);
    },
    dispatch(event, payload) {
      (subs[event] ?? []).forEach((h) => h(payload));
    },
  };
})();

// =============================================================================
// TASK 140 DEPENDENCY GRAPH ANALYSIS
// Generated before any split attempt. Status: BLOCKED (see below).
//
// PROPOSED MODULE BOUNDARIES:
//   todosService.js  — CRUD operations for todos (loadTodos, addTodo, deleteTodo,
//                      toggleTodo, updateTodo, deleteSelected, undo pipeline)
//   projectsState.js — Project state (state.customProjects, state.projectRecords,
//                      state.projectHeadingsByProjectId, setSelectedProjectKey,
//                      loadProjects, createSubproject, renameProjectTree)
//   drawerUi.js      — Todo drawer panel (openTodoDrawer, closeTodoDrawer,
//                      renderTodoDrawer, syncTodoDrawerStateWithRender,
//                      drawer draft save pipeline)
//   filterLogic.js   — Filtering + rendering (filterTodos, applyFiltersAndRender,
//                      renderTodos, updateCategoryFilter, setDateView, clearFilters)
//   overlayManager.js — Modals + overlays (openEditTodoModal, closeEditTodoModal,
//                       openProjectCrudModal, openProjectDeleteDialog,
//                       toggleCommandPalette, toggleShortcuts)
//
// CONFIRMED CIRCULAR IMPORT CHAINS:
//
//   ① todosService.js ↔ filterLogic.js
//      • loadTodos() / addTodo() / deleteTodo() / toggleTodo() → call filterTodos()
//        (filterLogic.js must be imported by todosService.js)
//      • filterTodos() / renderTodos() → read `todos` array
//        (todosService.js must be imported by filterLogic.js for `todos` state)
//      → CIRCULAR: todosService → filterLogic → todosService
//
//   ② projectsState.js ↔ filterLogic.js
//      • setSelectedProjectKey() → calls applyFiltersAndRender()   [filterLogic.js]
//      • applyFiltersAndRender() → renderTodos() reads state.customProjects,
//        state.projectRecords, state.projectHeadingsByProjectId                [projectsState.js]
//      → CIRCULAR: projectsState → filterLogic → projectsState
//
//   ③ drawerUi.js ↔ filterLogic.js
//      • applyFiltersAndRender() → calls syncTodoDrawerStateWithRender() [drawerUi.js]
//      • openTodoDrawer() / closeTodoDrawer() → call filterTodos()       [filterLogic.js]
//      → CIRCULAR: filterLogic → drawerUi → filterLogic
//
// RESOLUTION ANALYSIS:
//   Clean resolution requires ONE of:
//   (A) A shared mutable state module (e.g. store.js) — NOT in the allowed file list.
//   (B) Changing filterTodos() / setSelectedProjectKey() signatures to accept state
//       as parameters — explicitly FORBIDDEN by task constraints.
//   (C) Event-based decoupling (CustomEvent fire-and-forget) — changes the
//       synchronous call semantics, constituting a behavior change (BLOCKED).
//   (D) Dynamic import() to break cycles — requires async code paths where
//       currently synchronous; constitutes a behavior change (BLOCKED).
//   (E) Completely different module boundaries (e.g. co-locate todos state WITH
//       filterLogic.js) — still leaves chain ③ unresolved.
//
// ADDITIONAL BLOCKER — window[functionName] dispatcher (line ~13318):
//   The data-onclick dispatcher resolves ~90 handler functions via window[name].
//   Switching to type="module" removes automatic global scope for all functions.
//   Every handler would need an explicit window.xxx = xxx assignment in app.js,
//   making app.js non-thin and defeating the entry-point-orchestrator goal.
//
// VERDICT: BLOCKED
//   Per task constraint: "Circular import that cannot be resolved cleanly →
//   BLOCKED, report to user."
//   Three independent circular chains exist. None can be resolved without a
//   shared store module (file not in allowed list) or forbidden signature changes.
// =============================================================================

// Configuration
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : window.location.origin;

// Debounce utility — no external dependency.
// Fires on the leading edge (immediate on first call) and again on the
// trailing edge (ms after the last call), so single-event triggers (e.g.
// Playwright fill()) respond instantly while rapid keystrokes are batched.
const DEBOUNCE_MS = 250;
const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    const leading = !t;
    clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      if (!leading) fn(...args);
    }, ms);
    if (leading) fn(...args);
  };
};

// =============================================================================
// DialogManager — centralizes focus trap, Escape propagation, and aria-modal
// attribute management for all modal overlay surfaces.
//
// Design decisions:
//   • z-index is NOT managed — each overlay's CSS handles stacking. Touching
//     z-index here would break backdrops and existing Playwright assertions.
//   • Focus is NOT auto-managed — each overlay's own open/close function
//     handles focus movement. DialogManager only traps Tab while a layer is
//     registered so focus stays within the topmost surface.
//   • Escape is routed to the topmost layer's onEscape callback. The global
//     bubble-phase keydown handler must not double-fire for managed layers
//     (see guard below global keydown registration).
//   • aria-modal="true" is set on open and removed on close.
// =============================================================================
const DialogManager = (() => {
  const stack = []; // [{ layerId, el, onEscape }]

  function getFocusable(el) {
    return Array.from(
      el.querySelectorAll(
        "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])," +
          'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((e) => !e.closest("[hidden]") && e.offsetParent !== null);
  }

  function trapFocus(e) {
    const top = stack[stack.length - 1];
    if (!top) return;
    const focusable = getFocusable(top.el);
    if (!focusable.length) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleKeydown(e) {
    if (e.key === "Tab" && stack.length > 0) {
      trapFocus(e);
      e.stopPropagation();
      return;
    }
    if (e.key === "Escape" && stack.length > 0) {
      e.stopPropagation();
      const top = stack[stack.length - 1];
      if (top.onEscape) top.onEscape();
    }
  }

  document.addEventListener("keydown", handleKeydown, true);

  return {
    /**
     * Register an overlay layer with DialogManager.
     * @param {string} layerId     - unique identifier string
     * @param {HTMLElement} el     - the overlay container element
     * @param {object} [opts]
     *   opts.onEscape {function}  - called when Escape pressed on topmost layer
     */
    open(layerId, el, opts) {
      const options = opts || {};
      if (stack.some((s) => s.layerId === layerId)) return;
      el.setAttribute("aria-modal", "true");
      if (!el.getAttribute("role")) {
        el.setAttribute("role", "dialog");
      }
      stack.push({ layerId, el, onEscape: options.onEscape || null });
    },

    close(layerId) {
      const idx = stack.findIndex((s) => s.layerId === layerId);
      if (idx === -1) return;
      const entry = stack.splice(idx, 1)[0];
      entry.el.removeAttribute("aria-modal");
    },

    closeAll() {
      while (stack.length > 0) {
        const entry = stack.pop();
        entry.el.removeAttribute("aria-modal");
      }
    },

    isOpen(layerId) {
      return stack.some((s) => s.layerId === layerId);
    },

    get depth() {
      return stack.length;
    },
  };
})();

// ---------------------------------------------------------------------------
// Module consumption — extracted pure-function modules loaded before app.js
// via <script defer> in index.html (see state.js, apiClient.js pattern).
// ---------------------------------------------------------------------------
const {
  escapeHtml,
  showMessage,
  hideMessage,
  PROJECT_PATH_SEPARATOR,
  MOBILE_DRAWER_MEDIA_QUERY,
} = window.Utils || {};
const {
  LINT_VAGUE_WORDS,
  LINT_VAGUE_WORDS_ON_CREATE,
  LINT_URGENCY_WORDS,
  lintTodoFields,
  renderLintChip,
} = window.LintHeuristics || {};
const {
  splitProjectPath,
  normalizeProjectPath,
  compareProjectPaths,
  expandProjectTree,
  getProjectDepth,
  getProjectLeafName,
  renderProjectOptionEntry,
} = window.ProjectPathUtils || {};
const {
  padIcsNumber,
  toIcsUtcTimestamp,
  toIcsDateValue,
  escapeIcsText,
  foldIcsLine,
  buildIcsContentForTodos,
  buildIcsFilename,
} = window.IcsExport || {};
const { initTheme, toggleTheme } = window.ThemeModule || {};
const {
  AI_DEBUG_ENABLED,
  ON_CREATE_SURFACE,
  TODAY_PLAN_SURFACE,
  AI_SURFACE_TYPES,
  AI_SURFACE_IMPACT,
  isKnownSuggestionType,
  impactRankForSurface,
  sortSuggestions,
  capSuggestions,
  confidenceBand,
  confidenceLabel,
  labelForType,
  truncateRationale,
  needsConfirmation,
  shouldRenderTypeForSurface,
  renderAiDebugMeta,
  renderAiDebugSuggestionId,
} = window.AiSuggestionUtils || {};

const FEATURE_ENHANCED_TASK_CRITIC = isEnhancedTaskCriticEnabled();

const FEATURE_TASK_DRAWER_DECISION_ASSIST = isTaskDrawerDecisionAssistEnabled();

// Categories that are assigned automatically by server-side AI flows and must
// not surface as user-navigable project entries in the rail, the
// #categoryFilter dropdown, or the create-form project picker.
// Todos that carry these categories are intentionally preserved in the data
// layer and remain visible under "All Tasks"; they are only excluded from
// navigation surfaces.
const AI_INTERNAL_CATEGORIES = new Set(["AI Plan"]);

function isInternalCategoryPath(value) {
  const normalized = normalizeProjectPath(value);
  if (!normalized) return false;
  for (const internal of AI_INTERNAL_CATEGORIES) {
    if (
      normalized === internal ||
      normalized.startsWith(`${internal}${PROJECT_PATH_SEPARATOR}`)
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Lint heuristics provided by lintHeuristics.js (lintTodoFields, renderLintChip)
// ---------------------------------------------------------------------------

// AppState and ApiClient are loaded by state.js and apiClient.js (both
// <script defer> before app.js).  No inline fallback is needed — if either
// module is missing the app cannot function and we fail fast.
const AppStateModule = window.AppState;
const ApiClientModule = window.ApiClient;

const {
  AUTH_STATE,
  EMAIL_ACTION_TIMEOUT_MS,
  loadStoredSession,
  persistSession,
} = AppStateModule;
// PROJECT_PATH_SEPARATOR, MOBILE_DRAWER_MEDIA_QUERY — from utils.js
// ON_CREATE_SURFACE, TODAY_PLAN_SURFACE — from aiSuggestionUtils.js
// AI_DEBUG_ENABLED, AI_SURFACE_TYPES, AI_SURFACE_IMPACT — from aiSuggestionUtils.js
const PROJECTS_RAIL_COLLAPSED_STORAGE_KEY = "todos:projects-rail-collapsed";
const AI_WORKSPACE_COLLAPSED_STORAGE_KEY = "todos:ai-collapsed";
const AI_WORKSPACE_VISIBLE_STORAGE_KEY = "todos:ai-visible";
const AI_ON_CREATE_DISMISSED_STORAGE_KEY = "todos:ai-on-create-dismissed";
const QUICK_ENTRY_PROPERTIES_OPEN_STORAGE_KEY =
  "todos:quick-entry-properties-open";
const SIDEBAR_NAV_ITEMS = [];
state.onCreateAssistState.dismissedTodoIds = loadOnCreateDismissedTodoIds();

const HOME_TOP_FOCUS_CACHE_KEY = "todos:home-top-focus-cache";
const HOME_TOP_FOCUS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const QUICK_ENTRY_NATURAL_DATE_DEBOUNCE_MS = 320;

function emitAiSuggestionUndoTelemetry({
  surface,
  aiSuggestionDbId,
  suggestionId,
  todoId,
  selectedTodoIdsCount,
}) {
  try {
    console.info(
      JSON.stringify({
        type: "ai_decision_assist_telemetry",
        eventName: "ai_suggestion_undo",
        surface,
        aiSuggestionDbId: aiSuggestionDbId || undefined,
        suggestionId: suggestionId || undefined,
        todoId: todoId || undefined,
        selectedTodoIdsCount:
          typeof selectedTodoIdsCount === "number" &&
          Number.isFinite(selectedTodoIdsCount)
            ? Math.max(0, Math.floor(selectedTodoIdsCount))
            : undefined,
        ts: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("AI undo telemetry emit failed:", error);
  }
}

const apiClient = ApiClientModule.createApiClient({
  apiUrl: API_URL,
  getAuthToken: () => state.authToken,
  getRefreshToken: () => state.refreshToken,
  getAuthState: () => state.authState,
  setAuthState,
  onAuthFailure: handleAuthFailure,
  onAuthTokens: handleAuthTokens,
});

const {
  apiCall,
  fetchWithTimeout,
  apiCallWithTimeout,
  isAbortError,
  parseApiBody,
} = apiClient;

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
  EventBus.dispatch("todos:changed", { reason: "workspace-view" });

  if (state.isRailSheetOpen) {
    closeProjectsRailSheet({
      restoreFocus: !(triggerEl instanceof HTMLElement),
    });
  }
}

function moveProjectHeading(headingId, direction) {
  const headings = getProjectHeadings();
  const currentIndex = headings.findIndex(
    (heading) => String(heading.id) === String(headingId),
  );
  if (currentIndex < 0) return;
  const nextIndex = currentIndex + Number(direction);
  if (nextIndex < 0 || nextIndex >= headings.length) return;
  const targetId = String(headings[nextIndex]?.id || "");
  if (!targetId) return;
  reorderProjectHeadings(String(headingId), targetId, "before");
}
function reorderProjectHeadings(draggedId, targetId, placement = "before") {
  const projectName = getSelectedProjectKey();
  const projectRecord = getProjectRecordByName(projectName);
  if (!projectRecord?.id) return;

  const projectId = String(projectRecord.id);
  const headings = [...getProjectHeadings(projectName)];
  if (!headings.length) return;

  const draggedIndex = headings.findIndex(
    (heading) => String(heading.id) === String(draggedId),
  );
  const targetIndex = headings.findIndex(
    (heading) => String(heading.id) === String(targetId),
  );
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
    return;
  }

  const [draggedHeading] = headings.splice(draggedIndex, 1);
  let insertIndex = targetIndex + (placement === "after" ? 1 : 0);
  if (draggedIndex < insertIndex) {
    insertIndex -= 1;
  }
  insertIndex = Math.max(0, Math.min(insertIndex, headings.length));
  headings.splice(insertIndex, 0, draggedHeading);

  state.projectHeadingsByProjectId.set(
    projectId,
    headings.map((heading, index) => ({
      ...heading,
      sortOrder: index,
    })),
  );
  renderTodos();

  void (async () => {
    try {
      const response = await apiCall(
        `${API_URL}/projects/${encodeURIComponent(projectId)}/headings/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            headings.map((heading, index) => ({
              id: String(heading.id),
              sortOrder: index,
            })),
          ),
        },
      );
      if (!response || !response.ok) {
        throw new Error("Failed to persist heading order");
      }
    } catch (error) {
      console.error("Persist heading reorder failed:", error);
      await loadHeadingsForProject(projectName);
      renderTodos();
      showMessage("todosMessage", "Failed to reorder headings", "error");
    }
  })();
}

function getHeadingDropTargetFromTodo(todoId, dropPosition = "before") {
  const projectName = getSelectedProjectKey();
  const headings = getProjectHeadings(projectName);
  if (!headings.length) {
    return null;
  }
  const headingIds = new Set(headings.map((heading) => String(heading.id)));
  const todo = state.todos.find((item) => String(item.id) === String(todoId));
  const todoHeadingId = String(todo?.headingId || "");
  if (todoHeadingId && headingIds.has(todoHeadingId)) {
    if (todoHeadingId === String(draggedHeadingId || "")) {
      const currentIndex = headings.findIndex(
        (heading) => String(heading.id) === todoHeadingId,
      );
      if (currentIndex >= 0) {
        const previousHeading = headings[currentIndex - 1] || null;
        const nextHeading = headings[currentIndex + 1] || null;
        if (dropPosition === "before") {
          if (previousHeading?.id) {
            return { targetId: String(previousHeading.id), placement: "after" };
          }
          if (nextHeading?.id) {
            return { targetId: String(nextHeading.id), placement: "before" };
          }
        } else {
          if (nextHeading?.id) {
            return { targetId: String(nextHeading.id), placement: "before" };
          }
          if (previousHeading?.id) {
            return { targetId: String(previousHeading.id), placement: "after" };
          }
        }
      }
    }
    return { targetId: todoHeadingId, placement: dropPosition };
  }
  const edgeHeading =
    dropPosition === "after" ? headings[headings.length - 1] : headings[0];
  if (!edgeHeading?.id) {
    return null;
  }
  return { targetId: String(edgeHeading.id), placement: dropPosition };
}
async function moveTodoToHeading(todoId, headingIdValue) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  const nextHeadingId =
    typeof headingIdValue === "string" && headingIdValue.trim()
      ? headingIdValue.trim()
      : null;
  try {
    const updated = await applyTodoPatch(todoId, { headingId: nextHeadingId });
    if (!nextHeadingId) {
      renderTodos();
      return;
    }
    const projectName = normalizeProjectPath(
      updated?.category || todo.category || "",
    );
    if (projectName) {
      await loadHeadingsForProject(projectName);
    }
    renderTodos();
  } catch (error) {
    console.error("Move todo heading failed:", error);
    showMessage("todosMessage", "Failed to move task to heading", "error");
  }
}

function getCommandPaletteElements() {
  const overlay = document.getElementById("commandPaletteOverlay");
  const panel = document.getElementById("commandPalettePanel");
  const input = document.getElementById("commandPaletteInput");
  const list = document.getElementById("commandPaletteList");
  const empty = document.getElementById("commandPaletteEmpty");
  const title = document.getElementById("commandPaletteTitle");
  if (!(overlay instanceof HTMLElement)) return null;
  if (!(panel instanceof HTMLElement)) return null;
  if (!(input instanceof HTMLInputElement)) return null;
  if (!(list instanceof HTMLElement)) return null;
  if (!(empty instanceof HTMLElement)) return null;
  if (!(title instanceof HTMLElement)) return null;
  return { overlay, panel, input, list, empty, title };
}

function buildCommandPaletteItems() {
  const baseItems = [
    {
      id: "add-task",
      label: "Add task",
      type: "action",
      payload: "add-task",
    },
    {
      id: "all-tasks",
      label: "Go to All tasks",
      type: "project",
      payload: "",
    },
  ];

  const projectItems = getAllProjects().map((projectName) => ({
    id: `project-${projectName}`,
    label: `Go to project: ${getProjectLeafName(projectName)}`,
    type: "project",
    payload: projectName,
  }));

  return [...baseItems, ...projectItems];
}

function getCommandPaletteCommandMatches(query) {
  if (!query) {
    return state.commandPaletteItems;
  }
  return state.commandPaletteItems.filter((item) =>
    item.label.toLowerCase().includes(query),
  );
}

function getCommandPaletteTaskMatches(query) {
  if (!query) {
    return [];
  }

  const normalizedQuery = query.toLowerCase();
  const ranked = state.todos
    .map((todo) => {
      const title = String(todo.title || "");
      const description = String(todo.description || "");
      const titleLower = title.toLowerCase();
      const descriptionLower = description.toLowerCase();

      let score = -1;
      if (titleLower.startsWith(normalizedQuery)) {
        score = 0;
      } else if (titleLower.includes(normalizedQuery)) {
        score = 1;
      } else if (descriptionLower.includes(normalizedQuery)) {
        score = 2;
      }

      if (score === -1) return null;

      const dueAt = todo.dueDate ? new Date(todo.dueDate).getTime() : Infinity;
      return {
        id: `task-${todo.id}`,
        type: "task",
        todoId: String(todo.id),
        label: title,
        score,
        dueAt: Number.isFinite(dueAt) ? dueAt : Infinity,
        completed: !!todo.completed,
        meta: [
          todo.category ? `Project: ${todo.category}` : "",
          todo.dueDate
            ? `Due: ${new Date(todo.dueDate).toLocaleDateString()}`
            : "",
        ]
          .filter(Boolean)
          .join(" • "),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      const titleCompare = a.label.localeCompare(b.label);
      if (titleCompare !== 0) return titleCompare;
      return a.todoId.localeCompare(b.todoId);
    });

  return ranked.slice(0, 6);
}

function getCommandPaletteRenderModel() {
  const query = state.commandPaletteQuery.trim().toLowerCase();
  const commandMatches = getCommandPaletteCommandMatches(query);
  const taskMatches = getCommandPaletteTaskMatches(query);
  const rows = [];

  if (commandMatches.length > 0) {
    rows.push({
      kind: "section",
      id: "commands-section",
      label: "Commands",
    });
    commandMatches.forEach((item) => {
      rows.push({ kind: "item", item });
    });
  }

  if (query) {
    rows.push({
      kind: "section",
      id: "tasks-section",
      label: "Tasks",
    });
    if (taskMatches.length === 0) {
      rows.push({
        kind: "empty",
        id: "tasks-empty",
        label: "No tasks found",
      });
    } else {
      taskMatches.forEach((item) => {
        rows.push({ kind: "item", item });
      });
    }
  }

  const selectableItems = rows
    .filter((row) => row.kind === "item")
    .map((row) => row.item);

  const hasAnyResults =
    commandMatches.length > 0 || (!!query && taskMatches.length > 0);
  return { rows, selectableItems, hasAnyResults };
}

function renderCommandPalette() {
  const refs = getCommandPaletteElements();
  if (!refs) return;

  refs.overlay.classList.toggle(
    "command-palette-overlay--open",
    state.isCommandPaletteOpen,
  );
  refs.overlay.setAttribute("aria-hidden", String(!state.isCommandPaletteOpen));
  refs.input.value = state.commandPaletteQuery;

  const renderModel = getCommandPaletteRenderModel();
  state.commandPaletteSelectableItems = renderModel.selectableItems;
  if (state.commandPaletteSelectableItems.length === 0) {
    state.commandPaletteIndex = 0;
  } else if (
    state.commandPaletteIndex >
    state.commandPaletteSelectableItems.length - 1
  ) {
    state.commandPaletteIndex = state.commandPaletteSelectableItems.length - 1;
  }

  refs.input.setAttribute("aria-expanded", String(state.isCommandPaletteOpen));
  refs.input.setAttribute(
    "aria-activedescendant",
    state.commandPaletteSelectableItems.length > 0
      ? `commandPaletteOption-${state.commandPaletteIndex}`
      : "",
  );

  let selectableIndex = -1;
  refs.list.innerHTML = renderModel.rows
    .map((row) => {
      if (row.kind === "section") {
        return `<div class="command-palette-section" role="presentation">${escapeHtml(row.label)}</div>`;
      }
      if (row.kind === "empty") {
        return `<div class="command-palette-inline-empty" role="status">${escapeHtml(row.label)}</div>`;
      }

      selectableIndex += 1;
      const isActive = selectableIndex === state.commandPaletteIndex;
      const item = row.item;
      if (item.type === "task") {
        return `
          <button
            type="button"
            id="commandPaletteOption-${selectableIndex}"
            class="command-palette-option command-palette-option--task ${isActive ? "command-palette-option--active" : ""} ${item.completed ? "command-palette-option--completed" : ""}"
            role="option"
            aria-selected="${isActive ? "true" : "false"}"
            data-command-index="${selectableIndex}"
            data-command-id="${escapeHtml(item.id)}"
          >
            <span class="command-palette-option__title">${escapeHtml(item.label)}</span>
            <span class="command-palette-option__meta">${escapeHtml(item.meta || (item.completed ? "Completed" : ""))}</span>
          </button>
        `;
      }

      return `
        <button
          type="button"
          id="commandPaletteOption-${selectableIndex}"
          class="command-palette-option ${isActive ? "command-palette-option--active" : ""}"
          role="option"
          aria-selected="${isActive ? "true" : "false"}"
          data-command-index="${selectableIndex}"
          data-command-id="${escapeHtml(item.id)}"
        >
          ${escapeHtml(item.label)}
        </button>
      `;
    })
    .join("");

  refs.empty.hidden = renderModel.hasAnyResults;
}

function executeCommandPaletteItem(item, triggerEl = null) {
  if (!item) return;

  const todosView = document.getElementById("todosView");
  const shouldSwitchToTodos =
    !(todosView instanceof HTMLElement) ||
    !todosView.classList.contains("active") ||
    todosView.classList.contains("todos-view--settings-active");

  if (item.type === "action" && item.payload === "add-task") {
    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    if (shouldSwitchToTodos) {
      switchView("todos", todosTab instanceof HTMLElement ? todosTab : null);
    }
    closeCommandPalette({ restoreFocus: false });
    window.requestAnimationFrame(() => {
      openTaskComposer(triggerEl);
    });
    return;
  }

  if (item.type === "project") {
    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    if (shouldSwitchToTodos) {
      switchView("todos", todosTab instanceof HTMLElement ? todosTab : null);
    }
    state.currentWorkspaceView = item.payload ? "project" : "all";
    clearHomeListDrilldown();
    setSelectedProjectKey(String(item.payload || ""));
    closeCommandPalette({ restoreFocus: false });
  }

  if (item.type === "task") {
    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    if (shouldSwitchToTodos) {
      switchView("todos", todosTab instanceof HTMLElement ? todosTab : null);
    }

    closeCommandPalette({ restoreFocus: false });
    window.requestAnimationFrame(() => {
      openTodoDrawer(
        item.todoId,
        triggerEl instanceof HTMLElement ? triggerEl : null,
      );
    });
  }
}

function moveCommandPaletteSelection(delta) {
  const visibleCount = state.commandPaletteSelectableItems.length;
  if (visibleCount === 0) {
    state.commandPaletteIndex = 0;
    renderCommandPalette();
    return;
  }
  state.commandPaletteIndex =
    (state.commandPaletteIndex + delta + visibleCount) % visibleCount;
  renderCommandPalette();
}

function closeCommandPalette({ restoreFocus = true } = {}) {
  if (!state.isCommandPaletteOpen) return;
  state.isCommandPaletteOpen = false;
  state.commandPaletteQuery = "";
  state.commandPaletteIndex = 0;
  state.commandPaletteSelectableItems = [];
  renderCommandPalette();
  DialogManager.close("commandPalette");

  if (restoreFocus && state.lastFocusedBeforePalette instanceof HTMLElement) {
    state.lastFocusedBeforePalette.focus({ preventScroll: true });
  }
}

function openCommandPalette() {
  if (!state.currentUser) return;

  const refs = getCommandPaletteElements();
  if (!refs) return;
  if (state.isCommandPaletteOpen) return;

  state.lastFocusedBeforePalette =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  state.commandPaletteItems = buildCommandPaletteItems();
  state.commandPaletteSelectableItems = [];
  state.commandPaletteQuery = "";
  state.commandPaletteIndex = 0;
  state.isCommandPaletteOpen = true;
  renderCommandPalette();
  DialogManager.open("commandPalette", refs.overlay, {
    onEscape: () => closeCommandPalette({ restoreFocus: true }),
    backdrop: false,
  });

  window.requestAnimationFrame(() => {
    refs.input.focus();
    refs.input.select();
  });
}

function toggleCommandPalette() {
  if (state.isCommandPaletteOpen) {
    closeCommandPalette({ restoreFocus: true });
    return;
  }
  openCommandPalette();
}

function taskDrawerDismissKey(todoId) {
  return `taskDrawerAssist:dismissed:${todoId}`;
}

function getTaskDrawerSuggestionLabel(type) {
  return labelForType(type);
}

function normalizeTaskDrawerAssistEnvelope(
  aiSuggestionId,
  outputEnvelope,
  fallbackTodoId,
) {
  const suggestionsRaw = Array.isArray(outputEnvelope?.suggestions)
    ? outputEnvelope.suggestions
    : [];
  const normalized = suggestionsRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const suggestion = item;
      const type = String(suggestion.type || "");
      if (!shouldRenderTypeForSurface("task_drawer", type)) {
        return null;
      }
      const payload =
        suggestion.payload && typeof suggestion.payload === "object"
          ? { ...suggestion.payload }
          : {};
      if (typeof payload.todoId !== "string" || !payload.todoId.trim()) {
        payload.todoId = fallbackTodoId;
      }
      return {
        type,
        suggestionId:
          String(suggestion.suggestionId || "").trim() ||
          `${aiSuggestionId || "drawer"}-${index + 1}`,
        confidence: Math.max(
          0,
          Math.min(1, Number(suggestion.confidence) || 0),
        ),
        rationale: truncateRationale(suggestion.rationale, 120),
        payload,
        requiresConfirmation: needsConfirmation(suggestion),
        dismissed: false,
      };
    })
    .filter(Boolean);
  return capSuggestions(sortSuggestions("task_drawer", normalized), 6);
}

function renderTaskDrawerSuggestionSummary(suggestion) {
  if (suggestion.type === "rewrite_title") {
    return String(suggestion.payload.title || "Rewrite task title");
  }
  if (suggestion.type === "set_due_date") {
    const due = new Date(String(suggestion.payload.dueDateISO || ""));
    return Number.isNaN(due.getTime())
      ? "Set due date"
      : `Set due ${due.toLocaleDateString()}`;
  }
  if (suggestion.type === "set_priority") {
    return `Set priority ${String(suggestion.payload.priority || "").toUpperCase()}`;
  }
  if (suggestion.type === "set_project") {
    return `Set project ${String(suggestion.payload.projectName || suggestion.payload.category || "")}`.trim();
  }
  if (suggestion.type === "set_category") {
    return `Set category ${String(suggestion.payload.category || "")}`.trim();
  }
  if (suggestion.type === "split_subtasks") {
    const count = Array.isArray(suggestion.payload.subtasks)
      ? suggestion.payload.subtasks.length
      : 0;
    return `Add ${count} subtasks`;
  }
  if (suggestion.type === "propose_next_action") {
    return String(suggestion.payload.text || suggestion.payload.title || "");
  }
  if (suggestion.type === "ask_clarification") {
    return String(suggestion.payload.question || "Need one clarification");
  }
  return "Suggestion";
}

function renderTaskDrawerAssistSection(todoId) {
  // Lint-first gate: show lint chip only when a heuristic fires.
  // Full panel should render only after explicit user action.
  // In debug mode, always show the full panel so developers see all metadata.
  const assistState = state.taskDrawerAssistState;
  if (!assistState.showFullAssist && !AI_DEBUG_ENABLED) {
    const todo = getTodoById(todoId);
    const issue = todo
      ? lintTodoFields({
          title: todo.title,
          dueDate: todo.dueDate || "",
          priority: todo.priority || "",
          subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
          allTodos: state.todos,
        })
      : null;
    if (issue) {
      // A lint issue is present — show only the chip (suppress full panel).
      return `
        <div class="todo-drawer__section">
          <div class="todo-drawer__section-title">AI Suggestions</div>
          ${renderLintChip(issue)}
        </div>
      `;
    }
    return "";
  }

  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    return `
      <div class="todo-drawer__section">
        <div class="todo-drawer__section-title">AI Suggestions</div>
        <div class="ai-empty" role="status">AI Suggestions unavailable.</div>
      </div>
    `;
  }
  const base = `
    <div class="todo-drawer__section">
      <div class="todo-drawer__section-title">AI Suggestions</div>
      ${renderAiDebugMeta({
        requestId: assistState.requestId,
        generatedAt: assistState.generatedAt,
        contractVersion: assistState.contractVersion,
      })}
      ${assistState.loading ? '<div class="ai-empty" role="status">Loading suggestions...</div>' : ""}
      ${
        assistState.unavailable
          ? '<div class="ai-empty" role="status">AI Suggestions unavailable.</div>'
          : ""
      }
      ${assistState.error ? `<div class="ai-empty" role="status">${escapeHtml(assistState.error)}</div>` : ""}
      ${
        !assistState.loading &&
        !assistState.unavailable &&
        !assistState.error &&
        (assistState.mustAbstain || assistState.suggestions.length === 0)
          ? '<div class="ai-empty" role="status">No suggestions right now.</div>'
          : ""
      }
      ${
        assistState.suggestions.length > 0
          ? `<div class="todo-drawer-ai-list">
              ${assistState.suggestions
                .map((suggestion) => {
                  const confidenceLabel = confidenceLabelForSuggestion(
                    suggestion.confidence,
                  );
                  const applying =
                    assistState.applyingSuggestionId ===
                    suggestion.suggestionId;
                  const confirmOpen =
                    assistState.confirmSuggestionId === suggestion.suggestionId;
                  return `
                    <div class="todo-drawer-ai-card ai-card" data-testid="task-drawer-ai-card-${escapeHtml(suggestion.suggestionId)}">
                      <div class="todo-drawer-ai-card__top">
                        <span class="todo-drawer-ai-card__label">${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}</span>
                        <span class="ai-badge ai-badge--${escapeHtml(confidenceBand(suggestion.confidence))}" aria-label="Confidence ${escapeHtml(confidenceLabel)}">${escapeHtml(confidenceLabel)}</span>
                      </div>
                      <div class="todo-drawer-ai-card__summary">${escapeHtml(renderTaskDrawerSuggestionSummary(suggestion))}</div>
                      <div class="todo-drawer-ai-card__rationale ai-tooltip">${escapeHtml(suggestion.rationale)}</div>
                      ${renderAiDebugSuggestionId(suggestion.suggestionId)}
                      ${
                        assistState.lastUndoSuggestionId ===
                        suggestion.suggestionId
                          ? `<div class="ai-tooltip">Undone locally</div>`
                          : ""
                      }
                      <div class="todo-drawer-ai-card__actions ai-actions">
                        ${
                          confirmOpen
                            ? `
                              <div class="ai-confirm">
                                <button
                                  type="button"
                                  class="ai-action-btn"
                                  data-testid="task-drawer-ai-confirm-${escapeHtml(suggestion.suggestionId)}"
                                  data-drawer-ai-action="confirm-apply"
                                  data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                  aria-label="Confirm apply ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  class="ai-action-btn"
                                  data-testid="task-drawer-ai-cancel-${escapeHtml(suggestion.suggestionId)}"
                                  data-drawer-ai-action="cancel-confirm"
                                  data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                  aria-label="Cancel confirmation"
                                >
                                  Cancel
                                </button>
                              </div>
                            `
                            : `
                              <button
                                type="button"
                                class="ai-action-btn"
                                data-testid="task-drawer-ai-apply-${escapeHtml(suggestion.suggestionId)}"
                                data-drawer-ai-action="apply"
                                data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                aria-label="Apply ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                                ${applying ? "disabled" : ""}
                              >
                                ${applying ? "Applying..." : "Apply"}
                              </button>
                            `
                        }
                        <button
                          type="button"
                          class="ai-action-btn"
                          data-testid="task-drawer-ai-dismiss-${escapeHtml(suggestion.suggestionId)}"
                          data-drawer-ai-action="dismiss"
                          data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                          aria-label="Dismiss ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                        >
                          Dismiss
                        </button>
                        ${
                          assistState.undoBySuggestionId[
                            suggestion.suggestionId
                          ]
                            ? `
                              <button
                                type="button"
                                class="ai-undo"
                                data-testid="task-drawer-ai-undo-${escapeHtml(suggestion.suggestionId)}"
                                data-drawer-ai-action="undo"
                                data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                aria-label="Undo ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                              >
                                Undo
                              </button>
                            `
                            : ""
                        }
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;

  window.requestAnimationFrame(() => {
    const confirmButton = document.querySelector(
      `[data-drawer-ai-action="confirm-apply"][data-drawer-ai-suggestion-id="${escapeSelectorValue(
        assistState.confirmSuggestionId || "",
      )}"]`,
    );
    if (confirmButton instanceof HTMLElement) {
      confirmButton.focus({ preventScroll: true });
    }
  });

  return base;
}

function confidenceLabelForSuggestion(confidence) {
  return confidenceLabel(confidence);
}

function getTodoById(todoId) {
  return state.todos.find((todo) => todo.id === todoId) || null;
}

function getCurrentDrawerDraft(todo) {
  if (!todo) return null;
  if (!state.drawerDraft || state.drawerDraft.id !== todo.id) {
    initializeDrawerDraft(todo);
  }
  return state.drawerDraft;
}

function captureDrawerFocusState() {
  const refs = getTodoDrawerElements();
  if (!refs) return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!refs.drawer.contains(active)) return null;
  if (!active.id) return null;

  const state = { id: active.id, selectionStart: null, selectionEnd: null };
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    state.selectionStart = active.selectionStart;
    state.selectionEnd = active.selectionEnd;
  }
  return state;
}

function restoreDrawerFocusState(focusState) {
  if (!focusState || !focusState.id) return;
  const target = document.getElementById(focusState.id);
  if (!(target instanceof HTMLElement)) return;

  target.focus({ preventScroll: true });
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    if (
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number"
    ) {
      target.setSelectionRange(
        focusState.selectionStart,
        focusState.selectionEnd,
      );
    }
  }
}

function isMobileDrawerViewport() {
  if (window.matchMedia) {
    return window.matchMedia(MOBILE_DRAWER_MEDIA_QUERY).matches;
  }
  return window.innerWidth <= 768;
}

function updateDrawerDraftField(field, value) {
  if (!state.drawerDraft) return;
  state.drawerDraft[field] = value;
  if (state.drawerSaveState !== "saving") {
    setDrawerSaveState("idle");
  }
}

function renderDrawerSubtasks(todo) {
  if (!Array.isArray(todo.subtasks) || todo.subtasks.length === 0) {
    return '<p class="todo-drawer__subtasks-empty">No subtasks</p>';
  }

  return `
    <ul class="todo-drawer__subtasks-list">
      ${todo.subtasks
        .map((subtask) => {
          const title = escapeHtml(String(subtask?.title || ""));
          return `
            <li class="todo-drawer__subtasks-item ${subtask?.completed ? "completed" : ""}">
              <span aria-hidden="true">${subtask?.completed ? "✓" : "○"}</span>
              <span>${title}</span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
  updateAiWorkspaceStatusChip();
}

function buildDrawerProjectOptions(selectedProject = "") {
  const projects = getAllProjects();
  return `<option value="">None</option>${projects
    .map((project) => renderProjectOptionEntry(project, selectedProject))
    .join("")}`;
}

async function fetchTaskDrawerLatestSuggestion(todoId) {
  const response = await apiCall(
    `${API_URL}/ai/suggestions/latest?todoId=${encodeURIComponent(todoId)}&surface=task_drawer`,
  );
  return response;
}

async function generateTaskDrawerSuggestion(todo) {
  return apiCall(`${API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: "task_drawer",
      todoId: todo.id,
      title: todo.title,
      description: todo.description || "",
      notes: todo.notes || "",
    }),
  });
}

function escapeSelectorValue(value) {
  const raw = String(value);
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, "\\$&");
}

function renderTodoChips(todo, { isOverdue, dueDateStr }) {
  const chips = [];

  if (todo.dueDate) {
    const dueLabel = `${isOverdue ? "⚠️" : "📅"} ${dueDateStr}`;
    chips.push(
      `<span class="todo-chip todo-chip--due ${isOverdue ? "todo-chip--due-overdue" : ""}" title="${escapeHtml(dueLabel)}">${escapeHtml(dueLabel)}</span>`,
    );
  }

  if (todo.category) {
    chips.push(
      `<span class="todo-chip todo-chip--project" title="${escapeHtml(todo.category)}">🏷️ ${escapeHtml(todo.category)}</span>`,
    );
  }

  if (todo.priority === "high" && chips.length < 2) {
    chips.push(
      `<span class="todo-chip todo-chip--priority priority-badge high" title="High priority">HIGH</span>`,
    );
  }

  return chips.slice(0, 2).join("");
}

function resetOnCreateAssistState() {
  const dismissedTodoIds =
    state.onCreateAssistState?.dismissedTodoIds || new Set();
  state.onCreateAssistState = createInitialOnCreateAssistState();
  state.onCreateAssistState.dismissedTodoIds = dismissedTodoIds;
}

function loadOnCreateDismissedTodoIds() {
  try {
    const raw = window.localStorage.getItem(AI_ON_CREATE_DISMISSED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.map((value) => String(value || "").trim()).filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function persistOnCreateDismissedTodoIds() {
  try {
    const values = Array.from(
      state.onCreateAssistState.dismissedTodoIds || new Set(),
    );
    window.localStorage.setItem(
      AI_ON_CREATE_DISMISSED_STORAGE_KEY,
      JSON.stringify(values),
    );
  } catch {
    // Ignore storage failures.
  }
}

function markOnCreateDismissed(todoId) {
  if (!todoId) return;
  state.onCreateAssistState.dismissedTodoIds.add(String(todoId));
  persistOnCreateDismissedTodoIds();
}

function clearOnCreateDismissed(todoId) {
  if (!todoId) return;
  state.onCreateAssistState.dismissedTodoIds.delete(String(todoId));
  persistOnCreateDismissedTodoIds();
}

function isOnCreateDismissed(todoId) {
  if (!todoId) return false;
  return state.onCreateAssistState.dismissedTodoIds.has(String(todoId));
}

function getOnCreateImpactRank(type) {
  return impactRankForSurface(ON_CREATE_SURFACE, type);
}

function getOnCreateConfidenceBadge(confidence) {
  return confidenceLabel(confidence);
}

function clampOnCreateRationale(value) {
  return truncateRationale(value, 120);
}

function formatOnCreateSuggestionLabel(type) {
  return labelForType(type);
}

function formatOnCreateChoiceValue(choice) {
  if (typeof choice === "string") {
    return { value: choice, label: choice };
  }
  const value = String(
    choice?.value ||
      choice?.projectName ||
      choice?.category ||
      choice?.label ||
      "",
  ).trim();
  const label = String(choice?.label || value).trim();
  if (!value) return null;
  return {
    value,
    label,
    projectName: choice?.projectName,
    category: choice?.category,
  };
}

function normalizeOnCreateSuggestion(rawSuggestion) {
  if (!rawSuggestion || typeof rawSuggestion !== "object") return null;
  const type = String(rawSuggestion.type || "");
  if (!isKnownSuggestionType(type)) return null;
  if (!shouldRenderTypeForSurface(ON_CREATE_SURFACE, type)) return null;
  const suggestionId = String(rawSuggestion.suggestionId || "").trim();
  if (!suggestionId) return null;
  const payload =
    rawSuggestion.payload && typeof rawSuggestion.payload === "object"
      ? rawSuggestion.payload
      : {};
  const normalized = {
    type,
    suggestionId,
    confidence: Math.max(0, Math.min(1, Number(rawSuggestion.confidence) || 0)),
    rationale: clampOnCreateRationale(rawSuggestion.rationale),
    payload,
    requiresConfirmation: !!rawSuggestion.requiresConfirmation,
    dismissed: false,
    applied: false,
    confirmationOpen: false,
    undoSnapshot: null,
    clarificationExpanded: false,
    clarificationAnswered: false,
    clarificationAnswer: "",
    helperText: "",
  };
  if (type === "ask_clarification") {
    const choicesRaw = Array.isArray(payload.choices) ? payload.choices : [];
    normalized.payload = {
      ...payload,
      question: String(payload.question || "Pick one option").slice(0, 120),
      choices: choicesRaw
        .map((choice) => formatOnCreateChoiceValue(choice))
        .filter(Boolean)
        .slice(0, 4),
    };
  }
  return normalized;
}

function buildOnCreateSuggestion(
  type,
  suggestionId,
  confidence,
  rationale,
  payload,
  options = {},
) {
  return {
    type,
    suggestionId,
    confidence,
    rationale,
    payload,
    ...(options.requiresConfirmation ? { requiresConfirmation: true } : {}),
  };
}

function nextWeekdayAtNoonIso(day) {
  const target = new Date();
  const currentDay = target.getDay();
  let delta = (day - currentDay + 7) % 7;
  if (delta === 0) delta = 7;
  target.setDate(target.getDate() + delta);
  target.setHours(12, 0, 0, 0);
  return target.toISOString();
}

function yesterdayAtNoonIso() {
  const target = new Date();
  target.setDate(target.getDate() - 1);
  target.setHours(12, 0, 0, 0);
  return target.toISOString();
}

function buildMockOnCreateAssistEnvelope(rawTitle) {
  const title = String(rawTitle || "").trim();
  const titleLower = title.toLowerCase();
  const suggestions = [];

  if (titleLower.includes("tomorrow")) {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(12, 0, 0, 0);
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-tomorrow",
        0.88,
        "Detected a relative deadline in the title.",
        { dueDateISO: due.toISOString() },
      ),
    );
  } else if (titleLower.includes("by friday")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-friday",
        0.82,
        '"By Friday" implies a firm due date.',
        { dueDateISO: nextWeekdayAtNoonIso(5) },
      ),
    );
  }

  if (titleLower.includes("yesterday")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-past",
        0.51,
        "Parsed a past date mention. Confirm before applying.",
        { dueDateISO: yesterdayAtNoonIso() },
        { requiresConfirmation: true },
      ),
    );
  }

  if (/\burgent\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_priority",
        "oc-set-priority-urgent",
        0.9,
        "“Urgent” strongly signals high priority.",
        { priority: "high" },
      ),
    );
  } else if (/\basap\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_priority",
        "oc-set-priority-asap",
        0.67,
        "ASAP often maps to high priority. Confirm escalation.",
        { priority: "high" },
        { requiresConfirmation: true },
      ),
    );
  }

  const mentionsWebsite = titleLower.includes("website");
  const mentionsMarketing = titleLower.includes("marketing");
  if (mentionsWebsite && mentionsMarketing) {
    suggestions.push(
      buildOnCreateSuggestion(
        "ask_clarification",
        "oc-clarify-project",
        0.6,
        "Project target is ambiguous between website and marketing.",
        {
          questionId: "oc-project-choice",
          question: "Which project should this task belong to?",
          choices: [
            { value: "Website", label: "Website", projectName: "Website" },
            { value: "Marketing", label: "Marketing", category: "Marketing" },
          ],
        },
      ),
    );
  } else if (mentionsWebsite) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_project",
        "oc-set-project-website",
        0.84,
        "Detected a known project keyword.",
        { projectName: "Website", category: "Website" },
      ),
    );
  } else if (mentionsMarketing) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_category",
        "oc-set-category-marketing",
        0.8,
        "Detected a category keyword.",
        { category: "Marketing" },
      ),
    );
  }

  if (titleLower.includes("personal")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_category",
        "oc-set-category-personal",
        0.73,
        "“Personal” maps cleanly to a category.",
        { category: "Personal" },
      ),
    );
  }

  if (/\b(email|follow up|stuff)\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "rewrite_title",
        "oc-rewrite-vague",
        0.77,
        "Title is vague; propose a concrete next-action title.",
        { title: "Email stakeholder with specific next step and deadline" },
      ),
    );
  }

  if (titleLower.includes("unknown")) {
    suggestions.push({
      type: "not_supported",
      suggestionId: "oc-unknown-type",
      confidence: 0.5,
      rationale: "Should be ignored by UI.",
      payload: {},
    });
  }

  return {
    contractVersion: 1,
    generatedAt: new Date().toISOString(),
    surface: ON_CREATE_SURFACE,
    requestId: `on-create-${encodeURIComponent(titleLower.slice(0, 24) || "empty")}`,
    must_abstain: false,
    suggestions,
  };
}

function getOnCreateAssistElements() {
  const row = document.getElementById("aiOnCreateAssistRow");
  const titleInput = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  if (!(row instanceof HTMLElement)) return null;
  if (!(titleInput instanceof HTMLInputElement)) return null;
  return { row, titleInput, projectSelect, dueDateInput };
}

function ensureOnCreateProjectOption(projectName) {
  const refs = getOnCreateAssistElements();
  if (!refs || !(refs.projectSelect instanceof HTMLSelectElement)) return;
  const normalized = normalizeProjectPath(projectName);
  if (!normalized) return;
  const hasOption = Array.from(refs.projectSelect.options).some(
    (option) => normalizeProjectPath(option.value) === normalized,
  );
  if (hasOption) return;
  const option = document.createElement("option");
  option.value = normalized;
  option.textContent = normalized;
  refs.projectSelect.append(option);
}

function normalizeOnCreateAssistEnvelope(rawEnvelope) {
  const suggestionsRaw = Array.isArray(rawEnvelope?.suggestions)
    ? rawEnvelope.suggestions
    : [];
  const normalizedSuggestions = suggestionsRaw
    .map((suggestion) => normalizeOnCreateSuggestion(suggestion))
    .filter(Boolean)
    .map((suggestion) => ({
      ...suggestion,
      rationale: truncateRationale(suggestion.rationale, 120),
    }));
  const sortedSuggestions = sortSuggestions(
    ON_CREATE_SURFACE,
    normalizedSuggestions,
  );
  const cappedSuggestions = capSuggestions(sortedSuggestions, 6);

  let seenClarification = false;
  for (const suggestion of cappedSuggestions) {
    if (suggestion.type !== "ask_clarification") continue;
    if (!seenClarification) {
      seenClarification = true;
      continue;
    }
    suggestion.dismissed = true;
  }

  return {
    contractVersion: rawEnvelope?.contractVersion || 1,
    generatedAt: String(rawEnvelope?.generatedAt || new Date().toISOString()),
    requestId: String(rawEnvelope?.requestId || "on-create"),
    surface: ON_CREATE_SURFACE,
    must_abstain: !!rawEnvelope?.must_abstain,
    suggestions: cappedSuggestions,
  };
}

async function fetchOnCreateLatestSuggestion(todoId) {
  return apiCall(
    `${API_URL}/ai/suggestions/latest?todoId=${encodeURIComponent(todoId)}&surface=${ON_CREATE_SURFACE}`,
  );
}

async function generateOnCreateSuggestion(todo) {
  return apiCall(`${API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: ON_CREATE_SURFACE,
      todoId: todo.id,
      title: todo.title,
      description: todo.description || "",
      notes: todo.notes || "",
    }),
  });
}

async function loadOnCreateDecisionAssist(todo, allowGenerate = true) {
  if (!todo?.id) return;
  const todoId = String(todo.id);
  state.onCreateAssistState.loading = true;
  state.onCreateAssistState.error = "";
  state.onCreateAssistState.unavailable = false;
  state.onCreateAssistState.mode = "live";
  state.onCreateAssistState.liveTodoId = todoId;
  state.onCreateAssistState.aiSuggestionId = "";
  state.onCreateAssistState.envelope = null;
  state.onCreateAssistState.suggestions = [];
  state.onCreateAssistState.showAll = false;
  renderOnCreateAssistRow();

  try {
    let latestResponse = await fetchOnCreateLatestSuggestion(todoId);
    if (latestResponse.status === 403 || latestResponse.status === 404) {
      state.onCreateAssistState.loading = false;
      state.onCreateAssistState.unavailable = true;
      renderOnCreateAssistRow();
      return;
    }

    if (latestResponse.status === 204) {
      if (isOnCreateDismissed(todoId) || !allowGenerate) {
        state.onCreateAssistState.loading = false;
        state.onCreateAssistState.envelope = normalizeOnCreateAssistEnvelope({
          surface: ON_CREATE_SURFACE,
          must_abstain: true,
          suggestions: [],
        });
        state.onCreateAssistState.suggestions = [];
        renderOnCreateAssistRow();
        return;
      }

      const generated = await generateOnCreateSuggestion(todo);
      if (generated.status === 403 || generated.status === 404) {
        state.onCreateAssistState.loading = false;
        state.onCreateAssistState.unavailable = true;
        renderOnCreateAssistRow();
        return;
      }
      latestResponse = await fetchOnCreateLatestSuggestion(todoId);
    }

    if (latestResponse.status === 204) {
      state.onCreateAssistState.loading = false;
      state.onCreateAssistState.envelope = normalizeOnCreateAssistEnvelope({
        surface: ON_CREATE_SURFACE,
        must_abstain: true,
        suggestions: [],
      });
      state.onCreateAssistState.suggestions = [];
      renderOnCreateAssistRow();
      return;
    }

    if (!latestResponse.ok) {
      state.onCreateAssistState.loading = false;
      state.onCreateAssistState.error = "Could not load suggestions.";
      renderOnCreateAssistRow();
      return;
    }

    const payload = await latestResponse.json();
    const envelope = normalizeOnCreateAssistEnvelope(
      payload?.outputEnvelope || {},
    );
    state.onCreateAssistState.loading = false;
    state.onCreateAssistState.aiSuggestionId = String(
      payload?.aiSuggestionId || "",
    );
    state.onCreateAssistState.envelope = envelope;
    state.onCreateAssistState.suggestions = envelope.suggestions;
    state.onCreateAssistState.mode = "live";
    state.onCreateAssistState.liveTodoId = todoId;
    renderOnCreateAssistRow();
  } catch (error) {
    console.error("On-create AI load failed:", error);
    state.onCreateAssistState.loading = false;
    state.onCreateAssistState.error = "Could not load suggestions.";
    renderOnCreateAssistRow();
  }
}

function refreshOnCreateAssistFromTitle(force = false) {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  const title = refs.titleInput.value.trim();
  if (!title) {
    resetOnCreateAssistState();
    renderOnCreateAssistRow();
    return;
  }
  if (!force && state.onCreateAssistState.titleBasis === title) {
    renderOnCreateAssistRow();
    return;
  }
  const envelope = normalizeOnCreateAssistEnvelope(
    buildMockOnCreateAssistEnvelope(title),
  );
  state.onCreateAssistState = {
    ...createInitialOnCreateAssistState(),
    dismissedTodoIds: state.onCreateAssistState.dismissedTodoIds,
    titleBasis: title,
    envelope,
    suggestions: envelope.suggestions,
    mode: "mock",
    showAll: false,
  };
  renderOnCreateAssistRow();
}

function getOnCreateSuggestionById(suggestionId) {
  return state.onCreateAssistState.suggestions.find(
    (suggestion) => suggestion.suggestionId === suggestionId,
  );
}

function getActiveOnCreateSuggestions() {
  return state.onCreateAssistState.suggestions.filter(
    (suggestion) => !suggestion.dismissed,
  );
}

function formatOnCreateDueDateLabel(dueDateIso) {
  const date = new Date(dueDateIso);
  if (Number.isNaN(date.getTime())) return "Set due date";
  return `Due ${date.toLocaleDateString()}`;
}

function buildOnCreateChipSummary(suggestion) {
  if (suggestion.type === "set_due_date") {
    return formatOnCreateDueDateLabel(suggestion.payload.dueDateISO);
  }
  if (suggestion.type === "set_priority") {
    return `Priority ${String(suggestion.payload.priority || "").toUpperCase() || "MEDIUM"}`;
  }
  if (suggestion.type === "set_project") {
    return `Project ${String(suggestion.payload.projectName || suggestion.payload.category || "suggested")}`;
  }
  if (suggestion.type === "set_category") {
    return `Category ${String(suggestion.payload.category || "suggested")}`;
  }
  if (suggestion.type === "rewrite_title") {
    return "Refine title";
  }
  if (suggestion.type === "ask_clarification") {
    return "Need one choice";
  }
  return "Suggestion";
}

function renderOnCreateChipChoices(suggestion) {
  if (
    suggestion.type !== "ask_clarification" ||
    !suggestion.clarificationExpanded ||
    suggestion.clarificationAnswered
  ) {
    return "";
  }
  const choices = Array.isArray(suggestion.payload.choices)
    ? suggestion.payload.choices
    : [];
  if (choices.length === 0) return "";
  return `
    <div
      class="ai-create-chip__choices"
      role="radiogroup"
      aria-label="Clarification choices"
      aria-describedby="ai-create-rationale-${escapeHtml(suggestion.suggestionId)}"
    >
      ${choices
        .map(
          (choice) => `
            <button
              type="button"
              class="ai-create-chip__choice ai-action-btn"
              role="radio"
              aria-checked="false"
              data-ai-create-action="choose"
              data-ai-create-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
              data-ai-create-choice-value="${escapeHtml(String(choice.value || ""))}"
              aria-label="Choose ${escapeHtml(String(choice.label || choice.value || ""))}"
            >
              ${escapeHtml(String(choice.label || choice.value || ""))}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderOnCreateChipActions(suggestion) {
  const suggestionId = escapeHtml(suggestion.suggestionId);
  const label = escapeHtml(formatOnCreateSuggestionLabel(suggestion.type));
  const rationaleId = `ai-create-rationale-${suggestionId}`;
  if (suggestion.applied) {
    return `
      <span class="ai-create-chip__applied">Applied</span>
      <button
        type="button"
        class="ai-create-chip__undo ai-undo"
        data-testid="ai-chip-undo-${suggestionId}"
        aria-label="Undo ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="undo"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        Undo
      </button>
    `;
  }
  if (suggestion.requiresConfirmation && suggestion.confirmationOpen) {
    return `
      <div class="ai-confirm" role="group" aria-label="Confirm apply ${label}">
        <button
          type="button"
          class="ai-create-chip__confirm ai-action-btn"
          data-testid="ai-chip-confirm-${suggestionId}"
          aria-label="Confirm apply ${label}"
          aria-describedby="${rationaleId}"
          data-ai-create-action="confirm-apply"
          data-ai-create-suggestion-id="${suggestionId}"
        >
          Confirm
        </button>
        <button
          type="button"
          class="ai-create-chip__action ai-action-btn"
          aria-label="Cancel confirmation for ${label}"
          aria-describedby="${rationaleId}"
          data-ai-create-action="cancel-confirm"
          data-ai-create-suggestion-id="${suggestionId}"
        >
          Cancel
        </button>
      </div>
    `;
  }
  if (
    suggestion.type === "ask_clarification" &&
    !suggestion.clarificationAnswered
  ) {
    return `
      <button
        type="button"
        class="ai-create-chip__action ai-action-btn"
        data-testid="ai-chip-apply-${suggestionId}"
        aria-label="Open choices for ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="toggle-choices"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        Choose
      </button>
      <button
        type="button"
        class="ai-create-chip__dismiss ai-action-btn"
        data-testid="ai-chip-dismiss-${suggestionId}"
        aria-label="Dismiss ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="dismiss"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        ×
      </button>
    `;
  }
  return `
    <button
      type="button"
      class="ai-create-chip__action ai-action-btn"
      data-testid="ai-chip-apply-${suggestionId}"
      aria-label="Apply ${label}"
      aria-describedby="${rationaleId}"
      data-ai-create-action="apply"
      data-ai-create-suggestion-id="${suggestionId}"
    >
      Apply
    </button>
    <button
      type="button"
      class="ai-create-chip__dismiss ai-action-btn"
      data-testid="ai-chip-dismiss-${suggestionId}"
      aria-label="Dismiss ${label}"
      aria-describedby="${rationaleId}"
      data-ai-create-action="dismiss"
      data-ai-create-suggestion-id="${suggestionId}"
    >
      ×
    </button>
  `;
}

function renderOnCreateAssistRow() {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  const title = refs.titleInput.value.trim();
  const hasLiveContext = !!state.onCreateAssistState.liveTodoId;
  if (!title && !hasLiveContext && !state.onCreateAssistState.loading) {
    refs.row.hidden = true;
    refs.row.innerHTML = "";
    return;
  }

  // Lint-first gate: show one chip only; full panel revealed by Fix/Review.
  // In debug mode, always show the full panel so developers see all metadata.
  if (!state.onCreateAssistState.showFullAssist && !AI_DEBUG_ENABLED) {
    const issue = lintTodoFields({
      title,
      dueDate: refs.dueDateInput ? refs.dueDateInput.value : "",
      priority: state.currentPriority,
      allTodos: state.todos,
      surface: "on_create",
    });
    state.onCreateAssistState.lintIssue = issue;
    if (!issue) {
      refs.row.hidden = true;
      refs.row.innerHTML = "";
    } else {
      refs.row.hidden = false;
      refs.row.innerHTML = renderLintChip(issue);
    }
    return;
  }

  refs.row.hidden = false;
  if (state.onCreateAssistState.loading) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      <div class="ai-create-assist__empty ai-empty" role="status">Loading suggestions...</div>
    `;
    return;
  }
  if (state.onCreateAssistState.unavailable) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      <div class="ai-create-assist__empty ai-empty" role="status">AI Suggestions unavailable.</div>
    `;
    return;
  }
  if (state.onCreateAssistState.error) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      <div class="ai-create-assist__empty ai-empty" role="status">No suggestions right now.</div>
    `;
    return;
  }
  const activeSuggestions = getActiveOnCreateSuggestions();
  if (activeSuggestions.length === 0) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      ${renderAiDebugMeta(state.onCreateAssistState.envelope || {})}
      <div class="ai-create-assist__empty ai-empty" role="status">No suggestions right now.</div>
    `;
    return;
  }

  const defaultLimit = 4;
  const visibleLimit = state.onCreateAssistState.showAll ? 6 : defaultLimit;
  const visibleSuggestions = activeSuggestions.slice(0, visibleLimit);
  const hiddenCount = Math.max(
    0,
    activeSuggestions.length - visibleSuggestions.length,
  );

  refs.row.innerHTML = `
    <div class="ai-create-assist__header">
      <span class="ai-create-assist__title">AI Assist</span>
      ${
        hiddenCount > 0
          ? `
          <button
            type="button"
            class="ai-create-assist__expand"
            data-testid="ai-chip-expand-more"
            data-ai-create-action="toggle-more"
            aria-label="${state.onCreateAssistState.showAll ? "Show fewer suggestions" : `Show ${hiddenCount} more suggestions`}"
          >
            ${state.onCreateAssistState.showAll ? "Show less" : `+${hiddenCount} more`}
          </button>
        `
          : ""
      }
    </div>
    ${renderAiDebugMeta(state.onCreateAssistState.envelope || {})}
    <div class="ai-create-assist__chips">
      ${visibleSuggestions
        .map((suggestion) => {
          const confidenceLabel = getOnCreateConfidenceBadge(
            suggestion.confidence,
          );
          return `
            <div
              class="ai-create-chip ai-card ${suggestion.applied ? "ai-create-chip--applied" : ""}"
              data-testid="ai-chip-${escapeHtml(suggestion.suggestionId)}"
            >
              <div class="ai-create-chip__top">
                <span class="ai-create-chip__label">${escapeHtml(formatOnCreateSuggestionLabel(suggestion.type))}</span>
                <span
                  class="ai-create-chip__confidence ai-badge ai-badge--${escapeHtml(confidenceBand(suggestion.confidence))}"
                  aria-label="Confidence ${escapeHtml(confidenceLabel)}"
                >
                  ${escapeHtml(confidenceLabel)}
                </span>
              </div>
              <div
                class="ai-create-chip__summary"
                id="ai-create-rationale-${escapeHtml(suggestion.suggestionId)}"
                title="${escapeHtml(suggestion.rationale || buildOnCreateChipSummary(suggestion))}"
              >
                ${escapeHtml(buildOnCreateChipSummary(suggestion))}
              </div>
              <div class="ai-create-chip__rationale ai-tooltip">${escapeHtml(suggestion.rationale || buildOnCreateChipSummary(suggestion))}</div>
              ${renderAiDebugSuggestionId(suggestion.suggestionId)}
              ${
                suggestion.clarificationAnswered
                  ? `<div class="ai-create-chip__helper">Answer: ${escapeHtml(suggestion.clarificationAnswer)}</div>`
                  : ""
              }
              ${suggestion.helperText ? `<div class="ai-create-chip__helper">${escapeHtml(suggestion.helperText)}</div>` : ""}
              ${renderOnCreateChipChoices(suggestion)}
              <div class="ai-create-chip__actions ai-actions">
                ${renderOnCreateChipActions(suggestion)}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  const confirmationSuggestion = visibleSuggestions.find(
    (suggestion) =>
      needsConfirmation(suggestion) && suggestion.confirmationOpen,
  );
  if (confirmationSuggestion) {
    window.requestAnimationFrame(() => {
      const confirmButton = refs.row.querySelector(
        `[data-testid="ai-chip-confirm-${escapeSelectorValue(confirmationSuggestion.suggestionId)}"]`,
      );
      if (confirmButton instanceof HTMLElement) {
        confirmButton.focus({ preventScroll: true });
      }
    });
  }
}

function snapshotOnCreateDraftState() {
  const refs = getOnCreateAssistElements();
  if (!refs) return null;
  return {
    title: refs.titleInput.value,
    dueDate:
      refs.dueDateInput instanceof HTMLInputElement
        ? refs.dueDateInput.value
        : "",
    project:
      refs.projectSelect instanceof HTMLSelectElement
        ? refs.projectSelect.value
        : "",
    priority: state.currentPriority,
  };
}

function restoreOnCreateDraftState(snapshot) {
  if (!snapshot) return;
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  state.suppressOnCreateAssistInput = true;
  refs.titleInput.value = snapshot.title || "";
  if (refs.dueDateInput instanceof HTMLInputElement) {
    refs.dueDateInput.value = snapshot.dueDate || "";
  }
  if (refs.projectSelect instanceof HTMLSelectElement) {
    if (snapshot.project) {
      ensureOnCreateProjectOption(snapshot.project);
    }
    refs.projectSelect.value = snapshot.project || "";
  }
  if (
    snapshot.priority === "low" ||
    snapshot.priority === "medium" ||
    snapshot.priority === "high"
  ) {
    setPriority(snapshot.priority);
  }
  state.suppressOnCreateAssistInput = false;
}

function applyOnCreateSuggestion(suggestion, clarificationChoice = "") {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  suggestion.undoSnapshot = snapshotOnCreateDraftState();
  suggestion.applied = true;
  suggestion.confirmationOpen = false;
  suggestion.helperText = "";

  if (suggestion.type === "rewrite_title") {
    const nextTitle = String(suggestion.payload.title || "").trim();
    if (nextTitle) {
      state.suppressOnCreateAssistInput = true;
      refs.titleInput.value = nextTitle;
      state.suppressOnCreateAssistInput = false;
    }
  } else if (suggestion.type === "set_due_date") {
    const dueDateIso = String(suggestion.payload.dueDateISO || "");
    if (refs.dueDateInput instanceof HTMLInputElement) {
      refs.dueDateInput.value = toDateTimeLocalValue(dueDateIso);
    }
  } else if (suggestion.type === "set_priority") {
    const nextPriority = String(
      suggestion.payload.priority || "",
    ).toLowerCase();
    if (
      nextPriority === "low" ||
      nextPriority === "medium" ||
      nextPriority === "high"
    ) {
      setPriority(nextPriority);
    }
  } else if (suggestion.type === "set_project") {
    const rawProject = String(
      suggestion.payload.projectName || suggestion.payload.category || "",
    );
    const normalized = normalizeProjectPath(rawProject);
    if (normalized && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(normalized);
      refs.projectSelect.value = normalized;
    }
  } else if (suggestion.type === "set_category") {
    const rawCategory = String(suggestion.payload.category || "");
    const normalized = normalizeProjectPath(rawCategory);
    if (normalized && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(normalized);
      refs.projectSelect.value = normalized;
    }
  } else if (suggestion.type === "ask_clarification") {
    suggestion.clarificationAnswered = true;
    suggestion.clarificationExpanded = false;
    suggestion.clarificationAnswer = clarificationChoice || "Selected";
    const selectedChoice =
      (Array.isArray(suggestion.payload.choices)
        ? suggestion.payload.choices.find(
            (choice) => String(choice.value || "") === clarificationChoice,
          )
        : null) || null;
    const projectValue = normalizeProjectPath(
      String(
        selectedChoice?.projectName ||
          selectedChoice?.category ||
          selectedChoice?.value ||
          "",
      ),
    );
    if (projectValue && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(projectValue);
      refs.projectSelect.value = projectValue;
    }
    suggestion.helperText = "Thanks — will refine next time.";
  }
}

async function applyLiveOnCreateSuggestion(suggestion, confirmed = false) {
  if (!state.onCreateAssistState.aiSuggestionId) return;
  const response = await apiCall(
    `${API_URL}/ai/suggestions/${encodeURIComponent(state.onCreateAssistState.aiSuggestionId)}/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionId: suggestion.suggestionId,
        confirmed: confirmed === true,
      }),
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    state.onCreateAssistState.error =
      typeof data?.error === "string"
        ? data.error
        : "Could not apply suggestion.";
    renderOnCreateAssistRow();
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (data?.todo?.id) {
    const index = state.todos.findIndex((item) => item.id === data.todo.id);
    if (index >= 0) {
      state.todos[index] = data.todo;
    }
    renderTodos();
  }
  clearOnCreateDismissed(state.onCreateAssistState.liveTodoId);
  const refreshedTodo =
    (state.onCreateAssistState.liveTodoId &&
      state.todos.find(
        (item) => item.id === state.onCreateAssistState.liveTodoId,
      )) ||
    null;
  if (refreshedTodo) {
    await loadOnCreateDecisionAssist(refreshedTodo, false);
  } else {
    resetOnCreateAssistState();
    renderOnCreateAssistRow();
  }
}

async function onCreateAssistApplySuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || suggestion.dismissed || suggestion.applied) return;
  if (suggestion.type === "ask_clarification") {
    suggestion.clarificationExpanded = !suggestion.clarificationExpanded;
    renderOnCreateAssistRow();
    return;
  }
  if (suggestion.requiresConfirmation) {
    suggestion.confirmationOpen = true;
    renderOnCreateAssistRow();
    return;
  }
  if (state.onCreateAssistState.mode === "live") {
    await applyLiveOnCreateSuggestion(suggestion, false);
    return;
  }
  applyOnCreateSuggestion(suggestion);
  renderOnCreateAssistRow();
}

async function onCreateAssistConfirmApplySuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || suggestion.dismissed || suggestion.applied) return;
  if (state.onCreateAssistState.mode === "live") {
    await applyLiveOnCreateSuggestion(suggestion, true);
    return;
  }
  applyOnCreateSuggestion(suggestion);
  renderOnCreateAssistRow();
}

async function onCreateAssistDismissSuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion) return;
  if (
    state.onCreateAssistState.mode === "live" &&
    state.onCreateAssistState.aiSuggestionId
  ) {
    try {
      await apiCall(
        `${API_URL}/ai/suggestions/${encodeURIComponent(state.onCreateAssistState.aiSuggestionId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, dismissAll: true }),
        },
      );
    } catch (error) {
      console.error("On-create AI dismiss failed:", error);
    }
    markOnCreateDismissed(state.onCreateAssistState.liveTodoId);
    state.onCreateAssistState.suggestions = [];
    state.onCreateAssistState.envelope = normalizeOnCreateAssistEnvelope({
      surface: ON_CREATE_SURFACE,
      must_abstain: true,
      suggestions: [],
    });
    state.onCreateAssistState.aiSuggestionId = "";
    state.onCreateAssistState.error = "";
    renderOnCreateAssistRow();
    return;
  }
  suggestion.dismissed = true;
  renderOnCreateAssistRow();
}

function onCreateAssistUndoSuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || !suggestion.applied) return;
  restoreOnCreateDraftState(suggestion.undoSnapshot);
  suggestion.applied = false;
  suggestion.confirmationOpen = false;
  suggestion.clarificationAnswered = false;
  suggestion.clarificationAnswer = "";
  suggestion.helperText = "";
  suggestion.clarificationExpanded = false;
  suggestion.undoSnapshot = null;
  emitAiSuggestionUndoTelemetry({
    surface: ON_CREATE_SURFACE,
    aiSuggestionDbId: state.onCreateAssistState.aiSuggestionId,
    suggestionId,
    todoId: state.onCreateAssistState.liveTodoId || "",
    selectedTodoIdsCount: 1,
  });
  renderOnCreateAssistRow();
}

function onCreateAssistChooseClarification(suggestionId, choiceValue) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (
    !suggestion ||
    suggestion.type !== "ask_clarification" ||
    suggestion.applied
  ) {
    return;
  }
  applyOnCreateSuggestion(suggestion, String(choiceValue || "").trim());
  renderOnCreateAssistRow();
}

function bindOnCreateAssistHandlers() {
  if (window.__onCreateAssistHandlersBound) {
    return;
  }
  window.__onCreateAssistHandlersBound = true;

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "todoInput") return;
    if (state.suppressOnCreateAssistInput) {
      renderOnCreateAssistRow();
      return;
    }
    refreshOnCreateAssistFromTitle();
  });

  // Lint chip Fix/Review delegation (on-create surface only).
  // Excludes clicks inside #todoDetailsDrawer which has its own handler.
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("#todoDetailsDrawer")) return;
    const lintEl = target.closest("[data-ai-lint-action]");
    if (!(lintEl instanceof HTMLElement)) return;
    const lintAction = lintEl.getAttribute("data-ai-lint-action");
    state.onCreateAssistState.showFullAssist = true;
    if (state.onCreateAssistState.liveTodoId) {
      // Post-create mode: load server-backed suggestions for the saved todo.
      const todo = getTodoById(state.onCreateAssistState.liveTodoId);
      await loadOnCreateDecisionAssist(todo, lintAction === "fix");
    } else {
      // Pre-create mode: regenerate client-side mock suggestions and reveal them.
      // refreshOnCreateAssistFromTitle resets state; set showFullAssist after.
      refreshOnCreateAssistFromTitle(true);
      state.onCreateAssistState.showFullAssist = true;
      renderOnCreateAssistRow();
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest("[data-ai-create-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-ai-create-action");
    const suggestionId =
      actionEl.getAttribute("data-ai-create-suggestion-id") || "";
    if (action === "toggle-more") {
      state.onCreateAssistState.showAll = !state.onCreateAssistState.showAll;
      renderOnCreateAssistRow();
      return;
    }
    if (action === "apply" || action === "toggle-choices") {
      await onCreateAssistApplySuggestion(suggestionId);
      return;
    }
    if (action === "confirm-apply") {
      await onCreateAssistConfirmApplySuggestion(suggestionId);
      return;
    }
    if (action === "cancel-confirm") {
      const suggestion = getOnCreateSuggestionById(suggestionId);
      if (!suggestion) return;
      suggestion.confirmationOpen = false;
      renderOnCreateAssistRow();
      return;
    }
    if (action === "dismiss") {
      await onCreateAssistDismissSuggestion(suggestionId);
      return;
    }
    if (action === "undo") {
      onCreateAssistUndoSuggestion(suggestionId);
      return;
    }
    if (action === "choose") {
      const choiceValue =
        actionEl.getAttribute("data-ai-create-choice-value") || "";
      onCreateAssistChooseClarification(suggestionId, choiceValue);
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (
      !state.onCreateAssistState.suggestions.some(
        (item) => item.confirmationOpen,
      )
    ) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && !target.closest("#aiOnCreateAssistRow")) {
      return;
    }
    state.onCreateAssistState.suggestions.forEach((item) => {
      item.confirmationOpen = false;
    });
    renderOnCreateAssistRow();
  });
}

function resetTodayPlanState() {
  state.todayPlanState = createInitialTodayPlanState();
}

function getTodayPlanPanelElement() {
  const panel = document.getElementById("todayPlanPanel");
  if (!(panel instanceof HTMLElement)) return null;
  return panel;
}

function getTodayPlanImpactRank(type) {
  return impactRankForSurface(TODAY_PLAN_SURFACE, type);
}

function getTodayPlanConfidenceBadge(confidence) {
  return confidenceLabel(confidence);
}

function isTodayPlanViewActive() {
  return state.currentDateView === "today";
}

function toEpoch(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return Infinity;
  return date.getTime();
}

function normalizePriorityValue(priority) {
  const value = String(priority || "").toLowerCase();
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium";
}

function priorityWeight(priority) {
  const value = normalizePriorityValue(priority);
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function estimateTodoMinutes(todo, mode = "balanced") {
  const title = String(todo?.title || "").trim();
  const words = title ? title.split(/\s+/).length : 1;
  const base = Math.max(15, Math.min(120, words * 9));
  if (mode === "quick") {
    return Math.max(10, Math.min(30, Math.round(base * 0.6)));
  }
  if (mode === "deep") {
    return Math.max(45, Math.min(150, Math.round(base * 1.35)));
  }
  return base;
}

function rankTodayTodos(goalLower, todayTodos) {
  const mode = goalLower.includes("quick")
    ? "quick"
    : goalLower.includes("deep") || goalLower.includes("focus")
      ? "deep"
      : "balanced";
  const now = Date.now();
  const ranked = [...todayTodos].sort((a, b) => {
    const dueA = toEpoch(a.dueDate);
    const dueB = toEpoch(b.dueDate);
    const dueScoreA = dueA === Infinity ? Infinity : Math.max(0, dueA - now);
    const dueScoreB = dueB === Infinity ? Infinity : Math.max(0, dueB - now);
    const recencyA = toEpoch(a.updatedAt || a.createdAt);
    const recencyB = toEpoch(b.updatedAt || b.createdAt);
    const prioA = priorityWeight(a.priority);
    const prioB = priorityWeight(b.priority);
    if (mode === "quick") {
      const quickA = estimateTodoMinutes(a, "quick");
      const quickB = estimateTodoMinutes(b, "quick");
      if (quickA !== quickB) return quickA - quickB;
      if (dueScoreA !== dueScoreB) return dueScoreA - dueScoreB;
      if (prioA !== prioB) return prioB - prioA;
      return recencyB - recencyA;
    }
    if (mode === "deep") {
      const deepA = estimateTodoMinutes(a, "deep");
      const deepB = estimateTodoMinutes(b, "deep");
      if (deepA !== deepB) return deepB - deepA;
      if (prioA !== prioB) return prioB - prioA;
      if (dueScoreA !== dueScoreB) return dueScoreA - dueScoreB;
      return recencyB - recencyA;
    }
    if (dueScoreA !== dueScoreB) return dueScoreA - dueScoreB;
    if (prioA !== prioB) return prioB - prioA;
    return recencyB - recencyA;
  });
  return { mode, ranked };
}

function buildTodayPlanSuggestion(
  type,
  suggestionId,
  confidence,
  rationale,
  payload,
) {
  return {
    type,
    suggestionId,
    confidence,
    rationale: truncateRationale(rationale, 120),
    payload,
  };
}

function mockPlanFromGoal(goalText, todayTodos) {
  const goal = String(goalText || "").trim();
  const goalLower = goal.toLowerCase();
  const generatedAt = new Date().toISOString();

  if (
    goalLower.includes("abstain") ||
    !Array.isArray(todayTodos) ||
    !todayTodos.length
  ) {
    return {
      contractVersion: 1,
      generatedAt,
      requestId: `today-plan-${encodeURIComponent(goalLower || "empty")}`,
      surface: TODAY_PLAN_SURFACE,
      must_abstain: true,
      planPreview: { topN: 0, items: [] },
      suggestions: [],
    };
  }

  const { mode, ranked } = rankTodayTodos(goalLower, todayTodos);
  const topN =
    ranked.length >= 5 && (mode === "quick" || mode === "deep") ? 5 : 3;
  const selected = ranked.slice(0, Math.min(topN, ranked.length));
  const previewItems = selected.map((todo, index) => {
    const estimateMode =
      mode === "quick"
        ? "quick"
        : mode === "deep" && index === 0
          ? "deep"
          : "balanced";
    const minutes = estimateTodoMinutes(todo, estimateMode);
    const rationale =
      mode === "quick"
        ? "Quick-win candidate with low setup cost."
        : mode === "deep" && index === 0
          ? "Primary focus block for deep work."
          : "Urgency and priority alignment for today.";
    return {
      todoId: String(todo.id),
      rank: index + 1,
      timeEstimateMin: minutes,
      rationale,
    };
  });

  const suggestions = [];
  for (const item of previewItems) {
    const todo = selected.find((entry) => String(entry.id) === item.todoId);
    if (!todo) continue;
    if (item.rank <= 2) {
      const due = new Date();
      due.setDate(due.getDate() + item.rank);
      due.setHours(9 + item.rank, 0, 0, 0);
      suggestions.push(
        buildTodayPlanSuggestion(
          "set_due_date",
          `today-set-due-${item.todoId}`,
          0.8 - item.rank * 0.04,
          "Assign a concrete deadline for today's execution.",
          { todoId: item.todoId, dueDateISO: due.toISOString() },
        ),
      );
    }
    if (normalizePriorityValue(todo.priority) !== "high" && item.rank === 1) {
      suggestions.push(
        buildTodayPlanSuggestion(
          "set_priority",
          `today-set-priority-${item.todoId}`,
          0.77,
          "Top ranked item should be elevated for focus.",
          { todoId: item.todoId, priority: "high" },
        ),
      );
    }
    if (item.rank <= 2) {
      suggestions.push(
        buildTodayPlanSuggestion(
          "propose_next_action",
          `today-next-action-${item.todoId}`,
          0.7,
          "Define the first concrete step before context switching.",
          {
            todoId: item.todoId,
            text: `Start: ${String(todo.title || "").slice(0, 80)} and draft first deliverable.`,
          },
        ),
      );
    }
  }

  if (previewItems[0]) {
    const todoId = previewItems[0].todoId;
    suggestions.push(
      buildTodayPlanSuggestion(
        "split_subtasks",
        `today-split-${todoId}`,
        0.68,
        "Split one larger item into scoped execution steps.",
        {
          todoId,
          subtasks: [
            { title: "Outline deliverable", order: 1 },
            { title: "Execute focused work block", order: 2 },
            { title: "Review and close loop", order: 3 },
          ],
        },
      ),
    );
  }

  suggestions.push({
    type: "unknown_type",
    suggestionId: "today-unknown",
    confidence: 0.5,
    rationale: "Should be ignored",
    payload: { todoId: previewItems[0]?.todoId || "" },
  });

  return {
    contractVersion: 1,
    generatedAt,
    requestId: `today-plan-${encodeURIComponent(goalLower || "none")}-${todayTodos.length}`,
    surface: TODAY_PLAN_SURFACE,
    must_abstain: false,
    planPreview: {
      topN: previewItems.length,
      items: previewItems,
    },
    suggestions,
  };
}

function normalizeTodayPlanEnvelope(rawEnvelope) {
  const suggestionsRaw = Array.isArray(rawEnvelope?.suggestions)
    ? rawEnvelope.suggestions
    : [];
  const normalizedSuggestions = suggestionsRaw
    .filter((suggestion) =>
      shouldRenderTypeForSurface(TODAY_PLAN_SURFACE, suggestion?.type),
    )
    .map((suggestion) => ({
      type: String(suggestion.type),
      suggestionId: String(suggestion.suggestionId || ""),
      confidence: Math.max(0, Math.min(1, Number(suggestion.confidence) || 0)),
      rationale: truncateRationale(suggestion.rationale, 120),
      payload:
        suggestion.payload && typeof suggestion.payload === "object"
          ? suggestion.payload
          : {},
    }))
    .filter((suggestion) => suggestion.suggestionId);

  const previewItemsRaw = Array.isArray(rawEnvelope?.planPreview?.items)
    ? rawEnvelope.planPreview.items
    : [];
  const previewItems = previewItemsRaw
    .map((item) => ({
      todoId: String(item?.todoId || ""),
      rank: Number(item?.rank) || 0,
      timeEstimateMin: Number(item?.timeEstimateMin) || 0,
      rationale: truncateRationale(item?.rationale, 120),
    }))
    .filter((item) => item.todoId && item.rank > 0);

  return {
    contractVersion: Number(rawEnvelope?.contractVersion) || 1,
    generatedAt: String(rawEnvelope?.generatedAt || new Date().toISOString()),
    requestId: String(rawEnvelope?.requestId || "today-plan"),
    surface: TODAY_PLAN_SURFACE,
    must_abstain: !!rawEnvelope?.must_abstain,
    planPreview: {
      topN: Number(rawEnvelope?.planPreview?.topN) || previewItems.length,
      items: previewItems,
    },
    suggestions: normalizedSuggestions,
  };
}

async function fetchTodayPlanLatestSuggestion() {
  return apiCall(
    `${API_URL}/ai/suggestions/latest?surface=${TODAY_PLAN_SURFACE}`,
  );
}

function buildTodayPlanCandidates() {
  return getVisibleTodos().map((todo) => ({
    id: String(todo.id),
    title: String(todo.title || ""),
    dueDate: todo.dueDate || undefined,
    priority: todo.priority || undefined,
    createdAt: todo.createdAt || undefined,
    updatedAt: todo.updatedAt || undefined,
  }));
}

async function generateTodayPlanSuggestion(goalText) {
  const candidates = buildTodayPlanCandidates();
  const preferredTopN = candidates.length >= 5 ? 5 : 3;
  return apiCall(`${API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ai-explicit-request": "1",
    },
    body: JSON.stringify({
      surface: TODAY_PLAN_SURFACE,
      goal: goalText || undefined,
      topN: preferredTopN,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      anchorDateISO: new Date().toISOString(),
      todoCandidates: candidates,
    }),
  });
}

async function loadTodayPlanDecisionAssist(allowGenerate = false) {
  if (!isTodayPlanViewActive()) return;
  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    state.todayPlanState.loading = false;
    state.todayPlanState.generating = false;
    state.todayPlanState.unavailable = true;
    state.todayPlanState.hasLoaded = true;
    renderTodayPlanPanel();
    return;
  }

  state.todayPlanState.loading = true;
  state.todayPlanState.error = "";
  state.todayPlanState.unavailable = false;
  renderTodayPlanPanel();

  try {
    let latestResponse = await fetchTodayPlanLatestSuggestion();
    if (latestResponse.status === 403 || latestResponse.status === 404) {
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.unavailable = true;
      state.todayPlanState.hasLoaded = true;
      renderTodayPlanPanel();
      return;
    }

    if (latestResponse.status === 204 && allowGenerate) {
      const generated = await generateTodayPlanSuggestion(
        state.todayPlanState.goalText,
      );
      if (generated.status === 403 || generated.status === 404) {
        state.todayPlanState.loading = false;
        state.todayPlanState.generating = false;
        state.todayPlanState.unavailable = true;
        state.todayPlanState.hasLoaded = true;
        renderTodayPlanPanel();
        return;
      }
      latestResponse = await fetchTodayPlanLatestSuggestion();
    }

    if (latestResponse.status === 204) {
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.hasLoaded = true;
      state.todayPlanState.aiSuggestionId = "";
      state.todayPlanState.envelope = normalizeTodayPlanEnvelope({
        surface: TODAY_PLAN_SURFACE,
        must_abstain: false,
        planPreview: { topN: 3, items: [] },
        suggestions: [],
      });
      state.todayPlanState.selectedTodoIds = new Set();
      state.todayPlanState.dismissedSuggestionIds = new Set();
      renderTodayPlanPanel();
      return;
    }

    if (!latestResponse.ok) {
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.error = "Could not load suggestions.";
      state.todayPlanState.hasLoaded = true;
      renderTodayPlanPanel();
      return;
    }

    const payload = await latestResponse.json();
    const envelope = normalizeTodayPlanEnvelope(payload?.outputEnvelope || {});
    state.todayPlanState.loading = false;
    state.todayPlanState.generating = false;
    state.todayPlanState.hasLoaded = true;
    state.todayPlanState.aiSuggestionId = String(payload?.aiSuggestionId || "");
    state.todayPlanState.envelope = envelope;
    state.todayPlanState.dismissedSuggestionIds = new Set();
    state.todayPlanState.selectedTodoIds = new Set(
      envelope.planPreview.items
        .map((item) => String(item.todoId))
        .filter(Boolean),
    );
    renderTodayPlanPanel();
  } catch (error) {
    console.error("Today plan AI load failed:", error);
    state.todayPlanState.loading = false;
    state.todayPlanState.generating = false;
    state.todayPlanState.error = "Could not load suggestions.";
    state.todayPlanState.hasLoaded = true;
    renderTodayPlanPanel();
  }
}

function getTodayPlanSelectedSuggestionCards() {
  if (!state.todayPlanState.envelope) return [];
  const selectedIds = state.todayPlanState.selectedTodoIds;
  const filtered = state.todayPlanState.envelope.suggestions
    .filter((suggestion) => {
      const todoId = String(suggestion.payload?.todoId || "");
      return todoId && selectedIds.has(todoId);
    })
    .filter(
      (suggestion) =>
        !state.todayPlanState.dismissedSuggestionIds.has(
          suggestion.suggestionId,
        ),
    )
    .filter((suggestion) =>
      shouldRenderTypeForSurface(TODAY_PLAN_SURFACE, suggestion.type),
    );
  return capSuggestions(sortSuggestions(TODAY_PLAN_SURFACE, filtered), 6);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function renderTodayPlanPanel() {
  const panel = getTodayPlanPanelElement();
  if (!panel) return;
  if (!isTodayPlanViewActive()) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  panel.hidden = false;
  const goalText = state.todayPlanState.goalText || "";
  const envelope = state.todayPlanState.envelope;
  const previewItems = Array.isArray(envelope?.planPreview?.items)
    ? envelope.planPreview.items
    : [];
  const suggestionCards = getTodayPlanSelectedSuggestionCards();
  const emptyMessage = envelope?.must_abstain
    ? "No safe plan right now."
    : envelope &&
        !state.todayPlanState.generating &&
        suggestionCards.length === 0
      ? "No suggestions right now."
      : "";

  panel.setAttribute("data-testid", "today-plan-panel");
  panel.innerHTML = `
    <div class="today-plan-panel__header">
      <div class="today-plan-panel__title">Plan my day</div>
      ${
        state.todayPlanState.lastApplyBatch
          ? `
          <button
            type="button"
            class="today-plan-panel__undo ai-undo"
            data-testid="today-plan-undo"
            aria-label="Undo last plan apply"
            data-today-plan-action="undo"
          >
            Undo
          </button>
        `
          : ""
      }
    </div>
    <div class="today-plan-panel__controls">
      <label class="sr-only" for="todayPlanGoalInput">Goal (optional)</label>
      <input
        id="todayPlanGoalInput"
        data-testid="today-plan-goal-input"
        type="text"
        placeholder="Goal (optional)"
        value="${escapeHtml(goalText)}"
        aria-label="Goal (optional)"
      />
      <button
        id="todayPlanGenerateButton"
        data-testid="today-plan-generate"
        type="button"
        class="mini-btn"
        aria-label="Generate plan"
        data-today-plan-action="generate"
        ${state.todayPlanState.loading || state.todayPlanState.generating ? "disabled" : ""}
      >
        ${state.todayPlanState.loading || state.todayPlanState.generating ? "Generating..." : "Generate plan"}
      </button>
    </div>
    ${renderAiDebugMeta(envelope || {})}
    ${
      state.todayPlanState.loading || state.todayPlanState.generating
        ? '<div class="today-plan-panel__loading ai-empty" role="status">Generating plan preview...</div>'
        : ""
    }
    ${
      state.todayPlanState.unavailable
        ? '<div class="today-plan-panel__empty ai-empty" role="status">AI Suggestions unavailable.</div>'
        : ""
    }
    ${
      state.todayPlanState.error
        ? `<div class="today-plan-panel__empty ai-empty" role="status">${escapeHtml(state.todayPlanState.error)}</div>`
        : ""
    }
    ${
      previewItems.length > 0
        ? `
        <div class="today-plan-preview" data-testid="today-plan-preview">
          ${previewItems
            .map((item) => {
              const todo = state.todos.find(
                (entry) => String(entry.id) === String(item.todoId),
              );
              const checked = state.todayPlanState.selectedTodoIds.has(
                item.todoId,
              );
              return `
                <div class="today-plan-preview__item" data-testid="today-plan-item-${escapeHtml(item.todoId)}">
                  <input
                    type="checkbox"
                    data-testid="today-plan-item-checkbox-${escapeHtml(item.todoId)}"
                    data-today-plan-action="toggle-item"
                    data-today-plan-todo-id="${escapeHtml(item.todoId)}"
                    aria-label="Select plan item ${escapeHtml(String(todo?.title || item.todoId))}"
                    ${checked ? "checked" : ""}
                  />
                  <div class="today-plan-preview__rank">${item.rank}</div>
                  <div class="today-plan-preview__body">
                    <div class="today-plan-preview__title">${escapeHtml(String(todo?.title || "Task"))}</div>
                    <div class="today-plan-preview__meta">${item.timeEstimateMin} min • ${escapeHtml(item.rationale)}</div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `
        : ""
    }
    ${emptyMessage ? `<div class="today-plan-panel__empty ai-empty" role="status">${escapeHtml(emptyMessage)}</div>` : ""}
    ${
      suggestionCards.length > 0
        ? `
        <div class="today-plan-suggestions">
          ${suggestionCards
            .map((suggestion) => {
              const todoId = String(suggestion.payload?.todoId || "");
              const todo = state.todos.find(
                (entry) => String(entry.id) === todoId,
              );
              const summary =
                suggestion.type === "set_due_date"
                  ? `Set due ${new Date(String(suggestion.payload?.dueDateISO || "")).toLocaleDateString()}`
                  : suggestion.type === "set_priority"
                    ? `Set priority ${String(suggestion.payload?.priority || "").toUpperCase()}`
                    : suggestion.type === "split_subtasks"
                      ? `Split into ${Array.isArray(suggestion.payload?.subtasks) ? suggestion.payload.subtasks.length : 0} subtasks`
                      : `Next action: ${String(suggestion.payload?.text || "").slice(0, 60)}`;
              return `
                <div
                  class="today-plan-suggestion ai-card"
                  data-testid="today-plan-suggestion-${escapeHtml(suggestion.suggestionId)}"
                  data-today-plan-todo-id="${escapeHtml(todoId)}"
                >
                  <div class="today-plan-suggestion__title">${escapeHtml(labelForType(suggestion.type))}</div>
                  <div class="today-plan-suggestion__summary">${escapeHtml(summary)}</div>
                  <div
                    class="today-plan-suggestion__rationale ai-tooltip"
                    id="today-plan-rationale-${escapeHtml(suggestion.suggestionId)}"
                  >
                    ${escapeHtml(suggestion.rationale)}
                  </div>
                  ${renderAiDebugSuggestionId(suggestion.suggestionId)}
                  <div class="today-plan-suggestion__footer ai-actions">
                    <span class="today-plan-suggestion__confidence ai-badge ai-badge--${escapeHtml(confidenceBand(suggestion.confidence))}" aria-label="Confidence ${escapeHtml(getTodayPlanConfidenceBadge(suggestion.confidence))}">
                      ${escapeHtml(getTodayPlanConfidenceBadge(suggestion.confidence))}
                    </span>
                    <button
                      type="button"
                      class="today-plan-suggestion__dismiss ai-action-btn"
                      data-testid="today-plan-suggestion-dismiss-${escapeHtml(suggestion.suggestionId)}"
                      aria-label="Dismiss suggestion ${escapeHtml(suggestion.suggestionId)}"
                      aria-describedby="today-plan-rationale-${escapeHtml(suggestion.suggestionId)}"
                      data-today-plan-action="dismiss-suggestion"
                      data-today-plan-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="today-plan-panel__actions">
          <button
            type="button"
            class="add-btn"
            data-testid="today-plan-apply-selected"
            aria-label="Apply selected plan suggestions"
            data-today-plan-action="apply-selected"
          >
            Apply selected
          </button>
        </div>
      `
        : ""
    }
  `;
}

async function handleTodayPlanGenerate() {
  const goalInput = document.getElementById("todayPlanGoalInput");
  const goalText =
    goalInput instanceof HTMLInputElement ? goalInput.value.trim() : "";
  state.todayPlanState.goalText = goalText;
  state.todayPlanState.generating = true;
  state.todayPlanState.loading = true;
  state.todayPlanState.error = "";
  state.todayPlanState.unavailable = false;
  state.todayPlanState.loadingMessage = "Generating plan preview...";
  renderTodayPlanPanel();

  const generationId = ++state.todayPlanGenerationSeq;
  await loadTodayPlanDecisionAssist(true);
  if (generationId !== state.todayPlanGenerationSeq) return;
  state.todayPlanState.loadingMessage = "";
  state.todayPlanState.lastApplyBatch = null;
  renderTodayPlanPanel();
}

function handleTodayPlanToggleItem(todoId, checked) {
  if (checked) {
    state.todayPlanState.selectedTodoIds.add(todoId);
  } else {
    state.todayPlanState.selectedTodoIds.delete(todoId);
  }
  renderTodayPlanPanel();
}

async function handleTodayPlanDismissSuggestion(suggestionId) {
  if (
    state.todayPlanState.mode === "live" &&
    state.todayPlanState.aiSuggestionId
  ) {
    try {
      await apiCall(
        `${API_URL}/ai/suggestions/${encodeURIComponent(state.todayPlanState.aiSuggestionId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, dismissAll: true }),
        },
      );
    } catch (error) {
      console.error("Today plan dismiss failed:", error);
    }
    state.todayPlanState.aiSuggestionId = "";
    state.todayPlanState.envelope = normalizeTodayPlanEnvelope({
      surface: TODAY_PLAN_SURFACE,
      must_abstain: false,
      planPreview: { topN: 3, items: [] },
      suggestions: [],
    });
    state.todayPlanState.selectedTodoIds = new Set();
    state.todayPlanState.dismissedSuggestionIds = new Set();
    renderTodayPlanPanel();
    return;
  }
  state.todayPlanState.dismissedSuggestionIds.add(suggestionId);
  renderTodayPlanPanel();
}

async function handleTodayPlanApplySelected() {
  if (!state.todayPlanState.envelope) return;
  const suggestionsToApply = getTodayPlanSelectedSuggestionCards();
  if (!suggestionsToApply.length) return;

  const affectedTodoIds = new Set(
    suggestionsToApply
      .map((suggestion) => String(suggestion.payload?.todoId || ""))
      .filter(Boolean),
  );
  const todoSnapshots = {};
  for (const todoId of affectedTodoIds) {
    const todo = state.todos.find((entry) => String(entry.id) === todoId);
    if (!todo) continue;
    todoSnapshots[todoId] = deepClone(todo);
  }
  const notesDraftSnapshot = deepClone(state.todayPlanState.notesDraftByTodoId);
  if (
    state.todayPlanState.mode === "live" &&
    state.todayPlanState.aiSuggestionId
  ) {
    try {
      const response = await apiCall(
        `${API_URL}/ai/suggestions/${encodeURIComponent(state.todayPlanState.aiSuggestionId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedTodoIds: Array.from(state.todayPlanState.selectedTodoIds),
            confirmed: true,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        state.todayPlanState.error =
          typeof data?.error === "string"
            ? data.error
            : "Could not apply selected suggestions.";
        renderTodayPlanPanel();
        return;
      }
      const data = await response.json().catch(() => ({}));
      const updatedTodos = Array.isArray(data?.todos) ? data.todos : [];
      for (const updatedTodo of updatedTodos) {
        if (!updatedTodo?.id) continue;
        const index = state.todos.findIndex(
          (item) => String(item.id) === String(updatedTodo.id),
        );
        if (index >= 0) {
          state.todos[index] = updatedTodo;
        }
      }
      await loadTodayPlanDecisionAssist(false);
    } catch (error) {
      console.error("Today plan apply failed:", error);
      state.todayPlanState.error = "Could not apply selected suggestions.";
      renderTodayPlanPanel();
      return;
    }
  } else {
    for (const suggestion of suggestionsToApply) {
      const todoId = String(suggestion.payload?.todoId || "");
      const todo = state.todos.find((entry) => String(entry.id) === todoId);
      if (!todo) continue;

      if (suggestion.type === "set_priority") {
        todo.priority = normalizePriorityValue(suggestion.payload?.priority);
        continue;
      }
      if (suggestion.type === "set_due_date") {
        const dueDate = String(suggestion.payload?.dueDateISO || "");
        const parsed = new Date(dueDate);
        if (!Number.isNaN(parsed.getTime())) {
          todo.dueDate = parsed.toISOString();
        }
        continue;
      }
      if (suggestion.type === "split_subtasks") {
        const subtasksRaw = Array.isArray(suggestion.payload?.subtasks)
          ? suggestion.payload.subtasks
          : [];
        todo.subtasks = subtasksRaw.slice(0, 5).map((subtask, index) => ({
          id: `local-today-plan-${suggestion.suggestionId}-${index + 1}`,
          title: String(subtask?.title || "").slice(0, 200),
          completed: false,
          order: Number(subtask?.order) || index + 1,
        }));
        continue;
      }
      if (suggestion.type === "propose_next_action") {
        state.todayPlanState.notesDraftByTodoId[todoId] = String(
          suggestion.payload?.text || "",
        ).slice(0, 500);
      }
    }
  }

  state.todayPlanState.lastApplyBatch = {
    todoSnapshots,
    notesDraftSnapshot,
  };
  renderTodos();
}

function handleTodayPlanUndoBatch() {
  const batch = state.todayPlanState.lastApplyBatch;
  if (!batch) return;
  Object.entries(batch.todoSnapshots || {}).forEach(([todoId, snapshot]) => {
    const index = state.todos.findIndex((entry) => String(entry.id) === todoId);
    if (index === -1) return;
    state.todos[index] = snapshot;
  });
  state.todayPlanState.notesDraftByTodoId = deepClone(
    batch.notesDraftSnapshot || {},
  );
  state.todayPlanState.lastApplyBatch = null;
  emitAiSuggestionUndoTelemetry({
    surface: TODAY_PLAN_SURFACE,
    aiSuggestionDbId: state.todayPlanState.aiSuggestionId,
    suggestionId: state.todayPlanState.envelope?.requestId || "",
    selectedTodoIdsCount: Object.keys(batch.todoSnapshots || {}).length,
  });
  renderTodos();
}

function bindTodayPlanHandlers() {
  if (window.__todayPlanHandlersBound) {
    return;
  }
  window.__todayPlanHandlersBound = true;

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "todayPlanGoalInput") return;
    if (!(target instanceof HTMLInputElement)) return;
    state.todayPlanState.goalText = target.value;
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-today-plan-action");
    if (action !== "toggle-item") return;
    const todoId = String(target.getAttribute("data-today-plan-todo-id") || "");
    if (!todoId || !(target instanceof HTMLInputElement)) return;
    handleTodayPlanToggleItem(todoId, target.checked);
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest("[data-today-plan-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-today-plan-action");
    if (action === "toggle-item" && actionEl instanceof HTMLInputElement) {
      const todoId = String(
        actionEl.getAttribute("data-today-plan-todo-id") || "",
      );
      if (!todoId) return;
      handleTodayPlanToggleItem(todoId, actionEl.checked);
      return;
    }
    if (action === "generate") {
      await handleTodayPlanGenerate();
      return;
    }
    if (action === "dismiss-suggestion") {
      const suggestionId = String(
        actionEl.getAttribute("data-today-plan-suggestion-id") || "",
      );
      if (!suggestionId) return;
      await handleTodayPlanDismissSuggestion(suggestionId);
      return;
    }
    if (action === "apply-selected") {
      await handleTodayPlanApplySelected();
      return;
    }
    if (action === "undo") {
      handleTodayPlanUndoBatch();
    }
  });
}

// ========== PHASE B: PRIORITY, NOTES, SUBTASKS ==========

function openTodoComposerFromCta() {
  const input = document.getElementById("todoInput");
  if (!(input instanceof HTMLInputElement)) return;
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus();
}

function handleTodoKeyPress(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addTodo();
  }
}

function setPriority(priority) {
  state.currentPriority = priority;

  // Update button states
  document.querySelectorAll(".priority-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document
    .getElementById(
      `priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
    )
    .classList.add("active");
  updateQuickEntryPropertiesSummary();
}

function getPriorityIcon(priority) {
  const icons = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };
  return icons[priority] || icons.medium;
}

function toggleNotesInput() {
  const notesInput = document.getElementById("todoNotesInput");
  const icon = document.getElementById("notesExpandIcon");

  if (notesInput.style.display === "none") {
    notesInput.style.display = "block";
    icon.classList.add("expanded");
  } else {
    notesInput.style.display = "none";
    icon.classList.remove("expanded");
  }
}

function toggleNotes(todoId, event) {
  event.stopPropagation();
  const content = document.getElementById(`notes-content-${todoId}`);
  const icon = document.getElementById(`notes-icon-${todoId}`);

  if (content.style.display === "none") {
    content.style.display = "block";
    icon.classList.add("expanded");
  } else {
    content.style.display = "none";
    icon.classList.remove("expanded");
  }
}

function renderSubtasks(todo) {
  const completedCount = todo.subtasks.filter((s) => s.completed).length;
  const totalCount = todo.subtasks.length;

  return `
                <div class="subtasks-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span style="font-size: 0.85em; color: var(--text-secondary);">
                            ☑️ Subtasks: ${completedCount}/${totalCount}
                        </span>
                    </div>
                    <ul class="subtask-list">
                        ${todo.subtasks
                          .map(
                            (subtask) => `
                            <li class="subtask-item ${subtask.completed ? "completed" : ""}">
                                <input
                                    type="checkbox"
                                    class="todo-checkbox"
                                    aria-label="Mark subtask ${escapeHtml(subtask.title)} complete"
                                    style="width: 16px; height: 16px;"
                                    ${subtask.completed ? "checked" : ""}
                                    data-onchange="toggleSubtask('${todo.id}', '${subtask.id}')"
                                >
                                <span class="subtask-title">${escapeHtml(subtask.title)}</span>
                            </li>
                        `,
                          )
                          .join("")}
                    </ul>
                </div>
            `;
}

async function toggleSubtask(todoId, subtaskId) {
  const todo = state.todos.find((t) => t.id === todoId);
  if (!todo || !todo.subtasks) return;

  const subtask = todo.subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;

  try {
    const response = await apiCall(
      `${API_URL}/todos/${todoId}/subtasks/${subtaskId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !subtask.completed }),
      },
    );

    if (response && response.ok) {
      const updatedSubtask = await response.json();
      todo.subtasks = todo.subtasks.map((s) =>
        s.id === subtaskId ? updatedSubtask : s,
      );
      renderTodos();
    }
  } catch (error) {
    console.error("Toggle subtask failed:", error);
  }
}

async function aiBreakdownTodo(todoId, force = false) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;

  try {
    const response = await apiCall(`${API_URL}/ai/todos/${todoId}/breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxSubtasks: 5, force }),
    });
    const data = response ? await parseApiBody(response) : {};

    if (response && response.ok) {
      await loadTodos();
      await loadAiInsights();
      await loadAiFeedbackSummary();
      showMessage(
        "todosMessage",
        `Added ${data.createdCount || 0} AI subtasks for "${todo.title}"`,
        "success",
      );
      return;
    }

    if (response && response.status === 409) {
      const proceed = await showConfirmDialog(
        "This task already has subtasks. Generate additional subtasks anyway?",
      );
      if (proceed) {
        await aiBreakdownTodo(todoId, true);
      }
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "Failed to generate subtasks",
      "error",
    );
  } catch (error) {
    console.error("AI breakdown error:", error);
    showMessage("todosMessage", "Failed to generate subtasks", "error");
  }
}

// ========== PHASE A: DRAG & DROP FUNCTIONALITY ==========
let draggedOverTodoId = null;
let draggedHeadingId = null;

function resolveDragRow(event, selector, fallbackElement = null) {
  const candidateTargets = [];
  if (fallbackElement instanceof Element) {
    candidateTargets.push(fallbackElement);
  }
  const target = event?.target;
  if (target instanceof Element) {
    candidateTargets.push(target);
  }
  const currentTarget = event?.currentTarget;
  if (currentTarget instanceof Element) {
    candidateTargets.push(currentTarget);
  }

  for (const candidate of candidateTargets) {
    if (candidate.matches(selector)) {
      return candidate instanceof HTMLElement ? candidate : null;
    }
    const closest = candidate.closest(selector);
    if (closest instanceof HTMLElement) {
      return closest;
    }
  }

  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const pointTarget = document.elementFromPoint(clientX, clientY);
    if (pointTarget instanceof Element) {
      if (pointTarget.matches(selector)) {
        return pointTarget instanceof HTMLElement ? pointTarget : null;
      }
      const closest = pointTarget.closest(selector);
      if (closest instanceof HTMLElement) {
        return closest;
      }
    }
  }

  return null;
}

function getTodoRowFromDragEvent(event, fallbackElement = null) {
  return resolveDragRow(event, ".todo-item[data-todo-id]", fallbackElement);
}

function getHeadingRowFromDragEvent(event, fallbackElement = null) {
  return resolveDragRow(
    event,
    ".todo-heading-divider[data-heading-id]",
    fallbackElement,
  );
}

function handleDragStart(e, rowElement = null) {
  const row = getTodoRowFromDragEvent(e, rowElement);
  if (!row) return;
  state.draggedTodoId = row.dataset.todoId;
  draggedHeadingId = null;
  row.classList.add("dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", state.draggedTodoId || "");
  }
}

function handleDragOver(e, rowElement = null) {
  if (draggedHeadingId) {
    const row = getTodoRowFromDragEvent(e, rowElement);
    if (!row) return;
    const todoId = String(row.dataset.todoId || "");
    if (!todoId) return;
    e.preventDefault();
    clearHeadingDragState();
    const bounds = row.getBoundingClientRect();
    const dropPosition =
      e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    row.dataset.headingDropPosition = dropPosition;
    row.classList.add("todo-item--heading-drop-target");
    row.classList.add(
      dropPosition === "after"
        ? "todo-item--heading-drop-after"
        : "todo-item--heading-drop-before",
    );
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    return;
  }

  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }

  const row = getTodoRowFromDragEvent(e, rowElement);
  if (!row) return;
  document.querySelectorAll(".todo-item").forEach((item) => {
    if (item === row) return;
    delete item.dataset.todoDropPosition;
    item.classList.remove("drag-over");
  });
  const todoId = row?.dataset.todoId || "";
  if (todoId !== state.draggedTodoId) {
    const bounds = row.getBoundingClientRect();
    const dropPosition =
      e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    row.dataset.todoDropPosition = dropPosition;
    row?.classList.add("drag-over");
    draggedOverTodoId = todoId;
  }
}

function handleDrop(e, rowElement = null) {
  if (draggedHeadingId) {
    e.preventDefault();
    e.stopPropagation();
    const row = getTodoRowFromDragEvent(e, rowElement);
    if (!row) return;
    const targetTodoId = String(row.dataset.todoId || "");
    const dropPosition =
      row.dataset.headingDropPosition === "after" ? "after" : "before";
    const headingDropTarget = getHeadingDropTargetFromTodo(
      targetTodoId,
      dropPosition,
    );
    if (headingDropTarget) {
      reorderProjectHeadings(
        draggedHeadingId,
        headingDropTarget.targetId,
        headingDropTarget.placement,
      );
    }
    clearHeadingDragState();
    draggedHeadingId = null;
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const row = getTodoRowFromDragEvent(e, rowElement);
  const dropTargetId = row?.dataset.todoId || "";
  const placement =
    row?.dataset.todoDropPosition === "after" ? "after" : "before";
  if (row) {
    delete row.dataset.todoDropPosition;
  }
  row?.classList.remove("drag-over");

  if (
    state.draggedTodoId &&
    dropTargetId &&
    state.draggedTodoId !== dropTargetId
  ) {
    const selectedProject = getSelectedProjectKey();
    const targetTodo =
      state.todos.find((todo) => todo.id === dropTargetId) || null;
    const nextHeadingId = selectedProject
      ? String(targetTodo?.headingId || "")
      : null;
    reorderTodos(state.draggedTodoId, dropTargetId, {
      nextHeadingId: selectedProject ? nextHeadingId || null : undefined,
      placement,
    });
  }
}

function handleDragEnd(e, rowElement = null) {
  const row = getTodoRowFromDragEvent(e, rowElement);
  row?.classList.remove("dragging");
  document.querySelectorAll(".todo-item").forEach((item) => {
    item.classList.remove("drag-over");
    delete item.dataset.todoDropPosition;
  });
  clearHeadingDragState();
  state.draggedTodoId = null;
  draggedOverTodoId = null;
}

function clearHeadingDragState() {
  document.querySelectorAll(".todo-heading-divider").forEach((row) => {
    row.classList.remove(
      "todo-heading-divider--dragging",
      "todo-heading-divider--drag-over-before",
      "todo-heading-divider--drag-over-after",
    );
    delete row.dataset.headingDropPosition;
  });
  document.querySelectorAll(".todo-item").forEach((row) => {
    row.classList.remove(
      "todo-item--heading-drop-target",
      "todo-item--heading-drop-before",
      "todo-item--heading-drop-after",
    );
    delete row.dataset.headingDropPosition;
  });
}

function handleHeadingDragStart(e, rowElement = null) {
  const row = getHeadingRowFromDragEvent(e, rowElement);
  if (!row) return;
  const headingId = row.dataset.headingId || "";
  if (!headingId) return;

  draggedHeadingId = headingId;
  state.draggedTodoId = null;
  row.classList.add("todo-heading-divider--dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", headingId);
  }
}

function handleHeadingDragOver(e, rowElement = null) {
  const row = getHeadingRowFromDragEvent(e, rowElement);
  if (!row) return;
  const targetHeadingId = row.dataset.headingId || "";

  if (draggedHeadingId) {
    if (!targetHeadingId || targetHeadingId === draggedHeadingId) return;
    e.preventDefault();
    clearHeadingDragState();
    const bounds = row.getBoundingClientRect();
    const dropPosition =
      e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    row.dataset.headingDropPosition = dropPosition;
    row.classList.add(
      dropPosition === "after"
        ? "todo-heading-divider--drag-over-after"
        : "todo-heading-divider--drag-over-before",
    );
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    return;
  }

  if (!state.draggedTodoId || !targetHeadingId) return;
  e.preventDefault();
  clearHeadingDragState();
  row.classList.add("todo-heading-divider--drag-over-before");
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
}

function getFirstTodoIdInHeading(headingId, excludeTodoId = null) {
  const selectedProject = getSelectedProjectKey();
  const normalizedProject = normalizeProjectPath(selectedProject);
  const candidates = [...state.todos]
    .filter((todo) => {
      const todoProject = normalizeProjectPath(todo.category || "");
      if (normalizedProject && todoProject !== normalizedProject) return false;
      if (excludeTodoId && String(todo.id) === String(excludeTodoId))
        return false;
      return String(todo.headingId || "") === String(headingId || "");
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  return candidates[0]?.id || null;
}

function handleHeadingDrop(e, rowElement = null) {
  e.preventDefault();
  e.stopPropagation();
  const row = getHeadingRowFromDragEvent(e, rowElement);
  if (!row) return;
  const targetHeadingId = row.dataset.headingId || "";
  if (!targetHeadingId) return;

  if (draggedHeadingId) {
    const dropPosition =
      row.dataset.headingDropPosition === "after" ? "after" : "before";
    if (draggedHeadingId !== targetHeadingId) {
      reorderProjectHeadings(draggedHeadingId, targetHeadingId, dropPosition);
    }
    clearHeadingDragState();
    draggedHeadingId = null;
    return;
  }

  if (!state.draggedTodoId) return;
  const firstTodoId = getFirstTodoIdInHeading(
    targetHeadingId,
    state.draggedTodoId,
  );
  if (firstTodoId) {
    reorderTodos(state.draggedTodoId, firstTodoId, {
      nextHeadingId: targetHeadingId,
    });
  } else {
    moveTodoToHeading(state.draggedTodoId, targetHeadingId);
  }
  clearHeadingDragState();
}

function handleHeadingDragEnd() {
  clearHeadingDragState();
  draggedHeadingId = null;
}

// ========== PHASE A: KEYBOARD SHORTCUTS ==========
function toggleShortcuts() {
  const overlay = document.getElementById("shortcutsOverlay");
  if (!overlay) return;
  const isNowOpen = !overlay.classList.contains("active");
  overlay.classList.toggle("active");
  if (isNowOpen) {
    DialogManager.open("shortcuts", overlay, {
      onEscape: toggleShortcuts,
      backdrop: false,
    });
  } else {
    DialogManager.close("shortcuts");
  }
}

function closeShortcutsOverlay(event) {
  if (event.target.id === "shortcutsOverlay") {
    toggleShortcuts();
  }
}

document.addEventListener("keydown", function (e) {
  const isCommandK =
    (e.ctrlKey || e.metaKey) &&
    !e.shiftKey &&
    !e.altKey &&
    e.key.toLowerCase() === "k";
  if (isCommandK && !e.isComposing) {
    e.preventDefault();
    toggleCommandPalette();
    return;
  }

  if (state.isCommandPaletteOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette({ restoreFocus: true });
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveCommandPaletteSelection(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveCommandPaletteSelection(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const currentItem =
        state.commandPaletteSelectableItems[state.commandPaletteIndex];
      executeCommandPaletteItem(currentItem);
      return;
    }

    if (e.key === "Tab") {
      const refs = getCommandPaletteElements();
      if (!refs) return;
      const focusable = refs.panel.querySelectorAll(
        'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const focusableItems = Array.from(focusable).filter(
        (el) => el instanceof HTMLElement && !el.hidden,
      );
      if (focusableItems.length === 0) return;

      const first = focusableItems[0];
      const last = focusableItems[focusableItems.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
        return;
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (e.key === "Escape" && !state.isAiWorkspaceCollapsed) {
    const refs = getAiWorkspaceElements();
    const activeElement = document.activeElement;
    const focusInAiBody =
      !!refs &&
      activeElement instanceof HTMLElement &&
      refs.body.contains(activeElement);
    if (focusInAiBody) {
      e.preventDefault();
      setAiWorkspaceCollapsed(true, { restoreFocus: true });
      return;
    }
  }

  if (e.key === "Escape" && state.isProjectCrudModalOpen) {
    e.preventDefault();
    closeProjectCrudModal();
    return;
  }

  if (e.key === "Escape" && state.projectDeleteDialogState) {
    e.preventDefault();
    closeProjectDeleteDialog();
    return;
  }

  if (e.key === "Escape" && state.isProjectEditDrawerOpen) {
    e.preventDefault();
    closeProjectEditDrawer({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && state.openRailProjectMenuKey) {
    e.preventDefault();
    closeRailProjectMenu({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && state.isProfilePanelOpen) {
    e.preventDefault();
    closeProfilePanel({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && state.openTodoKebabId) {
    e.preventDefault();
    closeTodoKebabMenu({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && state.editingTodoId) {
    closeEditTodoModal();
    return;
  }

  if (e.key === "Escape" && state.isRailSheetOpen) {
    e.preventDefault();
    closeProjectsRailSheet({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && state.isMoreFiltersOpen) {
    const refs = getMoreFiltersElements();
    const activeElement = document.activeElement;
    const focusedInMoreFilters =
      !!refs &&
      (refs.panel.contains(activeElement) || refs.toggle === activeElement);
    if (focusedInMoreFilters) {
      e.preventDefault();
      // Stop the rail keydown handler (registered later on document) from also
      // handling this Escape and calling collapseToggle.focus(), which would
      // steal focus away from the toggle we just restored focus to.
      e.stopImmediatePropagation();
      closeMoreFilters({ restoreFocus: true });
      return;
    }
  }

  if (e.key === "Escape" && state.isTodoDrawerOpen) {
    e.preventDefault();
    closeTodoDrawer({ restoreFocus: true });
    return;
  }

  // Ignore if typing in input fields
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    // Allow Esc to clear search
    if (e.key === "Escape" && e.target.id === "searchInput") {
      e.target.value = "";
      EventBus.dispatch("todos:changed");
      e.target.blur();
    }
    return;
  }

  // Ctrl/Cmd + N: open task composer
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
    e.preventDefault();
    openTaskComposer();
    return;
  }

  // N: open task composer (when not typing in a field)
  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    openTaskComposer();
    return;
  }

  // Ctrl/Cmd + F: Focus on search
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    document.getElementById("searchInput")?.focus();
  }

  if (
    e.key === "/" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !e.shiftKey &&
    !e.isComposing
  ) {
    e.preventDefault();
    document.getElementById("searchInput")?.focus();
  }

  // Ctrl/Cmd + A: Select all todos
  if ((e.ctrlKey || e.metaKey) && e.key === "a") {
    e.preventDefault();
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = true;
      toggleSelectAll();
    }
  }

  // ?: Show keyboard shortcuts
  if (e.key === "?") {
    e.preventDefault();
    toggleShortcuts();
  }
});

// Load admin users
async function loadAdminUsers() {
  hideMessage("adminMessage");

  try {
    const response = await apiCall(`${API_URL}/admin/users`);
    if (response && response.ok) {
      state.users = await response.json();
      renderAdminUsers();
    } else {
      const data = await response.json();
      showMessage(
        "adminMessage",
        data.error || "Failed to load users",
        "error",
      );
    }
  } catch (error) {
    showMessage("adminMessage", "Network error. Please try again.", "error");
    console.error("Load users error:", error);
  }
}

// Render admin users
function renderAdminUsers() {
  const container = document.getElementById("adminContent");

  container.innerHTML = `
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Verified</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.users
                          .map(
                            (user) => `
                            <tr>
                                <td>${escapeHtml(user.email)}</td>
                                <td>${escapeHtml(user.name || "-")}</td>
                                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                                <td>${user.isVerified ? "✓" : "✗"}</td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                <td>
                                    ${
                                      user.id !== state.currentUser.id
                                        ? `
                                        ${
                                          user.role === "user"
                                            ? `
                                            <button class="action-btn promote" data-onclick="changeUserRole('${user.id}', 'admin')">Make Admin</button>
                                        `
                                            : `
                                            <button class="action-btn demote" data-onclick="changeUserRole('${user.id}', 'user')">Remove Admin</button>
                                        `
                                        }
                                        <button class="action-btn delete" data-onclick="deleteUser('${user.id}')">Delete</button>
                                    `
                                        : "<em>You</em>"
                                    }
                                </td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            `;
}

// Change user role
async function changeUserRole(userId, role) {
  hideMessage("adminMessage");

  try {
    const response = await apiCall(`${API_URL}/admin/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (response && response.ok) {
      showMessage("adminMessage", `User role updated to ${role}`, "success");
      loadAdminUsers();
    } else {
      const data = response ? await parseApiBody(response) : {};
      showMessage(
        "adminMessage",
        data.error || "Failed to update role",
        "error",
      );
    }
  } catch (error) {
    showMessage("adminMessage", "Network error. Please try again.", "error");
    console.error("Change role error:", error);
  }
}

// Delete user
async function deleteUser(userId) {
  if (
    !(await showConfirmDialog(
      "Are you sure you want to delete this user? This action cannot be undone.",
    ))
  )
    return;

  hideMessage("adminMessage");

  try {
    const response = await apiCall(`${API_URL}/admin/users/${userId}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      showMessage("adminMessage", "User deleted successfully", "success");
      loadAdminUsers();
    } else {
      const data = response ? await parseApiBody(response) : {};
      showMessage(
        "adminMessage",
        data.error || "Failed to delete user",
        "error",
      );
    }
  } catch (error) {
    showMessage("adminMessage", "Network error. Please try again.", "error");
    console.error("Delete user error:", error);
  }
}

// Switch view
function switchView(view, triggerEl = null) {
  const requestedView = view === "profile" ? "settings" : view;
  const isSettingsView = requestedView === "settings";
  const primaryView = isSettingsView ? "todos" : requestedView;

  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document
    .querySelectorAll(".nav-tab")
    .forEach((t) => t.classList.remove("active"));

  const targetView = document.getElementById(primaryView + "View");
  if (!(targetView instanceof HTMLElement)) {
    return;
  }
  targetView.classList.add("active");
  if (triggerEl) {
    triggerEl.classList.add("active");
  }
  if (
    !isSettingsView &&
    (!(triggerEl instanceof HTMLElement) ||
      !triggerEl.classList.contains("nav-tab"))
  ) {
    const matchingTab = document.querySelector(
      `.nav-tab[data-onclick*="switchView('${primaryView}'"]`,
    );
    if (matchingTab instanceof HTMLElement) {
      matchingTab.classList.add("active");
    }
  }
  setTodosViewBodyState(primaryView === "todos");
  setSettingsPaneVisible(isSettingsView);
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
  } else if (requestedView === "todos") {
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
  } else if (requestedView === "admin") {
    closeCommandPalette({ restoreFocus: false });
    closeProjectCrudModal({ restoreFocus: false });
    closeProjectEditDrawer({ restoreFocus: false });
    closeProjectDeleteDialog();
    closeMoreFilters();
    closeProjectsRailSheet({ restoreFocus: false });
    closeTodoDrawer({ restoreFocus: false });
    loadAdminUsers();
  }
}

function shouldIgnoreTodoDrawerOpen(target) {
  if (!(target instanceof Element)) return true;
  return !!target.closest(
    "input, button, select, textarea, a, label, [data-onclick], [data-onchange], .drag-handle, .todo-inline-actions, .subtasks-section, .todo-kebab, .todo-kebab-menu",
  );
}

function bindCommandPaletteHandlers() {
  if (window.__commandPaletteHandlersBound) {
    return;
  }
  window.__commandPaletteHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const overlay = target.closest("#commandPaletteOverlay");
    if (
      overlay instanceof HTMLElement &&
      target.id === "commandPaletteOverlay"
    ) {
      closeCommandPalette({ restoreFocus: true });
      return;
    }

    if (!state.isCommandPaletteOpen) return;

    const option = target.closest("[data-command-id]");
    if (!(option instanceof HTMLElement)) return;
    event.preventDefault();
    const itemIndex = Number.parseInt(
      option.getAttribute("data-command-index") || "-1",
      10,
    );
    if (itemIndex < 0) return;
    executeCommandPaletteItem(
      state.commandPaletteSelectableItems[itemIndex],
      option,
    );
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "commandPaletteInput") return;
    state.commandPaletteQuery =
      target instanceof HTMLInputElement ? target.value : String(target.value);
    state.commandPaletteIndex = 0;
    renderCommandPalette();
  });
}

function bindCriticalHandlers() {
  const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (!element || element.dataset.bound === "true") {
      return;
    }
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler(element, event);
    });
    element.dataset.bound = "true";
  };

  bindClick("loginTabButton", (element) => {
    switchAuthTab("login", element);
  });

  bindClick("registerTabButton", (element) => {
    switchAuthTab("register", element);
  });

  bindClick("forgotPasswordLink", () => {
    showForgotPassword();
  });

  bindClick("forgotBackToLoginButton", () => {
    showLogin();
  });

  bindClick("moreFiltersToggle", () => {
    toggleMoreFilters();
  });

  bindClick("projectsRailToggle", () => {
    setProjectsRailCollapsed(!state.isRailCollapsed);
    renderProjectsRail();
  });

  bindClick("projectsRailMobileOpen", (element) => {
    openProjectsFromTopbar(element);
  });

  bindClick("projectsRailMobileClose", () => {
    closeProjectsRailSheet({ restoreFocus: true });
  });

  bindClick("quickEntryPropertiesToggle", () => {
    setQuickEntryPropertiesOpen(!state.isQuickEntryPropertiesOpen);
  });

  bindClick("aiWorkspaceToggle", () => {
    toggleAiWorkspace();
  });

  const todoProjectSelect = document.getElementById("todoProjectSelect");
  if (todoProjectSelect && todoProjectSelect.dataset.bound !== "true") {
    todoProjectSelect.addEventListener("change", () => {
      syncQuickEntryProjectActions();
      updateQuickEntryPropertiesSummary();
    });
    todoProjectSelect.dataset.bound = "true";
  }

  const todoDueDateInput = document.getElementById("todoDueDateInput");
  if (todoDueDateInput && todoDueDateInput.dataset.bound !== "true") {
    todoDueDateInput.addEventListener("input", () => {
      updateQuickEntryPropertiesSummary();
    });
    todoDueDateInput.addEventListener("change", () => {
      updateQuickEntryPropertiesSummary();
    });
    todoDueDateInput.dataset.bound = "true";
  }

  const resendBtn = document.getElementById("resendVerificationButton");
  if (resendBtn && !resendBtn.dataset.bound) {
    resendBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resendVerification();
    });
    resendBtn.dataset.bound = "true";
  }
}

// Profile panel (dock)
function toggleProfilePanel() {
  if (state.isProfilePanelOpen) {
    closeProfilePanel({ restoreFocus: true });
  } else {
    const panel = document.getElementById("dockProfilePanel");
    if (!(panel instanceof HTMLElement)) return;
    const emailEl = document.getElementById("dockProfileEmail");
    if (emailEl instanceof HTMLElement) {
      emailEl.textContent = state.currentUser?.email ?? "";
    }
    panel.hidden = false;
    state.isProfilePanelOpen = true;
    DialogManager.open("profilePanel", panel, {
      onEscape: () => closeProfilePanel({ restoreFocus: true }),
      backdrop: false,
    });
  }
}

function closeProfilePanel({ restoreFocus = false } = {}) {
  const panel = document.getElementById("dockProfilePanel");
  if (panel instanceof HTMLElement) {
    panel.hidden = true;
  }
  state.isProfilePanelOpen = false;
  DialogManager.close("profilePanel");
  if (restoreFocus) {
    const trigger = document.getElementById("dockProfileBtn");
    if (trigger instanceof HTMLElement) trigger.focus();
  }
}

function bindDockHandlers() {
  if (window.__dockHandlersBound) return;
  window.__dockHandlersBound = true;

  document.addEventListener("click", (event) => {
    if (!state.isProfilePanelOpen) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panel = document.getElementById("dockProfilePanel");
    const trigger = document.getElementById("dockProfileBtn");
    if (
      (panel instanceof HTMLElement && panel.contains(target)) ||
      (trigger instanceof HTMLElement && trigger.contains(target))
    ) {
      return;
    }
    closeProfilePanel({ restoreFocus: false });
  });
}

// showMessage, hideMessage, escapeHtml — from utils.js
// toggleTheme, initTheme — from theme.js

// ========== PHASE E: SERVICE WORKER REGISTRATION ==========
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const shouldRegister =
      window.location.protocol === "https:" &&
      window.location.hostname !== "localhost";

    if (!shouldRegister) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      return;
    }

    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log(
          "Service Worker registered successfully:",
          registration.scope,
        );
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
}

function invokeBoundExpression(expression, event, element) {
  const source = expression.trim().replace(/;$/, "");
  if (!source) return;

  const eventMethodMatch = source.match(/^event\.([A-Za-z_$][\w$]*)\(\)$/);
  if (eventMethodMatch) {
    const methodName = eventMethodMatch[1];
    const method = event?.[methodName];
    if (typeof method === "function") {
      method.call(event);
    }
    return;
  }

  const callMatch = source.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
  if (!callMatch) return;

  const functionName = callMatch[1];
  const rawArgs = callMatch[2].trim();
  const target = window[functionName];
  if (typeof target !== "function") return;

  const tokens =
    rawArgs === "" ? [] : rawArgs.match(/'[^']*'|\"[^\"]*\"|[^,]+/g) || [];
  const args = tokens.map((token) => {
    const arg = token.trim();
    if (arg === "event") return event;
    if (arg === "this") return element;
    if (arg === "this.value") {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        return element.value;
      }
      return "";
    }
    if (arg === "this.checked") {
      if (element instanceof HTMLInputElement) {
        return element.checked;
      }
      return false;
    }
    if (/^'.*'$/.test(arg) || /^\".*\"$/.test(arg)) return arg.slice(1, -1);
    if (arg === "true") return true;
    if (arg === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(arg)) return Number(arg);
    return arg;
  });

  target(...args);
}

function bindDeclarativeHandlers() {
  if (window.__declarativeHandlersBound) {
    return;
  }
  window.__declarativeHandlersBound = true;

  // Per-expression debounce cache: input events are debounced so that rapid
  // keystrokes (e.g. typing into #searchInput) do not re-render on every key.
  const inputDebouncedInvokers = new Map();

  const events = [
    "click",
    "submit",
    "input",
    "change",
    "keypress",
    "dragstart",
    "dragover",
    "drop",
    "dragend",
  ];

  for (const eventType of events) {
    const attribute = `on${eventType}`;
    document.addEventListener(eventType, (event) => {
      const rawTarget = event.target;
      const target =
        rawTarget instanceof Element
          ? rawTarget
          : rawTarget instanceof Node
            ? rawTarget.parentElement
            : null;
      let element = target?.closest(`[data-${attribute}]`) || null;
      if (!element && (eventType === "dragover" || eventType === "drop")) {
        const clientX = Number(event.clientX);
        const clientY = Number(event.clientY);
        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
          const pointTarget = document.elementFromPoint(clientX, clientY);
          if (pointTarget instanceof Element) {
            element = pointTarget.closest(`[data-${attribute}]`);
          }
        }
      }
      if (!element && eventType === "drop") {
        const fallbackDropTarget = document.querySelector(
          ".todo-item--heading-drop-target, .todo-item.drag-over, .todo-heading-divider--drag-over-before, .todo-heading-divider--drag-over-after",
        );
        if (fallbackDropTarget instanceof Element) {
          element = fallbackDropTarget.closest(`[data-${attribute}]`);
        }
      }
      if (!element) return;
      const expression = element.dataset[attribute];
      if (!expression) return;
      if (eventType === "input") {
        let fn = inputDebouncedInvokers.get(expression);
        if (!fn) {
          fn = debounce(
            (expr, ev, el) => invokeBoundExpression(expr, ev, el),
            DEBOUNCE_MS,
          );
          inputDebouncedInvokers.set(expression, fn);
        }
        fn(expression, event, element);
      } else {
        invokeBoundExpression(expression, event, element);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Hook wiring — called after all modules are imported so cross-module
// calls through hooks.X?.() resolve to the correct functions.
// ---------------------------------------------------------------------------
(function wireHooks() {
  // drawerUi ↔ filterLogic
  hooks.syncTodoDrawerStateWithRender = syncTodoDrawerStateWithRender;
  // todosService / projectsState / drawerUi → filterLogic
  // domain modules dispatch via hooks; EventBus delivers to subscribers
  hooks.applyFiltersAndRender = (payload) =>
    EventBus.dispatch("todos:changed", payload);
  hooks.renderTodos = () => EventBus.dispatch("todos:render");

  // Subscribe renderers
  EventBus.subscribe("todos:changed", applyFiltersAndRender);
  EventBus.subscribe("todos:render", renderTodos);
  hooks.updateCategoryFilter = updateCategoryFilter;
  // todosService / filterLogic → projectsState
  hooks.loadProjects = loadProjects;
  hooks.refreshProjectCatalog = refreshProjectCatalog;
  hooks.scheduleLoadSelectedProjectHeadings =
    scheduleLoadSelectedProjectHeadings;
  hooks.renderProjectHeadingCreateButton = renderProjectHeadingCreateButton;
  // todosService → overlayManager
  hooks.showConfirmDialog = showConfirmDialog;
  // app.js orchestrator callbacks
  hooks.updateHeaderAndContextUI = updateHeaderAndContextUI;
  // drawerUi → todosService
  hooks.applyTodoPatch = applyTodoPatch;
  hooks.deleteTodo = deleteTodo;
  hooks.loadTodos = loadTodos;
  hooks.validateTodoTitle = validateTodoTitle;
  hooks.toDateInputValue = toDateInputValue;
  hooks.toIsoFromDateInput = toIsoFromDateInput;
  // drawerUi → projectsState
  hooks.getAllProjects = getAllProjects;
  hooks.normalizeProjectPath = normalizeProjectPath;
  hooks.renderProjectOptionEntry = renderProjectOptionEntry;
  // drawerUi → overlayManager
  hooks.openEditTodoModal = openEditTodoModal;
  // overlayManager → todosService
  hooks.toDateTimeLocalValue = toDateTimeLocalValue;
  hooks.updateProjectSelectOptions = updateProjectSelectOptions;
  // overlayManager → filterLogic
  hooks.syncTodoDrawerStateWithRender = syncTodoDrawerStateWithRender;
  // Utility hooks (from window.Utils / aiSuggestionUtils)
  hooks.escapeHtml = escapeHtml;
  hooks.showMessage = showMessage;
  hooks.parseApiBody = parseApiBody;
  hooks.normalizeProjectPath = normalizeProjectPath;
  hooks.expandProjectTree = expandProjectTree;
  hooks.compareProjectPaths = compareProjectPaths;
  hooks.getProjectLeafName = getProjectLeafName;
  hooks.PROJECT_PATH_SEPARATOR = PROJECT_PATH_SEPARATOR;
  // AI utility hooks
  hooks.labelForType = labelForType;
  hooks.shouldRenderTypeForSurface = shouldRenderTypeForSurface;
  hooks.needsConfirmation = needsConfirmation;
  hooks.truncateRationale = truncateRationale;
  hooks.capSuggestions = capSuggestions;
  hooks.sortSuggestions = sortSuggestions;
  hooks.confidenceLabel = confidenceLabel;
  hooks.confidenceBand = confidenceBand;
  hooks.renderLintChip = renderLintChip;
  hooks.renderAiDebugMeta = renderAiDebugMeta;
  hooks.renderAiDebugSuggestionId = renderAiDebugSuggestionId;
  hooks.lintTodoFields = lintTodoFields;
  hooks.emitAiSuggestionUndoTelemetry = emitAiSuggestionUndoTelemetry;
  // Config hooks
  hooks.API_URL = API_URL;
  hooks.AI_DEBUG_ENABLED = AI_DEBUG_ENABLED;
  hooks.FEATURE_ENHANCED_TASK_CRITIC = FEATURE_ENHANCED_TASK_CRITIC;
  hooks.FEATURE_TASK_DRAWER_DECISION_ASSIST =
    FEATURE_TASK_DRAWER_DECISION_ASSIST;
  hooks.MOBILE_DRAWER_MEDIA_QUERY = MOBILE_DRAWER_MEDIA_QUERY;
  hooks.apiCall = apiCall;
  hooks.fetchWithTimeout = fetchWithTimeout;
  hooks.apiCallWithTimeout = apiCallWithTimeout;
  hooks.isAbortError = isAbortError;
  // authUi cross-module hooks
  hooks.switchView = switchView;
  hooks.closeCommandPalette = closeCommandPalette;
  hooks.resetOnCreateAssistState = resetOnCreateAssistState;
  hooks.resetTodayPlanState = resetTodayPlanState;
  hooks.clearPlanDraftState = clearPlanDraftState;
  hooks.setTodosViewBodyState = setTodosViewBodyState;
  hooks.setSettingsPaneVisible = setSettingsPaneVisible;
  hooks.setProjectsRailCollapsed = setProjectsRailCollapsed;
  hooks.readStoredRailCollapsedState = readStoredRailCollapsedState;
  hooks.readStoredAiWorkspaceVisibleState = readStoredAiWorkspaceVisibleState;
  hooks.readStoredAiWorkspaceCollapsedState =
    readStoredAiWorkspaceCollapsedState;
  hooks.setAiWorkspaceVisible = setAiWorkspaceVisible;
  hooks.setAiWorkspaceCollapsed = setAiWorkspaceCollapsed;
  hooks.closeMoreFilters = closeMoreFilters;
  hooks.syncSidebarNavState = syncSidebarNavState;
  hooks.loadAiSuggestions = loadAiSuggestions;
  hooks.loadAiUsage = loadAiUsage;
  hooks.loadAiInsights = loadAiInsights;
  hooks.loadAiFeedbackSummary = loadAiFeedbackSummary;
  hooks.readStoredQuickEntryPropertiesOpenState =
    readStoredQuickEntryPropertiesOpenState;
  hooks.updateCritiqueDraftButtonState = updateCritiqueDraftButtonState;
  // railUi cross-module hooks
  hooks.DialogManager = DialogManager;
  hooks.ensureTodosShellActive = ensureTodosShellActive;
  // filterLogic → render sub-hooks
  hooks.renderProjectsRail = renderProjectsRail;
  hooks.renderTodayPlanPanel = renderTodayPlanPanel;
  hooks.clearHomeFocusDashboard = clearHomeFocusDashboard;
  hooks.renderHomeDashboard = renderHomeDashboard;
  hooks.updateBulkActionsVisibility = updateBulkActionsVisibility;
  hooks.updateAiWorkspaceStatusChip = updateAiWorkspaceStatusChip;
  // projectsState → rail
  hooks.renderProjectsRail = renderProjectsRail;
  hooks.closeProjectsRailSheet = closeProjectsRailSheet;
  // projectsState path utilities
  hooks.renderProjectOptionEntry = renderProjectOptionEntry;
  hooks.getSelectedProjectKey = getSelectedProjectKey;
  // createInitialTaskDrawerAssistState for drawerUi reset
  hooks.createInitialTaskDrawerAssistState = createInitialTaskDrawerAssistState;
  // Additional hooks needed by domain modules
  hooks.buildUrl = ApiClientModule.buildUrl;
  hooks.buildHomeTileListByKey = buildHomeTileListByKey;
  hooks.buildIcsContentForTodos = buildIcsContentForTodos;
  hooks.buildIcsFilename = buildIcsFilename;
  hooks.clearOnCreateDismissed = clearOnCreateDismissed;
  hooks.closeTaskComposer = closeTaskComposer;
  hooks.filterTodosList = filterTodosList;
  hooks.getHomeDrilldownLabel = getHomeDrilldownLabel;
  hooks.getProjectHeadings = getProjectHeadings;
  hooks.getTodoById = getTodoById;
  hooks.getVisibleTodos = getVisibleTodos;
  hooks.isInternalCategoryPath = isInternalCategoryPath;
  hooks.loadOnCreateDecisionAssist = loadOnCreateDecisionAssist;
  hooks.openTaskComposer = openTaskComposer;
  hooks.processQuickEntryNaturalDate = processQuickEntryNaturalDate;
  hooks.renderHomeFocusDashboard = renderHomeFocusDashboard;
  hooks.renderOnCreateAssistRow = renderOnCreateAssistRow;
  hooks.renderProjectOptions = renderProjectOptions;
  hooks.renderSubtasks = renderSubtasks;
  hooks.renderTodoChips = renderTodoChips;
  hooks.resetQuickEntryNaturalDueState = resetQuickEntryNaturalDueState;
  hooks.selectProjectFromRail = selectProjectFromRail;
  hooks.selectWorkspaceView = selectWorkspaceView;
  hooks.setPriority = setPriority;
  hooks.setQuickEntryPropertiesOpen = setQuickEntryPropertiesOpen;
  hooks.setSelectedProjectKey = setSelectedProjectKey;
  hooks.showInputDialog = showInputDialog;
  hooks.syncProjectHeaderActions = syncProjectHeaderActions;
  hooks.syncQuickEntryProjectActions = syncQuickEntryProjectActions;
  hooks.updateHeaderFromVisibleTodos = updateHeaderFromVisibleTodos;
  hooks.updateQuickEntryPropertiesSummary = updateQuickEntryPropertiesSummary;
  hooks.updateTaskComposerDueClearButton = updateTaskComposerDueClearButton;
  hooks.updateTopbarProjectsButton = updateTopbarProjectsButton;
})();

// ---------------------------------------------------------------------------
// Window bridge — all functions referenced via data-onclick / data-onsubmit /
// data-onchange in HTML must be on window because app.js is now a module
// (modules do not expose top-level declarations to global scope).
// ---------------------------------------------------------------------------
window.toggleTheme = toggleTheme;
window.openProjectsFromTopbar = openProjectsFromTopbar;
// Auth forms
window.switchAuthTab = switchAuthTab;
window.showForgotPassword = showForgotPassword;
window.showLogin = showLogin;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleForgotPassword = handleForgotPassword;
window.handleResetPassword = handleResetPassword;
window.resendVerification = resendVerification;
// Todo CRUD
window.addTodo = addTodo;
window.filterTodos = filterTodos;
window.clearFilters = clearFilters;
window.setDateView = setDateView;
window.handleTodoKeyPress = handleTodoKeyPress;
window.exportVisibleTodosToIcs = exportVisibleTodosToIcs;
// Edit modal
window.saveEditedTodo = saveEditedTodo;
window.closeEditTodoModal = closeEditTodoModal;
// Bulk actions
window.toggleSelectAll = toggleSelectAll;
window.completeSelected = completeSelected;
window.deleteSelected = deleteSelected;
window.performUndo = performUndo;
// Task composer
window.openTaskComposer = openTaskComposer;
window.closeTaskComposer = closeTaskComposer;
window.cancelTaskComposer = cancelTaskComposer;
window.toggleNotesInput = toggleNotesInput;
window.setPriority = setPriority;
window.clearTaskComposerDueDate = clearTaskComposerDueDate;
// Projects
window.createProject = createProject;
window.createSubproject = createSubproject;
window.renameProjectTree = renameProjectTree;
// Project key selection (used directly by UI tests via page.evaluate)
window.setSelectedProjectKey = setSelectedProjectKey;
// Views / navigation
window.switchView = switchView;
window.toggleProfilePanel = toggleProfilePanel;
window.logout = logout;
// Shortcuts / UI toggles
window.toggleShortcuts = toggleShortcuts;
window.closeShortcutsOverlay = closeShortcutsOverlay;
// Admin
window.handleAdminBootstrap = handleAdminBootstrap;
// Profile
window.handleUpdateProfile = handleUpdateProfile;
// AI workspace
window.openAiWorkspaceForBrainDump = openAiWorkspaceForBrainDump;
window.openAiWorkspaceForGoalPlan = openAiWorkspaceForGoalPlan;
window.critiqueDraftWithAi = critiqueDraftWithAi;
window.generatePlanWithAi = generatePlanWithAi;
window.draftPlanFromBrainDumpWithAi = draftPlanFromBrainDumpWithAi;
window.clearBrainDumpInput = clearBrainDumpInput;
// Search / filters
window.syncSheetSearch = syncSheetSearch;
// Todo interactions (from dynamically-rendered HTML)
window.retryLoadTodos = retryLoadTodos;
window.toggleTodo = toggleTodo;
window.toggleNotes = toggleNotes;
window.toggleSelectTodo = toggleSelectTodo;
window.toggleSubtask = toggleSubtask;
window.toggleTodoKebab = toggleTodoKebab;
window.openTodoFromKebab = openTodoFromKebab;
window.openEditTodoFromKebab = openEditTodoFromKebab;
window.openDrawerDangerZone = openDrawerDangerZone;
window.openTodoFromHomeTile = openTodoFromHomeTile;
window.moveTodoToProject = moveTodoToProject;
window.moveTodoToHeading = moveTodoToHeading;
window.moveProjectHeading = moveProjectHeading;
// Drag and drop
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.handleHeadingDragStart = handleHeadingDragStart;
window.handleHeadingDragOver = handleHeadingDragOver;
window.handleHeadingDrop = handleHeadingDrop;
window.handleHeadingDragEnd = handleHeadingDragEnd;
// AI critique / plan
window.applyCritiqueSuggestion = applyCritiqueSuggestion;
window.applyCritiqueSuggestionMode = applyCritiqueSuggestionMode;
window.dismissCritiqueSuggestion = dismissCritiqueSuggestion;
window.setCritiqueFeedbackReason = setCritiqueFeedbackReason;
window.aiBreakdownTodo = aiBreakdownTodo;
window.dismissPlanSuggestion = dismissPlanSuggestion;
window.resetPlanDraft = resetPlanDraft;
window.addPlanTasksToTodos = addPlanTasksToTodos;
window.selectAllPlanDraftTasks = selectAllPlanDraftTasks;
window.selectNoPlanDraftTasks = selectNoPlanDraftTasks;
window.setPlanDraftTaskSelected = setPlanDraftTaskSelected;
window.updatePlanDraftTaskTitle = updatePlanDraftTaskTitle;
window.updatePlanDraftTaskDescription = updatePlanDraftTaskDescription;
window.updatePlanDraftTaskDueDate = updatePlanDraftTaskDueDate;
window.updatePlanDraftTaskPriority = updatePlanDraftTaskPriority;
window.updatePlanDraftTaskProject = updatePlanDraftTaskProject;
window.retryMarkPlanSuggestionAccepted = retryMarkPlanSuggestionAccepted;
// Projects / headings
window.createHeadingForSelectedProject = createHeadingForSelectedProject;
// Home workspace
window.openHomeProject = openHomeProject;
window.openHomeTileList = openHomeTileList;
// Admin
window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------
function init() {
  renderSidebarNavigation();
  bindCriticalHandlers();
  bindTodoDrawerHandlers();
  bindProjectsRailHandlers();
  bindCommandPaletteHandlers();
  bindTaskComposerHandlers();
  bindDockHandlers();
  bindOnCreateAssistHandlers();
  bindTodayPlanHandlers();
  bindQuickEntryNaturalDateHandlers();

  // Check for reset token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("token");

  if (resetToken) {
    showResetPassword(resetToken);
    return;
  }

  const {
    token,
    refreshToken: refresh,
    user,
    invalidUserData,
    error,
  } = loadStoredSession();

  if (invalidUserData) {
    console.error("Invalid stored user data. Clearing auth state.", error);
    persistSession({ authToken: null, refreshToken: null, currentUser: null });
  }

  if (token && user) {
    state.authToken = token;
    state.refreshToken = refresh;
    state.currentUser = user;
    setAuthState(AUTH_STATE.AUTHENTICATED);
    showAppView();
    loadUserProfile();
  } else {
    setAuthState(AUTH_STATE.UNAUTHENTICATED);
  }
  renderOnCreateAssistRow();
  setQuickEntryPropertiesOpen(readStoredQuickEntryPropertiesOpenState(), {
    persist: false,
  });
  syncQuickEntryProjectActions();
  renderProjectHeadingCreateButton();
  renderQuickEntryNaturalDueChip();
  handleVerificationStatusFromUrl();
  bindRailSearchFocusBehavior();
}

// Initialize theme immediately
initTheme();

// Initialize on load
bindDeclarativeHandlers();
init();
