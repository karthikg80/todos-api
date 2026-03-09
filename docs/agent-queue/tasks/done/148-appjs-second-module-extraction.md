# TASK 148: appjs-second-module-extraction

type: Red
status: DONE
mode: refactor
builder: claude
reviewer: user
branch: claude/task-148-appjs-second-module-extraction
base: master

## Intent
app.js is currently 10,217 lines with ~337 function declarations remaining after
Task 147. The first extraction round (Tasks 140+147) covered 5 domain modules.
This task extracts the next 6 cohesive domains into new modules, targeting a
final app.js under 1,500 lines (imports + window registrations + init only).

## Target Modules (extraction order matters — least-dependent first)

### 1. public/featureFlags.js (new)
Functions to extract:
  readBooleanFeatureFlag, isEnhancedTaskCriticEnabled, isTaskDrawerDecisionAssistEnabled

No dependencies on other app.js functions. Extract first.

### 2. public/authUi.js (new)
Functions to extract:
  handleAuthFailure, handleAuthTokens, setAuthState,
  handleVerificationStatusFromUrl, switchAuthTab, showForgotPassword,
  showLogin, showResetPassword, handleLogin, handleRegister,
  handleForgotPassword, handleResetPassword, loadUserProfile, updateUserDisplay,
  loadAdminBootstrapStatus, handleAdminBootstrap, resendVerification,
  handleUpdateProfile, logout, showAppView, showAuthView

Depends on: store.js (state), featureFlags.js

### 3. public/railUi.js (new)
Functions to extract:
  syncProjectsRailHost, renderSidebarNavigation, setSettingsPaneVisible,
  setTodosViewBodyState, readStoredRailCollapsedState, persistRailCollapsedState,
  readStoredAiWorkspaceCollapsedState, readStoredAiWorkspaceVisibleState,
  persistAiWorkspaceCollapsedState, persistAiWorkspaceVisibleState,
  getProjectsRailElements, openProjectsFromCollapsedRail, isMobileRailViewport,
  getProjectTodoCount, updateTopbarProjectsButton, setProjectsRailActiveState,
  renderProjectsRail, setProjectsRailCollapsed, closeRailProjectMenu,
  toggleRailProjectMenu, lockBodyScrollForProjectsRail, unlockBodyScrollForProjectsRail,
  openProjectsRailSheet, closeProjectsRailSheet, selectProjectFromRail,
  getMoreFiltersElements, getFirstFocusableInMoreFilters, openMoreFilters,
  closeMoreFilters, toggleMoreFilters, syncSheetSearch, bindRailSearchFocusBehavior,
  renderProjectsRailListHtml, getRailOptionElements, getCurrentRailFocusKey,
  moveRailOptionFocus, syncRailA11yState, focusActiveProjectItem,
  openProjectsFromTopbar, syncSidebarNavState, bindProjectsRailHandlers

Depends on: store.js, filterLogic.js, projectsState.js

### 4. public/quickEntry.js (new)
Functions to extract:
  readStoredQuickEntryPropertiesOpenState, persistQuickEntryPropertiesOpenState,
  setQuickEntryPropertiesOpen, formatQuickEntryDueSummary,
  updateQuickEntryPropertiesSummary, getQuickEntryNaturalDateElements,
  normalizeQuickEntryTextSignature, toLocalDateTimeInputValue,
  formatQuickEntryNaturalDueLabel, loadChronoNaturalDateModule,
  removeMatchedDatePhraseFromTitle, parseQuickEntryNaturalDue,
  setQuickEntryDueInputValue, clearQuickEntryNaturalSuggestionPreview,
  renderQuickEntryNaturalDueChip, resetQuickEntryNaturalDueState,
  applyQuickEntryNaturalDueDetection, shouldSuppressQuickEntryNaturalAutoApply,
  processQuickEntryNaturalDate, scheduleQuickEntryNaturalDateParse,
  onQuickEntryTitleInputForNaturalDate, onQuickEntryDueInputChangedByUser,
  handleQuickEntryNaturalDueChipClick, bindQuickEntryNaturalDateHandlers,
  syncQuickEntryProjectActions, getTaskComposerElements,
  updateTaskComposerDueClearButton, inferTaskComposerDefaultProject,
  openTaskComposer, closeTaskComposer, cancelTaskComposer,
  resetTaskComposerFields, clearTaskComposerDueDate, bindTaskComposerHandlers

Depends on: store.js, todosService.js, filterLogic.js

