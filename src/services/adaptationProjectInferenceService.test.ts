import type { PrismaClient } from "@prisma/client";
import { AdaptationProjectInferenceService } from "./adaptationProjectInferenceService";

function createMockPrisma(
  overrides: Record<string, unknown> = {},
): PrismaClient {
  return {
    project: { findFirst: jest.fn() },
    todo: { findMany: jest.fn() },
    heading: { findMany: jest.fn() },
    ...overrides,
  } as unknown as PrismaClient;
}

describe("AdaptationProjectInferenceService", () => {
  it("returns 404 when the project is missing", async () => {
    const service = new AdaptationProjectInferenceService(
      createMockPrisma({
        project: { findFirst: jest.fn().mockResolvedValue(null) },
      }),
      { getOrCreateProfile: jest.fn() } as any,
      { inferProjectIntent: jest.fn() } as any,
    );

    await expect(
      service.getSoftInference("user-1", "project-1"),
    ).resolves.toEqual({
      status: 404,
      body: { error: "Project not found" },
    });
  });

  it("skips todo and heading fetches when behavioral confidence is already high", async () => {
    const projectFindFirst = jest.fn().mockResolvedValue({
      id: "project-1",
      name: "Project",
      description: "Description",
      targetDate: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    const todoFindMany = jest.fn();
    const headingFindMany = jest.fn();
    const getOrCreateProfile = jest.fn().mockResolvedValue({
      profile: { confidence: 0.82 },
    });
    const inferProjectIntent = jest.fn();
    const service = new AdaptationProjectInferenceService(
      createMockPrisma({
        project: { findFirst: projectFindFirst },
        todo: { findMany: todoFindMany },
        heading: { findMany: headingFindMany },
      }),
      { getOrCreateProfile } as any,
      { inferProjectIntent } as any,
    );

    await expect(
      service.getSoftInference("user-1", "project-1"),
    ).resolves.toEqual({
      status: 200,
      body: {
        inference: null,
        reason: "behavioral confidence sufficient — LLM inference skipped",
        behavioralConfidence: 0.82,
      },
    });
    expect(todoFindMany).not.toHaveBeenCalled();
    expect(headingFindMany).not.toHaveBeenCalled();
    expect(inferProjectIntent).not.toHaveBeenCalled();
  });

  it("loads project context and returns soft inference when behavioral confidence is low", async () => {
    const inferProjectIntent = jest.fn().mockResolvedValue({
      inferredProjectType: "commitment",
      confidence: 0.61,
    });
    const service = new AdaptationProjectInferenceService(
      createMockPrisma({
        project: {
          findFirst: jest.fn().mockResolvedValue({
            id: "project-1",
            name: "Launch plan",
            description: "Coordinate the rollout",
            targetDate: null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
          }),
        },
        todo: {
          findMany: jest.fn().mockResolvedValue([
            {
              title: "Write launch checklist",
              headingId: null,
              dueDate: null,
            },
          ]),
        },
        heading: {
          findMany: jest.fn().mockResolvedValue([{ name: "Milestones" }]),
        },
      }),
      {
        getOrCreateProfile: jest
          .fn()
          .mockResolvedValue({ profile: { confidence: 0.18 } }),
      } as any,
      { inferProjectIntent } as any,
    );

    await expect(
      service.getSoftInference("user-1", "project-1"),
    ).resolves.toEqual({
      status: 200,
      body: {
        inference: {
          inferredProjectType: "commitment",
          confidence: 0.61,
        },
        reason: "llm soft inference",
        behavioralConfidence: 0.18,
      },
    });
    expect(inferProjectIntent).toHaveBeenCalledWith({
      projectName: "Launch plan",
      projectDescription: "Coordinate the rollout",
      taskTitles: ["Write launch checklist"],
      existingSectionNames: ["Milestones"],
    });
  });
});
