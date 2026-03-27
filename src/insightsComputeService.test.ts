import { InsightsComputeService } from "./services/insightsComputeService";

describe("InsightsComputeService", () => {
  function createMockPrisma(overrides: Record<string, any> = {}) {
    return {
      todo: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        ...overrides.todo,
      },
      activityEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        ...overrides.activityEvent,
      },
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        ...overrides.project,
      },
      userInsight: {
        upsert: jest.fn().mockResolvedValue({}),
        ...overrides.userInsight,
      },
    } as any;
  }

  describe("computeCompletionVelocity", () => {
    it("should return tasks completed per day", async () => {
      const prisma = createMockPrisma({
        todo: { count: jest.fn().mockResolvedValue(14) },
      });
      const service = new InsightsComputeService(prisma);

      const start = new Date("2026-03-20");
      const end = new Date("2026-03-27");
      const velocity = await service.computeCompletionVelocity(
        "user-1",
        start,
        end,
      );

      expect(velocity).toBe(2); // 14 / 7 = 2
    });

    it("should return 0 when prisma is undefined", async () => {
      const service = new InsightsComputeService(undefined);
      const result = await service.computeCompletionVelocity(
        "user-1",
        new Date(),
        new Date(),
      );
      expect(result).toBe(0);
    });
  });

  describe("computeOvercommitmentRatio", () => {
    it("should return ratio of created to completed", async () => {
      const countMock = jest
        .fn()
        .mockResolvedValueOnce(10) // created
        .mockResolvedValueOnce(5); // completed
      const prisma = createMockPrisma({ todo: { count: countMock } });
      const service = new InsightsComputeService(prisma);

      const ratio = await service.computeOvercommitmentRatio(
        "user-1",
        new Date("2026-03-20"),
        new Date("2026-03-27"),
      );

      expect(ratio).toBe(2); // 10 / 5
    });

    it("should return created count when nothing completed", async () => {
      const countMock = jest
        .fn()
        .mockResolvedValueOnce(5) // created
        .mockResolvedValueOnce(0); // completed
      const prisma = createMockPrisma({ todo: { count: countMock } });
      const service = new InsightsComputeService(prisma);

      const ratio = await service.computeOvercommitmentRatio(
        "user-1",
        new Date("2026-03-20"),
        new Date("2026-03-27"),
      );

      expect(ratio).toBe(5);
    });
  });

  describe("computeStaleTasks", () => {
    it("should count stale open tasks", async () => {
      const prisma = createMockPrisma({
        todo: { count: jest.fn().mockResolvedValue(3) },
      });
      const service = new InsightsComputeService(prisma);

      const count = await service.computeStaleTasks("user-1");
      expect(count).toBe(3);

      // Verify the query filters
      const call = prisma.todo.count.mock.calls[0][0];
      expect(call.where.completed).toBe(false);
      expect(call.where.archived).toBe(false);
      expect(call.where.updatedAt.lt).toBeDefined();
    });
  });

  describe("computeStreak", () => {
    it("should count consecutive days with completions", async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const prisma = createMockPrisma({
        activityEvent: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { createdAt: today },
              { createdAt: yesterday },
              { createdAt: twoDaysAgo },
            ]),
        },
      });
      const service = new InsightsComputeService(prisma);

      const streak = await service.computeStreak("user-1");
      expect(streak).toBe(3);
    });

    it("should return 0 when no completions", async () => {
      const prisma = createMockPrisma();
      const service = new InsightsComputeService(prisma);

      const streak = await service.computeStreak("user-1");
      expect(streak).toBe(0);
    });
  });

  describe("computeProjectHealth", () => {
    it("should return null when project not found", async () => {
      const prisma = createMockPrisma();
      const service = new InsightsComputeService(prisma);

      const result = await service.computeProjectHealth("user-1", "proj-404");
      expect(result).toBeNull();
    });

    it("should compute health score for a project", async () => {
      const now = new Date();
      const countMock = jest
        .fn()
        .mockResolvedValueOnce(10) // totalTasks
        .mockResolvedValueOnce(7) // completedTasks
        .mockResolvedValueOnce(1) // overdueTasks
        .mockResolvedValueOnce(2); // velocity (7-day completed)

      const prisma = createMockPrisma({
        project: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: "proj-1", name: "Test" }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        todo: {
          count: countMock,
          findFirst: jest.fn().mockResolvedValue({ updatedAt: now }),
        },
      });
      const service = new InsightsComputeService(prisma);

      const result = await service.computeProjectHealth("user-1", "proj-1");

      expect(result).not.toBeNull();
      expect(result!.projectId).toBe("proj-1");
      expect(result!.projectName).toBe("Test");
      expect(result!.score).toBeGreaterThan(0);
      expect(result!.score).toBeLessThanOrEqual(100);
      expect(["healthy", "warning", "critical"]).toContain(result!.status);
    });
  });

  describe("computeAll", () => {
    it("should be a no-op when prisma is undefined", async () => {
      const service = new InsightsComputeService(undefined);
      await expect(service.computeAll("user-1")).resolves.toBeUndefined();
    });

    it("should compute and upsert all insight types", async () => {
      const prisma = createMockPrisma({
        project: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      });
      const service = new InsightsComputeService(prisma);

      await service.computeAll("user-1");

      // Should upsert 5 insight types (velocity, ratio, stale, streak, productive hour)
      expect(prisma.userInsight.upsert).toHaveBeenCalledTimes(5);
    });
  });
});
