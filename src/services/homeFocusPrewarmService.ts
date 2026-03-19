import { AiPlannerService } from "./aiService";
import type { IAiSuggestionStore } from "./aiSuggestionStore";
import {
  findLatestPendingHomeFocusSuggestion,
  normalizeHomeFocusEnvelope,
} from "./aiNormalizationService";

export const DEFAULT_HOME_FOCUS_PREWARM_TOP_N = 3;
export const DEFAULT_HOME_FOCUS_PREWARM_FRESHNESS_HOURS = 18;

export interface HomeFocusPrewarmInput {
  topN?: 3 | 5;
  freshnessHours?: number;
  force?: boolean;
  timezone?: string;
  periodKey?: string;
}

export interface HomeFocusPrewarmResult {
  status: "generated" | "reused";
  suggestionId: string;
  createdAt: string;
  freshUntil: string;
  ageHours: number;
  suggestionCount: number;
  mustAbstain: boolean;
}

export class HomeFocusPrewarmService {
  constructor(
    private readonly aiPlannerService: AiPlannerService,
    private readonly suggestionStore: IAiSuggestionStore,
  ) {}

  async prewarmForUser(
    userId: string,
    input: HomeFocusPrewarmInput = {},
  ): Promise<HomeFocusPrewarmResult> {
    const topN = input.topN ?? DEFAULT_HOME_FOCUS_PREWARM_TOP_N;
    const freshnessHours =
      input.freshnessHours ?? DEFAULT_HOME_FOCUS_PREWARM_FRESHNESS_HOURS;
    const now = new Date();
    const latest = await findLatestPendingHomeFocusSuggestion(
      this.suggestionStore,
      userId,
    );

    if (!input.force && latest) {
      const existing = this.tryBuildResult(latest, freshnessHours, now);
      if (existing && existing.ageHours < freshnessHours) {
        return { ...existing, status: "reused" };
      }
    }

    const output = await this.aiPlannerService.generateDecisionAssistStub(
      {
        surface: "home_focus",
        topN,
      },
      { userId },
    );

    const created = await this.suggestionStore.create({
      userId,
      type: "task_critic",
      input: {
        surface: "home_focus",
        topN,
        source: "automation_prewarm",
        ...(typeof input.timezone === "string" && input.timezone
          ? { timezone: input.timezone }
          : {}),
        ...(typeof input.periodKey === "string" && input.periodKey
          ? { periodKey: input.periodKey }
          : {}),
      },
      output: output as unknown as Record<string, unknown>,
    });

    const result = this.tryBuildResult(created, freshnessHours, now);
    if (!result) {
      throw new Error("Failed to normalize generated home focus snapshot");
    }
    return { ...result, status: "generated" };
  }

  private tryBuildResult(
    record: {
      id: string;
      createdAt: Date;
      output: Record<string, unknown>;
    },
    freshnessHours: number,
    now: Date,
  ): Omit<HomeFocusPrewarmResult, "status"> | null {
    try {
      const envelope = normalizeHomeFocusEnvelope(record.output);
      const createdAt = record.createdAt.toISOString();
      const ageHours = this.roundHours(
        (now.getTime() - record.createdAt.getTime()) / (60 * 60 * 1000),
      );
      return {
        suggestionId: record.id,
        createdAt,
        freshUntil: new Date(
          record.createdAt.getTime() + freshnessHours * 60 * 60 * 1000,
        ).toISOString(),
        ageHours,
        suggestionCount: envelope.suggestions.length,
        mustAbstain: envelope.must_abstain || envelope.suggestions.length === 0,
      };
    } catch {
      return null;
    }
  }

  private roundHours(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value * 100) / 100);
  }
}
