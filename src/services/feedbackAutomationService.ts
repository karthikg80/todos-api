import { PrismaClient } from "@prisma/client";
import {
  FeedbackAutomationConfigDto,
  FeedbackAutomationDecision,
  FeedbackAutomationDecisionDto,
  FeedbackAutomationRunResultDto,
  FeedbackTriageClassification,
  RunFeedbackAutomationRequestDto,
  UpdateFeedbackAutomationConfigDto,
} from "../types";
import { AgentConfigRecord, AgentConfigService } from "./agentConfigService";
import { AgentAuditService } from "./agentAuditService";
import { AgentJobRunService } from "./agentJobRunService";
import { FeedbackDuplicateService } from "./feedbackDuplicateService";
import { FeedbackPromotionService } from "./feedbackPromotionService";
import { FeedbackService } from "./feedbackService";

const AUTO_PROMOTION_JOB_NAME = "feedback_auto_promotion";
const ALLOWLISTED_CLASSIFICATIONS: Array<"bug" | "feature"> = [
  "bug",
  "feature",
];

type AutomationCandidateRecord = {
  id: string;
  title: string;
  type: "bug" | "feature" | "general";
  status: "new" | "triaged" | "promoted" | "rejected";
  classification: FeedbackTriageClassification | null;
  triageConfidence?: number | null;
  normalizedTitle: string | null;
  normalizedBody: string | null;
  impactSummary: string | null;
  reproStepsJson: unknown;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  proposedOutcome: string | null;
  duplicateCandidate: boolean;
  duplicateOfFeedbackId: string | null;
  duplicateOfGithubIssueNumber: number | null;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  promotionDecision: string | null;
  promotionReason: string | null;
  promotionRunId: string | null;
  promotionDecidedAt: Date | null;
};

export interface FeedbackAutomationServiceDeps {
  agentConfigService?: AgentConfigService;
  agentAuditService?: AgentAuditService;
  agentJobRunService?: AgentJobRunService;
  feedbackDuplicateService?: FeedbackDuplicateService;
  feedbackPromotionService?: FeedbackPromotionService;
  feedbackService?: FeedbackService;
}

function toConfigDto(config: AgentConfigRecord): FeedbackAutomationConfigDto {
  return {
    feedbackAutomationEnabled: config.feedbackAutomationEnabled,
    feedbackAutoPromoteEnabled: config.feedbackAutoPromoteEnabled,
    feedbackAutoPromoteMinConfidence: config.feedbackAutoPromoteMinConfidence,
    allowlistedClassifications: [...ALLOWLISTED_CLASSIFICATIONS],
  };
}

function toDecisionDto(record: {
  id: string;
  title: string;
  type: "bug" | "feature" | "general";
  status: "new" | "triaged" | "promoted" | "rejected";
  classification?: FeedbackTriageClassification | null;
  triageConfidence?: number | null;
  promotionDecision?: string | null;
  promotionReason?: string | null;
  promotionRunId?: string | null;
  promotionDecidedAt?: Date | string | null;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
}): FeedbackAutomationDecisionDto | null {
  if (
    !record.promotionDecidedAt ||
    (record.promotionDecision !== "review" &&
      record.promotionDecision !== "promoted")
  ) {
    return null;
  }

  const decidedAt =
    record.promotionDecidedAt instanceof Date
      ? record.promotionDecidedAt
      : new Date(record.promotionDecidedAt);
  if (Number.isNaN(decidedAt.getTime())) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    type: record.type,
    status: record.status,
    classification: record.classification ?? null,
    triageConfidence: record.triageConfidence,
    promotionDecision: record.promotionDecision,
    promotionReason: record.promotionReason,
    promotionRunId: record.promotionRunId,
    promotionDecidedAt: decidedAt.toISOString(),
    githubIssueNumber: record.githubIssueNumber,
    githubIssueUrl: record.githubIssueUrl,
  };
}

function buildRunPeriodKey(now: Date): string {
  return now.toISOString().slice(0, 16);
}

export class FeedbackAutomationService {
  private readonly agentConfigService: AgentConfigService;
  private readonly agentAuditService: AgentAuditService;
  private readonly agentJobRunService: AgentJobRunService;
  private readonly feedbackDuplicateService: FeedbackDuplicateService;
  private readonly feedbackPromotionService: FeedbackPromotionService;
  private readonly feedbackService: FeedbackService;

  constructor(
    private readonly prisma: PrismaClient,
    deps: FeedbackAutomationServiceDeps = {},
  ) {
    this.agentConfigService =
      deps.agentConfigService ?? new AgentConfigService(prisma);
    this.agentAuditService =
      deps.agentAuditService ?? new AgentAuditService(prisma);
    this.agentJobRunService =
      deps.agentJobRunService ?? new AgentJobRunService(prisma);
    this.feedbackDuplicateService =
      deps.feedbackDuplicateService ?? new FeedbackDuplicateService(prisma);
    this.feedbackService = deps.feedbackService ?? new FeedbackService(prisma);
    this.feedbackPromotionService =
      deps.feedbackPromotionService ??
      new FeedbackPromotionService(prisma, {
        feedbackService: this.feedbackService,
        feedbackDuplicateService: this.feedbackDuplicateService,
      });
  }