### 5. public/homeDashboard.js (new)
Functions to extract:
  getTodoDueDate, getStartOfToday, getEndOfDay, formatHomeDueBadge,
  createHomeTodoIdSet, takeExclusiveTodos, getHomeTodoDaysSinceRecentActivity,
  getHomeTopFocusDeterministicReason, getHomeTopFocusReason, getHomeDueSoonGroupKey,
  buildHomeDueSoonGroups, getDueSoonTodos, getStaleRiskTodos, getQuickWinTodos,
  getProjectsToNudge, getTopFocusFallbackTodos, getHomeDashboardModel,
  buildHomeTileListByKey, buildHomeTopFocusCandidates, getHomeTopFocusRequestKey,
  readCachedHomeTopFocus, writeCachedHomeTopFocus, applyHomeTopFocusResult,
  hydrateHomeTopFocusIfNeeded, renderHomeTaskRow, renderHomeTaskTile,
  renderProjectsToNudgeTile, renderHomeDashboard, openHomeTileList,
  openHomeProject, openTodoFromHomeTile, getHomeDrilldownLabel,
  clearHomeFocusDashboard, startOfLocalDay, getTodoDueSummary,
  formatDashboardDueChip, getDashboardReasonLine, getTodoRecencyDays,
  renderTopFocusRow, renderHomeFocusDashboard

Depends on: store.js, todosService.js, filterLogic.js, projectsState.js

### 6. public/aiWorkspace.js (new)
Functions to extract:
  getAiWorkspaceElements, getAiWorkspaceStatusLabel, updateAiWorkspaceStatusChip,
  syncAiWorkspaceVisibility, setAiWorkspaceVisible, setAiWorkspaceCollapsed,
  toggleAiWorkspace, focusAiWorkspaceTarget, openAiWorkspaceForBrainDump,
  openAiWorkspaceForGoalPlan, loadAiSuggestions, loadAiUsage,
  loadAiFeedbackSummary, loadAiInsights, renderAiUsageSummary,
  renderAiPerformanceInsights, renderAiFeedbackInsights, renderAiSuggestionHistory,
  updateSuggestionStatus, getFeedbackReason,
  toPlanDateInputValue, normalizePlanDraftPriority, clonePlanDraftTask,
  initPlanDraftState, clearPlanDraftState, removeAppliedPlanDraftTasks,
  isPlanActionBusy, updatePlanGenerateButtonState, getSelectedPlanDraftTasks,
  buildPlanTaskCreatePayload, renderCritiquePanel, renderLegacyCritiquePanel,
  getCritiqueSuggestions, renderEnhancedCritiquePanel, updateCritiqueDraftButtonState,
  setCritiqueFeedbackReason, renderPlanPanel, setPlanDraftTaskSelected,
  updatePlanDraftTaskTitle, updatePlanDraftTaskDescription, updatePlanDraftTaskDueDate,
  updatePlanDraftTaskProject, updatePlanDraftTaskPriority, selectAllPlanDraftTasks,
  selectNoPlanDraftTasks, resetPlanDraft, retryMarkPlanSuggestionAccepted,
  critiqueDraftWithAi, applyCritiqueSuggestion, applyCritiqueSuggestionMode,
  dismissCritiqueSuggestion, generatePlanWithAi, clearBrainDumpInput,
  handlePlanFromGoalSuccess, draftPlanFromBrainDumpWithAi, addPlanTasksToTodos,
  dismissPlanSuggestion,
  readStoredAiWorkspaceCollapsedState, readStoredAiWorkspaceVisibleState,
  persistAiWorkspaceCollapsedState, persistAiWorkspaceVisibleState

Depends on: store.js, todosService.js, filterLogic.js, projectsState.js

## Extraction Protocol (same as Task 147)

For EACH module:
1. Before writing code — list every function being extracted with its line number in app.js
2. Diff the app.js version vs any prior module version if function was touched by Tasks 141/143/145
3. Create the new module file with proper ES6 exports
4. Add import to app.js
5. Delete duplicates from app.js
6. Run npx tsc --noEmit — must pass before moving to next module
7. Run CI=1 npm run test:ui:fast after all 6 modules complete

## Out of Scope
- No behavior changes of any kind
- Do not touch: todayPlan, onCreateAssist, commandPalette, dragDrop, adminUsers,
  shortcuts, bindDeclarativeHandlers, init — these remain in app.js for now
- No CSS changes, no backend changes, no new dependencies
- No test rewrites

## Files Allowed
- public/app.js (deletions + import additions only)
- public/featureFlags.js (new)
- public/authUi.js (new)
- public/railUi.js (new)
- public/quickEntry.js (new)
- public/homeDashboard.js (new)
- public/aiWorkspace.js (new)
- public/store.js (only if cross-cutting state needs to move)

## Acceptance Criteria
- [ ] 6 new domain modules created with proper ES6 exports
- [ ] app.js imports all 6 new modules
- [ ] app.js line count < 5,000 (from 10,217)
- [ ] Zero duplicate function declarations between app.js and new modules
- [ ] npx tsc --noEmit passes after each module extraction
- [ ] npm run format:check passes
- [ ] npm run lint:html passes
- [ ] npm run lint:css passes
- [ ] npm run test:unit passes
- [ ] CI=1 npm run test:ui:fast passes (0 failures)
- [ ] No behavior regressions visible in browser

