import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../errorHandling";
import { AdaptationProjectInferenceService } from "./adaptationProjectInferenceService";

function createMockPrisma(overrides: Record<string, any> = {}): PrismaClient {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue(null),
      ...overrides.project,
    },
    todo: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.todo,
    },
    heading: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.heading,
    },
  } as unknown as PrismaClient;
}

describe("AdaptationProjectInferenceService", () => {
  it("throws a not-found error when the project does not exist", async () => {
    const prisma = createMockPrisma();
    const service = new AdaptationProjectInferenceService(
      prisma,
      {
        getOrCreateProfile: jest.fn(),
      } as any,
      {
        inferProjectIntent: jest.fn(),
      } as any,
    );

    await expect(
      service.getSoftInference("user-1", "missing-project"),
    ).rejects.toEqual(new HttpError(404, "Project not found"));
  });

  it("skips task and heading fetches when behavioral confidence is already high", async () => {
    const todoFindMany = jest.fn();
    const headingFindMany = jest.fn();
    const inferProjectIntent = jest.fn();
    const prisma = createMockPrisma({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: "project-1",
          name: "Project One",
          description: "Test",
        }),
      },
      todo: {
        findMany: todoFindMany,
      },
      heading: {
        findMany: headingFindMany,
      },
    });
    const service = new AdaptationProjectInferenceService(
      prisma,
      {
        getOrCreateProfile: jest.fn().mockResolvedValue({
          profile: { confidence: 0.8 },
        }),
      } as any,
      {
        inferProjectIntent,
      } as any,
    );

    await expect(
      service.getSoftInference("user-1", "project-1"),
    ).resolves.toEqual({
      inference: null,
      reason: "behavioral confidence sufficient — LLM inference skipped",
      behavioralConfidence: 0.8,
    });
    expect(todoFindMany).not.toHaveBeenCalled();
    expect(headingFindMany).not.toHaveBeenCalled();
    expect(inferProjectIntent).not.toHaveBeenCalled();
  });

  it("loads project context and returns soft inference when confidence is low", async () => {
    const inferProjectIntent = jest.fn().mockResolvedValue({
      inferredProjectType: "trip planning",
      suggestedSections: ["Bookings", "Packing"],
      recommendedHintStyle: "structured",
      confidence: 0.72,
    });
    const prisma = createMockPrisma({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: "project-1",
          name: "Japan Trip",
          description: "Plan spring travel",
        }),
      },
      todo: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { title: "Book flights" },
            { title: "Reserve hotel" },
          ]),
      },
      heading: {
        findMany: jest.fn().mockResolvedValue([{ name: "Ideas" }]),
      },
    });
    const service = new AdaptationProjectInferenceService(
      prisma,
      {
        getOrCreateProfile: jest.fn().mockResolvedValue({
          profile: { confidence: 0.2 },
        }),
      } as any,
      {
        inferProjectIntent,
      } as any,
    );

    await expect(
      service.getSoftInference("user-1", "project-1"),
    ).resolves.toEqual({
      inference: {
        inferredProjectType: "trip planning",
        suggestedSections: ["Bookings", "Packing"],
        recommendedHintStyle: "structured",
        confidence: 0.72,
      },
      reason: "llm soft inference",
      behavioralConfidence: 0.2,
    });
    expect(inferProjectIntent).toHaveBeenCalledWith({
      projectName: "Japan Trip",
      projectDescription: "Plan spring travel",
      taskTitles: ["Book flights", "Reserve hotel"],
      existingSectionNames: ["Ideas"],
    });
  });
});
