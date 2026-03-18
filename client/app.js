// =============================================================================
// ES6 Module Imports
// =============================================================================
import {
  state,
  hooks,
  createInitialTaskDrawerAssistState,
  createInitialOnCreateAssistState,
  createInitialTodayPlanState,
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
  getHomeDrilldownLabel,
  clearHomeFocusDashboard,
  startOfLocalDay,
  getTodoDueSummary,
  formatDashboardDueChip,
  getDashboardReasonLine,
  getTodoRecencyDays,
  renderTopFocusRow,
  renderHomeFocusDashboard,
} from "./modules/homeDashboard.js";
import {
  renderInboxView,
  loadInboxItems,
  bindInboxHandlers,
} from "./modules/inboxUi.js";
import {
  renderDayPlanAgentPanel,
  bindDayPlanAgentHandlers,
} from "./modules/planTodayAgent.js";
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
  renderAdminUsers,
  changeUserRole,
  deleteUser,
} from "./modules/adminUsers.js";
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
import * as TodayPlan from "./modules/todayPlan.js";
import {
  applyHomeFocusSuggestion,
  dismissHomeFocusSuggestion,
} from "./modules/homeAiService.js";
import { EventBus } from "./modules/eventBus.js";

// Configuration
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : window.location.origin;

// Debounce utility — no external dependency.
// Fires on the leading edge (immediate on first call) and again on the
// trailing edge (ms after the last call), so single-event triggers (e.g.
// Playwright fill()) respond instantly while rapid keystrokes are batched.
const FILTER_INPUT_DEBOUNCE_MS = 180;
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

const DEBOUNCED_INPUT_EXPRESSIONS = new Set([
  "filterTodos()",
  "syncSheetSearch()",
]);

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
      EventBus.dispatch("todos:changed", payload),
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
    syncSidebarNavState,
    readStoredAiWorkspaceCollapsedState,
    setAiWorkspaceCollapsed,
    loadTodos,
    loadAiSuggestions,
    loadAiUsage,
    loadAiInsights,
    loadAiFeedbackSummary,
    loadAdminUsers,
  });

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

  // Only search/filter inputs are debounced; other input handlers stay
  // immediate so task composition and assist surfaces remain responsive.
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
      if (
        eventType === "input" &&
        DEBOUNCED_INPUT_EXPRESSIONS.has(expression)
      ) {
        let fn = inputDebouncedInvokers.get(expression);
        if (!fn) {
          fn = debounce(
            (expr, ev, el) => invokeBoundExpression(expr, ev, el),
            FILTER_INPUT_DEBOUNCE_MS,
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
  // domain modules dispatch directly via EventBus; EventBus delivers to subscribers
  hooks.applyFiltersAndRender = (payload) =>
    EventBus.dispatch("todos:changed", payload);

  // Subscribe renderers
  EventBus.subscribe("todos:changed", applyFiltersAndRender);
  EventBus.subscribe("todos:render", renderTodos);
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
  hooks.resetTodayPlanState = TodayPlan.resetTodayPlanState;
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
  hooks.getRailPresentationMode = getRailPresentationMode;
  hooks.isMobileViewport = isMobileViewport;
  hooks.onResponsiveLayoutChanged = () => {
    renderProjectsRail();
  };
  // filterLogic → render sub-hooks
  hooks.renderProjectsRail = renderProjectsRail;
  hooks.patchProjectsRailView = patchProjectsRailView;
  hooks.renderTodayPlanPanel = TodayPlan.renderTodayPlanPanel;
  hooks.renderDayPlanAgentPanel = renderDayPlanAgentPanel;
  hooks.clearHomeFocusDashboard = clearHomeFocusDashboard;
  hooks.renderHomeDashboard = renderHomeDashboard;
  hooks.renderInboxView = renderInboxView;
  hooks.loadInboxItems = loadInboxItems;
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
  hooks.moveTodoToHeading = moveTodoToHeading;
  hooks.reorderProjectHeadings = reorderProjectHeadings;
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
  hooks.processQuickEntryNaturalDate = processQuickEntryNaturalDate;
  hooks.renderHomeFocusDashboard = renderHomeFocusDashboard;
  hooks.renderOnCreateAssistRow = OnCreateAssist.renderOnCreateAssistRow;
  hooks.renderProjectOptions = renderProjectOptions;
  hooks.renderSubtasks = renderSubtasks;
  hooks.getProjectRecordByName = getProjectRecordByName;
  hooks.renderTodoChips = TaskDrawerAssist.renderTodoChips;
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
window.archiveProject = archiveProject;
window.unarchiveProject = unarchiveProject;
// Home workspace
window.openHomeProject = openHomeProject;
window.openHomeTileList = openHomeTileList;
window.applyHomeFocusSuggestion = applyHomeFocusSuggestion;
window.dismissHomeFocusSuggestion = dismissHomeFocusSuggestion;
// Admin
window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------
function init() {
  bindResponsiveLayoutState();
  renderSidebarNavigation();
  bindCriticalHandlers();
  bindTodoDrawerHandlers();
  bindInboxHandlers();
  bindDayPlanAgentHandlers();
  bindProjectsRailHandlers();
  bindCommandPaletteHandlers();
  bindTaskComposerHandlers();
  bindDockHandlers();
  OnCreateAssist.bindOnCreateAssistHandlers();
  TodayPlan.bindTodayPlanHandlers();
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
  OnCreateAssist.renderOnCreateAssistRow();
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