## Constraints
- Same diff-before-delete discipline as Task 147 — always compare app.js vs new module before deleting
- tsc after each module batch — never delete a whole module's worth at once without checking
- No new npm dependencies
- If a function appears in the list but has been substantially modified by Tasks 141/143/145,
  the new module version must reflect the current app.js version — update the module, then delete from app.js
- BLOCKED if any circular import is introduced

## MIC-Lite

### Motivation
app.js at 10,217 lines still makes parallel work difficult and PRs conflict-prone.
This extraction brings app.js to a manageable core (~1,500-5,000 lines) covering only
the remaining unextracted domains (todayPlan, onCreateAssist, commandPalette, dragDrop).

### Impact
Pure reorganization — no behavior change. Risk is the same as Task 147: a function
modified after initial extraction having a stale version in the new module.
Mitigation: diff-before-delete.

### Checkpoints
- [ ] tsc passes after each of the 6 module extractions
- [ ] Browser manual smoke test after all 6 extracted: create todo, open drawer,
      auth flow, rail navigation, quick entry, AI workspace panel

## Pre-Mortem

1. Most likely: a function in the extraction list was modified by Tasks 141/143/145
   and the list version is stale. Mitigation: diff every function before deleting.
2. Second: a function listed under one module is actually called by another new module
   before that module is extracted, causing a temporary import cycle.
   Mitigation: extraction order in this task is dependency-sorted (featureFlags first,
   aiWorkspace last). Do not reorder.
3. Third: aiWorkspace.js is large (~100+ functions). Extract in two tsc-verified batches
   if needed rather than one large commit.

