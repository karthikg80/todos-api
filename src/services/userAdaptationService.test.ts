import { UserAdaptationService } from "./userAdaptationService";
import type { PrismaClient } from "@prisma/client";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockPrisma(overrides: Record<string, any> = {}): PrismaClient {
  return {
    activityEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.activityEvent,
    },
    project: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.project,
    },
    todo: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.todo,
    },
    userAdaptationProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({
        id: "profile-id",
        userId: "user-1",
        profileVersion: 1,
        policyVersion: 1,
        eligibility: "none",
        structureAppetite: "balanced",
        insightAffinity: "low",
        dateDiscipline: "medium",
        organizationStyle: "mixed",
        guidanceNeed: "medium",
        confidence: 0.2,
        confidenceReason: "cold start",
        signalsSnapshot: null,
        scoresSnapshot: null,
        signalsWindowDays: 60,
        computedAt: new Date(),
        updatedAt: new Date(),
      }),
      ...overrides.userAdaptationProfile,
    },
  } as unknown as PrismaClient;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("UserAdaptationService", () => {
  describe("getOrCreateProfile", () => {
    it("returns cold-start result when prisma is undefined", async () => {
      const service = new UserAdaptationService(undefined);
      const result = await service.getOrCreateProfile("user-1");

      expect(result.profile.eligibility).toBe("none");
      expect(result.profile.confidence).toBe(0.2);
      expect(result.profile.structureAppetite).toBe("balanced");
    });

    it("computes and stores profile when none exists", async () => {
      const upsertMock = jest.fn().mockResolvedValue({
        id: "profile-id",
        userId: "user-1",
        profileVersion: 1,
        policyVersion: 1,
        eligibility: "light",
        structureAppetite: "balanced",
        insightAffinity: "low",
        dateDiscipline: "medium",
        organizationStyle: "mixed",
        guidanceNeed: "medium",
        confidence: 0.35,
        confidenceReason: "3 projects, 8 sessions",
        signalsSnapshot: null,
        scoresSnapshot: null,
        signalsWindowDays: 60,
        computedAt: new Date(),
        updatedAt: new Date(),
      });

      const prisma = createMockPrisma({
        userAdaptationProfile: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: upsertMock,
        },
      });

      const service = new UserAdaptationService(prisma);
      const result = await service.getOrCreateProfile("user-1");

      expect(upsertMock).toHaveBeenCalled();
      expect(result.profile.eligibility).toBe("light");
    });

    it("returns stored profile when fresh", async () => {
      const storedProfile = {
        id: "profile-id",
        userId: "user-1",
        profileVersion: 1,
        policyVersion: 1,
        eligibility: "standard",
        structureAppetite: "planner",
        insightAffinity: "high",
        dateDiscipline: "high",
        organizationStyle: "sections_first",
        guidanceNeed: "low",
        confidence: 0.8,
        confidenceReason: "10 projects, 25 sessions",
        signalsSnapshot: null,
        scoresSnapshot: {
          structureUsageScore: 80,
          dateUsageScore: 75,
          insightEngagementScore: 70,
          tasksFirstScore: 30,
          sectionsFirstScore: 80,
          guidanceRelianceScore: 20,
        },
        signalsWindowDays: 60,
        computedAt: new Date(),
        updatedAt: new Date(),
      };

      const prisma = createMockPrisma({
        userAdaptationProfile: {
          findUnique: jest.fn().mockResolvedValue(storedProfile),
        },
      });

      const service = new UserAdaptationService(prisma);
      const result = await service.getOrCreateProfile("user-1");

      expect(result.profile.structureAppetite).toBe("planner");
      expect(result.profile.confidence).toBe(0.8);
      expect(result.profile.eligibility).toBe("standard");
    });

    it("recomputes when profile is stale (>24h)", async () => {
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 25);

      const storedProfile = {
        id: "profile-id",
        userId: "user-1",
        profileVersion: 1,
        policyVersion: 1,
        eligibility: "light",
        structureAppetite: "balanced",
        insightAffinity: "low",
        dateDiscipline: "medium",
        organizationStyle: "mixed",
        guidanceNeed: "medium",
        confidence: 0.3,
        confidenceReason: "old data",
        signalsSnapshot: null,
        scoresSnapshot: null,
        signalsWindowDays: 60,
        computedAt: staleDate,
        updatedAt: new Date(),
      };

      const upsertMock = jest.fn().mockResolvedValue({
        ...storedProfile,
        computedAt: new Date(),
        confidence: 0.4,
        confidenceReason: "recomputed",
      });

      const prisma = createMockPrisma({
        userAdaptationProfile: {
          findUnique: jest.fn().mockResolvedValue(storedProfile),
          upsert: upsertMock,
        },
      });

      const service = new UserAdaptationService(prisma);
      await service.getOrCreateProfile("user-1");

      expect(upsertMock).toHaveBeenCalled();
    });
  });

  describe("computeProfile", () => {
    it("forces recomputation regardless of staleness", async () => {
      const upsertMock = jest.fn().mockResolvedValue({
        id: "profile-id",
        userId: "user-1",
        profileVersion: 1,
        policyVersion: 1,
        eligibility: "light",
        structureAppetite: "balanced",
        insightAffinity: "low",
        dateDiscipline: "medium",
        organizationStyle: "mixed",
        guidanceNeed: "medium",
        confidence: 0.35,
        confidenceReason: "forced",
        signalsSnapshot: null,
        scoresSnapshot: null,
        signalsWindowDays: 60,
        computedAt: new Date(),
        updatedAt: new Date(),
      });

      const prisma = createMockPrisma({
        userAdaptationProfile: {
          upsert: upsertMock,
        },
      });

      const service = new UserAdaptationService(prisma);
      const result = await service.computeProfile("user-1");

      expect(upsertMock).toHaveBeenCalled();
      // Confidence reason is computed from actual data, not passed through
      expect(result.profile.confidenceReason).toContain("projects");
    });

    it("returns cold-start when prisma is undefined", async () => {
      const service = new UserAdaptationService(undefined);
      const result = await service.computeProfile("user-1");

      expect(result.profile.eligibility).toBe("none");
      expect(result.profile.confidence).toBe(0.2);
    });
  });

  describe("profile decay", () => {
    it("decays confidence and eligibility for stale profiles", async () => {
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 15); // 15h ago (> 12h decay, < 24h recompute)

      const storedProfile = {
        id: "profile-id",
        userId: "user-1",
        profileVersion: 1,
        policyVersion: 1,
        eligibility: "standard",
        structureAppetite: "planner",
        insightAffinity: "high",
        dateDiscipline: "high",
        organizationStyle: "sections_first",
        guidanceNeed: "low",
        confidence: 0.8,
        confidenceReason: "strong data",
        signalsSnapshot: null,
        scoresSnapshot: null,
        signalsWindowDays: 60,
        computedAt: staleDate,
        updatedAt: new Date(),
      };

      const prisma = createMockPrisma({
        userAdaptationProfile: {
          findUnique: jest.fn().mockResolvedValue(storedProfile),
        },
      });

      const service = new UserAdaptationService(prisma);
      const result = await service.getOrCreateProfile("user-1");

      // Confidence should be decayed
      expect(result.profile.confidence).toBeLessThan(0.8);
      expect(result.profile.confidenceReason).toContain("decayed");
    });

    it("does not decay fresh profiles", async () => {
      const freshDate = new Date();
      freshDate.setHours(freshDate.getHours() - 1); // 1 hour ago

      const storedProfile = {
        id: "profile-id",
        userId: "user-1",
        profileVersion: 1,
        policyVersion: 1,
        eligibility: "standard",
        structureAppetite: "balanced",
        insightAffinity: "medium",
        dateDiscipline: "medium",
        organizationStyle: "mixed",
        guidanceNeed: "medium",
        confidence: 0.5,
        confidenceReason: "moderate data",
        signalsSnapshot: null,
        scoresSnapshot: null,
        signalsWindowDays: 60,
        computedAt: freshDate,
        updatedAt: new Date(),
      };

      const prisma = createMockPrisma({
        userAdaptationProfile: {
          findUnique: jest.fn().mockResolvedValue(storedProfile),
        },
      });

      const service = new UserAdaptationService(prisma);
      const result = await service.getOrCreateProfile("user-1");

      expect(result.profile.confidence).toBe(0.5);
      expect(result.profile.confidenceReason).toBe("moderate data");
      expect(result.profile.eligibility).toBe("standard");
    });
  });

  describe("collectBehaviorSignals", () => {
    it("returns empty signals when prisma is undefined", async () => {
      const service = new UserAdaptationService(undefined);
      const signals = await service.collectBehaviorSignals("user-1");

      expect(signals.projectsCreated).toBe(0);
      expect(signals.insightOpportunityCount).toBe(0);
      expect(signals.pctProjectsWithSections).toBe(0);
    });

    it("collects signals from activity events and projects", async () => {
      const prisma = createMockPrisma({
        activityEvent: {
          findMany: jest.fn().mockResolvedValue([
            {
              eventType: "project_opened",
              createdAt: new Date("2026-04-01"),
              entityType: "project",
              entityId: "proj-1",
              metadata: null,
            },
            {
              eventType: "section_created",
              createdAt: new Date("2026-04-02"),
              entityType: "heading",
              entityId: "heading-1",
              metadata: null,
            },
            {
              eventType: "insights_open",
              createdAt: new Date("2026-04-03"),
              entityType: "insights",
              entityId: null,
              metadata: null,
            },
          ]),
        },
        project: {
          count: jest
            .fn()
            .mockResolvedValueOnce(3) // projectsCreated
            .mockResolvedValueOnce(1), // projectsCompleted
          findMany: jest.fn().mockResolvedValue([
            {
              id: "proj-1",
              targetDate: null,
              createdAt: new Date("2026-03-01"),
              _count: { todos: 5, headings: 2 },
            },
            {
              id: "proj-2",
              targetDate: new Date("2026-06-01"),
              createdAt: new Date("2026-03-15"),
              _count: { todos: 3, headings: 0 },
            },
          ]),
        },
        todo: {
          findMany: jest.fn().mockResolvedValue([
            {
              dueDate: new Date("2026-04-10"),
              priority: "high",
              headingId: "heading-1",
              completed: false,
              createdAt: new Date("2026-03-05"),
              updatedAt: new Date("2026-04-01"),
            },
            {
              dueDate: null,
              priority: "medium",
              headingId: null,
              completed: true,
              createdAt: new Date("2026-03-10"),
              updatedAt: new Date("2026-04-02"),
            },
          ]),
        },
      });

      const service = new UserAdaptationService(prisma);
      const signals = await service.collectBehaviorSignals("user-1");

      expect(signals.projectsCreated).toBe(3);
      expect(signals.projectOpenedCount).toBeGreaterThan(0);
      expect(signals.pctProjectsWithSections).toBe(50); // 1 of 2 projects has headings
    });
  });
});
