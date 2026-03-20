import { InMemoryAiSuggestionStore } from "./services/aiSuggestionStore";
import { HomeFocusPrewarmService } from "./services/homeFocusPrewarmService";
import { AiPlannerService } from "./services/aiService";

function buildHomeFocusOutput() {
  return {
    requestId: "req-home-focus",
    surface: "home_focus" as const,
    must_abstain: false,
    suggestions: [
      {
        type: "focus_task" as const,
        confidence: 0.91,
        rationale:
          "This is overdue and should be resolved before more work slips.",
        suggestionId: "home-focus-1",
        payload: {
          taskId: "todo-1",
          todoId: "todo-1",
          title: "Finalize travel dates",
          summary:
            "This is overdue and should be resolved before more work slips.",
          reason:
            "This is overdue and should be resolved before more work slips.",
          source: "deterministic",
        },
      },
    ],
  };
}

describe("HomeFocusPrewarmService", () => {
  it("generates a snapshot once and reuses it while it is still fresh", async () => {
    const suggestionStore = new InMemoryAiSuggestionStore();
    const aiPlannerService = {
      generateDecisionAssistStub: jest
        .fn()
        .mockResolvedValue(buildHomeFocusOutput()),
    } as unknown as AiPlannerService;

    const service = new HomeFocusPrewarmService(
      aiPlannerService,
      suggestionStore,
    );

    const first = await service.prewarmForUser("user-1", {
      topN: 3,
      freshnessHours: 18,
      periodKey: "2026-03-19",
      timezone: "America/New_York",
    });
    const second = await service.prewarmForUser("user-1", {
      topN: 3,
      freshnessHours: 18,
      periodKey: "2026-03-19",
      timezone: "America/New_York",
    });

    expect(first.status).toBe("generated");
    expect(first.suggestionCount).toBe(1);
    expect(second.status).toBe("reused");
    expect(second.suggestionId).toBe(first.suggestionId);
    expect(
      (aiPlannerService.generateDecisionAssistStub as jest.Mock).mock.calls,
    ).toHaveLength(1);
  });
});
