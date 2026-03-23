// =============================================================================
// ES6 Module Imports
// =============================================================================
import {
  state,
  hooks,
  createInitialTaskDrawerAssistState,
  createInitialOnCreateAssistState,
} from "./modules/store.js";
import {
  buildTodosQueryParams,
  loadTodos,
  retryLoadTodos,
  addTodo,
  addTodoFromInlineInput,
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
  shouldUseServerVisibleTodos,
} from "./modules/todosService.js";
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
  archiveProject,
  unarchiveProject,
} from "./modules/projectsState.js";
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
} from "./modules/filterLogic.js";
import {
  DialogManager,
  showConfirmDialog,
  showInputDialog,
  openEditTodoModal,
  closeEditTodoModal,
  saveEditedTodo,
} from "./modules/overlayManager.js";
import {
  readBooleanFeatureFlag,
  isEnhancedTaskCriticEnabled,
  isTaskDrawerDecisionAssistEnabled,
} from "./modules/featureFlags.js";
import {
  syncProjectsRailHost,
  renderSidebarNavigation,
  setSettingsPaneVisible,
  setFeedbackPaneVisible,
  setAdminPaneVisible,
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
  patchProjectsRailView,
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
} from "./modules/railUi.js";
import {
  bindResponsiveLayoutState,
  getRailPresentationMode,
  isMobileViewport,
} from "./modules/responsiveLayout.js";
import { createWorkspaceController } from "./modules/workspaceController.js";
import {
  prepareFeedbackView,
  syncFeedbackFormCopy,
  handleFeedbackTypeChange,
  handleFeedbackAttachmentChange,
  handleFeedbackSubmit,
  resetFeedbackFormView,
} from "./modules/feedbackUi.js";
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
  initSocialLogin,
  handleSocialCallback,
  handleGoogleLogin,
  handleAppleLogin,
  showPhoneLogin,
  handleSendOtp,
  handleVerifyOtp,
  handleResendOtp,
  loadLinkedProviders,
  handleUnlinkProvider,
  handleSetPassword,
} from "./modules/authUi.js";
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
} from "./modules/quickEntry.js";
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
  retryTodaysPlan,
  setUpcomingTab,
  getHomeDrilldownLabel,
  startOfLocalDay,
} from "./modules/homeDashboard.js";
import { refreshPrioritiesTile } from "./modules/homePrioritiesTile.js";
import {
  renderInboxView,
  loadInboxItems,
  bindInboxHandlers,
} from "./modules/inboxUi.js";
import { renderCleanupView, bindCleanupHandlers } from "./modules/cleanupUi.js";
import {
  renderWeeklyReviewView,
  bindWeeklyReviewHandlers,
} from "./modules/weeklyReviewUi.js";
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
} from "./modules/aiWorkspace.js";
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
} from "./modules/drawerUi.js";
import {
  loadAdminUsers,
  changeUserRole,
  deleteUser,
} from "./modules/adminUsers.js";
import {
  confirmAdminFeedbackDuplicate,
  ignoreDuplicateAndPromote,
  loadAdminFeedbackAutomationPanel,
  loadAdminFeedbackQueue,
  promoteAdminFeedback,
  retryAdminFeedbackAction,
  runAdminFeedbackPromotionPreview,
  runAdminFeedbackAutomation,
  runAdminFeedbackDuplicateCheck,
  saveAdminFeedbackAutomationConfig,
  selectAdminFeedback,
  setAdminFeedbackFilter,
  runAdminFeedbackTriage,
  updateAdminFeedbackStatus,
} from "./modules/adminFeedback.js";
import * as DragDrop from "./modules/dragDrop.js";
import { toggleShortcuts, closeShortcutsOverlay } from "./modules/shortcuts.js";
import {
  getCommandPaletteElements,
  buildCommandPaletteItems,
  getCommandPaletteCommandMatches,
  getCommandPaletteTaskMatches,
  getCommandPaletteRenderModel,
  renderCommandPalette,
  executeCommandPaletteItem,
  moveCommandPaletteSelection,
  closeCommandPalette,
  openCommandPalette,
  toggleCommandPalette,
  bindCommandPaletteHandlers,
} from "./modules/commandPalette.js";
import * as TaskDrawerAssist from "./modules/taskDrawerAssist.js";
import * as OnCreateAssist from "./modules/onCreateAssist.js";
import {
  applyHomeFocusSuggestion,
  dismissHomeFocusSuggestion,
} from "./modules/homeAiService.js";
import { EventBus } from "./modules/eventBus.js";
import { TODOS_CHANGED, TODOS_RENDER } from "./platform/events/eventTypes.js";
import {
  bindDeclarativeHandlers,
  registerServiceWorker,
} from "./bootstrap/initGlobalListeners.js";
import { initTodosFeature } from "./features/todos/initTodosFeature.js";
import { initProjectsFeature } from "./features/projects/initProjectsFeature.js";
import {
  initOnboarding,
  isOnboardingActive,
  advanceOnboarding,
  dismissOnboarding,
  toggleOnboardingArea,
  onboardingStep1Next,
  onboardingAddTask,
  onboardingSetDueDate,
} from "./modules/onboardingFlow.js";

