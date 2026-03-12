import { AgentIdempotencyService } from "./services/agentIdempotencyService";

function createMockPrisma() {
  const records = new Map<string, any>();

  return {
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
});
