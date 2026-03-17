import { PrismaClient } from "@prisma/client";
import { AgentConfigService } from "./agentConfigService";

export type RecommendationType = "config_change" | "score_weight";
export type RecommendationStatus = "pending" | "applied" | "dismissed";

export interface LearningRecommendationRecord {
  id: string;
  type: RecommendationType;
  target: string;
  currentValue: unknown;
  suggestedValue: unknown;
  confidence: number;
  why: string;
  evidence: unknown;
  status: RecommendationStatus;
  appliedAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
}

// Fields in AgentConfig that are safe to auto-apply from learning recommendations.
const SAFE_APPLY_TARGETS = new Set([
  "waitingFollowUpDays",
  "maxWriteActionsPerRun",
  "inboxConfidenceThreshold",
  "staleThresholdDays",
  "plannerWeightPriority",
  "plannerWeightDueDate",
  "plannerWeightEnergyMatch",
  "plannerWeightEstimateFit",
  "plannerWeightFreshness",
]);

export class LearningRecommendationService {
  private readonly agentConfigService: AgentConfigService;

  constructor(private readonly prisma?: PrismaClient) {
    this.agentConfigService = new AgentConfigService(prisma);
  }

  async record(
    userId: string,
    input: {
      type: RecommendationType;
      target: string;
      currentValue: unknown;
      suggestedValue: unknown;
      confidence: number;
      why: string;
      evidence?: unknown;
    },
  ): Promise<LearningRecommendationRecord> {
    if (!this.prisma) return this.mockRecord(userId, input);
    const rec = await this.prisma.learningRecommendation.create({
      data: {
        userId,
        type: input.type,
        target: input.target,
        currentValue: input.currentValue as object,
        suggestedValue: input.suggestedValue as object,
        confidence: input.confidence,
        why: input.why,
        evidence:
          input.evidence !== undefined ? (input.evidence as object) : undefined,
      },
    });
    return this.toRecord(rec);
  }

  async list(
    userId: string,
    filters: { status?: RecommendationStatus; limit?: number },
  ): Promise<LearningRecommendationRecord[]> {
    if (!this.prisma) return [];
    const rows = await this.prisma.learningRecommendation.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async apply(
    userId: string,
    id: string,
  ): Promise<{
    recommendation: LearningRecommendationRecord;
    configUpdated: boolean;
  }> {
    if (!this.prisma) {
      throw new Error("Persistence layer not available");
    }

    const rec = await this.prisma.learningRecommendation.findFirst({
      where: { id, userId },
    });
    if (!rec) throw new Error("Recommendation not found");
    if (rec.status !== "pending") {
      throw new Error(`Recommendation is already ${rec.status}`);
    }
    if (!SAFE_APPLY_TARGETS.has(rec.target)) {
      throw new Error(
        `Target '${rec.target}' is not in the safe-apply allowlist. Apply manually.`,
      );
    }

    // Apply to AgentConfig
    const suggestedValue = rec.suggestedValue as number;
    await this.agentConfigService.updateConfig(userId, {
      [rec.target]: suggestedValue,
    });

    const updated = await this.prisma.learningRecommendation.update({
      where: { id },
      data: { status: "applied", appliedAt: new Date() },
    });

    return { recommendation: this.toRecord(updated), configUpdated: true };
  }

  private mockRecord(
    _userId: string,
    input: {
      type: RecommendationType;
      target: string;
      currentValue: unknown;
      suggestedValue: unknown;
      confidence: number;
      why: string;
      evidence?: unknown;
    },
  ): LearningRecommendationRecord {
    return {
      id: "",
      type: input.type,
      target: input.target,
      currentValue: input.currentValue,
      suggestedValue: input.suggestedValue,
      confidence: input.confidence,
      why: input.why,
      evidence: input.evidence ?? null,
      status: "pending",
      appliedAt: null,
      dismissedAt: null,
      createdAt: new Date(),
    };
  }

  private toRecord(
    r: import("@prisma/client").LearningRecommendation,
  ): LearningRecommendationRecord {
    return {
      id: r.id,
      type: r.type as RecommendationType,
      target: r.target,
      currentValue: r.currentValue,
      suggestedValue: r.suggestedValue,
      confidence: r.confidence,
      why: r.why,
      evidence: r.evidence,
      status: r.status as RecommendationStatus,
      appliedAt: r.appliedAt,
      dismissedAt: r.dismissedAt,
      createdAt: r.createdAt,
    };
  }
}
