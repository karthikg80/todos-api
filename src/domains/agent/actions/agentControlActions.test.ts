import { registerAgentControlActions } from "./agentControlActions";
import { ActionRegistry, type ActionRuntime } from "./actionRegistry";
import type { AgentExecutionContext } from "./agentTypes";

function createRuntime(overrides: Partial<ActionRuntime> = {}): ActionRuntime {
  return {
    agentService: {} as ActionRuntime["agentService"],
    jobRunService: {
      claimRun: jest.fn(),
      completeRun: jest.fn(),
      failRun: jest.fn(),
      getRunStatus: jest.fn(),
      replayRun: jest.fn(),
      listRuns: jest.fn(),
    } as unknown as ActionRuntime["jobRunService"],
    metricsService: {} as ActionRuntime["metricsService"],
    feedbackService: {} as ActionRuntime["feedbackService"],
    dayContextService: {} as ActionRuntime["dayContextService"],
    agentConfigService: {} as ActionRuntime["agentConfigService"],
    failedActionService: {} as ActionRuntime["failedActionService"],
    executiveSummaryService: {} as ActionRuntime["executiveSummaryService"],
    evaluationService: {} as ActionRuntime["evaluationService"],
    learningRecommendationService:
      {} as ActionRuntime["learningRecommendationService"],
    frictionService: {} as ActionRuntime["frictionService"],
    actionPolicyService: {} as ActionRuntime["actionPolicyService"],
    captureService: null,
    projectService: undefined,
    persistencePrisma: {
      agentActionAudit: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as ActionRuntime["persistencePrisma"],
    exec: {
      handleIdempotent: jest.fn(),
      buildDryRunResult: jest.fn(),
      success: jest.fn((action, readOnly, context, status, data) => ({
        status,
        body: {
          ok: true,
          action,
          readOnly,
          data,
          trace: {
            requestId: context.requestId,
          },
        },
      })),
    },
    ...overrides,
  };
}

describe("registerAgentControlActions", () => {
  const context: AgentExecutionContext = {
    userId: "user-1",
    requestId: "req-1",
    actor: "orla",
    surface: "agent",
  };

  it("records a narration entry when a job run completes", async () => {
    const registry = new ActionRegistry();
    registerAgentControlActions(registry);

    const runtime = createRuntime();
    const completeRun = jest
      .spyOn(runtime.jobRunService, "completeRun")
      .mockResolvedValue(true);

    const handler = registry.getRaw("complete_job_run");

    expect(handler).toBeDefined();

    const result = await handler!(
      {
        jobName: "evaluator_daily",
        periodKey: "2026-04-10",
        metadata: {
          acceptanceRate: 0.8,
          learningRecordingCount: 2,
          autoAppliedCount: 1,
        },
      },
      context,
      runtime,
    );

    expect(completeRun).toHaveBeenCalledWith(
      "user-1",
      "evaluator_daily",
      "2026-04-10",
      {
        acceptanceRate: 0.8,
        learningRecordingCount: 2,
        autoAppliedCount: 1,
      },
    );
    expect(
      runtime.persistencePrisma?.agentActionAudit.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "record_job_narration",
          agentId: "orla",
          jobName: "evaluator_daily",
          jobPeriodKey: "2026-04-10",
          narration:
            "evaluator_daily completed successfully. acceptance rate: 0.8 · learning recording count: 2 · auto applied count: 1.",
        }),
      }),
    );
    expect(result.status).toBe(200);
  });

  it("records a failure narration when a job run fails", async () => {
    const registry = new ActionRegistry();
    registerAgentControlActions(registry);

    const runtime = createRuntime();
    const failRun = jest
      .spyOn(runtime.jobRunService, "failRun")
      .mockResolvedValue(true);

    const handler = registry.getRaw("fail_job_run");

    expect(handler).toBeDefined();

    await handler!(
      {
        jobName: "morning_brief",
        periodKey: "2026-04-11",
        errorMessage: "Calendar access expired",
      },
      context,
      runtime,
    );

    expect(failRun).toHaveBeenCalledWith(
      "user-1",
      "morning_brief",
      "2026-04-11",
      "Calendar access expired",
    );
    expect(
      runtime.persistencePrisma?.agentActionAudit.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobName: "morning_brief",
          narration:
            "Morning brief could not be generated: Calendar access expired",
          metadata: {
            errorMessage: "Calendar access expired",
          },
        }),
      }),
    );
  });

  it("does not record a feed narration for internal non-actionable job failures", async () => {
    const registry = new ActionRegistry();
    registerAgentControlActions(registry);

    const runtime = createRuntime();
    const failRun = jest
      .spyOn(runtime.jobRunService, "failRun")
      .mockResolvedValue(true);

    const handler = registry.getRaw("fail_job_run");

    expect(handler).toBeDefined();

    await handler!(
      {
        jobName: "evaluator_daily",
        periodKey: "2026-04-11",
        errorMessage: "Timeout while fetching agenda context",
      },
      context,
      runtime,
    );

    expect(failRun).toHaveBeenCalledWith(
      "user-1",
      "evaluator_daily",
      "2026-04-11",
      "Timeout while fetching agenda context",
    );
    expect(
      runtime.persistencePrisma?.agentActionAudit.create,
    ).not.toHaveBeenCalled();
  });
});
