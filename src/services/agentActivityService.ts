import { PrismaClient, Prisma } from "@prisma/client";

interface ActivityRow {
  agent_id: string;
  job_name: string;
  job_period_key: string;
  narration: string;
  metadata: Prisma.JsonValue;
  created_at: Date;
}

export interface AgentActivityEntry {
  agentId: string;
  jobName: string;
  periodKey: string;
  narration: string;
  metadata: Prisma.JsonValue | Record<string, never>;
  createdAt: string;
}

export class AgentActivityService {
  constructor(private readonly prisma: PrismaClient) {}

  async listRecentActivity(userId: string): Promise<AgentActivityEntry[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rows = await this.prisma.$queryRaw<ActivityRow[]>`
      SELECT DISTINCT ON (agent_id, job_name, job_period_key)
        agent_id, job_name, job_period_key, narration, metadata, created_at
      FROM agent_action_audits
      WHERE user_id = ${userId}
        AND narration IS NOT NULL
        AND created_at >= ${sevenDaysAgo}
      ORDER BY agent_id, job_name, job_period_key, created_at DESC
    `;

    return rows
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((row) => ({
        agentId: row.agent_id,
        jobName: row.job_name,
        periodKey: row.job_period_key,
        narration: row.narration,
        metadata: row.metadata ?? {},
        createdAt: row.created_at.toISOString(),
      }));
  }
}
