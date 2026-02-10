import { Router, Request, Response, NextFunction } from "express";
import { AiPlannerService } from "../aiService";
import {
  IAiSuggestionStore,
  InMemoryAiSuggestionStore,
} from "../aiSuggestionStore";
import {
  validateCritiqueTaskInput,
  validateFeedbackSummaryQuery,
  validatePlanFromGoalInput,
  validateSuggestionListQuery,
  validateSuggestionStatusInput,
} from "../aiValidation";
import { validateId } from "../validation";
import { ITodoService } from "../interfaces/ITodoService";
import { CreateTodoDto, Priority } from "../types";
import { config } from "../config";

export type UserPlan = "free" | "pro" | "team";

interface AiRouterDeps {
  aiPlannerService?: AiPlannerService;
  suggestionStore?: IAiSuggestionStore;
  todoService: ITodoService;
  aiDailySuggestionLimit?: number;
  aiDailySuggestionLimitByPlan?: Partial<Record<UserPlan, number>>;
  resolveAiUserPlan?: (userId: string) => Promise<UserPlan>;
  resolveAiUserId: (req: Request, res: Response) => string | null;
}

export function createAiRouter({
  aiPlannerService = new AiPlannerService(),
  suggestionStore = new InMemoryAiSuggestionStore(),
  todoService,
  aiDailySuggestionLimit,
  aiDailySuggestionLimitByPlan,
  resolveAiUserPlan,
  resolveAiUserId,
}: AiRouterDeps): Router {
  const router = Router();
  const defaultLimits: Record<UserPlan, number> = {
    free: config.aiDailySuggestionLimitByPlan.free,
    pro: config.aiDailySuggestionLimitByPlan.pro,
    team: config.aiDailySuggestionLimitByPlan.team,
  };
  const globalOverride =
    aiDailySuggestionLimit && aiDailySuggestionLimit > 0
      ? aiDailySuggestionLimit
      : undefined;
  const limitsByPlan: Record<UserPlan, number> = {
    free:
      aiDailySuggestionLimitByPlan?.free &&
      aiDailySuggestionLimitByPlan.free > 0
        ? aiDailySuggestionLimitByPlan.free
        : globalOverride || defaultLimits.free || config.aiDailySuggestionLimit,
    pro:
      aiDailySuggestionLimitByPlan?.pro && aiDailySuggestionLimitByPlan.pro > 0
        ? aiDailySuggestionLimitByPlan.pro
        : defaultLimits.pro || config.aiDailySuggestionLimit,
    team:
      aiDailySuggestionLimitByPlan?.team &&
      aiDailySuggestionLimitByPlan.team > 0
        ? aiDailySuggestionLimitByPlan.team
        : defaultLimits.team || config.aiDailySuggestionLimit,
  };

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

  const getUserPlan = async (userId: string): Promise<UserPlan> => {
    if (!resolveAiUserPlan) {
      return "free";
    }
    const plan = await resolveAiUserPlan(userId);
    return plan;
  };

  const getUsage = async (userId: string) => {
    const plan = await getUserPlan(userId);
    const dailyLimit = limitsByPlan[plan] || limitsByPlan.free;
    const dayStart = getCurrentUtcDayStart();
    const used = await suggestionStore.countByUserSince(userId, dayStart);
    const remaining = Math.max(dailyLimit - used, 0);
    return {
      plan,
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

  /**
   * @openapi
   * /ai/feedback-summary:
   *   get:
   *     tags:
   *       - AI
   *     summary: Aggregate accepted/rejected AI feedback reasons
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 90
   *         description: Rolling lookback window in days
   *       - in: query
   *         name: reasonLimit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 20
   *         description: Max reasons returned per status bucket
   *     responses:
   *       200:
   *         description: Feedback summary
   */
  router.get(
    "/feedback-summary",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const { days, reasonLimit } = validateFeedbackSummaryQuery(req.query);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const summary = await suggestionStore.summarizeFeedbackByUserSince(
          userId,
          since,
          reasonLimit,
        );

        res.json({
          days,
          reasonLimit,
          since: since.toISOString(),
          acceptedCount: summary.acceptedCount,
          rejectedCount: summary.rejectedCount,
          totalRated: summary.acceptedCount + summary.rejectedCount,
          acceptedReasons: summary.acceptedReasons,
          rejectedReasons: summary.rejectedReasons,
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
        const { status, reason } = validateSuggestionStatusInput(req.body);

        const updated = await suggestionStore.updateStatus(userId, id, status, {
          reason: reason || null,
          source: "manual_status_update",
          updatedAt: new Date().toISOString(),
        });
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
        if (
          suggestion.status === "accepted" &&
          Array.isArray(suggestion.appliedTodoIds) &&
          suggestion.appliedTodoIds.length > 0
        ) {
          const todos = [];
          for (const todoId of suggestion.appliedTodoIds) {
            const todo = await todoService.findById(userId, todoId);
            if (todo) {
              todos.push(todo);
            }
          }

          return res.json({
            createdCount: todos.length,
            todos,
            suggestion,
            idempotent: true,
          });
        }
        if (suggestion.status === "accepted") {
          return res.status(409).json({
            error:
              "Suggestion already accepted but has no applied todo history",
          });
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

        const createdIds = createdTodos.map((todo) => todo.id);
        const updatedSuggestion = await suggestionStore.markApplied(
          userId,
          id,
          createdIds,
          {
            reason: "applied_via_endpoint",
            source: "apply_endpoint",
            updatedAt: new Date().toISOString(),
          },
        );
        if (!updatedSuggestion) {
          return res.status(404).json({ error: "Suggestion not found" });
        }

        res.json({
          createdCount: createdTodos.length,
          todos: createdTodos,
          suggestion: updatedSuggestion,
          idempotent: false,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
