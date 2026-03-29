/**
 * Day Plan API Router
 *
 * Provides REST endpoints for the Today Plan — the flagship
 * feature of the execution intelligence platform.
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  DayPlanService,
  UpdateDayPlanDto,
  AddPlanTaskDto,
} from "../services/dayPlanService";

interface DayPlanRouterDeps {
  dayPlanService: DayPlanService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

export function createDayPlanRouter({
  dayPlanService,
  resolveUserId,
}: DayPlanRouterDeps): Router {
  const router = Router();

  /**
   * GET /plans/today — Get or create today's plan
   */
  router.get(
    "/today",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const plan = await dayPlanService.getOrCreateToday(userId);
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /plans/history/list — Get plan history for learning loop
   */
  router.get(
    "/history/list",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const limit = Math.min(Math.max(Number(req.query.limit) || 14, 1), 90);
        const plans = await dayPlanService.getHistory(userId, limit);
        res.json(plans);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /plans/:date — Get plan for a specific date (YYYY-MM-DD)
   */
  router.get(
    "/:date",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const plan = await dayPlanService.getByDate(
          userId,
          String(req.params.date),
        );
        if (!plan) {
          return res.status(404).json({ error: "Plan not found" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PUT /plans/:planId/meta — Update plan metadata (energy, notes)
   */
  router.put(
    "/:planId/meta",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const dto: UpdateDayPlanDto = {
          energyLevel: req.body.energyLevel,
          notes: req.body.notes,
        };
        const plan = await dayPlanService.update(
          userId,
          String(req.params.planId),
          dto,
        );
        if (!plan) {
          return res.status(404).json({ error: "Plan not found" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /plans/:planId/tasks — Add a task to the plan
   */
  router.post(
    "/:planId/tasks",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const dto: AddPlanTaskDto = {
          todoId: req.body.todoId,
          order: req.body.order,
          estimatedMinutes: req.body.estimatedMinutes,
        };
        if (!dto.todoId) {
          return res.status(400).json({ error: "todoId is required" });
        }
        const plan = await dayPlanService.addTask(
          userId,
          String(req.params.planId),
          dto,
        );
        if (!plan) {
          return res.status(404).json({ error: "Plan or todo not found" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * DELETE /plans/:planId/tasks/:todoId — Remove a task from the plan
   */
  router.delete(
    "/:planId/tasks/:todoId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const plan = await dayPlanService.removeTask(
          userId,
          String(req.params.planId),
          String(req.params.todoId),
        );
        if (!plan) {
          return res.status(404).json({ error: "Plan not found" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PUT /plans/:planId/reorder — Reorder tasks within a plan
   */
  router.put(
    "/:planId/reorder",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const taskOrders = req.body.tasks;
        if (!Array.isArray(taskOrders)) {
          return res.status(400).json({ error: "tasks array is required" });
        }
        const plan = await dayPlanService.reorderTasks(
          userId,
          String(req.params.planId),
          taskOrders,
        );
        if (!plan) {
          return res.status(404).json({ error: "Plan not found" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /plans/:planId/tasks/:todoId — Update task outcome
   */
  router.patch(
    "/:planId/tasks/:todoId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const { outcome } = req.body;
        if (outcome !== "completed" && outcome !== "deferred") {
          return res
            .status(400)
            .json({ error: "outcome must be 'completed' or 'deferred'" });
        }
        const plan = await dayPlanService.updateTaskOutcome(
          userId,
          String(req.params.planId),
          String(req.params.todoId),
          outcome,
        );
        if (!plan) {
          return res.status(404).json({ error: "Plan or task not found" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /plans/:planId/finalize — Finalize the plan
   */
  router.post(
    "/:planId/finalize",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const plan = await dayPlanService.finalize(
          userId,
          String(req.params.planId),
        );
        if (!plan) {
          return res
            .status(400)
            .json({ error: "Plan not found or already finalized" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /plans/:planId/abandon — Abandon the plan
   */
  router.post(
    "/:planId/abandon",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const plan = await dayPlanService.abandon(
          userId,
          String(req.params.planId),
        );
        if (!plan) {
          return res.status(404).json({ error: "Plan not found" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /plans/:planId/review — Generate end-of-day review
   */
  router.post(
    "/:planId/review",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const review = await dayPlanService.review(
          userId,
          String(req.params.planId),
        );
        if (!review) {
          return res.status(404).json({ error: "Plan not found" });
        }
        res.json(review);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
