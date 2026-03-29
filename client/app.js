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
  isTriageWorkspaceActive,
  hasHomeListDrilldown,
  clearHomeListDrilldown,
  normalizeWorkspaceView,
  isTodoNeedsOrganizing,
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
  setActiveTagFilter,
  getUniqueTagsWithCounts,
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
  initTaskDetailSurface,
  bindTaskDetailSurfaceHandlers,
  renderInlineTaskEditor,
  renderTaskPageSurface,
  mountTaskPageDependsPicker,
  openTaskPage,
  closeTaskPage,
  syncTaskPageRouteFromLocation,
} from "./modules/taskDetailSurface.js";
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
  handleSaveSoulPreferences,
  loadUserPlanningPreferences,
  populateSoulPreferencesForm,
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
  getComposerDependsOnIds,
  bindCaptureComposerHandlers,
  submitTaskComposerCapture,
  submitInlineCapture,
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
  startSmallerForTodo,
  moveTodoLater,
  markTodoNotNow,
  dropTodoFromList,
  startRescueMode,
  setNormalDayMode,
  retryTodaysPlan,
  setUpcomingTab,
  getHomeDrilldownLabel,
  startOfLocalDay,
} from "./modules/homeDashboard.js";
import { generateDayPlan } from "./modules/planTodayAgent.js";
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
  seedDrawerDraft,
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
import {
  loadMcpSessions,
  revokeMcpSession,
  revokeAllMcpSessions,
} from "./modules/mcpSessionsUi.js";
import * as TaskDrawerAssist from "./modules/taskDrawerAssist.js";
import * as OnCreateAssist from "./modules/onCreateAssist.js";
import {
  applyHomeFocusSuggestion,
  dismissHomeFocusSuggestion,
  refreshHomeFocusSuggestions,
} from "./modules/homeAiService.js";
import { EventBus } from "./modules/eventBus.js";
import { TODOS_CHANGED, TODOS_RENDER } from "./platform/events/eventTypes.js";
import {
  bindDeclarativeHandlers,
  registerServiceWorker,
} from "./bootstrap/initGlobalListeners.js";
import { wireHooks } from "./bootstrap/wireHooks.js";
import { registerWindowBridge } from "./bootstrap/registerWindowBridge.js";
import { initApp } from "./bootstrap/initApp.js";
import { initTodosFeature } from "./features/todos/initTodosFeature.js";
import { initProjectsFeature } from "./features/projects/initProjectsFeature.js";
import { trackEvent } from "./utils/activityTracker.js";
import {
  initOnboarding,
  isOnboardingActive,
  advanceOnboarding,
  dismissOnboarding,
  toggleOnboardingArea,
  setOnboardingTone,
  onboardingStep1Next,
  toggleOnboardingFailureMode,
  toggleOnboardingGoodDayTheme,
  setOnboardingPlanningStyle,
  setOnboardingEnergyPattern,
  setOnboardingDailyRitual,
  backOnboardingStep,
  finishOnboardingStep2,
  onboardingAddTask,
  finishOnboardingExamples,
  skipOnboardingExamples,
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
    loadInboxItems,
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
    loadMcpSessions,
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

  // Ctrl/Cmd + N: open task composer (works even in inputs)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
    e.preventDefault();
    openTaskComposer();
    return;
  }

  // Ctrl/Cmd + F: Focus on search
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    document.getElementById("searchInput")?.focus();
    return;
  }

  // Ctrl/Cmd + A: Select all todos
  if ((e.ctrlKey || e.metaKey) && e.key === "a") {
    e.preventDefault();
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = true;
      toggleSelectAll();
    }
    return;
  }

  // --- Below: unmodified key shortcuts, skip when typing in an input ---
  var isTyping =
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement ||
    (e.target instanceof HTMLElement && e.target.isContentEditable);
  if (isTyping) return;

  // N: open task composer
  if (e.key.toLowerCase() === "n" && !e.altKey) {
    e.preventDefault();
    openTaskComposer();
    return;
  }

  // /: Focus search
  if (e.key === "/" && !e.isComposing) {
    e.preventDefault();
    document.getElementById("searchInput")?.focus();
    return;
  }

  // ?: Show keyboard shortcuts
  if (e.key === "?") {
    e.preventDefault();
    toggleShortcuts();
    return;
  }

  // --- Task-level shortcuts (require a focused .todo-item) ---
  var focusedRow =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.closest(".todo-item[data-todo-id]")
      : null;

  // ↑/↓: Navigate between todo items
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    var allRows = Array.from(
      document.querySelectorAll(".todos-list .todo-item[data-todo-id]"),
    );
    if (allRows.length === 0) return;
    var currentIndex = focusedRow ? allRows.indexOf(focusedRow) : -1;
    var nextIndex =
      e.key === "ArrowDown"
        ? Math.min(currentIndex + 1, allRows.length - 1)
        : Math.max(currentIndex - 1, 0);
    if (allRows[nextIndex] instanceof HTMLElement) {
      e.preventDefault();
      allRows[nextIndex].focus();
    }
    return;
  }

  if (!focusedRow) return;
  var todoId = focusedRow.getAttribute("data-todo-id");
  if (!todoId) return;

  // Enter: Open drawer for focused task
  if (e.key === "Enter") {
    e.preventDefault();
    openTodoDrawer(todoId);
    return;
  }

  // Delete/Backspace: Delete focused task
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    deleteTodo(todoId);
    return;
  }

  // T: Set due date to today
  if (e.key.toLowerCase() === "t") {
    e.preventDefault();
    var today = new Date();
    today.setHours(23, 59, 0, 0);
    applyTodoPatch(todoId, { dueDate: today.toISOString() });
    return;
  }

  // S: Set status to someday (clear due date)
  if (e.key.toLowerCase() === "s") {
    e.preventDefault();
    applyTodoPatch(todoId, { status: "someday", dueDate: null });
    return;
  }

  // D: Set due date via prompt
  if (e.key.toLowerCase() === "d") {
    e.preventDefault();
    openTodoDrawer(todoId);
    // Drawer will open with date fields accessible
    return;
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
    // Sync theme label
    var isDark = document.body.classList.contains("dark-mode");
    var themeLabel = panel.querySelector(".dock-theme-label");
    if (themeLabel)
      themeLabel.textContent = isDark ? "Light mode" : "Dark mode";
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
// Bootstrap wiring — delegates to extracted bootstrap modules.
// Each call receives a deps bag of every function / constant it needs.
// ---------------------------------------------------------------------------
// --- wireHooks deps ---
wireHooks({
  hooks,
  state,
  EventBus,
  TODOS_CHANGED,
  TODOS_RENDER,
  AI_DEBUG_ENABLED,
  API_URL,
  ApiClientModule,
  DialogManager,
  FEATURE_ENHANCED_TASK_CRITIC,
  FEATURE_TASK_DRAWER_DECISION_ASSIST,
  HOME_FOCUS_SURFACE,
  MOBILE_DRAWER_MEDIA_QUERY,
  ON_CREATE_SURFACE,
  OnCreateAssist,
  PROJECT_PATH_SEPARATOR,
  TODAY_PLAN_SURFACE,
  TaskDrawerAssist,
  addTodo,
  addUndoAction,
  apiCall,
  apiCallWithTimeout,
  applyFiltersAndRender,
  applyTodoPatch,
  buildHomeTileListByKey,
  buildIcsContentForTodos,
  buildIcsFilename,
  capSuggestions,
  clearHomeListDrilldown,
  clearPlanDraftState,
  closeCommandPalette,
  closeMoreFilters,
  closeProjectsRailSheet,
  closeTaskComposer,
  closeTaskPage,
  closeTodoDrawer,
  compareProjectPaths,
  confidenceBand,
  confidenceLabel,
  createInitialTaskDrawerAssistState,
  createProjectByName,
  deleteTodo,
  emitAiSuggestionUndoTelemetry,
  ensureTodosShellActive,
  escapeHtml,
  expandProjectTree,
  fetchWithTimeout,
  filterTodosList,
  generateDayPlan,
  getAllProjects,
  getComposerDependsOnIds,
  getHomeDrilldownLabel,
  getProjectHeadings,
  getProjectLeafName,
  getProjectRecordByName,
  getRailPresentationMode,
  getSelectedProjectKey,
  getTodoDrawerElements,
  getVisibleTodos,
  hideMessage,
  impactRankForSurface,
  initializeDrawerDraft,
  isAbortError,
  isInternalCategoryPath,
  isKnownSuggestionType,
  isMobileViewport,
  isTodoNeedsOrganizing,
  isTriageWorkspaceActive,
  labelForType,
  lintTodoFields,
  loadAiFeedbackSummary,
  loadAiInsights,
  loadAiSuggestions,
  loadAiUsage,
  loadInboxItems,
  loadMcpSessions,
  loadProjects,
  loadTodos,
  loadUserPlanningPreferences,
  mountTaskPageDependsPicker,
  needsConfirmation,
  normalizeProjectPath,
  openEditTodoModal,
  openTaskComposer,
  openTaskPage,
  openTodoDrawer,
  parseApiBody,
  parseQuickEntryNaturalDue,
  patchProjectsRailView,
  populateSoulPreferencesForm,
  prepareFeedbackView,
  processQuickEntryNaturalDate,
  readStoredAiWorkspaceCollapsedState,
  readStoredAiWorkspaceVisibleState,
  readStoredQuickEntryPropertiesOpenState,
  readStoredRailCollapsedState,
  refreshHomeFocusSuggestions,
  refreshProjectCatalog,
  removeMatchedDatePhraseFromTitle,
  renderAiDebugMeta,
  renderAiDebugSuggestionId,
  renderCleanupView,
  renderHomeDashboard,
  renderInboxView,
  renderInlineTaskEditor,
  renderLintChip,
  renderProjectHeadingCreateButton,
  renderProjectOptionEntry,
  renderProjectOptions,
  renderProjectsRail,
  renderTaskPageSurface,
  renderTodoRowHtml,
  renderTodos,
  renderWeeklyReviewView,
  resetQuickEntryNaturalDueState,
  scheduleLoadSelectedProjectHeadings,
  seedDrawerDraft,
  selectProjectFromRail,
  selectWorkspaceView,
  setAdminPaneVisible,
  setAiWorkspaceCollapsed,
  setAiWorkspaceVisible,
  setDrawerSaveState,
  setFeedbackPaneVisible,
  setProjectsRailCollapsed,
  setQuickEntryPropertiesOpen,
  setSelectedProjectKey,
  setSettingsPaneVisible,
  setTodosViewBodyState,
  shouldRenderTypeForSurface,
  shouldUseServerVisibleTodos,
  showConfirmDialog,
  showInputDialog,
  showMessage,
  sortSuggestions,
  submitTaskComposerCapture,
  switchView,
  syncFeedbackFormCopy,
  syncProjectHeaderActions,
  syncQuickEntryProjectActions,
  syncSidebarNavState,
  syncTaskPageRouteFromLocation,
  syncTodoDrawerStateWithRender,
  toDateInputValue,
  toDateTimeLocalValue,
  toIsoFromDateInput,
  toggleAiWorkspace,
  truncateRationale,
  updateAiWorkspaceStatusChip,
  updateBulkActionsVisibility,
  updateCategoryFilter,
  updateCritiqueDraftButtonState,
  updateHeaderAndContextUI,
  updateHeaderFromVisibleTodos,
  updateProjectSelectOptions,
  updateQuickEntryPropertiesSummary,
  updateTaskComposerDueClearButton,
  updateTopbarProjectsButton,
  validateTodoTitle,
});

// --- registerWindowBridge deps ---
registerWindowBridge({
  DragDrop,
  addPlanTasksToTodos,
  addTodo,
  advanceOnboarding,
  applyCritiqueSuggestion,
  applyCritiqueSuggestionMode,
  applyHomeFocusSuggestion,
  archiveProject,
  backOnboardingStep,
  cancelTaskComposer,
  changeUserRole,
  clearBrainDumpInput,
  clearFilters,
  clearTaskComposerDueDate,
  closeEditTodoModal,
  closeProfilePanel,
  closeShortcutsOverlay,
  closeTaskComposer,
  completeSelected,
  confirmAdminFeedbackDuplicate,
  createHeadingForSelectedProject,
  createProject,
  createSubproject,
  critiqueDraftWithAi,
  deleteSelected,
  deleteUser,
  dismissCritiqueSuggestion,
  dismissHomeFocusSuggestion,
  dismissOnboarding,
  dismissPlanSuggestion,
  draftPlanFromBrainDumpWithAi,
  dropTodoFromList,
  exportVisibleTodosToIcs,
  filterTodos,
  finishOnboardingExamples,
  finishOnboardingStep2,
  generatePlanWithAi,
  handleAdminBootstrap,
  handleAppleLogin,
  handleForgotPassword,
  handleGoogleLogin,
  handleLogin,
  handleRegister,
  handleResendOtp,
  handleResetPassword,
  handleSaveSoulPreferences,
  handleSendOtp,
  handleSetPassword,
  handleUnlinkProvider,
  handleUpdateProfile,
  handleVerifyOtp,
  hooks,
  ignoreDuplicateAndPromote,
  initOnboarding,
  isOnboardingActive,
  logout,
  markTodoNotNow,
  moveTodoLater,
  moveTodoToProject,
  onboardingAddTask,
  onboardingSetDueDate,
  onboardingStep1Next,
  openAiWorkspaceForBrainDump,
  openAiWorkspaceForGoalPlan,
  openDrawerDangerZone,
  openEditTodoFromKebab,
  openHomeProject,
  openHomeTileList,
  openProjectsFromTopbar,
  openTaskComposer,
  openTodoDrawer,
  openTodoFromHomeTile,
  openTodoFromKebab,
  performUndo,
  promoteAdminFeedback,
  refreshPrioritiesTile,
  renameProjectTree,
  resendVerification,
  resetPlanDraft,
  retryAdminFeedbackAction,
  retryLoadTodos,
  retryMarkPlanSuggestionAccepted,
  retryTodaysPlan,
  revokeAllMcpSessions,
  revokeMcpSession,
  runAdminFeedbackAutomation,
  runAdminFeedbackDuplicateCheck,
  runAdminFeedbackPromotionPreview,
  runAdminFeedbackTriage,
  saveAdminFeedbackAutomationConfig,
  saveEditedTodo,
  selectAdminFeedback,
  selectAllPlanDraftTasks,
  selectNoPlanDraftTasks,
  setActiveTagFilter,
  setAdminFeedbackFilter,
  setCritiqueFeedbackReason,
  setDateView,
  setNormalDayMode,
  setOnboardingDailyRitual,
  setOnboardingEnergyPattern,
  setOnboardingPlanningStyle,
  setOnboardingTone,
  setPlanDraftTaskSelected,
  setSelectedProjectKey,
  setUpcomingTab,
  showForgotPassword,
  showLogin,
  showPhoneLogin,
  skipOnboardingExamples,
  startRescueMode,
  startSmallerForTodo,
  state,
  submitInlineCapture,
  submitTaskComposerCapture,
  switchAuthTab,
  switchView,
  syncSheetSearch,
  toggleOnboardingArea,
  toggleOnboardingFailureMode,
  toggleOnboardingGoodDayTheme,
  toggleProfilePanel,
  toggleSelectAll,
  toggleSelectTodo,
  toggleShortcuts,
  toggleTheme,
  toggleTodo,
  toggleTodoKebab,
  unarchiveProject,
  updateAdminFeedbackStatus,
  updatePlanDraftTaskDescription,
  updatePlanDraftTaskDueDate,
  updatePlanDraftTaskPriority,
  updatePlanDraftTaskProject,
  updatePlanDraftTaskTitle,
});

// --- initApp deps ---
initApp({
  AUTH_STATE,
  OnCreateAssist,
  bindCaptureComposerHandlers,
  bindCleanupHandlers,
  bindCommandPaletteHandlers,
  bindCriticalHandlers,
  bindDockHandlers,
  bindInboxHandlers,
  bindProjectsRailHandlers,
  bindQuickEntryNaturalDateHandlers,
  bindRailSearchFocusBehavior,
  bindResponsiveLayoutState,
  bindTaskComposerHandlers,
  bindTaskDetailSurfaceHandlers,
  bindTodoDrawerHandlers,
  bindWeeklyReviewHandlers,
  handleSocialCallback,
  handleVerificationStatusFromUrl,
  hooks,
  initProjectsFeature,
  initSocialLogin,
  initTaskDetailSurface,
  initTheme,
  initTodosFeature,
  loadStoredSession,
  loadTodos,
  loadUserProfile,
  persistSession,
  readStoredQuickEntryPropertiesOpenState,
  renderProjectHeadingCreateButton,
  renderQuickEntryNaturalDueChip,
  renderSidebarNavigation,
  setAuthState,
  setQuickEntryPropertiesOpen,
  showAppView,
  showResetPassword,
  state,
  syncQuickEntryProjectActions,
  trackEvent,
});
