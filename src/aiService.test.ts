import type { IPlannerService } from "./interfaces/IPlannerService";
import { AiPlannerService } from "./services/aiService";

function createPlannerServiceMock(): jest.Mocked<IPlannerService> {
  return {
    planProject: jest.fn(),
    ensureNextAction: jest.fn(),
    weeklyReview: jest.fn(),
    decideNextWork: jest.fn(),
    analyzeProjectHealth: jest.fn(),
    analyzeWorkGraph: jest.fn(),
  };
}

describe("AiPlannerService", () => {
  it("uses planner runtime for home_focus when user context is available", async () => {
    const plannerService = createPlannerServiceMock();
    plannerService.decideNextWork.mockResolvedValue({
      recommendedTasks: [
        {
          taskId: "task-1",
          projectId: "project-1",
          title: "Decide on travel dates",
          reason: "It is overdue and unblocks a project.",
          impact: "high",
          effort: "medium",
        },
      ],
    });

    const service = new AiPlannerService({ plannerService });
    const result = await service.generateDecisionAssistStub(
      {
        surface: "home_focus",
        topN: 3,
      },
      { userId: "user-1" },
    );

    expect(plannerService.decideNextWork).toHaveBeenCalledWith({
      userId: "user-1",
      mode: "suggest",
    });
    expect(result.surface).toBe("home_focus");
    expect(result.suggestions[0]).toMatchObject({
      type: "focus_task",
      payload: expect.objectContaining({
        taskId: "task-1",
        todoId: "task-1",
        projectId: "project-1",
        title: "Decide on travel dates",
        source: "deterministic",
      }),
    });
  });

  it("falls back to deterministic home_focus ranking when planner reuse fails", async () => {
    const plannerService = createPlannerServiceMock();
    plannerService.decideNextWork.mockRejectedValue(
      new Error("planner unavailable"),
    );
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const service = new AiPlannerService({ plannerService });
    const result = await service.generateDecisionAssistStub(
      {
        surface: "home_focus",
        topN: 3,
        todoCandidates: [
          {
            id: "task-low",
            title: "Organize notes",
            priority: "low",
          },
          {
            id: "task-high",
            title: "Renew passport",
            priority: "high",
            dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
      { userId: "user-1" },
    );

    expect(result.surface).toBe("home_focus");
    expect(
      (result.suggestions[0]?.payload as { taskId?: string } | undefined)
        ?.taskId,
    ).toBe("task-high");

    warnSpy.mockRestore();
  });
});
