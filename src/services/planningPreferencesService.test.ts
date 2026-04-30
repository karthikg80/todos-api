import type { PrismaClient } from "@prisma/client";
import { PlanningPreferencesService } from "./planningPreferencesService";

function createMockPrisma(
  overrides: Record<string, unknown> = {},
): PrismaClient {
  return {
    userPlanningPreferences: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

describe("PlanningPreferencesService", () => {
  it("returns defaults when a user has no saved preferences", async () => {
    const service = new PlanningPreferencesService(createMockPrisma());

    await expect(service.getForUser("user-1")).resolves.toEqual({
      maxDailyTasks: null,
      preferredChunkMinutes: null,
      deepWorkPreference: null,
      weekendsActive: true,
      preferredContexts: [],
      waitingFollowUpDays: 7,
      workWindowsJson: null,
      soulProfile: {
        lifeAreas: [],
        failureModes: [],
        planningStyle: "both",
        energyPattern: "variable",
        goodDayThemes: [],
        tone: "calm",
        dailyRitual: "neither",
      },
    });
  });

  it("sanitizes and merges soul profile updates before upserting", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      soulProfile: {
        tone: "focused",
        lifeAreas: ["work"],
        planningStyle: "flexibility",
      },
    });
    const upsert = jest.fn().mockImplementation(({ create }) =>
      Promise.resolve({
        id: "pref-1",
        userId: create.userId,
        maxDailyTasks: null,
        preferredChunkMinutes: null,
        deepWorkPreference: null,
        weekendsActive: true,
        preferredContexts: [],
        waitingFollowUpDays: 7,
        workWindowsJson: null,
        soulProfile: create.soulProfile,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    );
    const service = new PlanningPreferencesService(
      createMockPrisma({
        userPlanningPreferences: { findUnique, upsert },
      }),
    );

    const result = await service.updateForUser("user-1", {
      soulProfile: {
        tone: "LOUD",
        planningStyle: "Structure",
        lifeAreas: ["work", "health", "work", "invalid"],
      },
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({
          userId: "user-1",
          soulProfile: {
            tone: "calm",
            planningStyle: "structure",
            lifeAreas: ["work", "health"],
            failureModes: [],
            energyPattern: "variable",
            goodDayThemes: [],
            dailyRitual: "neither",
          },
        }),
      }),
    );
    expect(result.soulProfile).toEqual({
      tone: "calm",
      planningStyle: "structure",
      lifeAreas: ["work", "health"],
      failureModes: [],
      energyPattern: "variable",
      goodDayThemes: [],
      dailyRitual: "neither",
    });
  });
});
