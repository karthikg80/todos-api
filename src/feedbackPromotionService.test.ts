import { FeedbackPromotionService } from "./services/feedbackPromotionService";

describe("FeedbackPromotionService", () => {
  const baseRecord = {
    id: "feedback-1",
    userId: "user-1",
    type: "bug" as const,
    status: "triaged" as const,
    classification: "bug" as const,
    normalizedTitle: "Task drawer crashes on save for reporter@example.com",
    normalizedBody:
      "Saving from the task drawer crashes the current editing session for reporter@example.com.",
    impactSummary: "Users cannot save edits from the task drawer.",
    reproStepsJson: ["Open the task drawer", "Edit notes", "Press save"],
    expectedBehavior: "The task should save normally.",
    actualBehavior: "The task drawer crashes and loses the draft.",
    proposedOutcome: "Stabilize save handling in the task drawer.",
    triageSummary:
      'Bug feedback from "Task drawer crashes" on https://app.example.com/?view=todos&email=reporter@example.com.',
    missingInfoJson: [],
    agentLabelsJson: ["ui"],
    pageUrl: "https://app.example.com/?view=todos&email=reporter@example.com",
    appVersion: "1.6.0",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    screenshotUrl: "https://example.com/private/bug.png",
    duplicateCandidate: false,
    duplicateReason: null,
    duplicateOfFeedbackId: null,
    duplicateOfGithubIssueNumber: null,
    githubIssueNumber: null,
    githubIssueUrl: null,
  };

  it("builds a deterministic bug preview with stable labels and redacts sensitive context", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue(baseRecord),
      },
    } as never;

    const service = new FeedbackPromotionService(prisma, {
      feedbackService: {
        recordPromotion: jest.fn(),
      } as never,
      feedbackDuplicateService: {
        assertPromotionIsSafe: jest.fn(),
      } as never,
      feedbackFailureService: {
        listOpenForFeedback: jest.fn().mockResolvedValue([]),
        resolveOpenForFeedback: jest.fn().mockResolvedValue(undefined),
        record: jest.fn(),
      } as never,
      agentIdempotencyService: {
        lookup: jest.fn().mockResolvedValue({ kind: "miss" }),
        store: jest.fn().mockResolvedValue(undefined),
      } as never,
      gitHubIssueAdapter: {
        searchIssues: jest.fn(),
        createIssue: jest.fn(),
        applyLabels: jest.fn(),
      },
    });

    const preview = await service.buildPreview("feedback-1");

    expect(preview).toEqual({
      issueType: "bug",
      title: "Task drawer crashes on save for [redacted-email]",
      body: expect.stringContaining("## Steps To Reproduce"),
      labels: ["bug", "triaged-by-agent", "ui"],
      sourceFeedbackIds: ["feedback-1"],
      canPromote: true,
      duplicateCandidate: false,
      duplicateReason: null,
      existingGithubIssueNumber: null,
      existingGithubIssueUrl: null,
    });
    expect(preview.body).toContain("Source feedback IDs: `feedback-1`");
    expect(preview.body).toContain(
      "Screenshot captured privately in app review queue and intentionally omitted from GitHub export.",
    );
    expect(preview.body).not.toContain("reporter@example.com");
    expect(preview.body).not.toContain("?view=todos");
  });

  it("creates a GitHub issue, applies labels, and records promotion metadata", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseRecord,
          type: "feature",
          classification: "feature",
          normalizedTitle: "Add planning bundles",
          normalizedBody:
            "Users need a bundled planning flow to reduce manual setup.",
          impactSummary: "Weekly planning takes too many manual steps.",
          proposedOutcome: "Offer suggested planning bundles.",
          triageSummary: 'Feature feedback from "Add planning bundles".',
        }),
      },
    } as never;
    const recordPromotion = jest.fn().mockResolvedValue({});
    const createIssue = jest.fn().mockResolvedValue({
      number: 412,
      url: "https://github.com/karthikg80/todos-api/issues/412",
    });
    const applyLabels = jest
      .fn()
      .mockResolvedValue(["feature", "triaged-by-agent", "ui"]);
    const feedbackFailureService = {
      listOpenForFeedback: jest.fn().mockResolvedValue([]),
      resolveOpenForFeedback: jest.fn().mockResolvedValue(undefined),
      record: jest.fn(),
    };
    const agentIdempotencyService = {
      lookup: jest.fn().mockResolvedValue({ kind: "miss" }),
      store: jest.fn().mockResolvedValue(undefined),
    };

    const service = new FeedbackPromotionService(prisma, {
      feedbackService: {
        recordPromotion,
      } as never,
      feedbackDuplicateService: {
        assertPromotionIsSafe: jest.fn().mockResolvedValue(undefined),
      } as never,
      feedbackFailureService: feedbackFailureService as never,
      agentIdempotencyService: agentIdempotencyService as never,
      gitHubIssueAdapter: {
        searchIssues: jest.fn(),
        createIssue,
        applyLabels,
      },
    });

    const result = await service.promoteFeedback("feedback-1", "admin-1");

    expect(createIssue).toHaveBeenCalledWith({
      title: "Add planning bundles",
      body: expect.stringContaining("## Proposed Outcome"),
    });
    expect(applyLabels).toHaveBeenCalledWith(412, [
      "feature",
      "triaged-by-agent",
      "ui",
    ]);
    expect(recordPromotion).toHaveBeenCalledWith(
      "feedback-1",
      "admin-1",
      expect.objectContaining({
        githubIssueNumber: 412,
        githubIssueUrl: "https://github.com/karthikg80/todos-api/issues/412",
      }),
    );
    expect(agentIdempotencyService.store).toHaveBeenCalled();
    expect(result.issueNumber).toBe(412);
    expect(result.preview.issueType).toBe("feature");
  });

  it("replays an idempotent promotion result without creating another issue", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue(baseRecord),
      },
    } as never;
    const createIssue = jest.fn();
    const replayBody = {
      issueNumber: 512,
      issueUrl: "https://github.com/karthikg80/todos-api/issues/512",
      promotedAt: "2026-03-21T03:00:00.000Z",
      preview: {
        issueType: "bug",
        title: "Task drawer crashes on save",
        body: "Issue body",
        labels: ["bug"],
        sourceFeedbackIds: ["feedback-1"],
        canPromote: true,
        duplicateCandidate: false,
      },
    };
    const service = new FeedbackPromotionService(prisma, {
      feedbackService: {
        recordPromotion: jest.fn(),
      } as never,
      feedbackDuplicateService: {
        assertPromotionIsSafe: jest.fn().mockResolvedValue(undefined),
      } as never,
      feedbackFailureService: {
        listOpenForFeedback: jest.fn().mockResolvedValue([]),
        resolveOpenForFeedback: jest.fn().mockResolvedValue(undefined),
        record: jest.fn(),
      } as never,
      agentIdempotencyService: {
        lookup: jest
          .fn()
          .mockResolvedValue({ kind: "replay", status: 200, body: replayBody }),
        store: jest.fn(),
      } as never,
      gitHubIssueAdapter: {
        searchIssues: jest.fn(),
        createIssue,
        applyLabels: jest.fn(),
      },
    });

    const result = await service.promoteFeedback("feedback-1", "admin-1");

    expect(result).toEqual(replayBody);
    expect(createIssue).not.toHaveBeenCalled();
  });

  it("recovers a partially completed promotion from recorded failure state", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue(baseRecord),
      },
    } as never;
    const recordPromotion = jest.fn().mockResolvedValue({});
    const createIssue = jest.fn();
    const feedbackFailureService = {
      listOpenForFeedback: jest.fn().mockResolvedValue([
        {
          id: "failure-1",
          payload: {
            createdIssue: {
              number: 611,
              url: "https://github.com/karthikg80/todos-api/issues/611",
            },
          },
        },
      ]),
      resolveOpenForFeedback: jest.fn().mockResolvedValue(undefined),
      record: jest.fn(),
    };
    const agentIdempotencyService = {
      lookup: jest.fn().mockResolvedValue({ kind: "miss" }),
      store: jest.fn().mockResolvedValue(undefined),
    };
    const service = new FeedbackPromotionService(prisma, {
      feedbackService: {
        recordPromotion,
      } as never,
      feedbackDuplicateService: {
        assertPromotionIsSafe: jest.fn().mockResolvedValue(undefined),
      } as never,
      feedbackFailureService: feedbackFailureService as never,
      agentIdempotencyService: agentIdempotencyService as never,
      gitHubIssueAdapter: {
        searchIssues: jest.fn(),
        createIssue,
        applyLabels: jest.fn(),
      },
    });

    const result = await service.promoteFeedback("feedback-1", "admin-1");

    expect(createIssue).not.toHaveBeenCalled();
    expect(recordPromotion).toHaveBeenCalledWith(
      "feedback-1",
      "admin-1",
      expect.objectContaining({
        githubIssueNumber: 611,
      }),
    );
    expect(result.issueNumber).toBe(611);
  });
});
