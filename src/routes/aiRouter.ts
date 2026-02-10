import { Router, Request, Response, NextFunction } from "express";
import { AiPlannerService } from "../aiService";
import {
  IAiSuggestionStore,
  InMemoryAiSuggestionStore,
} from "../aiSuggestionStore";
import {
  validateCritiqueTaskInput,
  validatePlanFromGoalInput,
  validateSuggestionListQuery,
  validateSuggestionStatusInput,
} from "../aiValidation";
import { validateId } from "../validation";

interface AiRouterDeps {
  aiPlannerService?: AiPlannerService;
  suggestionStore?: IAiSuggestionStore;
  resolveAiUserId: (req: Request, res: Response) => string | null;
}

export function createAiRouter({
  aiPlannerService = new AiPlannerService(),
  suggestionStore = new InMemoryAiSuggestionStore(),
  resolveAiUserId,
}: AiRouterDeps): Router {
  const router = Router();

  /**
   * @openapi
   * /ai/task-critic:
   *   post:
   *     tags:
   *       - AI
   *     summary: Improve clarity and execution quality of a task
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Task critique with suggested improvements
   *       400:
   *         description: Validation error
   */
  router.post(
    "/task-critic",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const input = validateCritiqueTaskInput(req.body);
        const result = await aiPlannerService.critiqueTask(input);

        const suggestion = await suggestionStore.create({
          userId,
          type: "task_critic",
          input: {
            ...input,
            dueDate: input.dueDate?.toISOString(),
          },
          output: {
            ...result,
          },
        });

        res.json({
          ...result,
          suggestionId: suggestion.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * @openapi
   * /ai/plan-from-goal:
   *   post:
   *     tags:
   *       - AI
   *     summary: Generate a practical execution plan from a goal statement
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Generated plan and task suggestions
   *       400:
   *         description: Validation error
   */
  router.post(
    "/plan-from-goal",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const input = validatePlanFromGoalInput(req.body);
        const result = await aiPlannerService.planFromGoal(input);

        const suggestion = await suggestionStore.create({
          userId,
          type: "plan_from_goal",
          input: {
            ...input,
            targetDate: input.targetDate?.toISOString(),
          },
          output: {
            ...result,
            tasks: result.tasks.map((task) => ({
              ...task,
              dueDate: task.dueDate?.toISOString(),
            })),
          },
        });

        res.json({
          ...result,
          suggestionId: suggestion.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/suggestions",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const { limit } = validateSuggestionListQuery(req.query);
        const records = await suggestionStore.listByUser(userId, limit);
        res.json(records);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/suggestions/:id/status",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const id = String(req.params.id);
        validateId(id);
        const { status } = validateSuggestionStatusInput(req.body);

        const updated = await suggestionStore.updateStatus(userId, id, status);
        if (!updated) {
          return res.status(404).json({ error: "Suggestion not found" });
        }

        res.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
