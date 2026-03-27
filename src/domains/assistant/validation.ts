/**
 * Assistant domain validators — planning, review, evaluation validation.
 *
 * Re-exports from the monolithic agentValidation.ts for domain-scoped imports.
 */
export {
  // Planning
  validateAgentPlanProjectInput,
  validateAgentEnsureNextActionInput,
  validateAgentPlanTodayInput,
  validateAgentBreakDownTaskInput,
  validateAgentSuggestNextActionsInput,
  validateAgentSimulatePlanInput,
  validateAgentDecideNextWorkInput,
  // Review
  validateAgentWeeklyReviewInput,
  validateAgentWeeklyReviewSummaryInput,
  validateAgentReviewProjectsInput,
  validateAgentWeeklyExecSummaryInput,
  // Evaluation
  validateAgentEvaluateDailyInput,
  validateAgentEvaluateWeeklyInput,
  // Analysis
  validateAgentAnalyzeProjectHealthInput,
  validateAgentAnalyzeTaskQualityInput,
  validateAgentAnalyzeWorkGraphInput,
  validateAgentFindDuplicateTasksInput,
  validateAgentFindStaleItemsInput,
  validateAgentTaxonomyCleanupInput,
  // Feedback
  validateAgentRecordFeedbackInput,
  validateAgentListFeedbackInput,
  validateAgentFeedbackSummaryInput,
  // Day context
  validateAgentSetDayContextInput,
  validateAgentGetDayContextInput,
  validateAgentGetAvailabilityWindowsInput,
  // Inbox
  validateAgentCaptureInboxItemInput,
  validateAgentListInboxItemsInput,
  validateAgentPromoteInboxItemInput,
  validateAgentSuggestCaptureRouteInput,
  validateAgentTriageCaptureItemInput,
  validateAgentTriageInboxInput,
  // Follow-up
  validateAgentCreateFollowUpInput,
  // Stale/upcoming/today
  validateAgentListTodayInput,
  validateAgentListNextActionsInput,
  validateAgentListWaitingOnInput,
  validateAgentListUpcomingInput,
  validateAgentListStaleTasksInput,
  validateAgentListProjectsWithoutNextActionInput,
  // Home focus
  validateAgentPrewarmHomeFocusInput,
} from "../../validation/agentValidation";
