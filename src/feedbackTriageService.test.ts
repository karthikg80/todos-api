import {
  FeedbackTriageService,
  triageFeedbackDeterministic,
} from "./services/feedbackTriageService";

describe("FeedbackTriageService", () => {
  it("builds a repro-oriented deterministic bug triage payload", () => {
    const result = triageFeedbackDeterministic({
      id: "feedback-1",
      type: "bug",
      title: "Task drawer crashes on save",
      body: [
        "What happened?",
        "The task drawer crashed when I hit save.",
        "",
        "What did you expect?",
        "The task should save cleanly.",
        "",
        "What were you doing right before it happened?",
        "Editing notes in the drawer.",
      ].join("\n"),
      screenshotUrl: "https://example.com/bug.png",
      pageUrl: "https://app.example.com/?view=todos",
      userAgent: "Jest Browser",
      appVersion: "1.6.0",
      triageSummary: null,
      dedupeKey: null,
    });

    expect(result.classification).toBe("bug");
    expect(result.triageConfidence).toBeGreaterThan(0.8);
    expect(result.reproSteps).toEqual([
      "Editing notes in the drawer.",
      "The task drawer crashed when I hit save.",
    ]);
    expect(result.expectedBehavior).toBe("The task should save cleanly.");
    expect(result.actualBehavior).toBe(
      "The task drawer crashed when I hit save.",
    );
    expect(result.labels).toContain("feedback:bug");
    expect(result.missingInfo).toEqual([]);
    expect(result.dedupeKey).toHaveLength(24);
  });

  it("falls back to deterministic triage when provider output is invalid", async () => {
    const prisma = {
      feedbackRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: "feedback-2",
          userId: "user-1",
          type: "feature",
          title: "Make weekly planning easier",
          body: [
            "What are you trying to do?",
            "Plan the week quickly.",
            "",
            "What is hard today?",
            "I have to sort tasks by hand.",
            "",
            "What would make this better?",
            "Auto-group related tasks into bundles.",
          ].join("\n"),
          screenshotUrl: null,
          pageUrl: "https://app.example.com/?view=planning",
          userAgent: "Jest Browser",
          appVersion: "1.6.0",
          triageSummary: null,
          dedupeKey: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const provider = {
      generateJson: jest.fn().mockResolvedValue({ classification: "oops" }),
    };
    const feedbackFailureService = {
      record: jest.fn().mockResolvedValue({}),
      resolveOpenForFeedback: jest.fn().mockResolvedValue(undefined),
    };
    const service = new FeedbackTriageService(prisma, {
      provider,
      feedbackFailureService: feedbackFailureService as never,
    });

    const result = await service.triageFeedback("feedback-2");

    expect(provider.generateJson).toHaveBeenCalledTimes(1);
    expect(result.classification).toBe("feature");
    expect(result.proposedOutcome).toBe(
      "Auto-group related tasks into bundles.",
    );
    expect(result.missingInfo).toEqual([]);
    expect(feedbackFailureService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackId: "feedback-2",
        actionType: "feedback.triage",
      }),
    );
    expect(prisma.feedbackRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "feedback-2" },
        data: expect.objectContaining({
          classification: "feature",
          normalizedTitle: "Make weekly planning easier",
        }),
      }),
    );
    expect(
      feedbackFailureService.resolveOpenForFeedback,
    ).not.toHaveBeenCalled();
  });
});
