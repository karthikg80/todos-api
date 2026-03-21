import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import {
  FeedbackPromotionPreviewDto,
  FeedbackPromotionResultDto,
} from "../types";
import { AgentIdempotencyService } from "./agentIdempotencyService";
import {
  GitHubIssueAdapter,
  GitHubIssueSearchService,
} from "./githubIssueSearchService";
import {
  DuplicatePromotionConflictError,
  FeedbackDuplicateService,
} from "./feedbackDuplicateService";
import { renderFeedbackIssuePreview } from "./feedbackIssueRenderer";
import { FeedbackService } from "./feedbackService";
import { FailedAutomationActionService } from "./failedAutomationActionService";
import { FeedbackFailureService } from "./feedbackFailureService";

type PromotionRecord = {
  id: string;
  userId: string;
  type: "bug" | "feature" | "general";
  status: "new" | "triaged" | "promoted" | "rejected";
  classification:
    | "bug"
    | "feature"
    | "support"
    | "duplicate_candidate"
    | "noise"
    | null;
  normalizedTitle: string | null;
  normalizedBody: string | null;
  impactSummary: string | null;
  reproStepsJson: unknown;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  proposedOutcome: string | null;
  triageSummary: string | null;
  missingInfoJson: unknown;
  agentLabelsJson: unknown;
  pageUrl: string | null;
  appVersion: string | null;
  userAgent: string | null;
  screenshotUrl: string | null;
  duplicateCandidate: boolean;
  duplicateReason: string | null;
  duplicateOfFeedbackId: string | null;
  duplicateOfGithubIssueNumber: number | null;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
};

export interface FeedbackPromotionServiceDeps {
  feedbackService?: FeedbackService;
  feedbackDuplicateService?: FeedbackDuplicateService;
  gitHubIssueAdapter?: GitHubIssueAdapter;
  feedbackFailureService?: FeedbackFailureService;
  agentIdempotencyService?: AgentIdempotencyService;
}

const FEEDBACK_PROMOTION_ACTION = "feedback_promote";

function buildPromotionIdempotencyKey(
  feedbackId: string,
  preview: FeedbackPromotionPreviewDto,
): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        feedbackId,
        title: preview.title,
        body: preview.body,
        labels: preview.labels,
      }),
    )
    .digest("hex")
    .slice(0, 24);
  return `${feedbackId}:${digest}`;
}

export class FeedbackPromotionService {
  private readonly feedbackService: FeedbackService;
  private readonly feedbackDuplicateService: FeedbackDuplicateService;
  private readonly gitHubIssueAdapter: GitHubIssueAdapter;
  private readonly feedbackFailureService: FeedbackFailureService;
  private readonly agentIdempotencyService: AgentIdempotencyService;

  constructor(
    private readonly prisma: PrismaClient,
    deps: FeedbackPromotionServiceDeps = {},
  ) {
    this.feedbackService = deps.feedbackService ?? new FeedbackService(prisma);
    this.feedbackDuplicateService =
      deps.feedbackDuplicateService ?? new FeedbackDuplicateService(prisma);
    this.gitHubIssueAdapter =
      deps.gitHubIssueAdapter ?? new GitHubIssueSearchService();
    this.feedbackFailureService =
      deps.feedbackFailureService ??
      new FeedbackFailureService(new FailedAutomationActionService(prisma));
    this.agentIdempotencyService =
      deps.agentIdempotencyService ?? new AgentIdempotencyService(prisma);
  }

  async buildPreview(feedbackId: string): Promise<FeedbackPromotionPreviewDto> {
    const record = await this.loadRecord(feedbackId);
    return renderFeedbackIssuePreview(record);
  }

