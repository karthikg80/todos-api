import { AgentIdempotencyService } from "./services/agentIdempotencyService";

function createMockPrisma() {
  const records = new Map<string, any>();

  return {
    records,
    agentIdempotencyRecord: {
      findUnique: jest.fn(async ({ where }) => {
        const key = `${where.action_userId_idempotencyKey.userId}:${where.action_userId_idempotencyKey.action}:${where.action_userId_idempotencyKey.idempotencyKey}`;
        return records.get(key) || null;
      }),
      delete: jest.fn(async ({ where }) => {
        const key = `${where.action_userId_idempotencyKey.userId}:${where.action_userId_idempotencyKey.action}:${where.action_userId_idempotencyKey.idempotencyKey}`;
        records.delete(key);
        return null;
      }),
      create: jest.fn(async ({ data }) => {
        const key = `${data.userId}:${data.action}:${data.idempotencyKey}`;
        records.set(key, data);
        return data;
      }),
    },
  };
}

describe("AgentIdempotencyService durability", () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it("replays matching create-flow input across service instances when backed by Prisma", async () => {
    const prisma = createMockPrisma();
    const first = new AgentIdempotencyService(prisma as any);
    const second = new AgentIdempotencyService(prisma as any);

    await first.store(
      "create_task",
      "user-1",
      "idem-1",
      { title: "Durable task" },
      201,
      { ok: true, data: { task: { id: "task-1" } } },
    );

    const replay = await second.lookup("create_task", "user-1", "idem-1", {
      title: "Durable task",
    });

    expect(replay).toEqual({
      kind: "replay",
      status: 201,
      body: { ok: true, data: { task: { id: "task-1" } } },
    });
  });

  it("retains persisted idempotency records for 30 days", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-02T12:00:00.000Z"));
    const prisma = createMockPrisma();
    const service = new AgentIdempotencyService(prisma as any);

    await service.store(
      "create_task",
      "user-1",
      "idem-30-day",
      { title: "Durable task" },
      201,
      { ok: true, data: { task: { id: "task-1" } } },
    );

    const record = prisma.records.get("user-1:create_task:idem-30-day");
    expect(record.expiresAt).toEqual(new Date("2026-06-01T12:00:00.000Z"));
  });
});
