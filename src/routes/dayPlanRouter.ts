/**
 * Day Plan API Router
 *
 * Provides REST endpoints for the Today Plan — the flagship
 * feature of the execution intelligence platform.
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  DayPlanService,
  CreateDayPlanDto,
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
   * @openapi
   * /plans/today:
   *   get:
   *     tags: [Plans]
   *     summary: Get or create today's plan
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Today's day plan
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
   * @openapi
   * /plans/{date}:
   *   get:
   *     tags: [Plans]
   *     summary: Get plan for a specific date
   *     parameters:
   *       - in: path
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    "/:date",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const plan = await dayPlanService.getByDate(userId, String(req.params.date));
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
   * @openapi
   * /plans/{planId}:
   *   put:
   *     tags: [Plans]
   *     summary: Update plan metadata (energy, notes)
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
        const plan = await dayPlanService.update(userId, String(req.params.planId), dto);
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
   * @openapi
   * /plans/{planId}/tasks:
   *   post:
   *     tags: [Plans]
   *     summary: Add a task to the plan
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
   * @openapi
   * /plans/{planId}/tasks/{todoId}:
   *   delete:
   *     tags: [Plans]
   *     summary: Remove a task from the plan
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
   * @openapi
   * /plans/{planId}/reorder:
   *   put:
   *     tags: [Plans]
   *     summary: Reorder tasks within a plan
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
   * @openapi
   * /plans/{planId}/finalize:
   *   post:
   *     tags: [Plans]
   *     summary: Finalize the plan (commit to working on these tasks)
   */
  router.post(
    "/:planId/finalize",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const plan = await dayPlanService.finalize(userId, String(req.params.planId));
        if (!plan) {
          return res
            .status(400)
            .json({ error: "Plan not found or not in draft status" });
        }
        res.json(plan);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * @openapi
   * /plans/{planId}/review:
   *   post:
   *     tags: [Plans]
   *     summary: Generate end-of-day review (committed vs actual)
   */
  router.post(
    "/:planId/review",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const review = await dayPlanService.review(userId, String(req.params.planId));
        if (!review) {
          return res.status(404).json({ error: "Plan not found" });
        }
        res.json(review);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * @openapi
   * /plans/history:
   *   get:
   *     tags: [Plans]
   *     summary: Get plan history for learning loop
   */
  router.get(
    "/history/list",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const limit = Math.min(
          Math.max(Number(req.query.limit) || 14, 1),
          90,
        );
        const plans = await dayPlanService.getHistory(userId, limit);
        res.json(plans);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
