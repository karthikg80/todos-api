import type {
  ActionRegistry,
  ActionRuntime,
  ActionContext,
} from "./actionRegistry";
import {
  validateAgentGetJobRunInput,
  validateAgentListJobRunsInput,
  validateAgentListFailedActionsInput,
  validateAgentGetAgentConfigInput,
  validateAgentListMetricsInput,
  validateAgentMetricsSummaryInput,
  validateAgentListFeedbackInput,
  validateAgentFeedbackSummaryInput,
  validateAgentGetDayContextInput,
  validateAgentWeeklyExecSummaryInput,
  validateAgentListLearningRecsInput,
  validateAgentListFrictionPatternsInput,
  validateAgentGetActionPoliciesInput,
} from "../../../validation/agentValidation";

export function registerSystemReadActions(registry: ActionRegistry): void {
  registry.register(
    "get_job_run_status",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const { jobName, periodKey } = validateAgentGetJobRunInput(params);
      const run = await runtime.jobRunService.getRunStatus(
        context.userId,
        jobName,
        periodKey,
      );
      return { status: 200, data: { run } };
    },
  );

  registry.register(
    "list_job_runs",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListJobRunsInput(params);
      const runs = await runtime.jobRunService.listRuns(
        context.userId,
        filters,
      );
      return { status: 200, data: { runs, total: runs.length } };
    },
  );

  registry.register(
    "list_failed_actions",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListFailedActionsInput(params);
      const actions = await runtime.failedActionService.list(
        context.userId,
        filters,
      );
      return { status: 200, data: { actions, total: actions.length } };
    },
  );

  registry.register(
    "get_agent_config",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      validateAgentGetAgentConfigInput(params);
      const config = await runtime.agentConfigService.getConfig(context.userId);
      return { status: 200, data: { config } };
    },
  );

  registry.register(
    "list_metrics",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListMetricsInput(params);
      const events = await runtime.metricsService.list(context.userId, filters);
      return { status: 200, data: { events, total: events.length } };
    },
  );

  registry.register(
    "metrics_summary",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentMetricsSummaryInput(params);
      const summary = await runtime.metricsService.summary(
        context.userId,
        filters,
      );
      return { status: 200, data: { summary } };
    },
  );

  registry.register(
    "list_recommendation_feedback",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListFeedbackInput(params);
      const items = await runtime.feedbackService.list(context.userId, filters);
      return { status: 200, data: { items, total: items.length } };
    },
  );

  registry.register(
    "feedback_summary",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentFeedbackSummaryInput(params);
      const summaries = await runtime.feedbackService.summary(
        context.userId,
        filters,
      );
      return { status: 200, data: { summaries, total: summaries.length } };
    },
  );

  registry.register(
    "get_day_context",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const { contextDate } = validateAgentGetDayContextInput(params);
      const today = contextDate ?? new Date().toISOString().slice(0, 10);
      const dayCtxResult = await runtime.dayContextService.getContext(
        context.userId,
        today,
      );
      return { status: 200, data: { context: dayCtxResult } };
    },
  );

  registry.register(
    "weekly_executive_summary",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const { weekOffset } = validateAgentWeeklyExecSummaryInput(params);
      const summary = await runtime.executiveSummaryService.getSummary(
        context.userId,
        weekOffset ?? 0,
      );
      return { status: 200, data: { summary } };
    },
  );

  registry.register(
    "list_learning_recommendations",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const { status, limit } = validateAgentListLearningRecsInput(params);
      const recs = await runtime.learningRecommendationService.list(
        context.userId,
        { status, limit },
      );
      return {
        status: 200,
        data: { recommendations: recs, total: recs.length },
      };
    },
  );

  registry.register(
    "list_friction_patterns",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const { since, limit } = validateAgentListFrictionPatternsInput(params);
      const result = await runtime.frictionService.listPatterns(
        context.userId,
        {
          since,
          limit,
        },
      );
      return {
        status: 200,
        data: result as unknown as Record<string, unknown>,
      };
    },
  );

  registry.register(
    "get_action_policies",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      validateAgentGetActionPoliciesInput(params);
      const policies = await runtime.actionPolicyService.getPolicies(
        context.userId,
      );
      return { status: 200, data: { policies } };
    },
  );
}
