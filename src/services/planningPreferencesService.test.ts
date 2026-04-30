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

  it("preserves existing soul profile fields during partial updates", async () => {
    const existing = {
      id: "pref-1",
      userId: "user-1",
      maxDailyTasks: 4,
      preferredChunkMinutes: 45,
      deepWorkPreference: "morning",
      weekendsActive: false,
      preferredContexts: ["office"],
      waitingFollowUpDays: 3,
      workWindowsJson: null,
      soulProfile: {
        lifeAreas: ["work", "personal"],
        failureModes: ["overcommitted"],
        planningStyle: "structure",
        energyPattern: "morning",
        goodDayThemes: ["important_work", "protect_rest"],
        tone: "direct",
        dailyRitual: "morning_plan",
      },
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    };
    const findUnique = jest.fn().mockResolvedValue(existing);
    const upsert = jest.fn().mockImplementation(({ update }) =>
      Promise.resolve({
        ...existing,
        ...update,
      }),
    );
    const service = new PlanningPreferencesService(
      createMockPrisma({
        userPlanningPreferences: { findUnique, upsert },
      }),
    );

    const result = await service.updateForUser("user-1", {
      soulProfile: {
        tone: "focused",
        failureModes: ["forgetful", "unknown", "forgetful"],
      },
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        update: {
          soulProfile: {
            lifeAreas: ["work", "personal"],
            failureModes: ["forgetful"],
            planningStyle: "structure",
            energyPattern: "morning",
            goodDayThemes: ["important_work", "protect_rest"],
            tone: "focused",
            dailyRitual: "morning_plan",
          },
        },
      }),
    );
    expect(result.soulProfile).toEqual({
      lifeAreas: ["work", "personal"],
      failureModes: ["forgetful"],
      planningStyle: "structure",
      energyPattern: "morning",
      goodDayThemes: ["important_work", "protect_rest"],
      tone: "focused",
      dailyRitual: "morning_plan",
    });
  });
});
