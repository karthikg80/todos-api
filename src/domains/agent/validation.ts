/**
 * Agent domain validators — job run, audit, config, metrics validation.
 *
 * Re-exports from the monolithic agentValidation.ts for domain-scoped imports.
 */
export {
  // Job runs
  validateAgentClaimJobRunInput,
  validateAgentCompleteJobRunInput,
  validateAgentFailJobRunInput,
  validateAgentGetJobRunInput,
  validateAgentListJobRunsInput,
  validateAgentReplayJobRunInput,
  // Config
  validateAgentGetAgentConfigInput,
  validateAgentUpdateAgentConfigInput,
  // Metrics
  validateAgentRecordMetricInput,
  validateAgentListMetricsInput,
  validateAgentMetricsSummaryInput,
  // Audit
  validateAgentListAuditLogInput,
  validateAgentListAuditLogExtendedInput,
  // Failed actions
  validateAgentRecordFailedActionInput,
  validateAgentListFailedActionsInput,
  validateAgentResolveFailedActionInput,
  // Action policies
  validateAgentGetActionPoliciesInput,
  validateAgentUpdateActionPolicyInput,
  // Learning
  validateAgentRecordLearningRecInput,
  validateAgentListLearningRecsInput,
  validateAgentApplyLearningRecInput,
  // Friction
  validateAgentListFrictionPatternsInput,
} from "../../validation/agentValidation";
