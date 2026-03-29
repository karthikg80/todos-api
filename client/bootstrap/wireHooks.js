// wireHooks.js — Cross-module hook wiring.
// Assigns domain functions to the shared `hooks` object so that modules
// can call each other through hooks.X?.() without circular imports.
//
// Extracted from app.js — no behavior change.
// ---------------------------------------------------------------------------

/**
 * @param {object} d — flat bag of every function / constant that hooks needs.
 *   Keys mirror the local names used in app.js at the call-site.
 */
export function wireHooks(d) {
  const { hooks, state, EventBus, TODOS_CHANGED, TODOS_RENDER } = d;

  // drawerUi ↔ filterLogic
  hooks.syncTodoDrawerStateWithRender = d.syncTodoDrawerStateWithRender;
  // todosService / projectsState / drawerUi → filterLogic
  // domain modules dispatch directly via EventBus; EventBus delivers to subscribers
  hooks.applyFiltersAndRender = (payload) =>
    EventBus.dispatch(TODOS_CHANGED, payload);

  // Subscribe renderers
  EventBus.subscribe(TODOS_CHANGED, d.applyFiltersAndRender);
  EventBus.subscribe(TODOS_RENDER, d.renderTodos);
  hooks.updateCategoryFilter = d.updateCategoryFilter;
  hooks.shouldUseServerVisibleTodos = d.shouldUseServerVisibleTodos;
  // todosService / filterLogic → projectsState
  hooks.loadProjects = d.loadProjects;
  hooks.createProjectByName = d.createProjectByName;
  hooks.refreshProjectCatalog = d.refreshProjectCatalog;
  hooks.scheduleLoadSelectedProjectHeadings =
    d.scheduleLoadSelectedProjectHeadings;
  hooks.renderProjectHeadingCreateButton = d.renderProjectHeadingCreateButton;
  // todosService → overlayManager
  hooks.showConfirmDialog = d.showConfirmDialog;
  // app.js orchestrator callbacks
  hooks.updateHeaderAndContextUI = d.updateHeaderAndContextUI;
  // drawerUi / taskDetailSurface → todosService
  hooks.applyTodoPatch = d.applyTodoPatch;
  hooks.deleteTodo = d.deleteTodo;
  hooks.loadTodos = d.loadTodos;
  hooks.addSubtask = async (todoId, title) => {
    await d.apiCall(`${d.API_URL}/todos/${todoId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  };
  hooks.deleteSubtask = async (todoId, subtaskId) => {
    await d.apiCall(`${d.API_URL}/todos/${todoId}/subtasks/${subtaskId}`, {
      method: "DELETE",
    });
  };
  hooks.addTodo = d.addTodo;
  hooks.submitTaskComposerCapture = d.submitTaskComposerCapture;
  hooks.addUndoAction = d.addUndoAction;
  hooks.renderTodos = d.renderTodos;
  hooks.validateTodoTitle = d.validateTodoTitle;
  hooks.toDateInputValue = d.toDateInputValue;
  hooks.toIsoFromDateInput = d.toIsoFromDateInput;
  hooks.openTodoDrawer = d.openTodoDrawer;
  hooks.closeTodoDrawer = d.closeTodoDrawer;
  hooks.seedDrawerDraft = d.seedDrawerDraft;
  hooks.openTaskPage = d.openTaskPage;
  hooks.closeTaskPage = d.closeTaskPage;
  hooks.syncTaskPageRouteFromLocation = d.syncTaskPageRouteFromLocation;
  hooks.renderInlineTaskEditor = d.renderInlineTaskEditor;
  hooks.renderTodoRowHtml = d.renderTodoRowHtml;
  hooks.renderTaskPageSurface = d.renderTaskPageSurface;
  hooks.mountTaskPageDependsPicker = d.mountTaskPageDependsPicker;
  // drawerUi → projectsState
  hooks.getAllProjects = d.getAllProjects;
  hooks.normalizeProjectPath = d.normalizeProjectPath;
  hooks.renderProjectOptionEntry = d.renderProjectOptionEntry;
  hooks.getProjectRecordByName = d.getProjectRecordByName;
  // drawerUi → overlayManager
  hooks.openEditTodoModal = d.openEditTodoModal;
  // overlayManager → todosService
  hooks.toDateTimeLocalValue = d.toDateTimeLocalValue;
  hooks.updateProjectSelectOptions = d.updateProjectSelectOptions;
  // overlayManager → filterLogic
  hooks.syncTodoDrawerStateWithRender = d.syncTodoDrawerStateWithRender;
  // quickEntry → todosService
  hooks.getComposerDependsOnIds = d.getComposerDependsOnIds;
  // Utility hooks (from window.Utils / aiSuggestionUtils)
  hooks.escapeHtml = d.escapeHtml;
  hooks.showMessage = d.showMessage;
  hooks.parseApiBody = d.parseApiBody;
  hooks.normalizeProjectPath = d.normalizeProjectPath;
  hooks.expandProjectTree = d.expandProjectTree;
  hooks.compareProjectPaths = d.compareProjectPaths;
  hooks.getProjectLeafName = d.getProjectLeafName;
  hooks.PROJECT_PATH_SEPARATOR = d.PROJECT_PATH_SEPARATOR;
  // AI utility hooks
  hooks.labelForType = d.labelForType;
  hooks.shouldRenderTypeForSurface = d.shouldRenderTypeForSurface;
  hooks.needsConfirmation = d.needsConfirmation;
  hooks.truncateRationale = d.truncateRationale;
  hooks.capSuggestions = d.capSuggestions;
  hooks.sortSuggestions = d.sortSuggestions;
  hooks.confidenceLabel = d.confidenceLabel;
  hooks.confidenceBand = d.confidenceBand;
  hooks.renderLintChip = d.renderLintChip;
  hooks.renderAiDebugMeta = d.renderAiDebugMeta;
  hooks.renderAiDebugSuggestionId = d.renderAiDebugSuggestionId;
  hooks.lintTodoFields = d.lintTodoFields;
  hooks.emitAiSuggestionUndoTelemetry = d.emitAiSuggestionUndoTelemetry;
  // Config hooks
  hooks.API_URL = d.API_URL;
  hooks.AI_DEBUG_ENABLED = d.AI_DEBUG_ENABLED;
  hooks.FEATURE_ENHANCED_TASK_CRITIC = d.FEATURE_ENHANCED_TASK_CRITIC;
  hooks.FEATURE_TASK_DRAWER_DECISION_ASSIST =
    d.FEATURE_TASK_DRAWER_DECISION_ASSIST;
  hooks.MOBILE_DRAWER_MEDIA_QUERY = d.MOBILE_DRAWER_MEDIA_QUERY;
  hooks.apiCall = d.apiCall;
  hooks.fetchWithTimeout = d.fetchWithTimeout;
  hooks.apiCallWithTimeout = d.apiCallWithTimeout;
  hooks.isAbortError = d.isAbortError;
  // authUi cross-module hooks
  hooks.switchView = d.switchView;
  hooks.closeCommandPalette = d.closeCommandPalette;
  hooks.resetOnCreateAssistState = d.OnCreateAssist.resetOnCreateAssistState;
  hooks.clearPlanDraftState = d.clearPlanDraftState;
  hooks.setTodosViewBodyState = d.setTodosViewBodyState;
  hooks.setSettingsPaneVisible = d.setSettingsPaneVisible;
  hooks.setFeedbackPaneVisible = d.setFeedbackPaneVisible;
  hooks.setAdminPaneVisible = d.setAdminPaneVisible;
  hooks.setProjectsRailCollapsed = d.setProjectsRailCollapsed;
  hooks.readStoredRailCollapsedState = d.readStoredRailCollapsedState;
  hooks.readStoredAiWorkspaceVisibleState = d.readStoredAiWorkspaceVisibleState;
  hooks.readStoredAiWorkspaceCollapsedState =
    d.readStoredAiWorkspaceCollapsedState;
  hooks.setAiWorkspaceVisible = d.setAiWorkspaceVisible;
  hooks.setAiWorkspaceCollapsed = d.setAiWorkspaceCollapsed;
  hooks.closeMoreFilters = d.closeMoreFilters;
  hooks.syncSidebarNavState = d.syncSidebarNavState;
  hooks.loadAiSuggestions = d.loadAiSuggestions;
  hooks.loadAiUsage = d.loadAiUsage;
  hooks.loadAiInsights = d.loadAiInsights;
  hooks.loadAiFeedbackSummary = d.loadAiFeedbackSummary;
  hooks.readStoredQuickEntryPropertiesOpenState =
    d.readStoredQuickEntryPropertiesOpenState;
  hooks.loadUserPlanningPreferences = d.loadUserPlanningPreferences;
  hooks.populateSoulPreferencesForm = d.populateSoulPreferencesForm;
  hooks.updateCritiqueDraftButtonState = d.updateCritiqueDraftButtonState;
  // railUi cross-module hooks
  hooks.DialogManager = d.DialogManager;
  hooks.ensureTodosShellActive = d.ensureTodosShellActive;
  hooks.getRailPresentationMode = d.getRailPresentationMode;
  hooks.isMobileViewport = d.isMobileViewport;
  hooks.onResponsiveLayoutChanged = () => {
    d.renderProjectsRail();
  };
  // filterLogic → render sub-hooks
  hooks.renderProjectsRail = d.renderProjectsRail;
  hooks.patchProjectsRailView = d.patchProjectsRailView;
  hooks.renderHomeDashboard = d.renderHomeDashboard;
  hooks.renderInboxView = d.renderInboxView;
  hooks.loadInboxItems = d.loadInboxItems;
  hooks.isTriageWorkspaceActive = d.isTriageWorkspaceActive;
  hooks.isTodoNeedsOrganizing = d.isTodoNeedsOrganizing;
  hooks.renderWeeklyReviewView = d.renderWeeklyReviewView;
  hooks.renderCleanupView = d.renderCleanupView;
  hooks.updateBulkActionsVisibility = d.updateBulkActionsVisibility;
  hooks.updateAiWorkspaceStatusChip = d.updateAiWorkspaceStatusChip;
  // projectsState → rail
  hooks.renderProjectsRail = d.renderProjectsRail;
  hooks.closeProjectsRailSheet = d.closeProjectsRailSheet;
  // projectsState path utilities
  hooks.renderProjectOptionEntry = d.renderProjectOptionEntry;
  hooks.getSelectedProjectKey = d.getSelectedProjectKey;
  // createInitialTaskDrawerAssistState for drawerUi reset
  hooks.createInitialTaskDrawerAssistState =
    d.createInitialTaskDrawerAssistState;
  // Additional hooks needed by domain modules
  hooks.buildUrl = d.ApiClientModule.buildUrl;
  hooks.buildHomeTileListByKey = d.buildHomeTileListByKey;
  // New module hooks (task 149)
  hooks.hideMessage = d.hideMessage;
  // hooks.moveTodoToHeading, hooks.reorderProjectHeadings — set by initProjectsFeature
  hooks.openTodoDrawer = d.openTodoDrawer;
  hooks.clearHomeListDrilldown = d.clearHomeListDrilldown;
  hooks.impactRankForSurface = d.impactRankForSurface;
  hooks.ON_CREATE_SURFACE = d.ON_CREATE_SURFACE;
  hooks.TODAY_PLAN_SURFACE = d.TODAY_PLAN_SURFACE;
  hooks.HOME_FOCUS_SURFACE = d.HOME_FOCUS_SURFACE;
  hooks.isKnownSuggestionType = d.isKnownSuggestionType;
  hooks.initializeDrawerDraft = d.initializeDrawerDraft;
  hooks.setDrawerSaveState = d.setDrawerSaveState;
  hooks.getTodoDrawerElements = d.getTodoDrawerElements;
  hooks.escapeSelectorValue = d.TaskDrawerAssist.escapeSelectorValue;
  hooks.buildIcsContentForTodos = d.buildIcsContentForTodos;
  hooks.buildIcsFilename = d.buildIcsFilename;
  hooks.clearOnCreateDismissed = d.OnCreateAssist.clearOnCreateDismissed;
  hooks.closeTaskComposer = d.closeTaskComposer;
  hooks.filterTodosList = d.filterTodosList;
  hooks.getHomeDrilldownLabel = d.getHomeDrilldownLabel;
  hooks.getProjectHeadings = d.getProjectHeadings;
  hooks.getTodoById = d.TaskDrawerAssist.getTodoById;
  hooks.getVisibleTodos = d.getVisibleTodos;
  hooks.isInternalCategoryPath = d.isInternalCategoryPath;
  hooks.loadOnCreateDecisionAssist =
    d.OnCreateAssist.loadOnCreateDecisionAssist;
  hooks.openTaskComposer = d.openTaskComposer;
  hooks.parseQuickEntryNaturalDue = d.parseQuickEntryNaturalDue;
  hooks.removeMatchedDatePhraseFromTitle = d.removeMatchedDatePhraseFromTitle;
  hooks.processQuickEntryNaturalDate = d.processQuickEntryNaturalDate;
  hooks.renderOnCreateAssistRow = d.OnCreateAssist.renderOnCreateAssistRow;
  hooks.renderProjectOptions = d.renderProjectOptions;
  // hooks.renderSubtasks — set by initTodosFeature
  hooks.getProjectRecordByName = d.getProjectRecordByName;
  hooks.renderTodoChips = d.TaskDrawerAssist.renderTodoChips;
  hooks.resetQuickEntryNaturalDueState = d.resetQuickEntryNaturalDueState;
  hooks.selectProjectFromRail = d.selectProjectFromRail;
  hooks.selectWorkspaceView = d.selectWorkspaceView;
  hooks.triggerPlanToday = d.generateDayPlan;
  hooks.toggleAiWorkspace = d.toggleAiWorkspace;
  hooks.refreshHomeFocus = d.refreshHomeFocusSuggestions;
  hooks.loadMcpSessions = d.loadMcpSessions;
  hooks.exportCalendar = () => {
    const btn = document.getElementById("exportIcsButton");
    if (btn instanceof HTMLElement) btn.click();
  };
  // hooks.setPriority — set by initTodosFeature
  hooks.setQuickEntryPropertiesOpen = d.setQuickEntryPropertiesOpen;
  hooks.setSelectedProjectKey = d.setSelectedProjectKey;
  hooks.showInputDialog = d.showInputDialog;
  hooks.syncProjectHeaderActions = d.syncProjectHeaderActions;
  hooks.syncQuickEntryProjectActions = d.syncQuickEntryProjectActions;
  hooks.prepareFeedbackView = d.prepareFeedbackView;
  hooks.syncFeedbackFormCopy = d.syncFeedbackFormCopy;
  hooks.updateHeaderFromVisibleTodos = d.updateHeaderFromVisibleTodos;
  hooks.updateQuickEntryPropertiesSummary = d.updateQuickEntryPropertiesSummary;
  hooks.updateTaskComposerDueClearButton = d.updateTaskComposerDueClearButton;
  hooks.updateTopbarProjectsButton = d.updateTopbarProjectsButton;
}
