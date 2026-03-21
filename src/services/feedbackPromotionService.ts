import { PrismaClient } from "@prisma/client";
import {
  FeedbackPromotionPreviewDto,
  FeedbackPromotionResultDto,
} from "../types";
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

type PromotionRecord = {
  id: string;
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
}

export class FeedbackPromotionService {
  private readonly feedbackService: FeedbackService;
  private readonly feedbackDuplicateService: FeedbackDuplicateService;
  private readonly gitHubIssueAdapter: GitHubIssueAdapter;

  constructor(
    private readonly prisma: PrismaClient,
    deps: FeedbackPromotionServiceDeps = {},
  ) {
    this.feedbackService = deps.feedbackService ?? new FeedbackService(prisma);
    this.feedbackDuplicateService =
      deps.feedbackDuplicateService ?? new FeedbackDuplicateService(prisma);
    this.gitHubIssueAdapter =
      deps.gitHubIssueAdapter ?? new GitHubIssueSearchService();
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
    if (preview.existingGithubIssueNumber || preview.existingGithubIssueUrl) {
      throw new Error("Feedback has already been promoted");
    }
    const createdIssue = await this.gitHubIssueAdapter.createIssue({
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

    return {
      issueNumber: createdIssue.number,
      issueUrl: createdIssue.url,
      promotedAt: promotedAt.toISOString(),
      preview,
    };
  }

  private async loadRecord(feedbackId: string): Promise<PromotionRecord> {
    const record = await this.prisma.feedbackRequest.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
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
}
