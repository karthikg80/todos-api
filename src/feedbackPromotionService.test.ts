import { FeedbackPromotionService } from "./services/feedbackPromotionService";

describe("FeedbackPromotionService", () => {
  const baseRecord = {
    id: "feedback-1",
    type: "bug" as const,
    status: "triaged" as const,
    classification: "bug" as const,
    normalizedTitle: "Task drawer crashes on save",
    normalizedBody:
      "Saving from the task drawer crashes the current editing session.",
    impactSummary: "Users cannot save edits from the task drawer.",
    reproStepsJson: ["Open the task drawer", "Edit notes", "Press save"],
    expectedBehavior: "The task should save normally.",
    actualBehavior: "The task drawer crashes and loses the draft.",
    proposedOutcome: "Stabilize save handling in the task drawer.",
    triageSummary:
      'Bug feedback from "Task drawer crashes" on https://app.example.com/?view=todos.',
    missingInfoJson: [],
    agentLabelsJson: ["ui"],
    pageUrl: "https://app.example.com/?view=todos",
    appVersion: "1.6.0",
    userAgent: "Playwright Browser",
    screenshotUrl: "https://example.com/bug.png",
    duplicateCandidate: false,
    duplicateReason: null,
    duplicateOfFeedbackId: null,
    duplicateOfGithubIssueNumber: null,
    githubIssueNumber: null,
    githubIssueUrl: null,
  };

  it("builds a deterministic bug preview with stable labels", async () => {
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
      gitHubIssueAdapter: {
        searchIssues: jest.fn(),
        createIssue: jest.fn(),
        applyLabels: jest.fn(),
      },
    });

    const preview = await service.buildPreview("feedback-1");

    expect(preview).toEqual({
      issueType: "bug",
      title: "Task drawer crashes on save",
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
    expect(preview.body).not.toContain("What happened?");
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

    const service = new FeedbackPromotionService(prisma, {
      feedbackService: {
        recordPromotion,
      } as never,
      feedbackDuplicateService: {
        assertPromotionIsSafe: jest.fn().mockResolvedValue(undefined),
      } as never,
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
    expect(result.issueNumber).toBe(412);
    expect(result.preview.issueType).toBe("feature");
  });
});
