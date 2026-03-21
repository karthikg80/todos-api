import { FeedbackAutomationService } from "./services/feedbackAutomationService";

describe("FeedbackAutomationService", () => {
  const baseConfig = {
    id: "config-1",
    userId: "admin-1",
    dailyEnabled: true,
    weeklyEnabled: true,
    inboxEnabled: true,
    watchdogEnabled: true,
    decomposerEnabled: true,
    feedbackAutomationEnabled: true,
    feedbackAutoPromoteEnabled: true,
    feedbackAutoPromoteMinConfidence: 0.9,
    autoApply: false,
    maxWriteActionsPerRun: 20,
    inboxConfidenceThreshold: 0.9,
    staleThresholdDays: 14,
    waitingFollowUpDays: 7,
    plannerWeightPriority: 1,
    plannerWeightDueDate: 1,
    plannerWeightEnergyMatch: 1,
    plannerWeightEstimateFit: 1,
    plannerWeightFreshness: 1,
    createdAt: new Date("2026-03-21T03:00:00.000Z"),
    updatedAt: new Date("2026-03-21T03:00:00.000Z"),
  };

  const eligibleCandidate = {
    id: "feedback-1",
    title: "Task drawer crashes on save",
    type: "bug" as const,
    status: "triaged" as const,
    classification: "bug" as const,
    triageConfidence: 0.96,
    normalizedTitle: "Task drawer crashes on save",
    normalizedBody:
      "Saving from the task drawer crashes the current editing session.",
    impactSummary: "Users cannot save edits from the task drawer.",
    reproStepsJson: ["Open the task drawer", "Edit notes", "Press save"],
    expectedBehavior: "The task should save normally.",
    actualBehavior: "The task drawer crashes and loses the draft.",
    proposedOutcome: "Stabilize drawer save handling.",
    duplicateCandidate: false,
    duplicateOfFeedbackId: null,
    duplicateOfGithubIssueNumber: null,
    githubIssueNumber: null,
    githubIssueUrl: null,
    promotionDecision: null,
    promotionReason: null,
    promotionRunId: null,
    promotionDecidedAt: null,
  };

  it("auto-promotes eligible triaged feedback", async () => {
    const claimRun = jest.fn().mockResolvedValue({
      claimed: true,
      run: { id: "run-1" },
    });
    const completeRun = jest.fn().mockResolvedValue(true);
    const promoteFeedback = jest.fn().mockResolvedValue({
      issueNumber: 512,
      issueUrl: "https://github.com/karthikg80/todos-api/issues/512",
    });
    const recordPromotionDecision = jest.fn().mockResolvedValue({
      ...eligibleCandidate,
      status: "promoted",
      promotionDecision: "promoted",
      promotionReason:
        "Auto-promoted after passing confidence and duplicate checks",
      promotionRunId: "run-1",
      promotionDecidedAt: new Date("2026-03-21T03:05:00.000Z"),
      githubIssueNumber: 512,
      githubIssueUrl: "https://github.com/karthikg80/todos-api/issues/512",
      user: { id: "user-1", email: "user@example.com", name: "User" },
      reviewer: { id: "admin-1", email: "admin@example.com", name: "Admin" },
      userId: "user-1",
      body: "raw",
      screenshotUrl: null,
      attachmentMetadata: null,
      pageUrl: null,
      userAgent: null,
      appVersion: null,
      agentLabels: [],
      missingInfo: [],
      triageSummary: null,
      severity: null,
      dedupeKey: null,
      matchedFeedbackIds: [],
      matchedGithubIssueNumber: null,
      matchedGithubIssueUrl: null,
      duplicateOfGithubIssueUrl: null,
      promotedAt: "2026-03-21T03:05:00.000Z",
      reviewedByUserId: "admin-1",
      reviewedAt: "2026-03-21T03:05:00.000Z",
      rejectionReason: null,
      createdAt: "2026-03-21T03:00:00.000Z",
      updatedAt: "2026-03-21T03:05:00.000Z",
    });

    const service = new FeedbackAutomationService(
      {
        feedbackRequest: {
          findMany: jest.fn().mockResolvedValue([eligibleCandidate]),
        },
      } as never,
      {
        agentConfigService: {
          getConfig: jest.fn().mockResolvedValue(baseConfig),
        } as never,
        agentJobRunService: {
          claimRun,
          completeRun,
          failRun: jest.fn(),
        } as never,
        agentAuditService: {
          record: jest.fn().mockResolvedValue(undefined),
        } as never,
        feedbackDuplicateService: {
          detectAndPersist: jest.fn().mockResolvedValue({
            duplicateCandidate: false,
            matchedFeedbackIds: [],
            matchedGithubIssueNumber: null,
            matchedGithubIssueUrl: null,
            duplicateReason: null,
          }),
        } as never,
        feedbackPromotionService: {
          promoteFeedback,
        } as never,
        feedbackService: {
          recordPromotionDecision,
        } as never,
      },
    );

    const result = await service.runAutoPromotion("admin-1", { limit: 10 });

    expect(result.claimed).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.promotedCount).toBe(1);
    expect(result.reviewCount).toBe(0);
    expect(promoteFeedback).toHaveBeenCalledWith("feedback-1", "admin-1");
    expect(recordPromotionDecision).toHaveBeenCalledWith(
      "feedback-1",
      expect.objectContaining({
        promotionDecision: "promoted",
        promotionRunId: "run-1",
      }),
    );
    expect(completeRun).toHaveBeenCalled();
  });

  it("routes low-confidence feedback to human review", async () => {
    const reviewCandidate = {
      ...eligibleCandidate,
      id: "feedback-2",
      triageConfidence: 0.74,
    };
    const promoteFeedback = jest.fn();
    const recordPromotionDecision = jest.fn().mockResolvedValue({
      ...reviewCandidate,
      promotionDecision: "review",
      promotionReason:
        "Triage confidence 0.74 is below the auto-promotion threshold",
      promotionRunId: "run-2",
      promotionDecidedAt: new Date("2026-03-21T03:10:00.000Z"),
      user: { id: "user-1", email: "user@example.com", name: "User" },
      reviewer: null,
      userId: "user-1",
      body: "raw",
      screenshotUrl: null,
      attachmentMetadata: null,
      pageUrl: null,
      userAgent: null,
      appVersion: null,
      agentLabels: [],
      missingInfo: [],
      triageSummary: null,
      severity: null,
      dedupeKey: null,
      matchedFeedbackIds: [],
      matchedGithubIssueNumber: null,
      matchedGithubIssueUrl: null,
      duplicateOfGithubIssueUrl: null,
      promotedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: "2026-03-21T03:00:00.000Z",
      updatedAt: "2026-03-21T03:10:00.000Z",
    });

    const service = new FeedbackAutomationService(
      {
        feedbackRequest: {
          findMany: jest.fn().mockResolvedValue([reviewCandidate]),
        },
      } as never,
      {
        agentConfigService: {
          getConfig: jest.fn().mockResolvedValue({
            ...baseConfig,
            feedbackAutoPromoteMinConfidence: 0.9,
          }),
        } as never,
        agentJobRunService: {
          claimRun: jest.fn().mockResolvedValue({
            claimed: true,
            run: { id: "run-2" },
          }),
          completeRun: jest.fn().mockResolvedValue(true),
          failRun: jest.fn(),
        } as never,
        agentAuditService: {
          record: jest.fn().mockResolvedValue(undefined),
        } as never,
        feedbackDuplicateService: {
          detectAndPersist: jest.fn(),
        } as never,
        feedbackPromotionService: {
          promoteFeedback,
        } as never,
        feedbackService: {
          recordPromotionDecision,
        } as never,
      },
    );

    const result = await service.runAutoPromotion("admin-1", { limit: 10 });

    expect(result.promotedCount).toBe(0);
    expect(result.reviewCount).toBe(1);
    expect(promoteFeedback).not.toHaveBeenCalled();
    expect(recordPromotionDecision).toHaveBeenCalledWith(
      "feedback-2",
      expect.objectContaining({
        promotionDecision: "review",
      }),
    );
  });
});
