import { Router, Request, Response, NextFunction } from "express";
import { PlanningPreferencesService } from "../services/planningPreferencesService";

export function createPreferencesRouter(
  planningPreferencesService: PlanningPreferencesService,
): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.json(await planningPreferencesService.getForUser(userId));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.json(
        await planningPreferencesService.upsertForUser(userId, req.body),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
