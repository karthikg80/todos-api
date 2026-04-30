import type { PrismaClient } from "@prisma/client";
import { AgentActivityService } from "./agentActivityService";

function createMockPrisma(overrides: Record<string, any> = {}): PrismaClient {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as PrismaClient;
}

describe("AgentActivityService", () => {
  it("maps recent activity rows into API entries and sorts newest-first", async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        agent_id: "agent-b",
        job_name: "daily",
        job_period_key: "2026-04-18",
        narration: "Second entry",
        metadata: null,
        created_at: new Date("2026-04-18T10:00:00.000Z"),
      },
      {
        agent_id: "agent-a",
        job_name: "inbox",
        job_period_key: "2026-04-19",
        narration: "Newest entry",
        metadata: { source: "runner" },
        created_at: new Date("2026-04-19T12:00:00.000Z"),
      },
    ]);
    const service = new AgentActivityService(
      createMockPrisma({ $queryRaw: queryRaw }),
    );

    await expect(service.listRecentActivity("user-1")).resolves.toEqual([
      {
        agentId: "agent-a",
        jobName: "inbox",
        periodKey: "2026-04-19",
        narration: "Newest entry",
        metadata: { source: "runner" },
        createdAt: "2026-04-19T12:00:00.000Z",
      },
      {
        agentId: "agent-b",
        jobName: "daily",
        periodKey: "2026-04-18",
        narration: "Second entry",
        metadata: {},
        createdAt: "2026-04-18T10:00:00.000Z",
      },
    ]);

    const [, userIdArg, dateArg] = queryRaw.mock.calls[0];
    expect(userIdArg).toBe("user-1");
    expect(dateArg).toBeInstanceOf(Date);
  });
});
