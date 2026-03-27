import { ActivityEventService } from "./services/activityEventService";

describe("ActivityEventService", () => {
  function createMockPrisma(overrides: Partial<any> = {}) {
    return {
      activityEvent: {
        create: jest.fn().mockResolvedValue({ id: "evt-1" }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        ...overrides,
      },
    } as any;
  }

  describe("recordEvent (fire-and-forget)", () => {
    it("should call prisma.create with correct data", () => {
      const prisma = createMockPrisma();
      const service = new ActivityEventService(prisma);

      service.recordEvent("user-1", "task_created", {
        entityType: "todo",
        entityId: "todo-1",
        metadata: { priority: "high" },
      });

      expect(prisma.activityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          eventType: "task_created",
          entityType: "todo",
          entityId: "todo-1",
          metadata: { priority: "high" },
        }),
      });
    });

    it("should not throw when prisma.create fails", () => {
      const prisma = createMockPrisma({
        create: jest.fn().mockRejectedValue(new Error("db down")),
      });
      const service = new ActivityEventService(prisma);

      // Should not throw
      expect(() => {
        service.recordEvent("user-1", "task_completed");
      }).not.toThrow();
    });

    it("should be a no-op when prisma is undefined", () => {
      const service = new ActivityEventService(undefined);
      expect(() => {
        service.recordEvent("user-1", "task_deleted");
      }).not.toThrow();
    });

    it("should handle missing optional fields", () => {
      const prisma = createMockPrisma();
      const service = new ActivityEventService(prisma);

      service.recordEvent("user-1", "session_start");

      expect(prisma.activityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          eventType: "session_start",
          entityType: null,
          entityId: null,
        }),
      });
    });
  });

  describe("batchCreate", () => {
    it("should create valid events and skip invalid event types", async () => {
      const prisma = createMockPrisma();
      const service = new ActivityEventService(prisma);

      const count = await service.batchCreate("user-1", [
        { eventType: "task_created" },
        { eventType: "invalid_type" },
        { eventType: "session_start" },
      ]);

      expect(count).toBe(2);
      const createManyCall = prisma.activityEvent.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(2);
      expect(createManyCall.data[0].eventType).toBe("task_created");
      expect(createManyCall.data[1].eventType).toBe("session_start");
    });

    it("should enforce max batch size of 50", async () => {
      const prisma = createMockPrisma({
        createMany: jest.fn().mockResolvedValue({ count: 50 }),
      });
      const service = new ActivityEventService(prisma);

      const events = Array.from({ length: 60 }, () => ({
        eventType: "task_created",
      }));
      await service.batchCreate("user-1", events);

      const createManyCall = prisma.activityEvent.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(50);
    });

    it("should return 0 for empty events array", async () => {
      const prisma = createMockPrisma();
      const service = new ActivityEventService(prisma);

      const count = await service.batchCreate("user-1", []);
      expect(count).toBe(0);
      expect(prisma.activityEvent.createMany).not.toHaveBeenCalled();
    });

    it("should return 0 when prisma is undefined", async () => {
      const service = new ActivityEventService(undefined);
      const count = await service.batchCreate("user-1", [
        { eventType: "task_created" },
      ]);
      expect(count).toBe(0);
    });

    it("should use provided timestamp when available", async () => {
      const prisma = createMockPrisma();
      const service = new ActivityEventService(prisma);

      await service.batchCreate("user-1", [
        {
          eventType: "task_completed",
          timestamp: "2026-03-27T10:00:00.000Z",
        },
      ]);

      const data = prisma.activityEvent.createMany.mock.calls[0][0].data;
      expect(data[0].createdAt).toEqual(new Date("2026-03-27T10:00:00.000Z"));
    });
  });

  describe("countByType", () => {
    it("should return grouped counts", async () => {
      const prisma = createMockPrisma({
        groupBy: jest.fn().mockResolvedValue([
          { eventType: "task_created", _count: { id: 5 } },
          { eventType: "task_completed", _count: { id: 3 } },
        ]),
      });
      const service = new ActivityEventService(prisma);

      const result = await service.countByType(
        "user-1",
        new Date("2026-03-20"),
        new Date("2026-03-27"),
      );

      expect(result).toEqual({
        task_created: 5,
        task_completed: 3,
      });
    });

    it("should return empty object when prisma is undefined", async () => {
      const service = new ActivityEventService(undefined);
      const result = await service.countByType(
        "user-1",
        new Date(),
        new Date(),
      );
      expect(result).toEqual({});
    });
  });

  describe("findByUser", () => {
    it("should return empty array when prisma is undefined", async () => {
      const service = new ActivityEventService(undefined);
      const result = await service.findByUser("user-1");
      expect(result).toEqual([]);
    });

    it("should pass filters to prisma query", async () => {
      const prisma = createMockPrisma();
      const service = new ActivityEventService(prisma);
      const since = new Date("2026-03-20");

      await service.findByUser("user-1", {
        eventType: "task_completed",
        since,
        limit: 10,
      });

      expect(prisma.activityEvent.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          eventType: "task_completed",
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });
  });
});