  async promoteFeedback(
    feedbackId: string,
    reviewerUserId: string,
    options: { ignoreDuplicateSuggestion?: boolean } = {},
  ): Promise<FeedbackPromotionResultDto> {
    if (!options.ignoreDuplicateSuggestion) {
      await this.feedbackDuplicateService.assertPromotionIsSafe(feedbackId);
    }

    const preview = await this.buildPreview(feedbackId);
    const idempotencyKey = buildPromotionIdempotencyKey(feedbackId, preview);
    const replay = await this.agentIdempotencyService.lookup(
      FEEDBACK_PROMOTION_ACTION,
      reviewerUserId,
      idempotencyKey,
      {
        feedbackId,
        ignoreDuplicateSuggestion: Boolean(options.ignoreDuplicateSuggestion),
        preview,
      },
    );
    if (replay.kind === "conflict") {
      throw new Error(
        "Retry payload changed for the same promotion idempotency key",
      );
    }
    if (replay.kind === "replay") {
      return replay.body as FeedbackPromotionResultDto;
    }

    if (preview.existingGithubIssueNumber || preview.existingGithubIssueUrl) {
      throw new Error("Feedback has already been promoted");
    }

    const recovered = await this.tryRecoverRecordedPromotion(
      feedbackId,
      reviewerUserId,
      preview,
      idempotencyKey,
      options,
    );
    if (recovered) {
      return recovered;
    }

    let createdIssue: { number: number; url: string } | null = null;
    try {
      createdIssue = await this.gitHubIssueAdapter.createIssue({
        title: preview.title,
        body: preview.body,
      });
      await this.gitHubIssueAdapter.applyLabels(
        createdIssue.number,
        preview.labels,
      );

      const promotedAt = new Date();
      await this.feedbackService.recordPromotion(feedbackId, reviewerUserId, {
        githubIssueNumber: createdIssue.number,
        githubIssueUrl: createdIssue.url,
        promotedAt,
      });

      const result = {
        issueNumber: createdIssue.number,
        issueUrl: createdIssue.url,
        promotedAt: promotedAt.toISOString(),
        preview,
      };
      await this.feedbackFailureService.resolveOpenForFeedback(
        feedbackId,
        "feedback.promotion",
      );
      await this.agentIdempotencyService.store(
        FEEDBACK_PROMOTION_ACTION,
        reviewerUserId,
        idempotencyKey,
        {
          feedbackId,
          ignoreDuplicateSuggestion: Boolean(options.ignoreDuplicateSuggestion),
          preview,
        },
        200,
        result,
      );
      return result;
    } catch (error) {
      const record = await this.loadRecord(feedbackId);
      await this.feedbackFailureService.record({
        userId: record.userId,
        feedbackId,
        actionType: "feedback.promotion",
        errorCode: "PROMOTION_FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Feedback promotion failed",
        payload: {
          feedbackId,
          preview,
          createdIssue,
          labels: preview.labels,
          idempotencyKey,
          ignoreDuplicateSuggestion: Boolean(options.ignoreDuplicateSuggestion),
        },
        retryable: true,
      });
      throw error;
    }
  }

  private async loadRecord(feedbackId: string): Promise<PromotionRecord> {
    const record = await this.prisma.feedbackRequest.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        classification: true,
        normalizedTitle: true,
        normalizedBody: true,
        impactSummary: true,
        reproStepsJson: true,
        expectedBehavior: true,
        actualBehavior: true,
        proposedOutcome: true,
        triageSummary: true,
        missingInfoJson: true,
        agentLabelsJson: true,
        pageUrl: true,
        appVersion: true,
        userAgent: true,
        screenshotUrl: true,
        duplicateCandidate: true,
        duplicateReason: true,
        duplicateOfFeedbackId: true,
        duplicateOfGithubIssueNumber: true,
        githubIssueNumber: true,
        githubIssueUrl: true,
      },
    });

    if (!record) {
      throw new Error("Feedback request not found");
    }

    return record;
  }

  private async tryRecoverRecordedPromotion(
    feedbackId: string,
    reviewerUserId: string,
    preview: FeedbackPromotionPreviewDto,
    idempotencyKey: string,
    options: { ignoreDuplicateSuggestion?: boolean },
  ): Promise<FeedbackPromotionResultDto | null> {
    const failures = await this.feedbackFailureService.listOpenForFeedback(
      feedbackId,
      "feedback.promotion",
    );

    for (const failure of failures) {
      const payload =
        failure.payload && typeof failure.payload === "object"
          ? (failure.payload as {
              createdIssue?: { number?: number; url?: string };
              labels?: string[];
            })
          : {};
      const createdIssue = payload.createdIssue;
      if (
        !createdIssue ||
        typeof createdIssue.number !== "number" ||
        typeof createdIssue.url !== "string"
      ) {
        continue;
      }

      await this.gitHubIssueAdapter.applyLabels(
        createdIssue.number,
        Array.isArray(payload.labels) ? payload.labels : preview.labels,
      );
      const promotedAt = new Date();
      await this.feedbackService.recordPromotion(feedbackId, reviewerUserId, {
        githubIssueNumber: createdIssue.number,
        githubIssueUrl: createdIssue.url,
        promotedAt,
      });

      const result = {
        issueNumber: createdIssue.number,
        issueUrl: createdIssue.url,
        promotedAt: promotedAt.toISOString(),
        preview,
      };
      await this.feedbackFailureService.resolveOpenForFeedback(
        feedbackId,
        "feedback.promotion",
      );
      await this.agentIdempotencyService.store(
        FEEDBACK_PROMOTION_ACTION,
        reviewerUserId,
        idempotencyKey,
        {
          feedbackId,
          ignoreDuplicateSuggestion: Boolean(options.ignoreDuplicateSuggestion),
          preview,
        },
        200,
        result,
      );
      return result;
    }

    return null;
  }
}