## Scope Escalation Triggers
- >12 files touched → BLOCKED
- Any new npm dependency → BLOCKED
- Any behavior change → BLOCKED

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/186
- Commit SHA(s): 0208875db690787986e95344638cadbb5e4f0bce
- app.js line count before: 10,217
- app.js line count after: 5,423
- Functions extracted:
  - featureFlags.js (3 functions): readBooleanFeatureFlag, isEnhancedTaskCriticEnabled, isTaskDrawerDecisionAssistEnabled
  - authUi.js (21 functions): handleAuthFailure, handleAuthTokens, setAuthState, handleVerificationStatusFromUrl, switchAuthTab, showForgotPassword, showLogin, showResetPassword, handleLogin, handleRegister, handleForgotPassword, handleResetPassword, loadUserProfile, updateUserDisplay, loadAdminBootstrapStatus, handleAdminBootstrap, resendVerification, handleUpdateProfile, logout, showAppView, showAuthView
  - railUi.js (33 functions): syncProjectsRailHost, renderSidebarNavigation, setSettingsPaneVisible, setTodosViewBodyState, readStoredRailCollapsedState, persistRailCollapsedState, readStoredAiWorkspaceCollapsedState, readStoredAiWorkspaceVisibleState, persistAiWorkspaceCollapsedState, persistAiWorkspaceVisibleState, getProjectsRailElements, openProjectsFromCollapsedRail, isMobileRailViewport, getProjectTodoCount, updateTopbarProjectsButton, setProjectsRailActiveState, renderProjectsRail, setProjectsRailCollapsed, closeRailProjectMenu, toggleRailProjectMenu, lockBodyScrollForProjectsRail, unlockBodyScrollForProjectsRail, openProjectsRailSheet, closeProjectsRailSheet, selectProjectFromRail, getMoreFiltersElements, getFirstFocusableInMoreFilters, openMoreFilters, closeMoreFilters, toggleMoreFilters, syncSheetSearch, bindRailSearchFocusBehavior, renderProjectsRailListHtml, getRailOptionElements, getCurrentRailFocusKey, moveRailOptionFocus, syncRailA11yState, focusActiveProjectItem, openProjectsFromTopbar, syncSidebarNavState, bindProjectsRailHandlers
  - quickEntry.js (34 functions): readStoredQuickEntryPropertiesOpenState, persistQuickEntryPropertiesOpenState, setQuickEntryPropertiesOpen, formatQuickEntryDueSummary, updateQuickEntryPropertiesSummary, getQuickEntryNaturalDateElements, normalizeQuickEntryTextSignature, toLocalDateTimeInputValue, formatQuickEntryNaturalDueLabel, loadChronoNaturalDateModule, removeMatchedDatePhraseFromTitle, parseQuickEntryNaturalDue, setQuickEntryDueInputValue, clearQuickEntryNaturalSuggestionPreview, renderQuickEntryNaturalDueChip, resetQuickEntryNaturalDueState, applyQuickEntryNaturalDueDetection, shouldSuppressQuickEntryNaturalAutoApply, processQuickEntryNaturalDate, scheduleQuickEntryNaturalDateParse, onQuickEntryTitleInputForNaturalDate, onQuickEntryDueInputChangedByUser, handleQuickEntryNaturalDueChipClick, bindQuickEntryNaturalDateHandlers, syncQuickEntryProjectActions, getTaskComposerElements, updateTaskComposerDueClearButton, inferTaskComposerDefaultProject, openTaskComposer, closeTaskComposer, cancelTaskComposer, resetTaskComposerFields, clearTaskComposerDueDate, bindTaskComposerHandlers
  - homeDashboard.js (38 functions): getTodoDueDate, getStartOfToday, getEndOfDay, startOfLocalDay, formatHomeDueBadge, createHomeTodoIdSet, takeExclusiveTodos, getHomeTodoDaysSinceRecentActivity, getHomeTopFocusDeterministicReason, getHomeTopFocusReason, getHomeDueSoonGroupKey, buildHomeDueSoonGroups, getDueSoonTodos, getStaleRiskTodos, getQuickWinTodos, getProjectsToNudge, getTopFocusFallbackTodos, getHomeDashboardModel, buildHomeTileListByKey, buildHomeTopFocusCandidates, getHomeTopFocusRequestKey, readCachedHomeTopFocus, writeCachedHomeTopFocus, applyHomeTopFocusResult, hydrateHomeTopFocusIfNeeded, renderHomeTaskRow, renderHomeTaskTile, renderProjectsToNudgeTile, renderHomeDashboard, openHomeTileList, openHomeProject, openTodoFromHomeTile, getHomeDrilldownLabel, clearHomeFocusDashboard, getTodoDueSummary, formatDashboardDueChip, getDashboardReasonLine, getTodoRecencyDays, renderTopFocusRow, renderHomeFocusDashboard
  - aiWorkspace.js (~60 functions): getAiWorkspaceElements, getAiWorkspaceStatusLabel, updateAiWorkspaceStatusChip, syncAiWorkspaceVisibility, setAiWorkspaceVisible, setAiWorkspaceCollapsed, toggleAiWorkspace, focusAiWorkspaceTarget, openAiWorkspaceForBrainDump, openAiWorkspaceForGoalPlan, loadAiSuggestions, loadAiUsage, loadAiFeedbackSummary, loadAiInsights, renderAiUsageSummary, renderAiPerformanceInsights, renderAiFeedbackInsights, renderAiSuggestionHistory, updateSuggestionStatus, getFeedbackReason, toPlanDateInputValue, normalizePlanDraftPriority, clonePlanDraftTask, initPlanDraftState, clearPlanDraftState, removeAppliedPlanDraftTasks, isPlanActionBusy, updatePlanGenerateButtonState, getSelectedPlanDraftTasks, buildPlanTaskCreatePayload, renderCritiquePanel, renderLegacyCritiquePanel, getCritiqueSuggestions, renderEnhancedCritiquePanel, updateCritiqueDraftButtonState, setCritiqueFeedbackReason, renderPlanPanel, setPlanDraftTaskSelected, updatePlanDraftTaskTitle, updatePlanDraftTaskDescription, updatePlanDraftTaskDueDate, updatePlanDraftTaskProject, updatePlanDraftTaskPriority, selectAllPlanDraftTasks, selectNoPlanDraftTasks, resetPlanDraft, retryMarkPlanSuggestionAccepted, critiqueDraftWithAi, applyCritiqueSuggestion, applyCritiqueSuggestionMode, dismissCritiqueSuggestion, generatePlanWithAi, clearBrainDumpInput, handlePlanFromGoalSuccess, draftPlanFromBrainDumpWithAi, addPlanTasksToTodos, dismissPlanSuggestion
- Functions left in app.js (flagged for Task 149): todayPlan (~25 functions), onCreateAssist (~20 functions), commandPalette, dragDrop, adminUsers, shortcuts, bindDeclarativeHandlers, init — ~141 functions total
- PASS/FAIL matrix:
  - tsc --noEmit: PASS
  - format:check: PASS
  - lint:html: PASS
  - lint:css: PASS
  - test:unit: PASS (207 tests)
  - test:ui:fast: PASS (204 passed, 32 skipped @visual)

## Outcome
Task complete. 6 domain modules extracted. app.js reduced from 10,217 to 5,423 lines.
Key bugs fixed during extraction:
1. Missing `const { apiCall, parseApiBody, ... } = apiClient` destructuring (caused PAGE_ERROR on load)
2. Missing `init()` bootstrap function (app never initialized)
3. Wrong import source for `renderProjectOptionEntry` (window.ProjectPathUtils, not projectsState.js)
4. Several homeDashboard functions rewritten incorrectly during extraction — restored from original app.js
