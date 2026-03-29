/**
 * Action registry — per-instance dispatch table for agent action handlers.
 *
 * Each AgentExecutor owns its own ActionRegistry instance, so there is
 * no global mutable state and no cross-instance bleed in tests.
 *
 * Handlers are stateless functions that receive an ActionRuntime at
 * call-time. They return { status, data } and the executor wraps it
 * in the canonical success/error envelope.
 */

import type { AgentService } from "../../../services/agentService";
import type { AgentJobRunService } from "../../../services/agentJobRunService";
import type { AgentMetricsService } from "../../../services/agentMetricsService";
import type { RecommendationFeedbackService } from "../../../services/recommendationFeedbackService";
import type { DayContextService } from "../../../services/dayContextService";
import type { AgentConfigService } from "../../../services/agentConfigService";
import type { FailedAutomationActionService } from "../../../services/failedAutomationActionService";
import type { WeeklyExecutiveSummaryService } from "../../../services/weeklyExecutiveSummaryService";
import type { LearningRecommendationService } from "../../../services/learningRecommendationService";
import type { FrictionService } from "../../../services/frictionService";
import type { ActionPolicyService } from "../../../services/actionPolicyService";

export interface ActionContext {
  userId: string;
  requestId: string;
  actor: string;
  surface: "agent" | "mcp";
  idempotencyKey?: string;
}

/**
 * Services available to extracted action handlers at call-time.
 * Built by the executor from its own instance fields.
 */
export interface ActionRuntime {
  agentService: AgentService;
  jobRunService: AgentJobRunService;
  metricsService: AgentMetricsService;
  feedbackService: RecommendationFeedbackService;
  dayContextService: DayContextService;
  agentConfigService: AgentConfigService;
  failedActionService: FailedAutomationActionService;
  executiveSummaryService: WeeklyExecutiveSummaryService;
  learningRecommendationService: LearningRecommendationService;
  frictionService: FrictionService;
  actionPolicyService: ActionPolicyService;
}

/**
 * Handler return type — domain data + HTTP status.
 * The executor wraps this via this.success().
 */
export interface ActionHandlerResult {
  status: number;
  data: Record<string, unknown>;
}

/**
 * Stateless action handler function.
 * Receives params (validated input), context (user/request metadata),
 * and runtime (service instances) at call-time.
 */
export type ActionHandler = (
  params: Record<string, unknown>,
  context: ActionContext,
  runtime: ActionRuntime,
) => Promise<ActionHandlerResult>;

/**
 * Per-instance action registry. Each executor creates its own.
 */
export class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  register(action: string, handler: ActionHandler): void {
    this.handlers.set(action, handler);
  }

  get(action: string): ActionHandler | undefined {
    return this.handlers.get(action);
  }

  has(action: string): boolean {
    return this.handlers.has(action);
  }

  registeredActions(): string[] {
    return Array.from(this.handlers.keys());
  }
}
