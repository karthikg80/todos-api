// =============================================================================
// assistant feature barrel — re-exports from aiWorkspace.js
//
// New code should import from this barrel:
//   import { critiqueDraftWithAi } from '../features/assistant/index.js';
//
// The aiWorkspace.js monolith (1,517 lines) will be split incrementally:
// - critiquePanel.js (task critique flow)
// - planPanel.js (plan generation/draft)
// - brainDumpPanel.js (brain dump → plan flow)
// =============================================================================

export {
  // Workspace visibility
  getAiWorkspaceElements,
  syncAiWorkspaceVisibility,
  setAiWorkspaceVisible,
  setAiWorkspaceCollapsed,
  toggleAiWorkspace,
  focusAiWorkspaceTarget,
  // Workspace actions
  openAiWorkspaceForBrainDump,
  openAiWorkspaceForGoalPlan,
  // Data loading
  loadAiSuggestions,
  loadAiUsage,
  loadAiFeedbackSummary,
  loadAiInsights,
  // Rendering
  renderAiUsageSummary,
  renderAiPerformanceInsights,
  renderAiFeedbackInsights,
  renderAiSuggestionHistory,
  // Critique
  renderCritiquePanel,
  critiqueDraftWithAi,
  applyCritiqueSuggestion,
  applyCritiqueSuggestionMode,
  dismissCritiqueSuggestion,
  setCritiqueFeedbackReason,
  updateCritiqueDraftButtonState,
  // Plan
  renderPlanPanel,
  generatePlanWithAi,
  draftPlanFromBrainDumpWithAi,
  clearBrainDumpInput,
  addPlanTasksToTodos,
  dismissPlanSuggestion,
  resetPlanDraft,
  // Plan draft editing
  setPlanDraftTaskSelected,
  updatePlanDraftTaskTitle,
  updatePlanDraftTaskDescription,
  updatePlanDraftTaskDueDate,
  updatePlanDraftTaskProject,
  updatePlanDraftTaskPriority,
  selectAllPlanDraftTasks,
  selectNoPlanDraftTasks,
  retryMarkPlanSuggestionAccepted,
} from "../../modules/aiWorkspace.js";
