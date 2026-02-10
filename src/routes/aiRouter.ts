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
import { ITodoService } from "../interfaces/ITodoService";
import { CreateTodoDto, Priority } from "../types";
import { config } from "../config";

interface AiRouterDeps {
  aiPlannerService?: AiPlannerService;
  suggestionStore?: IAiSuggestionStore;
  todoService: ITodoService;
  aiDailySuggestionLimit?: number;
  resolveAiUserId: (req: Request, res: Response) => string | null;
}

export function createAiRouter({
  aiPlannerService = new AiPlannerService(),
  suggestionStore = new InMemoryAiSuggestionStore(),
  todoService,
  aiDailySuggestionLimit,
  resolveAiUserId,
}: AiRouterDeps): Router {
  const router = Router();
  const dailyLimit = aiDailySuggestionLimit ?? config.aiDailySuggestionLimit;

  const getCurrentUtcDayStart = (): Date => {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  };

  const getNextUtcDayStart = (): Date => {
    const dayStart = getCurrentUtcDayStart();
    return new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  };

  const getUsage = async (userId: string) => {
    const dayStart = getCurrentUtcDayStart();
    const used = await suggestionStore.countByUserSince(userId, dayStart);
    const remaining = Math.max(dailyLimit - used, 0);
    return {
      used,
      remaining,
      limit: dailyLimit,
      resetAt: getNextUtcDayStart().toISOString(),
    };
  };

  const enforceDailyQuota = async (userId: string, res: Response) => {
    const usage = await getUsage(userId);
    if (usage.remaining <= 0) {
      res.status(429).json({
        error: "Daily AI suggestion limit reached",
        usage,
      });
      return false;
    }
    return true;
  };

  const parsePlanTasks = (output: Record<string, unknown>): CreateTodoDto[] => {
    const rawTasks = output.tasks;
    if (!Array.isArray(rawTasks)) {
      return [];
    }

    const priorities: Priority[] = ["low", "medium", "high"];
    return rawTasks
      .map((task): CreateTodoDto | null => {
        if (!task || typeof task !== "object") {
          return null;
        }
        const item = task as Record<string, unknown>;
        const title = typeof item.title === "string" ? item.title.trim() : "";
        if (!title) {
          return null;
        }

        const description =
          typeof item.description === "string"
            ? item.description.trim()
            : undefined;
        const priority = priorities.includes(item.priority as Priority)
          ? (item.priority as Priority)
          : "medium";

        let dueDate: Date | undefined;
        if (
          typeof item.dueDate === "string" &&
          !Number.isNaN(Date.parse(item.dueDate))
        ) {
          dueDate = new Date(item.dueDate);
        }

        return {
          title,
          description,
          priority,
          dueDate,
          category: "AI Plan",
        };
      })
      .filter((task): task is CreateTodoDto => !!task);
  };

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
        if (!(await enforceDailyQuota(userId, res))) return;

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
        if (!(await enforceDailyQuota(userId, res))) return;

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

  /**
   * @openapi
   * /ai/usage:
   *   get:
   *     tags:
   *       - AI
   *     summary: Get daily AI usage and remaining quota
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Usage summary
   */
  router.get(
    "/usage",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const usage = await getUsage(userId);
        res.json(usage);
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

  /**
   * @openapi
   * /ai/suggestions/{id}/apply:
   *   post:
   *     tags:
   *       - AI
   *     summary: Apply a generated plan suggestion and create todos
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Suggestion applied and todos created
   *       400:
   *         description: Invalid suggestion payload/type
   *       404:
   *         description: Suggestion not found
   *       409:
   *         description: Suggestion already handled
   */
  router.post(
    "/suggestions/:id/apply",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const id = String(req.params.id);
        validateId(id);

        const suggestion = await suggestionStore.getById(userId, id);
        if (!suggestion) {
          return res.status(404).json({ error: "Suggestion not found" });
        }
        if (suggestion.type !== "plan_from_goal") {
          return res
            .status(400)
            .json({ error: "Only plan_from_goal suggestions can be applied" });
        }
        if (suggestion.status === "rejected") {
          return res
            .status(409)
            .json({ error: "Cannot apply a rejected suggestion" });
        }
        if (suggestion.status === "accepted") {
          return res.status(409).json({ error: "Suggestion already applied" });
        }

        const tasks = parsePlanTasks(suggestion.output);
        if (tasks.length === 0) {
          return res
            .status(400)
            .json({ error: "Suggestion does not contain valid plan tasks" });
        }

        const createdTodos = [];
        for (const task of tasks) {
          const todo = await todoService.create(userId, task);
          createdTodos.push(todo);
        }

        const updatedSuggestion = await suggestionStore.updateStatus(
          userId,
          id,
          "accepted",
        );

        res.json({
          createdCount: createdTodos.length,
          todos: createdTodos,
          suggestion: updatedSuggestion,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
