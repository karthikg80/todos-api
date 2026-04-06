import { Router, Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";

interface ActivityRow {
  agent_id: string;
  job_name: string;
  job_period_key: string;
  narration: string;
  metadata: Prisma.JsonValue;
  created_at: Date;
}

export function createAgentActivityRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/agent-activity", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      const rows = await prisma.$queryRaw<ActivityRow[]>`
        SELECT DISTINCT ON (agent_id, job_name, job_period_key)
          agent_id, job_name, job_period_key, narration, metadata, created_at
        FROM agent_action_audits
        WHERE user_id = ${userId}
          AND narration IS NOT NULL
          AND created_at >= ${sevenDaysAgo}
        ORDER BY agent_id, job_name, job_period_key, created_at DESC
      `;

      const entries = rows
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .map((row) => ({
          agentId: row.agent_id,
          jobName: row.job_name,
          periodKey: row.job_period_key,
          narration: row.narration,
          metadata: row.metadata ?? {},
          createdAt: row.created_at.toISOString(),
        }));

      res.json({ entries });
    } catch (err) {
      console.error("Failed to fetch agent activity:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
