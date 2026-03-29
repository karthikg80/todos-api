/**
 * Action registry — per-instance dispatch table for agent action handlers.
 *
 * Each AgentExecutor owns its own ActionRegistry instance, so there is
 * no global mutable state and no cross-instance bleed in tests.
 *
 * Two handler types:
 *  - ActionHandler: returns { status, data }; executor wraps via this.success()
 *  - RawActionHandler: returns AgentExecutionResult directly; used for write
 *    actions that need access to handleIdempotent / buildDryRunResult / success
 *    via the WriteActionExecutor shim on runtime.exec.
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
import type { CaptureService } from "../../../services/captureService";
import type { IProjectService } from "../../../interfaces/IProjectService";
import type { PrismaClient } from "@prisma/client";
import type {
  AgentActionName,
  AgentExecutionContext,
  AgentExecutionResult,
} from "./agentTypes";

export interface ActionContext {
  userId: string;
  requestId: string;
  actor: string;
  surface: "agent" | "mcp";
  idempotencyKey?: string;
}

/**
 * Shim exposing executor private helpers to extracted write action handlers.
 * Built by the executor via .bind() and attached to runtime.exec.
 */
export interface WriteActionExecutor {
  handleIdempotent(
    action: AgentActionName,
    context: AgentExecutionContext,
    input: unknown,
    fn: () => Promise<Record<string, unknown>>,
    successStatus?: number,
  ): Promise<AgentExecutionResult>;
  buildDryRunResult(
    action: "create_task" | "update_task",
    input: Record<string, unknown>,
  ): Record<string, unknown>;
  success(
    action: AgentActionName,
    readOnly: boolean,
    context: AgentExecutionContext,
    status: number,
    data: Record<string, unknown>,
  ): AgentExecutionResult;
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
  captureService: CaptureService | null;
  projectService: IProjectService | undefined;
  persistencePrisma: PrismaClient | undefined;
  exec: WriteActionExecutor;
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
 * Stateless action handler — returns domain data for executor to wrap.
 */
export type ActionHandler = (
  params: Record<string, unknown>,
  context: ActionContext,
  runtime: ActionRuntime,
) => Promise<ActionHandlerResult>;

/**
 * Raw action handler — returns AgentExecutionResult directly.
 * Used for write actions that need handleIdempotent / buildDryRunResult
 * via runtime.exec.
 */
export type RawActionHandler = (
  params: Record<string, unknown>,
  context: AgentExecutionContext,
  runtime: ActionRuntime,
) => Promise<AgentExecutionResult>;

/**
 * Per-instance action registry. Each executor creates its own.
 */
export class ActionRegistry {
  private readonly handlers = new Map<string, ActionHandler>();
  private readonly rawHandlers = new Map<string, RawActionHandler>();

  register(action: string, handler: ActionHandler): void {
    this.handlers.set(action, handler);
  }

  get(action: string): ActionHandler | undefined {
    return this.handlers.get(action);
  }

  has(action: string): boolean {
    return this.handlers.has(action);
  }

  registerRaw(action: string, handler: RawActionHandler): void {
    this.rawHandlers.set(action, handler);
  }

  getRaw(action: string): RawActionHandler | undefined {
    return this.rawHandlers.get(action);
  }

  hasRaw(action: string): boolean {
    return this.rawHandlers.has(action);
  }

  registeredActions(): string[] {
    return [
      ...Array.from(this.handlers.keys()),
      ...Array.from(this.rawHandlers.keys()),
    ];
  }
}
