import type { PrismaClient } from "@prisma/client";
import { PlanningPreferencesService } from "./planningPreferencesService";

function createMockPrisma(overrides: Record<string, any> = {}): PrismaClient {
  return {
    userPlanningPreferences: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      ...overrides.userPlanningPreferences,
    },
  } as unknown as PrismaClient;
}

describe("PlanningPreferencesService", () => {
  it("returns defaults when no preferences exist", async () => {
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

  it("merges and sanitizes soul profile updates during upsert", async () => {
    const upsertMock = jest.fn().mockResolvedValue({
      maxDailyTasks: null,
      preferredChunkMinutes: null,
      deepWorkPreference: null,
      weekendsActive: true,
      preferredContexts: [],
      waitingFollowUpDays: 7,
      workWindowsJson: null,
      soulProfile: {
        tone: "calm",
        lifeAreas: ["work", "personal"],
        planningStyle: "structure",
        failureModes: [],
        energyPattern: "variable",
        goodDayThemes: [],
        dailyRitual: "neither",
      },
    });
    const prisma = createMockPrisma({
      userPlanningPreferences: {
        findUnique: jest.fn().mockResolvedValue({
          userId: "user-1",
          maxDailyTasks: null,
          preferredChunkMinutes: null,
          deepWorkPreference: null,
          weekendsActive: true,
          preferredContexts: [],
          waitingFollowUpDays: 7,
          workWindowsJson: null,
          soulProfile: {
            tone: "focused",
            lifeAreas: ["work", "personal"],
            planningStyle: "both",
            failureModes: [],
            energyPattern: "variable",
            goodDayThemes: [],
            dailyRitual: "neither",
          },
        }),
        upsert: upsertMock,
      },
    });
    const service = new PlanningPreferencesService(prisma);

    const result = await service.upsertForUser("user-1", {
      soulProfile: {
        planningStyle: "structure",
        lifeAreas: ["work", "invalid", "personal", "work"],
        tone: "",
      },
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        update: expect.objectContaining({
          soulProfile: {
            lifeAreas: ["work", "personal"],
            failureModes: [],
            planningStyle: "structure",
            energyPattern: "variable",
            goodDayThemes: [],
            tone: "calm",
            dailyRitual: "neither",
          },
        }),
      }),
    );
    expect(result.soulProfile).toEqual({
      lifeAreas: ["work", "personal"],
      failureModes: [],
      planningStyle: "structure",
      energyPattern: "variable",
      goodDayThemes: [],
      tone: "calm",
      dailyRitual: "neither",
    });
  });
});
