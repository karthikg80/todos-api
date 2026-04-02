import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "../config";
import {
  GitHubIssueMatch,
  GitHubIssueSearchAdapter,
  GitHubIssueSearchService,
} from "./githubIssueSearchService";
import { FailedAutomationActionService } from "./failedAutomationActionService";
import { FeedbackFailureService } from "./feedbackFailureService";

type FeedbackDuplicateRecord = {
  id: string;
  userId: string;
  type: "bug" | "feature" | "general";
  status: "new" | "triaged" | "promoted" | "rejected" | "resolved";
  title: string;
  body: string;
  pageUrl: string | null;
  classification:
    | "bug"
    | "feature"
    | "support"
    | "duplicate_candidate"
    | "noise"
    | null;
  normalizedTitle: string | null;
  normalizedBody: string | null;
  dedupeKey: string | null;
};

export interface FeedbackDuplicateAssessment {
  duplicateCandidate: boolean;
  matchedFeedbackIds: string[];
  matchedGithubIssueNumber: number | null;
  matchedGithubIssueUrl: string | null;
  duplicateReason: string | null;
}

export interface FeedbackDuplicateServiceDeps {
  gitHubSearchAdapter?: GitHubIssueSearchAdapter;
  feedbackFailureService?: FeedbackFailureService;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(a|an|the|to|for|in|on|at|by|with|from|of|and)\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, column) =>
      row === 0 ? column : column === 0 ? row : 0,
    ),
  );
  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      matrix[row][column] =
        a[row - 1] === b[column - 1]
          ? matrix[row - 1][column - 1]
          : 1 +
            Math.min(
              matrix[row - 1][column],
              matrix[row][column - 1],
              matrix[row - 1][column - 1],
            );
    }
  }
  return matrix[a.length][b.length];
}

function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 0;
  return 1 - levenshtein(a, b) / maxLength;
}

function sharedTokenCount(a: string, b: string): number {
  const left = new Set(a.split(" ").filter((token) => token.length >= 4));
  const right = new Set(b.split(" ").filter((token) => token.length >= 4));
  let shared = 0;
  left.forEach((token) => {
    if (right.has(token)) {
      shared += 1;
    }
  });
  return shared;
}

function buildSearchQuery(record: FeedbackDuplicateRecord): string {
  const normalizedTitle = normalizeText(record.normalizedTitle || record.title);
  const terms = normalizedTitle
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 6)
    .join(" ");
  return `repo:${config.githubRepo} is:issue "${terms || record.title}"`;
}

