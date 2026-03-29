/**
 * DecisionAssistGuards
 *
 * Encapsulates the cross-cutting guards and helpers that were previously
 * defined inline inside the aiRouter factory. These are thin orchestration
 * wrappers around quota, throttle, feature-flag, and telemetry services.
 */

import { IAiSuggestionStore } from "./aiSuggestionStore";
import { AiQuotaService, AiUsage } from "./aiQuotaService";
import { DecisionAssistSurface } from "../validation/aiContracts";
import {
  evaluateDecisionAssistThrottle,
  DecisionAssistThrottleResult,
} from "./decisionAssistThrottle";
import * as decisionAssistTelemetry from "./decisionAssistTelemetry";

export interface DecisionAssistGuardsDeps {
  quotaService: AiQuotaService;
  suggestionStore: IAiSuggestionStore;
  decisionAssistEnabled: boolean;
}

export class DecisionAssistGuards {
  private readonly quotaService: AiQuotaService;
  private readonly suggestionStore: IAiSuggestionStore;
  private readonly decisionAssistEnabled: boolean;

  constructor(deps: DecisionAssistGuardsDeps) {
    this.quotaService = deps.quotaService;
    this.suggestionStore = deps.suggestionStore;
    this.decisionAssistEnabled = deps.decisionAssistEnabled;
  }

  /**
   * Check daily AI quota. Returns exceeded usage info, or null if within limits.
   */
  async checkQuota(userId: string): Promise<AiUsage | null> {
    return this.quotaService.checkQuota(userId);
  }

  /**
   * Evaluate whether decision assist should be throttled for this user/surface.
   */
  async evaluateThrottle(
    userId: string,
    surface: DecisionAssistSurface,
  ): Promise<DecisionAssistThrottleResult> {
    const records = await this.suggestionStore.listByUser(userId, 120);
    return evaluateDecisionAssistThrottle({
      records,
      surface,
      now: new Date(),
    });
  }

  /**
   * Check whether decision assist is enabled.
   */
  isFeatureEnabled(): boolean {
    return this.decisionAssistEnabled;
  }

  /**
   * Parse the x-ai-explicit-request header to determine if user
   * explicitly requested decision assist (bypasses throttle).
   */
  isExplicitRequest(headerValue: string | undefined): boolean {
    if (typeof headerValue !== "string") return false;
    const normalized = headerValue.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }

  /**
   * Emit decision assist telemetry safely (fire-and-forget).
   */
  emitTelemetry(
    event: decisionAssistTelemetry.DecisionAssistTelemetryEvent,
  ): void {
    try {
      decisionAssistTelemetry.emitDecisionAssistTelemetry(event);
    } catch (error) {
      console.warn("Decision assist telemetry emit failed:", error);
    }
  }
}
