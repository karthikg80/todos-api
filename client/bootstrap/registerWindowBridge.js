// registerWindowBridge.js — Expose module-scoped functions to window.
// All functions referenced via data-onclick / data-onsubmit / data-onchange
// in HTML must be on window because app.js is an ES module.
//
// Extracted from app.js — no behavior change.
// ---------------------------------------------------------------------------

/**
 * @param {object} d — flat bag of every function that HTML data-on* attributes reference.
 *   Keys mirror the local names used in app.js at the call-site.
 */
export function registerWindowBridge(d) {
  window.toggleTheme = d.toggleTheme;
  window.revokeMcpSession = d.revokeMcpSession;
  window.revokeAllMcpSessions = d.revokeAllMcpSessions;
  // toggleSimpleMode removed — single control is #uiModeSelect via setUiMode()
  window.openProjectsFromTopbar = d.openProjectsFromTopbar;
  // Auth forms
  window.switchAuthTab = d.switchAuthTab;
  window.showForgotPassword = d.showForgotPassword;
  window.showLogin = d.showLogin;
  window.showAuthPage = function showAuthPage(tab) {
    var landing = document.getElementById("landingPage");
    var authForm = document.getElementById("authFormSection");
    if (landing) landing.classList.remove("auth-landing-active");
    if (authForm) authForm.classList.add("auth-page--active");
    d.switchAuthTab(tab || "login");
    var scroll = document.getElementById("appMainScroll");
    if (scroll) scroll.scrollTop = 0;
  };
  window.showLandingPage = function showLandingPage() {
    var landing = document.getElementById("landingPage");
    var authForm = document.getElementById("authFormSection");
    if (landing) landing.classList.add("auth-landing-active");
    if (authForm) authForm.classList.remove("auth-page--active");
    var scroll = document.getElementById("appMainScroll");
    if (scroll) scroll.scrollTop = 0;
  };
  window.handleLogin = d.handleLogin;
  window.handleRegister = d.handleRegister;
  window.handleForgotPassword = d.handleForgotPassword;
  window.handleResetPassword = d.handleResetPassword;
  window.resendVerification = d.resendVerification;
  // Social / phone auth
  window.handleGoogleLogin = d.handleGoogleLogin;
  window.handleAppleLogin = d.handleAppleLogin;
  window.showPhoneLogin = d.showPhoneLogin;
  window.handleSendOtp = d.handleSendOtp;
  window.handleVerifyOtp = d.handleVerifyOtp;
  window.handleResendOtp = d.handleResendOtp;
  // Account management
  window.handleUnlinkProvider = d.handleUnlinkProvider;
  window.handleSetPassword = d.handleSetPassword;
  // Todo CRUD
  window.addTodo = d.addTodo;
  window.submitTaskComposerCapture = d.submitTaskComposerCapture;
  window.handleInlineQuickAddKeyPress = function handleInlineQuickAddKeyPress(
    event,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      d.submitInlineCapture();
    }
  };
  window.filterTodos = d.filterTodos;
  window.clearFilters = d.clearFilters;
  window.setDateView = d.setDateView;
  // handleTodoKeyPress — registered by initTodosFeature
  window.exportVisibleTodosToIcs = d.exportVisibleTodosToIcs;
  // Edit modal
  window.saveEditedTodo = d.saveEditedTodo;
  window.closeEditTodoModal = d.closeEditTodoModal;
  // Bulk actions
  window.toggleSelectAll = d.toggleSelectAll;
  window.completeSelected = d.completeSelected;
  window.deleteSelected = d.deleteSelected;
  window.performUndo = d.performUndo;
  // Todo drawer — opened by clicking todo-content via data-onclick
  window.openTodoDrawer = d.openTodoDrawer;
  // Task composer
  window.openTaskComposer = d.openTaskComposer;
  window.closeTaskComposer = d.closeTaskComposer;
  window.cancelTaskComposer = d.cancelTaskComposer;
  // toggleNotesInput — registered by initTodosFeature
  // setPriority — registered by initTodosFeature
  window.clearTaskComposerDueDate = d.clearTaskComposerDueDate;
  // Projects
  window.createProject = d.createProject;
  window.createSubproject = d.createSubproject;
  window.renameProjectTree = d.renameProjectTree;
  // Project key selection (used directly by UI tests via page.evaluate)
  window.setSelectedProjectKey = d.setSelectedProjectKey;
  window.toggleTagFilter = function toggleTagFilter(tag) {
    var current = d.state.activeTagFilter;
    d.setActiveTagFilter(current === tag ? "" : tag);
  };
  // Views / navigation
  window.switchView = d.switchView;
  window.toggleProfilePanel = d.toggleProfilePanel;
  window.profileNavTo = function profileNavTo(view) {
    d.closeProfilePanel({ restoreFocus: false });
    d.switchView(view);
  };
  window.profileToggleTheme = function profileToggleTheme() {
    d.toggleTheme();
    // Update the label inside the panel
    var isDark = document.body.classList.contains("dark-mode");
    var label = document.querySelector(".dock-theme-label");
    if (label) label.textContent = isDark ? "Light mode" : "Dark mode";
  };
  window.logout = d.logout;
  // Feedback form moved to standalone /feedback/new page — bridges removed
  // Shortcuts / UI toggles
  window.toggleShortcuts = d.toggleShortcuts;
  window.closeShortcutsOverlay = d.closeShortcutsOverlay;
  // Admin
  window.handleAdminBootstrap = d.handleAdminBootstrap;
  // Profile
  window.handleUpdateProfile = d.handleUpdateProfile;
  window.handleSaveSoulPreferences = d.handleSaveSoulPreferences;
  // UI Mode
  window.setUiMode = function setUiMode(mode) {
    const isSimple = mode === "simple";
    document.body.classList.toggle("simple-mode", isSimple);
    try {
      localStorage.setItem("todos:ui-mode", mode);
      localStorage.removeItem("simpleMode"); // clean up legacy key
    } catch {}
    // Sync both UI controls (both are <select> elements now)
    const select = document.getElementById("uiModeSelect");
    if (select instanceof HTMLSelectElement) select.value = mode;
    const toggle = document.getElementById("simpleModeToggle");
    if (toggle instanceof HTMLSelectElement) toggle.value = mode;
    // Redirect away from hidden workspace views by clicking the "All" button
    if (isSimple) {
      const active = document.querySelector(
        ".workspace-view-item.projects-rail-item--active",
      );
      const view = active?.getAttribute("data-workspace-view");
      if (view && ["home", "triage"].includes(view)) {
        const allBtn = document.querySelector(
          '[data-workspace-view="all"].workspace-view-item',
        );
        if (allBtn instanceof HTMLElement) allBtn.click();
      }
    }
  };
  // AI workspace
  window.openAiWorkspaceForBrainDump = d.openAiWorkspaceForBrainDump;
  window.openAiWorkspaceForGoalPlan = d.openAiWorkspaceForGoalPlan;
  window.critiqueDraftWithAi = d.critiqueDraftWithAi;
  window.generatePlanWithAi = d.generatePlanWithAi;
  window.draftPlanFromBrainDumpWithAi = d.draftPlanFromBrainDumpWithAi;
  window.clearBrainDumpInput = d.clearBrainDumpInput;
  // Search / filters
  window.syncSheetSearch = d.syncSheetSearch;
  // Todo interactions (from dynamically-rendered HTML)
  window.retryLoadTodos = d.retryLoadTodos;
  window.toggleTodo = d.toggleTodo;
  // toggleNotes — registered by initTodosFeature
  window.toggleSelectTodo = d.toggleSelectTodo;
  // toggleSubtask — registered by initTodosFeature
  window.toggleTodoKebab = d.toggleTodoKebab;
  window.openTodoFromKebab = d.openTodoFromKebab;
  window.openEditTodoFromKebab = d.openEditTodoFromKebab;
  window.openDrawerDangerZone = d.openDrawerDangerZone;
  window.openTodoFromHomeTile = d.openTodoFromHomeTile;
  window.moveTodoToProject = d.moveTodoToProject;
  // moveTodoToHeading, moveProjectHeading — registered by initProjectsFeature
  // Drag and drop
  window.handleDragStart = d.DragDrop.handleDragStart;
  window.handleDragOver = d.DragDrop.handleDragOver;
  window.handleDrop = d.DragDrop.handleDrop;
  window.handleDragEnd = d.DragDrop.handleDragEnd;
  window.handleHeadingDragStart = d.DragDrop.handleHeadingDragStart;
  window.handleHeadingDragOver = d.DragDrop.handleHeadingDragOver;
  window.handleHeadingDrop = d.DragDrop.handleHeadingDrop;
  window.handleHeadingDragEnd = d.DragDrop.handleHeadingDragEnd;
  // AI critique / plan
  window.applyCritiqueSuggestion = d.applyCritiqueSuggestion;
  window.applyCritiqueSuggestionMode = d.applyCritiqueSuggestionMode;
  window.dismissCritiqueSuggestion = d.dismissCritiqueSuggestion;
  window.setCritiqueFeedbackReason = d.setCritiqueFeedbackReason;
  // aiBreakdownTodo — registered by initTodosFeature
  window.dismissPlanSuggestion = d.dismissPlanSuggestion;
  window.resetPlanDraft = d.resetPlanDraft;
  window.addPlanTasksToTodos = d.addPlanTasksToTodos;
  window.selectAllPlanDraftTasks = d.selectAllPlanDraftTasks;
  window.selectNoPlanDraftTasks = d.selectNoPlanDraftTasks;
  window.setPlanDraftTaskSelected = d.setPlanDraftTaskSelected;
  window.updatePlanDraftTaskTitle = d.updatePlanDraftTaskTitle;
  window.updatePlanDraftTaskDescription = d.updatePlanDraftTaskDescription;
  window.updatePlanDraftTaskDueDate = d.updatePlanDraftTaskDueDate;
  window.updatePlanDraftTaskPriority = d.updatePlanDraftTaskPriority;
  window.updatePlanDraftTaskProject = d.updatePlanDraftTaskProject;
  window.retryMarkPlanSuggestionAccepted = d.retryMarkPlanSuggestionAccepted;
  // Projects / headings
  window.createHeadingForSelectedProject = d.createHeadingForSelectedProject;
  window.archiveProject = d.archiveProject;
  window.unarchiveProject = d.unarchiveProject;
  // Home workspace
  window.openHomeProject = d.openHomeProject;
  window.openHomeTileList = d.openHomeTileList;
  window.startSmallerForTodo = d.startSmallerForTodo;
  window.moveTodoLater = d.moveTodoLater;
  window.markTodoNotNow = d.markTodoNotNow;
  window.dropTodoFromList = d.dropTodoFromList;
  window.startRescueMode = d.startRescueMode;
  window.setNormalDayMode = d.setNormalDayMode;
  window.retryTodaysPlan = d.retryTodaysPlan;
  window.setUpcomingTab = d.setUpcomingTab;
  window.refreshPrioritiesTile = d.refreshPrioritiesTile;
  window.applyHomeFocusSuggestion = d.applyHomeFocusSuggestion;
  window.dismissHomeFocusSuggestion = d.dismissHomeFocusSuggestion;
  // Onboarding flow
  window.initOnboarding = d.initOnboarding;
  window.restartOnboarding = async function () {
    try {
      await d.hooks.apiCall(`${d.hooks.API_URL}/users/me/onboarding/restart`, {
        method: "POST",
      });
      // Reset client state and re-init
      if (d.state.currentUser) {
        d.state.currentUser.onboardingCompletedAt = null;
        d.state.currentUser.onboardingStep = 0;
      }
      d.hooks.selectWorkspaceView?.("home");
      window.location.reload();
    } catch (e) {
      console.error("Restart onboarding failed:", e);
      d.hooks.showMessage?.(
        "profileMessage",
        "Could not restart tour",
        "error",
      );
    }
  };
  window.isOnboardingActive = d.isOnboardingActive;
  window.advanceOnboarding = d.advanceOnboarding;
  window.dismissOnboarding = d.dismissOnboarding;
  window.toggleOnboardingArea = d.toggleOnboardingArea;
  window.setOnboardingTone = d.setOnboardingTone;
  window.onboardingStep1Next = d.onboardingStep1Next;
  window.toggleOnboardingFailureMode = d.toggleOnboardingFailureMode;
  window.toggleOnboardingGoodDayTheme = d.toggleOnboardingGoodDayTheme;
  window.setOnboardingPlanningStyle = d.setOnboardingPlanningStyle;
  window.setOnboardingEnergyPattern = d.setOnboardingEnergyPattern;
  window.setOnboardingDailyRitual = d.setOnboardingDailyRitual;
  window.backOnboardingStep = d.backOnboardingStep;
  window.finishOnboardingStep2 = d.finishOnboardingStep2;
  window.onboardingAddTask = d.onboardingAddTask;
  window.finishOnboardingExamples = d.finishOnboardingExamples;
  window.skipOnboardingExamples = d.skipOnboardingExamples;
  window.onboardingSetDueDate = d.onboardingSetDueDate;
  // Admin
  window.changeUserRole = d.changeUserRole;
  window.deleteUser = d.deleteUser;
  window.selectAdminFeedback = d.selectAdminFeedback;
  window.setAdminFeedbackFilter = d.setAdminFeedbackFilter;
  window.runAdminFeedbackDuplicateCheck = d.runAdminFeedbackDuplicateCheck;
  window.confirmAdminFeedbackDuplicate = d.confirmAdminFeedbackDuplicate;
  window.ignoreDuplicateAndPromote = d.ignoreDuplicateAndPromote;
  window.runAdminFeedbackPromotionPreview = d.runAdminFeedbackPromotionPreview;
  window.promoteAdminFeedback = d.promoteAdminFeedback;
  window.retryAdminFeedbackAction = d.retryAdminFeedbackAction;
  window.runAdminFeedbackTriage = d.runAdminFeedbackTriage;
  window.updateAdminFeedbackStatus = d.updateAdminFeedbackStatus;
  window.saveAdminFeedbackAutomationConfig =
    d.saveAdminFeedbackAutomationConfig;
  window.runAdminFeedbackAutomation = d.runAdminFeedbackAutomation;
}
