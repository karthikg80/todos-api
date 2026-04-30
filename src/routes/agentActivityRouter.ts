import { Router, Request, Response, NextFunction } from "express";
import { AgentActivityService } from "../services/agentActivityService";

export function createAgentActivityRouter(
  agentActivityService: AgentActivityService,
): Router {
  const router = Router();

  router.get(
    "/agent-activity",
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        res.json({
          entries: await agentActivityService.listRecentActivity(userId),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
