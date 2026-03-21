import {
  DuplicatePromotionConflictError,
  FeedbackDuplicateService,
} from "./services/feedbackDuplicateService";

describe("FeedbackDuplicateService", () => {
  it("detects internal feedback duplicates conservatively and skips GitHub search", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "feedback-1",
          userId: "user-1",
          type: "bug",
          status: "triaged",
          title: "Task drawer crashes on save",
          body: "Crash details",
          pageUrl: "https://app.example.com/?view=todos",
          classification: "bug",
          normalizedTitle: "Task drawer crashes on save",
          normalizedBody: "Crash details",
          dedupeKey: "same-dedupe-key",
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "feedback-2",
            type: "bug",
            status: "triaged",
            title: "Task drawer crashes on save",
            body: "Same crash details",
            pageUrl: "https://app.example.com/?view=todos",
            classification: "bug",
            normalizedTitle: "Task drawer crashes on save",
            normalizedBody: "Same crash details",
            dedupeKey: "same-dedupe-key",
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const gitHubSearchAdapter = {
      searchIssues: jest.fn(),
    };
    const service = new FeedbackDuplicateService(prisma, {
      gitHubSearchAdapter,
    });

    const assessment = await service.detectAndPersist("feedback-1");

    expect(assessment).toEqual({
      duplicateCandidate: true,
      matchedFeedbackIds: ["feedback-2"],
      matchedGithubIssueNumber: null,
      matchedGithubIssueUrl: null,
      duplicateReason: "Matching dedupe key with normalized feedback",
    });
    expect(gitHubSearchAdapter.searchIssues).not.toHaveBeenCalled();
  });

  it("uses GitHub issue search when no internal duplicate is found", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "feedback-1",
          userId: "user-1",
          type: "feature",
          status: "triaged",
          title: "Add planning bundles",
          body: "Feature details",
          pageUrl: "https://app.example.com/?view=planning",
          classification: "feature",
          normalizedTitle: "Add planning bundles",
          normalizedBody: "Feature details",
          dedupeKey: "feature-dedupe-key",
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const gitHubSearchAdapter = {
      searchIssues: jest.fn().mockResolvedValue([
        {
          number: 405,
          url: "https://github.com/karthikg80/todos-api/issues/405",
          title: "Add planning bundles",
          state: "open",
        },
      ]),
    };
    const service = new FeedbackDuplicateService(prisma, {
      gitHubSearchAdapter,
    });

    const assessment = await service.detectAndPersist("feedback-1");

    expect(gitHubSearchAdapter.searchIssues).toHaveBeenCalledTimes(1);
    expect(assessment).toEqual({
      duplicateCandidate: true,
      matchedFeedbackIds: [],
      matchedGithubIssueNumber: 405,
      matchedGithubIssueUrl:
        "https://github.com/karthikg80/todos-api/issues/405",
      duplicateReason: "Likely matches GitHub issue #405",
    });
  });

  it("throws a promotion conflict when duplicates are found", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "feedback-1",
          userId: "user-1",
          type: "bug",
          status: "triaged",
          title: "Task drawer crashes on save",
          body: "Crash details",
          pageUrl: "https://app.example.com/?view=todos",
          classification: "bug",
          normalizedTitle: "Task drawer crashes on save",
          normalizedBody: "Crash details",
          dedupeKey: "same-dedupe-key",
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "feedback-2",
            type: "bug",
            status: "triaged",
            title: "Task drawer crashes on save",
            body: "Same crash details",
            pageUrl: "https://app.example.com/?view=todos",
            classification: "bug",
            normalizedTitle: "Task drawer crashes on save",
            normalizedBody: "Same crash details",
            dedupeKey: "same-dedupe-key",
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new FeedbackDuplicateService(prisma);

    await expect(
      service.assertPromotionIsSafe("feedback-1"),
    ).rejects.toBeInstanceOf(DuplicatePromotionConflictError);
  });

  it("records duplicate-search failures conservatively when GitHub lookup fails", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "feedback-1",
          userId: "user-1",
          type: "feature",
          status: "triaged",
          title: "Add planning bundles",
          body: "Feature details",
          pageUrl: "https://app.example.com/?view=planning",
          classification: "feature",
          normalizedTitle: "Add planning bundles",
          normalizedBody: "Feature details",
          dedupeKey: "feature-dedupe-key",
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const feedbackFailureService = {
      record: jest.fn().mockResolvedValue({}),
      resolveOpenForFeedback: jest.fn().mockResolvedValue(undefined),
    };
    const gitHubSearchAdapter = {
      searchIssues: jest
        .fn()
        .mockRejectedValue(new Error("GitHub unavailable")),
    };
    const service = new FeedbackDuplicateService(prisma, {
      gitHubSearchAdapter,
      feedbackFailureService: feedbackFailureService as never,
    });

    const assessment = await service.detectAndPersist("feedback-1");

    expect(assessment).toEqual({
      duplicateCandidate: false,
      matchedFeedbackIds: [],
      matchedGithubIssueNumber: null,
      matchedGithubIssueUrl: null,
      duplicateReason: null,
    });
    expect(feedbackFailureService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackId: "feedback-1",
        actionType: "feedback.duplicate_search",
      }),
    );
    expect(
      feedbackFailureService.resolveOpenForFeedback,
    ).not.toHaveBeenCalled();
  });
});