// Configuration
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : window.location.origin;

// debounce, DEBOUNCED_INPUT_EXPRESSIONS, FILTER_INPUT_DEBOUNCE_MS
// moved to bootstrap/initGlobalListeners.js

// ---------------------------------------------------------------------------
// Module consumption — extracted pure-function modules loaded before app.js
// via <script defer> in index.html (see utils/authSession.js, utils/apiClient.js pattern).
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
  HOME_FOCUS_SURFACE,
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
// Lint heuristics provided by utils/lintHeuristics.js (lintTodoFields, renderLintChip)
// ---------------------------------------------------------------------------

// AppState and ApiClient are loaded by utils/authSession.js and utils/apiClient.js (both
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
// PROJECT_PATH_SEPARATOR, MOBILE_DRAWER_MEDIA_QUERY — from utils/utils.js
// ON_CREATE_SURFACE, TODAY_PLAN_SURFACE — from utils/aiSuggestionUtils.js
// AI_DEBUG_ENABLED, AI_SURFACE_TYPES, AI_SURFACE_IMPACT — from utils/aiSuggestionUtils.js
const SIDEBAR_NAV_ITEMS = [];
state.onCreateAssistState.dismissedTodoIds =
  OnCreateAssist.loadOnCreateDismissedTodoIds();
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

const { ensureTodosShellActive, selectWorkspaceView, switchView } =
  createWorkspaceController({
    normalizeWorkspaceView,
    clearHomeListDrilldown,
    setSelectedProjectKey,
    setDateView,
    dispatchTodosChanged: (payload) =>
      EventBus.dispatch(TODOS_CHANGED, payload),
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
    setAdminPaneVisible,
    syncSidebarNavState,
    readStoredAiWorkspaceCollapsedState,
    setAiWorkspaceCollapsed,
    loadTodos,
    loadAiSuggestions,
    loadAiUsage,
    loadAiInsights,
    loadAiFeedbackSummary,
    loadAdminUsers: () => {
      void loadAdminFeedbackAutomationPanel();
      void loadAdminFeedbackQueue();
      void loadAdminUsers();
    },
    prepareFeedbackView,
    clearBulkSelection: () => {
      state.selectedTodos.clear();
      updateBulkActionsVisibility();
      updateSelectAllCheckbox();
    },
  });

// moveProjectHeading, reorderProjectHeadings, moveTodoToHeading
// moved to features/projects/initProjectsFeature.js

// ========== PHASE B: PRIORITY, NOTES, SUBTASKS ==========

function openTodoComposerFromCta() {
  const input = document.getElementById("todoInput");
  if (!(input instanceof HTMLInputElement)) return;
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus();
}