function buildAssessmentUpdate(
  assessment: FeedbackDuplicateAssessment,
): Prisma.FeedbackRequestUpdateInput {
  return {
    duplicateCandidate: assessment.duplicateCandidate,
    matchedFeedbackIds:
      assessment.matchedFeedbackIds.length > 0
        ? (assessment.matchedFeedbackIds as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    matchedGithubIssueNumber: assessment.matchedGithubIssueNumber,
    matchedGithubIssueUrl: assessment.matchedGithubIssueUrl,
    duplicateReason: assessment.duplicateReason,
  };
}

function buildEmptyAssessment(): FeedbackDuplicateAssessment {
  return {
    duplicateCandidate: false,
    matchedFeedbackIds: [],
    matchedGithubIssueNumber: null,
    matchedGithubIssueUrl: null,
    duplicateReason: null,
  };
}

function scoreGitHubIssue(
  record: FeedbackDuplicateRecord,
  issue: GitHubIssueMatch,
): number {
  const normalizedRecord = normalizeText(
    record.normalizedTitle || record.title,
  );
  const normalizedIssue = normalizeText(issue.title);
  const similarity = similarityScore(normalizedRecord, normalizedIssue);
  const tokenOverlap = sharedTokenCount(normalizedRecord, normalizedIssue);

  if (normalizedRecord === normalizedIssue) {
    return 1;
  }
  if (similarity >= 0.94 && tokenOverlap >= 3) {
    return similarity;
  }
  return 0;
}

export class DuplicatePromotionConflictError extends Error {
  constructor(
    public readonly assessment: FeedbackDuplicateAssessment,
    message = "Duplicate candidate found",
  ) {
    super(message);
    this.name = "DuplicatePromotionConflictError";
  }
}

export class FeedbackDuplicateService {
  private readonly gitHubSearchAdapter: GitHubIssueSearchAdapter;
  private readonly feedbackFailureService: FeedbackFailureService;

  constructor(
    private readonly prisma: PrismaClient,
    deps: FeedbackDuplicateServiceDeps = {},
  ) {
    this.gitHubSearchAdapter =
      deps.gitHubSearchAdapter ?? new GitHubIssueSearchService();
    this.feedbackFailureService =
      deps.feedbackFailureService ??
      new FeedbackFailureService(new FailedAutomationActionService(prisma));
  }

  async detectAndPersist(
    feedbackId: string,
  ): Promise<FeedbackDuplicateAssessment> {
    const record = await this.prisma.feedbackRequest.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        title: true,
        body: true,
        pageUrl: true,
        classification: true,
        normalizedTitle: true,
        normalizedBody: true,
        dedupeKey: true,
      },
    });

    if (!record) {
      throw new Error("Feedback request not found");
    }

    const internalMatches = await this.findInternalMatches(record);
    const githubSearchResult =
      internalMatches.matchedFeedbackIds.length > 0 ||
      record.classification === "noise"
        ? { match: null, failed: false }
        : await this.findGitHubIssueMatch(record);
    const githubMatch = githubSearchResult.match;

    const assessment: FeedbackDuplicateAssessment =
      internalMatches.matchedFeedbackIds.length > 0 || githubMatch
        ? {
            duplicateCandidate: true,
            matchedFeedbackIds: internalMatches.matchedFeedbackIds,
            matchedGithubIssueNumber: githubMatch?.number ?? null,
            matchedGithubIssueUrl: githubMatch?.url ?? null,
            duplicateReason:
              internalMatches.duplicateReason ||
              (githubMatch
                ? `Likely matches GitHub issue #${githubMatch.number}`
                : null),
          }
        : buildEmptyAssessment();

    await this.prisma.feedbackRequest.update({
      where: { id: feedbackId },
      data: buildAssessmentUpdate(assessment),
    });
    if (!githubSearchResult.failed) {
      await this.feedbackFailureService.resolveOpenForFeedback(
        feedbackId,
        "feedback.duplicate_search",
      );
    }

    return assessment;
  }

  async assertPromotionIsSafe(feedbackId: string): Promise<void> {
    const assessment = await this.detectAndPersist(feedbackId);
    if (assessment.duplicateCandidate) {
      throw new DuplicatePromotionConflictError(assessment);
    }
  }

  private async findInternalMatches(
    record: FeedbackDuplicateRecord,
  ): Promise<FeedbackDuplicateAssessment> {
    const candidates = await this.prisma.feedbackRequest.findMany({
      where: {
        id: { not: record.id },
        status: { not: "rejected" },
        ...(record.classification
          ? { classification: record.classification }
          : { type: record.type }),
      },
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        body: true,
        pageUrl: true,
        classification: true,
        normalizedTitle: true,
        normalizedBody: true,
        dedupeKey: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 25,
    });

    const normalizedRecord = normalizeText(
      record.normalizedTitle || record.title,
    );
    const matchedFeedbackIds: string[] = [];
    let duplicateReason: string | null = null;

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeText(
        candidate.normalizedTitle || candidate.title,
      );
      const sameKey =
        Boolean(record.dedupeKey) &&
        Boolean(candidate.dedupeKey) &&
        record.dedupeKey === candidate.dedupeKey;
      const sameNormalizedTitle =
        normalizedRecord.length > 0 && normalizedRecord === normalizedCandidate;
      const similarTitle =
        similarityScore(normalizedRecord, normalizedCandidate) >= 0.95 &&
        sharedTokenCount(normalizedRecord, normalizedCandidate) >= 3;

      if (sameKey || sameNormalizedTitle || similarTitle) {
        matchedFeedbackIds.push(candidate.id);
        if (!duplicateReason) {
          duplicateReason = sameKey
            ? "Matching dedupe key with normalized feedback"
            : sameNormalizedTitle
              ? "Matching normalized title with existing feedback"
              : "Very similar normalized title with existing feedback";
        }
      }
    }

    return {
      duplicateCandidate: matchedFeedbackIds.length > 0,
      matchedFeedbackIds: matchedFeedbackIds.slice(0, 5),
      matchedGithubIssueNumber: null,
      matchedGithubIssueUrl: null,
      duplicateReason,
    };
  }

  private async findGitHubIssueMatch(
    record: FeedbackDuplicateRecord,
  ): Promise<{ match: GitHubIssueMatch | null; failed: boolean }> {
    try {
      const issues = await this.gitHubSearchAdapter.searchIssues(
        buildSearchQuery(record),
      );
      let bestMatch: GitHubIssueMatch | null = null;
      let bestScore = 0;
      for (const issue of issues) {
        const score = scoreGitHubIssue(record, issue);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = issue;
        }
      }
      return { match: bestScore >= 0.94 ? bestMatch : null, failed: false };
    } catch (error) {
      await this.feedbackFailureService.record({
        userId: record.userId,
        feedbackId: record.id,
        actionType: "feedback.duplicate_search",
        errorCode: "DUPLICATE_SEARCH_FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Duplicate search failed",
        payload: {
          feedbackId: record.id,
          query: buildSearchQuery(record),
        },
        retryable: true,
      });
      return { match: null, failed: true };
    }
  }
}
