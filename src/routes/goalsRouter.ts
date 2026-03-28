import { Router, Request, Response, NextFunction } from "express";
import { GoalService } from "../services/goalService";

interface GoalsRouterDeps {
  goalService?: GoalService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

export function createGoalsRouter({
  goalService,
  resolveUserId,
}: GoalsRouterDeps): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!goalService)
        return res.status(501).json({ error: "Goals not configured" });
      const userId = resolveUserId(req, res);
      if (!userId) return;
      const archived = req.query.archived === "true" ? true : undefined;
      const goals = await goalService.findAll(userId, { archived });
      res.json(goals);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!goalService)
        return res.status(501).json({ error: "Goals not configured" });
      const userId = resolveUserId(req, res);
      if (!userId) return;
      const { name, description, targetDate } = req.body;
      if (!name || typeof name !== "string" || !name.trim())
        return res.status(400).json({ error: "name is required" });
      if (name.length > 200)
        return res.status(400).json({ error: "name max length is 200" });
      const goal = await goalService.create(userId, {
        name: name.trim(),
        description: description ?? null,
        targetDate: targetDate ?? null,
      });
      res.status(201).json(goal);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!goalService)
          return res.status(501).json({ error: "Goals not configured" });
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const goal = await goalService.findById(userId, String(req.params.id));
        if (!goal) return res.status(404).json({ error: "Goal not found" });
        res.json(goal);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!goalService)
          return res.status(501).json({ error: "Goals not configured" });
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const goal = await goalService.update(
          userId,
          String(req.params.id),
          req.body,
        );
        if (!goal) return res.status(404).json({ error: "Goal not found" });
        res.json(goal);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!goalService)
          return res.status(501).json({ error: "Goals not configured" });
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const deleted = await goalService.delete(userId, String(req.params.id));
        if (!deleted) return res.status(404).json({ error: "Goal not found" });
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