// handleTodoKeyPress, setPriority, getPriorityIcon, toggleNotesInput,
// toggleNotes, renderSubtasks, toggleSubtask, aiBreakdownTodo
// moved to features/todos/initTodosFeature.js

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
      EventBus.dispatch(TODOS_CHANGED);
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

function shouldIgnoreTodoDrawerOpen(target) {
  if (!(target instanceof Element)) return true;
  return !!target.closest(
    "input, button, select, textarea, a, label, [data-onclick], [data-onchange], .drag-handle, .todo-inline-actions, .subtasks-section, .todo-kebab, .todo-kebab-menu",
  );
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

// showMessage, hideMessage, escapeHtml — from utils/utils.js
// toggleTheme, initTheme — from utils/theme.js

// Service worker registration moved to bootstrap/initGlobalListeners.js

// invokeBoundExpression + bindDeclarativeHandlers moved to bootstrap/initGlobalListeners.js

// ---------------------------------------------------------------------------
// Hook wiring — called after all modules are imported so cross-module
// calls through hooks.X?.() resolve to the correct functions.
// ---------------------------------------------------------------------------
(function wireHooks() {
  // drawerUi ↔ filterLogic
  hooks.syncTodoDrawerStateWithRender = syncTodoDrawerStateWithRender;
  // todosService / projectsState / drawerUi → filterLogic
  // domain modules dispatch directly via EventBus; EventBus delivers to subscribers
  hooks.applyFiltersAndRender = (payload) =>
    EventBus.dispatch(TODOS_CHANGED, payload);

  // Subscribe renderers
  EventBus.subscribe(TODOS_CHANGED, applyFiltersAndRender);
  EventBus.subscribe(TODOS_RENDER, renderTodos);
  hooks.updateCategoryFilter = updateCategoryFilter;
  hooks.shouldUseServerVisibleTodos = shouldUseServerVisibleTodos;
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
  hooks.addTodo = addTodo;
  hooks.addTodoFromInlineInput = addTodoFromInlineInput;
  hooks.renderTodos = renderTodos;
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
  hooks.resetOnCreateAssistState = OnCreateAssist.resetOnCreateAssistState;
  hooks.clearPlanDraftState = clearPlanDraftState;
  hooks.setTodosViewBodyState = setTodosViewBodyState;
  hooks.setSettingsPaneVisible = setSettingsPaneVisible;
  hooks.setFeedbackPaneVisible = setFeedbackPaneVisible;
  hooks.setAdminPaneVisible = setAdminPaneVisible;
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
  hooks.getRailPresentationMode = getRailPresentationMode;
  hooks.isMobileViewport = isMobileViewport;
  hooks.onResponsiveLayoutChanged = () => {
    renderProjectsRail();
  };
  // filterLogic → render sub-hooks
  hooks.renderProjectsRail = renderProjectsRail;
  hooks.patchProjectsRailView = patchProjectsRailView;
  hooks.renderHomeDashboard = renderHomeDashboard;
  hooks.renderInboxView = renderInboxView;
  hooks.loadInboxItems = loadInboxItems;
  hooks.renderWeeklyReviewView = renderWeeklyReviewView;
  hooks.renderCleanupView = renderCleanupView;
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
  // New module hooks (task 149)
  hooks.hideMessage = hideMessage;
  // hooks.moveTodoToHeading, hooks.reorderProjectHeadings — set by initProjectsFeature
  hooks.openTodoDrawer = openTodoDrawer;
  hooks.clearHomeListDrilldown = clearHomeListDrilldown;
  hooks.impactRankForSurface = impactRankForSurface;
  hooks.ON_CREATE_SURFACE = ON_CREATE_SURFACE;
  hooks.TODAY_PLAN_SURFACE = TODAY_PLAN_SURFACE;
  hooks.HOME_FOCUS_SURFACE = HOME_FOCUS_SURFACE;
  hooks.isKnownSuggestionType = isKnownSuggestionType;
  hooks.initializeDrawerDraft = initializeDrawerDraft;
  hooks.setDrawerSaveState = setDrawerSaveState;
  hooks.getTodoDrawerElements = getTodoDrawerElements;
  hooks.escapeSelectorValue = TaskDrawerAssist.escapeSelectorValue;
  hooks.buildIcsContentForTodos = buildIcsContentForTodos;
  hooks.buildIcsFilename = buildIcsFilename;
  hooks.clearOnCreateDismissed = OnCreateAssist.clearOnCreateDismissed;
  hooks.closeTaskComposer = closeTaskComposer;
  hooks.filterTodosList = filterTodosList;
  hooks.getHomeDrilldownLabel = getHomeDrilldownLabel;
  hooks.getProjectHeadings = getProjectHeadings;
  hooks.getTodoById = TaskDrawerAssist.getTodoById;
  hooks.getVisibleTodos = getVisibleTodos;
  hooks.isInternalCategoryPath = isInternalCategoryPath;
  hooks.loadOnCreateDecisionAssist = OnCreateAssist.loadOnCreateDecisionAssist;
  hooks.openTaskComposer = openTaskComposer;
  hooks.parseQuickEntryNaturalDue = parseQuickEntryNaturalDue;
  hooks.removeMatchedDatePhraseFromTitle = removeMatchedDatePhraseFromTitle;
  hooks.processQuickEntryNaturalDate = processQuickEntryNaturalDate;
  hooks.renderOnCreateAssistRow = OnCreateAssist.renderOnCreateAssistRow;
  hooks.renderProjectOptions = renderProjectOptions;
  // hooks.renderSubtasks — set by initTodosFeature
  hooks.getProjectRecordByName = getProjectRecordByName;
  hooks.renderTodoChips = TaskDrawerAssist.renderTodoChips;
  hooks.resetQuickEntryNaturalDueState = resetQuickEntryNaturalDueState;
  hooks.selectProjectFromRail = selectProjectFromRail;
  hooks.selectWorkspaceView = selectWorkspaceView;
  // hooks.setPriority — set by initTodosFeature
  hooks.setQuickEntryPropertiesOpen = setQuickEntryPropertiesOpen;
  hooks.setSelectedProjectKey = setSelectedProjectKey;
  hooks.showInputDialog = showInputDialog;
  hooks.syncProjectHeaderActions = syncProjectHeaderActions;
  hooks.syncQuickEntryProjectActions = syncQuickEntryProjectActions;
  hooks.prepareFeedbackView = prepareFeedbackView;
  hooks.syncFeedbackFormCopy = syncFeedbackFormCopy;
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
window.toggleSimpleMode = function (enabled) {
  document.body.classList.toggle("simple-mode", enabled);
  try {
    localStorage.setItem("simpleMode", enabled ? "1" : "0");
  } catch {}
};
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
// Social / phone auth
window.handleGoogleLogin = handleGoogleLogin;
window.handleAppleLogin = handleAppleLogin;
window.showPhoneLogin = showPhoneLogin;
window.handleSendOtp = handleSendOtp;
window.handleVerifyOtp = handleVerifyOtp;
window.handleResendOtp = handleResendOtp;
// Account management
window.handleUnlinkProvider = handleUnlinkProvider;
window.handleSetPassword = handleSetPassword;
// Todo CRUD
window.addTodo = addTodo;
window.filterTodos = filterTodos;
window.clearFilters = clearFilters;
window.setDateView = setDateView;
// handleTodoKeyPress — registered by initTodosFeature
window.exportVisibleTodosToIcs = exportVisibleTodosToIcs;
// Edit modal
window.saveEditedTodo = saveEditedTodo;
window.closeEditTodoModal = closeEditTodoModal;
// Bulk actions
window.toggleSelectAll = toggleSelectAll;
window.completeSelected = completeSelected;
window.deleteSelected = deleteSelected;
window.performUndo = performUndo;
// Todo drawer — opened by clicking todo-content via data-onclick
window.openTodoDrawer = openTodoDrawer;
// Task composer
window.openTaskComposer = openTaskComposer;
window.closeTaskComposer = closeTaskComposer;
window.cancelTaskComposer = cancelTaskComposer;
// toggleNotesInput — registered by initTodosFeature
// setPriority — registered by initTodosFeature
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
window.handleFeedbackTypeChange = handleFeedbackTypeChange;
window.handleFeedbackAttachmentChange = handleFeedbackAttachmentChange;
window.handleFeedbackSubmit = handleFeedbackSubmit;
window.resetFeedbackFormView = resetFeedbackFormView;
// Shortcuts / UI toggles
window.toggleShortcuts = toggleShortcuts;
window.closeShortcutsOverlay = closeShortcutsOverlay;
// Admin
window.handleAdminBootstrap = handleAdminBootstrap;
// Profile
window.handleUpdateProfile = handleUpdateProfile;
// UI Mode
window.setUiMode = function setUiMode(mode) {
  const isSimple = mode === "simple";
  document.body.classList.toggle("simple-mode", isSimple);
  try {
    localStorage.setItem("todos:ui-mode", mode);
  } catch {}
  const select = document.getElementById("uiModeSelect");
  if (select instanceof HTMLSelectElement) select.value = mode;
};
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
// toggleNotes — registered by initTodosFeature
window.toggleSelectTodo = toggleSelectTodo;
// toggleSubtask — registered by initTodosFeature
window.toggleTodoKebab = toggleTodoKebab;
window.openTodoFromKebab = openTodoFromKebab;
window.openEditTodoFromKebab = openEditTodoFromKebab;
window.openDrawerDangerZone = openDrawerDangerZone;
window.openTodoFromHomeTile = openTodoFromHomeTile;
window.moveTodoToProject = moveTodoToProject;
// moveTodoToHeading, moveProjectHeading — registered by initProjectsFeature
// Drag and drop
window.handleDragStart = DragDrop.handleDragStart;
window.handleDragOver = DragDrop.handleDragOver;
window.handleDrop = DragDrop.handleDrop;
window.handleDragEnd = DragDrop.handleDragEnd;
window.handleHeadingDragStart = DragDrop.handleHeadingDragStart;
window.handleHeadingDragOver = DragDrop.handleHeadingDragOver;
window.handleHeadingDrop = DragDrop.handleHeadingDrop;
window.handleHeadingDragEnd = DragDrop.handleHeadingDragEnd;
// AI critique / plan
window.applyCritiqueSuggestion = applyCritiqueSuggestion;
window.applyCritiqueSuggestionMode = applyCritiqueSuggestionMode;
window.dismissCritiqueSuggestion = dismissCritiqueSuggestion;
window.setCritiqueFeedbackReason = setCritiqueFeedbackReason;
// aiBreakdownTodo — registered by initTodosFeature
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
window.archiveProject = archiveProject;
window.unarchiveProject = unarchiveProject;
// Home workspace
window.openHomeProject = openHomeProject;
window.openHomeTileList = openHomeTileList;
window.retryTodaysPlan = retryTodaysPlan;
window.setUpcomingTab = setUpcomingTab;
window.refreshPrioritiesTile = refreshPrioritiesTile;
window.applyHomeFocusSuggestion = applyHomeFocusSuggestion;
window.dismissHomeFocusSuggestion = dismissHomeFocusSuggestion;
// Onboarding flow
window.initOnboarding = initOnboarding;
window.isOnboardingActive = isOnboardingActive;
window.advanceOnboarding = advanceOnboarding;
window.dismissOnboarding = dismissOnboarding;
window.toggleOnboardingArea = toggleOnboardingArea;
window.onboardingStep1Next = onboardingStep1Next;
window.onboardingAddTask = onboardingAddTask;
window.onboardingSetDueDate = onboardingSetDueDate;
// Admin
window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;
window.selectAdminFeedback = selectAdminFeedback;
window.setAdminFeedbackFilter = setAdminFeedbackFilter;
window.runAdminFeedbackDuplicateCheck = runAdminFeedbackDuplicateCheck;
window.confirmAdminFeedbackDuplicate = confirmAdminFeedbackDuplicate;
window.ignoreDuplicateAndPromote = ignoreDuplicateAndPromote;
window.runAdminFeedbackPromotionPreview = runAdminFeedbackPromotionPreview;
window.promoteAdminFeedback = promoteAdminFeedback;
window.retryAdminFeedbackAction = retryAdminFeedbackAction;
window.runAdminFeedbackTriage = runAdminFeedbackTriage;
window.updateAdminFeedbackStatus = updateAdminFeedbackStatus;
window.saveAdminFeedbackAutomationConfig = saveAdminFeedbackAutomationConfig;
window.runAdminFeedbackAutomation = runAdminFeedbackAutomation;

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------
function init() {
  console.warn("[init] START");
  initTodosFeature();
  initProjectsFeature();
  bindResponsiveLayoutState();
  renderSidebarNavigation();
  bindCriticalHandlers();
  bindTodoDrawerHandlers();
  bindInboxHandlers();
  bindWeeklyReviewHandlers();
  bindCleanupHandlers();
  bindProjectsRailHandlers();
  bindCommandPaletteHandlers();
  bindTaskComposerHandlers();
  bindDockHandlers();
  OnCreateAssist.bindOnCreateAssistHandlers();
  bindQuickEntryNaturalDateHandlers();

  // Eagerly load chrono when inline quick-add input is focused
  const inlineQuickAddInput = document.getElementById("inlineQuickAddInput");
  if (inlineQuickAddInput instanceof HTMLInputElement) {
    inlineQuickAddInput.addEventListener(
      "focus",
      () => {
        loadChronoNaturalDateModule();
      },
      { once: true },
    );
  }

  // Handle social login callback before anything else — the URL contains
  // ?auth=success&token=...&refreshToken=... after Google/Apple OAuth redirect.
  handleSocialCallback();

  // Check for password-reset token in URL (only when NOT a social auth callback)
  const urlParams = new URLSearchParams(window.location.search);
  const isSocialCallback = urlParams.has("auth");
  const resetToken = !isSocialCallback ? urlParams.get("token") : null;

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
  OnCreateAssist.renderOnCreateAssistRow();
  setQuickEntryPropertiesOpen(readStoredQuickEntryPropertiesOpenState(), {
    persist: false,
  });
  syncQuickEntryProjectActions();
  renderProjectHeadingCreateButton();
  renderQuickEntryNaturalDueChip();
  handleVerificationStatusFromUrl();
  // handleSocialCallback() moved earlier in init() — before resetToken check
  initSocialLogin();
  bindRailSearchFocusBehavior();
}

// Initialize theme immediately
initTheme();
// Initialize simple mode from localStorage
(function initSimpleMode() {
  const enabled = localStorage.getItem("simpleMode") === "1";
  if (enabled) document.body.classList.add("simple-mode");
  const toggle = document.getElementById("simpleModeToggle");
  if (toggle instanceof HTMLInputElement) toggle.checked = enabled;
})();
// Initialize UI mode from localStorage
(function initUiMode() {
  try {
    const mode = localStorage.getItem("todos:ui-mode") || "advanced";
    if (mode === "simple") {
      document.body.classList.add("simple-mode");
    }
    const select = document.getElementById("uiModeSelect");
    if (select instanceof HTMLSelectElement) select.value = mode;
  } catch {}
})();

// Initialize on load
registerServiceWorker();
bindDeclarativeHandlers();
init();