  async getConfig(userId: string): Promise<FeedbackAutomationConfigDto> {
    const config = await this.agentConfigService.getConfig(userId);
    return toConfigDto(config);
  }

  async updateConfig(
    userId: string,
    update: UpdateFeedbackAutomationConfigDto,
  ): Promise<FeedbackAutomationConfigDto> {
    const config = await this.agentConfigService.updateConfig(userId, update);
    return toConfigDto(config);
  }

  async listRecentDecisions(
    limit = 10,
  ): Promise<FeedbackAutomationDecisionDto[]> {
    const records = await this.prisma.feedbackRequest.findMany({
      where: {
        promotionDecision: {
          not: null,
        },
        promotionDecidedAt: {
          not: null,
        },
      },
      orderBy: [
        {
          promotionDecidedAt: "desc",
        },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        classification: true,
        triageConfidence: true,
        promotionDecision: true,
        promotionReason: true,
        promotionRunId: true,
        promotionDecidedAt: true,
        githubIssueNumber: true,
        githubIssueUrl: true,
      },
    });

    return records.flatMap((record) => {
      const decision = toDecisionDto(record);
      return decision ? [decision] : [];
    });
  }

  async runAutoPromotion(
    userId: string,
    input: RunFeedbackAutomationRequestDto = {},
  ): Promise<FeedbackAutomationRunResultDto> {
    const config = await this.agentConfigService.getConfig(userId);
    const periodKey = buildRunPeriodKey(new Date());

    if (!config.feedbackAutomationEnabled) {
      return {
        jobName: AUTO_PROMOTION_JOB_NAME,
        periodKey,
        runId: null,
        claimed: false,
        skipped: true,
        reason: "Feedback automation is disabled",
        processedCount: 0,
        promotedCount: 0,
        reviewCount: 0,
        decisions: [],
      };
    }

    const { claimed, run } = await this.agentJobRunService.claimRun(
      userId,
      AUTO_PROMOTION_JOB_NAME,
      periodKey,
    );
    if (!claimed) {
      return {
        jobName: AUTO_PROMOTION_JOB_NAME,
        periodKey,
        runId: null,
        claimed: false,
        skipped: true,
        reason: "An automation run is already in progress for this period",
        processedCount: 0,
        promotedCount: 0,
        reviewCount: 0,
        decisions: [],
      };
    }

    try {
      const candidates = await this.loadCandidates(input.limit ?? 20);
      const decisions: FeedbackAutomationDecisionDto[] = [];

      for (const candidate of candidates) {
        const decision = await this.processCandidate(
          candidate,
          userId,
          config,
          run?.id ?? null,
        );
        decisions.push(decision);
      }

      const result: FeedbackAutomationRunResultDto = {
        jobName: AUTO_PROMOTION_JOB_NAME,
        periodKey,
        runId: run?.id ?? null,
        claimed: true,
        skipped: false,
        reason: null,
        processedCount: decisions.length,
        promotedCount: decisions.filter(
          (decision) => decision.promotionDecision === "promoted",
        ).length,
        reviewCount: decisions.filter(
          (decision) => decision.promotionDecision === "review",
        ).length,
        decisions,
      };

      await this.agentJobRunService.completeRun(
        userId,
        AUTO_PROMOTION_JOB_NAME,
        periodKey,
        result,
      );
      await this.agentAuditService.record({
        surface: "agent",
        action: AUTO_PROMOTION_JOB_NAME,
        readOnly: false,
        outcome: "success",
        status: 200,
        userId,
        requestId: `feedback-auto-${periodKey}`,
        actor: "feedback-automation",
        jobName: AUTO_PROMOTION_JOB_NAME,
        jobPeriodKey: periodKey,
        triggeredBy: "automation",
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Feedback automation failed";
      await this.agentJobRunService.failRun(
        userId,
        AUTO_PROMOTION_JOB_NAME,
        periodKey,
        message,
      );
      await this.agentAuditService.record({
        surface: "agent",
        action: AUTO_PROMOTION_JOB_NAME,
        readOnly: false,
        outcome: "error",
        status: 500,
        userId,
        requestId: `feedback-auto-${periodKey}`,
        actor: "feedback-automation",
        errorCode: "FEEDBACK_AUTOMATION_FAILED",
        jobName: AUTO_PROMOTION_JOB_NAME,
        jobPeriodKey: periodKey,
        triggeredBy: "automation",
      });
      throw error;
    }
  }

  private async loadCandidates(
    limit: number,
  ): Promise<AutomationCandidateRecord[]> {
    return this.prisma.feedbackRequest.findMany({
      where: {
        status: "triaged",
        githubIssueNumber: null,
      },
      orderBy: [{ createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        classification: true,
        triageConfidence: true,
        normalizedTitle: true,
        normalizedBody: true,
        impactSummary: true,
        reproStepsJson: true,
        expectedBehavior: true,
        actualBehavior: true,
        proposedOutcome: true,
        duplicateCandidate: true,
        duplicateOfFeedbackId: true,
        duplicateOfGithubIssueNumber: true,
        githubIssueNumber: true,
        githubIssueUrl: true,
        promotionDecision: true,
        promotionReason: true,
        promotionRunId: true,
        promotionDecidedAt: true,
      },
    });
  }

  private async processCandidate(
    record: AutomationCandidateRecord,
    reviewerUserId: string,
    config: AgentConfigRecord,
    runId: string | null,
  ): Promise<FeedbackAutomationDecisionDto> {
    const blockedReason = this.getReviewReason(record, config);
    if (blockedReason) {
      return this.persistDecision(record.id, {
        decision: "review",
        reason: blockedReason,
        runId,
      });
    }

    const duplicateAssessment =
      await this.feedbackDuplicateService.detectAndPersist(record.id);
    if (duplicateAssessment.duplicateCandidate) {
      return this.persistDecision(record.id, {
        decision: "review",
        reason:
          duplicateAssessment.duplicateReason ||
          "Duplicate candidate found during auto-promotion",
        runId,
      });
    }

    if (!config.feedbackAutoPromoteEnabled) {
      return this.persistDecision(record.id, {
        decision: "review",
        reason: "Auto-promote is disabled; kept in the review queue",
        runId,
      });
    }

    try {
      await this.feedbackPromotionService.promoteFeedback(
        record.id,
        reviewerUserId,
      );
      return this.persistDecision(record.id, {
        decision: "promoted",
        reason: "Auto-promoted after passing confidence and duplicate checks",
        runId,
      });
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Auto-promotion failed: ${error.message}`
          : "Auto-promotion failed";
      return this.persistDecision(record.id, {
        decision: "review",
        reason,
        runId,
      });
    }
  }

  private getReviewReason(
    record: AutomationCandidateRecord,
    config: AgentConfigRecord,
  ): string | null {
    if (!record.classification) {
      return "Awaiting triage classification";
    }
    if (
      record.classification !== "bug" &&
      record.classification !== "feature"
    ) {
      return `Classification ${record.classification} is not allowlisted for auto-promotion`;
    }
    if (
      typeof record.triageConfidence !== "number" ||
      record.triageConfidence < config.feedbackAutoPromoteMinConfidence
    ) {
      return `Triage confidence ${this.formatConfidence(record.triageConfidence)} is below the auto-promotion threshold`;
    }
    if (record.duplicateOfFeedbackId || record.duplicateOfGithubIssueNumber) {
      return "Confirmed duplicate records must stay in human review";
    }
    if (record.duplicateCandidate) {
      return "Duplicate review is required before promotion";
    }
    if (record.githubIssueNumber) {
      return "Feedback has already been promoted";
    }

    const missingFields = this.getMissingRequiredFields(record);
    if (missingFields.length > 0) {
      return `Missing required normalized fields: ${missingFields.join(", ")}`;
    }

    return null;
  }

  private getMissingRequiredFields(
    record: AutomationCandidateRecord,
  ): string[] {
    const missing: string[] = [];
    if (!record.normalizedTitle) {
      missing.push("normalizedTitle");
    }
    if (!record.normalizedBody) {
      missing.push("normalizedBody");
    }
    if (!record.impactSummary) {
      missing.push("impactSummary");
    }

    const reproSteps = Array.isArray(record.reproStepsJson)
      ? record.reproStepsJson.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];

    if (record.classification === "bug") {
      if (reproSteps.length === 0) {
        missing.push("reproSteps");
      }
      if (!record.expectedBehavior) {
        missing.push("expectedBehavior");
      }
      if (!record.actualBehavior) {
        missing.push("actualBehavior");
      }
    }

    if (record.classification === "feature" && !record.proposedOutcome) {
      missing.push("proposedOutcome");
    }

    return missing;
  }

  private formatConfidence(value: number | null | undefined): string {
    if (typeof value !== "number") {
      return "unknown";
    }
    return value.toFixed(2);
  }

  private async persistDecision(
    feedbackId: string,
    input: {
      decision: FeedbackAutomationDecision;
      reason: string;
      runId: string | null;
    },
  ): Promise<FeedbackAutomationDecisionDto> {
    const decidedAt = new Date();
    const updated = await this.feedbackService.recordPromotionDecision(
      feedbackId,
      {
        promotionDecision: input.decision,
        promotionReason: input.reason,
        promotionRunId: input.runId,
        promotionDecidedAt: decidedAt,
      },
    );
    const decision = toDecisionDto(updated);
    if (!decision) {
      throw new Error("Failed to persist feedback automation decision");
    }
    return decision;
  }
}
