import { Router, Request, Response, NextFunction } from "express";
import { AiPlannerService } from "../aiService";
import {
  IAiSuggestionStore,
  InMemoryAiSuggestionStore,
} from "../aiSuggestionStore";
import {
  validateApplySuggestionInput,
  validateBreakdownTodoInput,
  validateCritiqueTaskInput,
  validateDecisionAssistDismissInput,
  validateDecisionAssistLatestQuery,
  validateDecisionAssistStubInput,
  validateFeedbackSummaryQuery,
  validateInsightsQuery,
  validatePlanFromGoalInput,
  validateSuggestionListQuery,
  validateSuggestionStatusInput,
} from "../aiValidation";
import {
  DecisionAssistOutput,
  DecisionAssistSuggestion,
  DecisionAssistSuggestionType,
  DecisionAssistSurface,
  validateDecisionAssistOutput,
} from "../aiContracts";
import { validateId } from "../validation";
import { ITodoService } from "../interfaces/ITodoService";
import { CreateTodoDto, Priority } from "../types";
import { config } from "../config";
import { IProjectService } from "../interfaces/IProjectService";

export type UserPlan = "free" | "pro" | "team";

interface AiRouterDeps {
  aiPlannerService?: AiPlannerService;
  suggestionStore?: IAiSuggestionStore;
  todoService: ITodoService;
  aiDailySuggestionLimit?: number;
  aiDailySuggestionLimitByPlan?: Partial<Record<UserPlan, number>>;
  resolveAiUserPlan?: (userId: string) => Promise<UserPlan>;
  resolveAiUserId: (req: Request, res: Response) => string | null;
  projectService?: IProjectService;
  decisionAssistEnabled?: boolean;
}

export function createAiRouter({
  aiPlannerService = new AiPlannerService(),
  suggestionStore = new InMemoryAiSuggestionStore(),
  todoService,
  aiDailySuggestionLimit,
  aiDailySuggestionLimitByPlan,
  resolveAiUserPlan,
  resolveAiUserId,
  projectService,
  decisionAssistEnabled = config.aiDecisionAssistEnabled,
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

  const getFeedbackContext = async (userId: string) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const summary = await suggestionStore.summarizeFeedbackByUserSince(
      userId,
      since,
      3,
    );
    return {
      rejectionSignals: summary.rejectedReasons.map((item) => item.reason),
      acceptanceSignals: summary.acceptedReasons.map((item) => item.reason),
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

  const buildInsightsRecommendation = (params: {
    plan: UserPlan;
    usageRemaining: number;
    usageLimit: number;
    generatedCount: number;
    topRejectedReason?: string;
  }): string => {
    const usageThreshold = Math.max(1, Math.ceil(params.usageLimit * 0.1));
    if (params.plan === "free" && params.usageRemaining <= usageThreshold) {
      return "You are near your daily AI cap. Upgrade to Pro for higher limits and uninterrupted planning.";
    }
    const reason = (params.topRejectedReason || "").toLowerCase();
    if (
      reason.includes("generic") ||
      reason.includes("vague") ||
      reason.includes("specific")
    ) {
      return "Recent rejections suggest outputs are too generic. Add constraints like owner, metric, and due date to get stronger suggestions.";
    }
    if (params.generatedCount < 3) {
      return "Generate a few more AI suggestions this week to improve personalization and quality tracking.";
    }
    return "Keep rating suggestions after each run to continuously improve output quality.";
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

  const TASK_DRAWER_SURFACE: DecisionAssistSurface = "task_drawer";
  const ON_CREATE_SURFACE: DecisionAssistSurface = "on_create";
  const TODAY_PLAN_SURFACE: DecisionAssistSurface = "today_plan";
  const TODO_BOUND_TYPE: "task_critic" = "task_critic";
  const TODO_BOUND_SURFACES = new Set<DecisionAssistSurface>([
    TASK_DRAWER_SURFACE,
    ON_CREATE_SURFACE,
  ]);
  const TODAY_PLAN_ALLOWED_TYPES = new Set<DecisionAssistSuggestionType>([
    "set_due_date",
    "set_priority",
    "split_subtasks",
    "propose_next_action",
  ]);
  const TODO_BOUND_ALLOWED_TYPES: Record<
    "task_drawer" | "on_create",
    Set<DecisionAssistSuggestionType>
  > = {
    task_drawer: new Set<DecisionAssistSuggestionType>([
      "rewrite_title",
      "split_subtasks",
      "propose_next_action",
      "set_due_date",
      "set_priority",
      "set_project",
      "set_category",
      "ask_clarification",
      "defer_task",
    ]),
    on_create: new Set<DecisionAssistSuggestionType>([
      "rewrite_title",
      "set_due_date",
      "set_priority",
      "set_project",
      "set_category",
      "ask_clarification",
    ]),
  };

  type NormalizedTodoBoundSuggestion = DecisionAssistSuggestion & {
    suggestionId: string;
    requiresConfirmation: boolean;
    payload: Record<string, unknown>;
  };

  type NormalizedTodoBoundEnvelope = DecisionAssistOutput & {
    suggestions: NormalizedTodoBoundSuggestion[];
  };

  type NormalizedTodayPlanSuggestion = DecisionAssistSuggestion & {
    suggestionId: string;
    requiresConfirmation: boolean;
    payload: Record<string, unknown>;
  };

  type NormalizedTodayPlanEnvelope = DecisionAssistOutput & {
    suggestions: NormalizedTodayPlanSuggestion[];
  };

  const parseBool = (value: unknown): boolean => value === true;

  const normalizeTodoBoundEnvelope = (
    rawOutput: Record<string, unknown>,
    todoId: string,
    surface: DecisionAssistSurface,
  ): NormalizedTodoBoundEnvelope => {
    const validated = validateDecisionAssistOutput(rawOutput);
    if (validated.surface !== surface) {
      throw new Error("Suggestion envelope surface mismatch");
    }
    const allowedTypes =
      TODO_BOUND_ALLOWED_TYPES[surface as "task_drawer" | "on_create"];

    const normalizedSuggestions = validated.suggestions
      .map((item, index): NormalizedTodoBoundSuggestion => {
        const rawItem =
          Array.isArray(rawOutput.suggestions) &&
          rawOutput.suggestions[index] &&
          typeof rawOutput.suggestions[index] === "object"
            ? (rawOutput.suggestions[index] as Record<string, unknown>)
            : {};
        const suggestionIdRaw =
          typeof rawItem.suggestionId === "string"
            ? rawItem.suggestionId.trim()
            : "";
        const suggestionId = suggestionIdRaw || `task-drawer-${index + 1}`;
        const payload = {
          ...(item.payload || {}),
          todoId:
            typeof (item.payload || {}).todoId === "string"
              ? (item.payload as Record<string, unknown>).todoId
              : todoId,
        };
        return {
          ...item,
          payload,
          suggestionId,
          requiresConfirmation: parseBool(rawItem.requiresConfirmation),
        };
      })
      .filter((item) => allowedTypes.has(item.type));

    return {
      ...validated,
      suggestions: normalizedSuggestions,
    };
  };

  const normalizeTodayPlanEnvelope = (
    rawOutput: Record<string, unknown>,
  ): NormalizedTodayPlanEnvelope => {
    const validated = validateDecisionAssistOutput(rawOutput);
    if (validated.surface !== TODAY_PLAN_SURFACE) {
      throw new Error("Suggestion envelope surface mismatch");
    }
    const previewTodoIds = new Set(
      (validated.planPreview?.items || [])
        .map((item) => (typeof item.todoId === "string" ? item.todoId : ""))
        .filter(Boolean),
    );
    const normalizedSuggestions = validated.suggestions.reduce<
      NormalizedTodayPlanSuggestion[]
    >((acc, item, index) => {
      const rawItem =
        Array.isArray(rawOutput.suggestions) &&
        rawOutput.suggestions[index] &&
        typeof rawOutput.suggestions[index] === "object"
          ? (rawOutput.suggestions[index] as Record<string, unknown>)
          : {};
      const suggestionIdRaw =
        typeof rawItem.suggestionId === "string"
          ? rawItem.suggestionId.trim()
          : "";
      const suggestionId = suggestionIdRaw || `today-plan-${index + 1}`;
      const payload =
        item.payload && typeof item.payload === "object"
          ? ({ ...item.payload } as Record<string, unknown>)
          : {};
      const payloadTodoId =
        typeof payload.todoId === "string" ? payload.todoId.trim() : "";
      if (!payloadTodoId || !previewTodoIds.has(payloadTodoId)) {
        return acc;
      }
      const normalized: NormalizedTodayPlanSuggestion = {
        ...item,
        suggestionId,
        requiresConfirmation: parseBool(rawItem.requiresConfirmation),
        payload: {
          ...payload,
          todoId: payloadTodoId,
        },
      };
      if (TODAY_PLAN_ALLOWED_TYPES.has(normalized.type)) {
        acc.push(normalized);
      }
      return acc;
    }, []);

    return {
      ...validated,
      suggestions: normalizedSuggestions,
    };
  };

  const findLatestPendingDecisionAssistSuggestion = async (
    userId: string,
    todoId: string,
    surface: DecisionAssistSurface,
  ) => {
    const records = await suggestionStore.listByUser(userId, 100);
    return (
      records.find((record) => {
        if (record.status !== "pending") return false;
        if (record.type !== TODO_BOUND_TYPE) return false;
        const inputSurface =
          typeof record.input?.surface === "string" ? record.input.surface : "";
        const inputTodoId =
          typeof record.input?.todoId === "string" ? record.input.todoId : "";
        return inputSurface === surface && inputTodoId === todoId;
      }) || null
    );
  };

  const findLatestPendingTodayPlanSuggestion = async (userId: string) => {
    const records = await suggestionStore.listByUser(userId, 100);
    return (
      records.find((record) => {
        if (record.status !== "pending") return false;
        if (record.type !== "plan_from_goal") return false;
        const inputSurface =
          typeof record.input?.surface === "string" ? record.input.surface : "";
        const inputTodoId =
          typeof record.input?.todoId === "string" ? record.input.todoId : "";
        return inputSurface === TODAY_PLAN_SURFACE && !inputTodoId;
      }) || null
    );
  };

  const ensureDecisionAssistFeatureEnabled = (res: Response): boolean => {
    if (decisionAssistEnabled) {
      return true;
    }
    res.status(403).json({ error: "Decision assist disabled" });
    return false;
  };

  /**
   * @openapi
   * /ai/decision-assist/stub:
   *   post:
   *     tags:
   *       - AI
   *     summary: Generate contract-validated stub suggestions for Decision Assist surfaces
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Structured Decision Assist suggestions
   *       400:
   *         description: Validation error
   */
  router.post(
    "/decision-assist/stub",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;
        if (!(await enforceDailyQuota(userId, res))) return;

        const input = validateDecisionAssistStubInput(req.body);
        if (input.surface === TASK_DRAWER_SURFACE) {
          if (!ensureDecisionAssistFeatureEnabled(res)) return;
          if (!input.todoId) {
            return res
              .status(400)
              .json({ error: "todoId is required for task_drawer surface" });
          }
        }
        if (input.surface === ON_CREATE_SURFACE && input.todoId) {
          if (!ensureDecisionAssistFeatureEnabled(res)) return;
        }
        if (input.surface === TODAY_PLAN_SURFACE) {
          if (!ensureDecisionAssistFeatureEnabled(res)) return;
        }
        if (
          (input.surface === TASK_DRAWER_SURFACE ||
            (input.surface === ON_CREATE_SURFACE && input.todoId)) &&
          input.todoId
        ) {
          const todo = await todoService.findById(userId, input.todoId);
          if (!todo) {
            return res.status(404).json({ error: "Todo not found" });
          }
        }
        const output = validateDecisionAssistOutput(
          await aiPlannerService.generateDecisionAssistStub(input),
        );

        const suggestion = await suggestionStore.create({
          userId,
          type:
            input.surface === "today_plan" ? "plan_from_goal" : "task_critic",
          input: {
            ...input,
          },
          output: output as unknown as Record<string, unknown>,
        });

        res.json({
          ...output,
          suggestionId: suggestion.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

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
        const feedbackContext = await getFeedbackContext(userId);
        const result = await aiPlannerService.critiqueTask(
          input,
          feedbackContext,
        );

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
        const feedbackContext = await getFeedbackContext(userId);
        const result = await aiPlannerService.planFromGoal(
          input,
          feedbackContext,
        );

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
   * /ai/insights:
   *   get:
   *     tags:
   *       - AI
   *     summary: Get AI quality and usage insights with recommendation
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 90
   *         description: Rolling lookback window in days (default 7)
   *     responses:
   *       200:
   *         description: AI insights summary
   */
  router.get(
    "/insights",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const { days } = validateInsightsQuery(req.query);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const [usage, generatedCount, feedbackSummary] = await Promise.all([
          getUsage(userId),
          suggestionStore.countByUserSince(userId, since),
          suggestionStore.summarizeFeedbackByUserSince(userId, since, 3),
        ]);

        const ratedCount =
          feedbackSummary.acceptedCount + feedbackSummary.rejectedCount;
        const acceptanceRate =
          ratedCount > 0
            ? Math.round((feedbackSummary.acceptedCount / ratedCount) * 100)
            : null;
        const topRejectedReason = feedbackSummary.rejectedReasons[0]?.reason;
        const recommendation = buildInsightsRecommendation({
          plan: usage.plan,
          usageRemaining: usage.remaining,
          usageLimit: usage.limit,
          generatedCount,
          topRejectedReason,
        });

        res.json({
          periodDays: days,
          since: since.toISOString(),
          usageToday: usage,
          generatedCount,
          ratedCount,
          acceptedCount: feedbackSummary.acceptedCount,
          rejectedCount: feedbackSummary.rejectedCount,
          acceptanceRate,
          topAcceptedReasons: feedbackSummary.acceptedReasons,
          topRejectedReasons: feedbackSummary.rejectedReasons,
          recommendation,
        });
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

  router.get(
    "/suggestions/latest",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;
        if (!ensureDecisionAssistFeatureEnabled(res)) return;

        const { todoId, surface } = validateDecisionAssistLatestQuery(
          req.query,
        );
        const isTodoBound = TODO_BOUND_SURFACES.has(surface);
        const isTodayPlan = surface === TODAY_PLAN_SURFACE;
        if (!isTodoBound && !isTodayPlan) {
          return res.status(400).json({
            error: "surface must be on_create, task_drawer, or today_plan",
          });
        }

        const latest = isTodoBound
          ? await findLatestPendingDecisionAssistSuggestion(
              userId,
              String(todoId || ""),
              surface,
            )
          : await findLatestPendingTodayPlanSuggestion(userId);
        if (!latest) {
          return res.status(204).end();
        }

        try {
          const outputEnvelope = isTodoBound
            ? normalizeTodoBoundEnvelope(
                latest.output,
                String(todoId || ""),
                surface,
              )
            : normalizeTodayPlanEnvelope(latest.output);
          return res.json({
            aiSuggestionId: latest.id,
            status: latest.status,
            outputEnvelope,
          });
        } catch {
          return res.json({
            aiSuggestionId: latest.id,
            status: latest.status,
            outputEnvelope: {
              requestId: `safe-empty-${latest.id}`,
              surface,
              must_abstain: true,
              planPreview:
                surface === TODAY_PLAN_SURFACE
                  ? { topN: 3, items: [] }
                  : undefined,
              suggestions: [],
            },
          });
        }
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * @openapi
   * /ai/todos/{id}/breakdown:
   *   post:
   *     tags:
   *       - AI
   *     summary: Generate and create subtasks for an existing todo
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Breakdown generated and subtasks created
   *       404:
   *         description: Todo not found
   *       409:
   *         description: Todo already has subtasks
   */
  router.post(
    "/todos/:id/breakdown",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;

        const id = String(req.params.id);
        validateId(id);
        const { maxSubtasks, force } = validateBreakdownTodoInput(req.body);

        const todo = await todoService.findById(userId, id);
        if (!todo) {
          return res.status(404).json({ error: "Todo not found" });
        }

        const existingCount = Array.isArray(todo.subtasks)
          ? todo.subtasks.length
          : 0;
        if (existingCount > 0 && !force) {
          return res.status(409).json({
            error: "Todo already has subtasks. Pass force=true to add more.",
            existingSubtasks: existingCount,
          });
        }

        const feedbackContext = await getFeedbackContext(userId);
        const breakdown = await aiPlannerService.breakdownTodoIntoSubtasks(
          {
            title: todo.title,
            description: todo.description,
            notes: todo.notes,
            priority: todo.priority,
            maxSubtasks,
          },
          feedbackContext,
        );

        if (
          !Array.isArray(breakdown.subtasks) ||
          breakdown.subtasks.length < 1
        ) {
          return res
            .status(400)
            .json({ error: "Generated breakdown contains no subtasks" });
        }

        const createdSubtasks = [];
        for (const item of breakdown.subtasks.slice(0, maxSubtasks)) {
          const subtask = await todoService.createSubtask(userId, id, {
            title: item.title,
          });
          if (subtask) {
            createdSubtasks.push(subtask);
          }
        }

        res.json({
          todoId: id,
          summary: breakdown.summary,
          createdCount: createdSubtasks.length,
          subtasks: createdSubtasks,
        });
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
        const { reason, suggestionId, confirmed, selectedTodoIds } =
          validateApplySuggestionInput(req.body);

        const suggestion = await suggestionStore.getById(userId, id);
        if (!suggestion) {
          return res.status(404).json({ error: "Suggestion not found" });
        }
        if (suggestion.status === "rejected") {
          return res
            .status(409)
            .json({ error: "Cannot apply a rejected suggestion" });
        }
        if (suggestion.type === "plan_from_goal") {
          const inputSurfaceRaw =
            typeof suggestion.input?.surface === "string"
              ? suggestion.input.surface
              : "";
          const inputSurface = inputSurfaceRaw as DecisionAssistSurface;
          if (inputSurface === TODAY_PLAN_SURFACE) {
            if (!ensureDecisionAssistFeatureEnabled(res)) return;
            if (suggestion.status !== "pending") {
              return res
                .status(409)
                .json({ error: "Suggestion is no longer pending" });
            }

            let envelope: NormalizedTodayPlanEnvelope;
            try {
              envelope = normalizeTodayPlanEnvelope(suggestion.output);
            } catch {
              return res
                .status(400)
                .json({ error: "Stored suggestion output is invalid" });
            }

            const plannedTodoIds = new Set(
              (envelope.planPreview?.items || [])
                .map((item) =>
                  typeof item.todoId === "string" ? item.todoId : "",
                )
                .filter(Boolean),
            );
            const selectedSet =
              selectedTodoIds && selectedTodoIds.length > 0
                ? new Set(
                    selectedTodoIds.filter((todoId) =>
                      plannedTodoIds.has(todoId),
                    ),
                  )
                : plannedTodoIds;

            const applicableSuggestions = (
              envelope.suggestions as NormalizedTodayPlanSuggestion[]
            ).filter((item) => {
              const payloadTodoId =
                typeof item.payload?.todoId === "string"
                  ? item.payload.todoId
                  : "";
              return !!payloadTodoId && selectedSet.has(payloadTodoId);
            });

            if (!applicableSuggestions.length) {
              return res.status(400).json({
                error:
                  "No applicable today plan suggestions for selectedTodoIds",
              });
            }

            const updatedTodosMap = new Map<
              string,
              Awaited<ReturnType<ITodoService["findById"]>>
            >();

            for (const selected of applicableSuggestions) {
              const payload = selected.payload || {};
              const todoId =
                typeof payload.todoId === "string" ? payload.todoId : "";
              if (!todoId) continue;

              const currentTodo =
                updatedTodosMap.get(todoId) ||
                (await todoService.findById(userId, todoId));
              if (!currentTodo) continue;

              if (selected.requiresConfirmation && confirmed !== true) {
                return res.status(400).json({
                  error: "Confirmation is required for this suggestion",
                });
              }

              if (selected.type === "set_priority") {
                const priority = String(payload.priority || "").toLowerCase();
                if (!["low", "medium", "high"].includes(priority)) {
                  return res
                    .status(400)
                    .json({ error: "Invalid priority value" });
                }
                if (priority === "high" && confirmed !== true) {
                  return res.status(400).json({
                    error:
                      "High priority changes require explicit confirmation",
                  });
                }
                const updated = await todoService.update(userId, todoId, {
                  priority: priority as Priority,
                });
                if (updated) updatedTodosMap.set(todoId, updated);
                continue;
              }

              if (selected.type === "set_due_date") {
                const dueDateISO =
                  typeof payload.dueDateISO === "string"
                    ? payload.dueDateISO
                    : "";
                const parsed = new Date(dueDateISO);
                if (Number.isNaN(parsed.getTime())) {
                  return res.status(400).json({ error: "Invalid due date" });
                }
                if (parsed.getTime() < Date.now() && confirmed !== true) {
                  return res.status(400).json({
                    error: "Past due dates require explicit confirmation",
                  });
                }
                const updated = await todoService.update(userId, todoId, {
                  dueDate: parsed,
                });
                if (updated) updatedTodosMap.set(todoId, updated);
                continue;
              }

              if (selected.type === "split_subtasks") {
                const subtasksRaw = Array.isArray(payload.subtasks)
                  ? payload.subtasks
                  : [];
                if (subtasksRaw.length < 1 || subtasksRaw.length > 5) {
                  return res
                    .status(400)
                    .json({ error: "split_subtasks requires 1-5 subtasks" });
                }
                for (const item of subtasksRaw.slice(0, 5)) {
                  const title =
                    item &&
                    typeof item === "object" &&
                    typeof item.title === "string"
                      ? item.title.trim()
                      : "";
                  if (!title || title.length > 200) {
                    return res
                      .status(400)
                      .json({ error: "Invalid subtask title" });
                  }
                  await todoService.createSubtask(userId, todoId, { title });
                }
                const refreshed = await todoService.findById(userId, todoId);
                if (refreshed) updatedTodosMap.set(todoId, refreshed);
                continue;
              }

              if (selected.type === "propose_next_action") {
                const textCandidate =
                  typeof payload.text === "string"
                    ? payload.text
                    : typeof payload.title === "string"
                      ? payload.title
                      : "";
                const nextAction = textCandidate.trim();
                if (!nextAction || nextAction.length > 200) {
                  return res
                    .status(400)
                    .json({ error: "Invalid next action text" });
                }
                const nextNotes = currentTodo.notes
                  ? `${currentTodo.notes}\nNext action: ${nextAction}`
                  : `Next action: ${nextAction}`;
                const updated = await todoService.update(userId, todoId, {
                  notes: nextNotes,
                });
                if (updated) updatedTodosMap.set(todoId, updated);
              }
            }

            const updatedTodos = Array.from(updatedTodosMap.values()).filter(
              (item): item is NonNullable<typeof item> => !!item,
            );
            const appliedTodoIds = updatedTodos.map((todo) => todo.id);
            const updatedSuggestion = await suggestionStore.markApplied(
              userId,
              id,
              appliedTodoIds,
              {
                reason: reason || "today_plan_apply",
                source: "today_plan_apply",
                suggestionId: suggestionId || null,
                selectedTodoIds: Array.from(selectedSet),
                updatedAt: new Date().toISOString(),
              },
            );
            if (!updatedSuggestion) {
              return res.status(404).json({ error: "Suggestion not found" });
            }

            return res.json({
              updatedCount: updatedTodos.length,
              todos: updatedTodos,
              suggestion: updatedSuggestion,
              idempotent: false,
            });
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
              reason: reason || "applied_via_endpoint",
              source: "apply_endpoint",
              updatedAt: new Date().toISOString(),
            },
          );
          if (!updatedSuggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
          }

          return res.json({
            createdCount: createdTodos.length,
            todos: createdTodos,
            suggestion: updatedSuggestion,
            idempotent: false,
          });
        }

        if (!ensureDecisionAssistFeatureEnabled(res)) return;
        if (suggestion.type !== TODO_BOUND_TYPE) {
          return res.status(400).json({
            error: "Only task_critic or plan_from_goal can be applied",
          });
        }
        const inputSurfaceRaw =
          typeof suggestion.input?.surface === "string"
            ? suggestion.input.surface
            : "";
        const inputSurface = inputSurfaceRaw as DecisionAssistSurface;
        if (!TODO_BOUND_SURFACES.has(inputSurface)) {
          return res.status(400).json({
            error: "Only on_create or task_drawer suggestions can be applied",
          });
        }
        if (!suggestionId) {
          return res
            .status(400)
            .json({ error: "suggestionId is required for suggestion apply" });
        }

        const inputTodoId =
          typeof suggestion.input?.todoId === "string"
            ? suggestion.input.todoId
            : "";
        if (!inputTodoId) {
          return res
            .status(400)
            .json({ error: "Todo-bound suggestion missing todo context" });
        }
        const todo = await todoService.findById(userId, inputTodoId);
        if (!todo) {
          return res.status(404).json({ error: "Todo not found" });
        }
        if (suggestion.status !== "pending") {
          return res
            .status(409)
            .json({ error: "Suggestion is no longer pending" });
        }

        let envelope: NormalizedTodoBoundEnvelope;
        try {
          envelope = normalizeTodoBoundEnvelope(
            suggestion.output,
            inputTodoId,
            inputSurface,
          );
        } catch {
          return res
            .status(400)
            .json({ error: "Stored suggestion output is invalid" });
        }

        const envelopeSuggestions =
          envelope.suggestions as NormalizedTodoBoundSuggestion[];
        const selected = envelopeSuggestions.find(
          (item) => item.suggestionId === suggestionId,
        );
        if (!selected) {
          return res.status(404).json({ error: "Suggestion item not found" });
        }

        if (selected.requiresConfirmation && confirmed !== true) {
          return res
            .status(400)
            .json({ error: "Confirmation is required for this suggestion" });
        }

        const payload = selected.payload || {};
        const now = Date.now();
        const todoIdsApplied = [inputTodoId];
        let updatedTodo = todo;

        switch (selected.type) {
          case "rewrite_title": {
            const nextTitle =
              typeof payload.title === "string" ? payload.title.trim() : "";
            if (!nextTitle || nextTitle.length > 200) {
              return res.status(400).json({ error: "Invalid rewrite title" });
            }
            const updated = await todoService.update(userId, inputTodoId, {
              title: nextTitle,
            });
            if (!updated) {
              return res.status(404).json({ error: "Todo not found" });
            }
            updatedTodo = updated;
            break;
          }
          case "set_due_date": {
            const dueDateISO =
              typeof payload.dueDateISO === "string" ? payload.dueDateISO : "";
            const parsed = new Date(dueDateISO);
            if (Number.isNaN(parsed.getTime())) {
              return res.status(400).json({ error: "Invalid due date" });
            }
            if (parsed.getTime() < now && confirmed !== true) {
              return res.status(400).json({
                error: "Past due dates require explicit confirmation",
              });
            }
            const updated = await todoService.update(userId, inputTodoId, {
              dueDate: parsed,
            });
            if (!updated) {
              return res.status(404).json({ error: "Todo not found" });
            }
            updatedTodo = updated;
            break;
          }
          case "set_priority": {
            const priority = String(payload.priority || "").toLowerCase();
            if (!["low", "medium", "high"].includes(priority)) {
              return res.status(400).json({ error: "Invalid priority value" });
            }
            const requiresPriorityConfirm =
              priority === "high" && confirmed !== true;
            if (requiresPriorityConfirm) {
              return res.status(400).json({
                error: "High priority changes require explicit confirmation",
              });
            }
            const updated = await todoService.update(userId, inputTodoId, {
              priority: priority as Priority,
            });
            if (!updated) {
              return res.status(404).json({ error: "Todo not found" });
            }
            updatedTodo = updated;
            break;
          }
          case "set_category":
          case "set_project": {
            let nextCategory =
              typeof payload.category === "string"
                ? payload.category.trim()
                : "";
            const projectName =
              typeof payload.projectName === "string"
                ? payload.projectName.trim()
                : "";
            const projectId =
              typeof payload.projectId === "string"
                ? payload.projectId.trim()
                : "";

            if (!nextCategory && projectName) {
              nextCategory = projectName;
            }

            if (projectId && projectService) {
              const projects = await projectService.findAll(userId);
              const byId = projects.find((item) => item.id === projectId);
              if (byId) {
                nextCategory = byId.name;
              }
            } else if (projectName && projectService) {
              const projects = await projectService.findAll(userId);
              const byName = projects.find(
                (item) => item.name.toLowerCase() === projectName.toLowerCase(),
              );
              if (byName) {
                nextCategory = byName.name;
              }
            }

            if (!nextCategory || nextCategory.length > 50) {
              return res
                .status(400)
                .json({ error: "Invalid category/project value" });
            }

            const updated = await todoService.update(userId, inputTodoId, {
              category: nextCategory,
            });
            if (!updated) {
              return res.status(404).json({ error: "Todo not found" });
            }
            updatedTodo = updated;
            break;
          }
          case "split_subtasks": {
            const subtasksRaw = Array.isArray(payload.subtasks)
              ? payload.subtasks
              : [];
            if (subtasksRaw.length < 1 || subtasksRaw.length > 5) {
              return res
                .status(400)
                .json({ error: "split_subtasks requires 1-5 subtasks" });
            }
            // Safe mode: append generated subtasks to avoid destructive deletion.
            for (const item of subtasksRaw.slice(0, 5)) {
              const title =
                item &&
                typeof item === "object" &&
                typeof item.title === "string"
                  ? item.title.trim()
                  : "";
              if (!title || title.length > 200) {
                return res.status(400).json({ error: "Invalid subtask title" });
              }
              const created = await todoService.createSubtask(
                userId,
                inputTodoId,
                {
                  title,
                },
              );
              if (!created) {
                return res.status(404).json({ error: "Todo not found" });
              }
            }
            updatedTodo =
              (await todoService.findById(userId, inputTodoId)) || todo;
            break;
          }
          case "propose_next_action": {
            const textCandidate =
              typeof payload.text === "string"
                ? payload.text
                : typeof payload.title === "string"
                  ? payload.title
                  : "";
            const nextAction = textCandidate.trim();
            if (!nextAction || nextAction.length > 200) {
              return res
                .status(400)
                .json({ error: "Invalid next action text" });
            }
            const prefix = "Next action: ";
            const nextNotes = updatedTodo.notes
              ? `${updatedTodo.notes}\n${prefix}${nextAction}`
              : `${prefix}${nextAction}`;
            const updated = await todoService.update(userId, inputTodoId, {
              notes: nextNotes,
            });
            if (!updated) {
              return res.status(404).json({ error: "Todo not found" });
            }
            updatedTodo = updated;
            break;
          }
          case "ask_clarification":
          case "defer_task":
          default: {
            return res.status(400).json({
              error: `Suggestion type "${selected.type}" is not supported for apply`,
            });
          }
        }

        const updatedSuggestion = await suggestionStore.markApplied(
          userId,
          id,
          todoIdsApplied,
          {
            reason: reason || `applied:${selected.suggestionId}`,
            source: `${inputSurface}_apply`,
            suggestionId: selected.suggestionId,
            updatedAt: new Date().toISOString(),
          },
        );
        if (!updatedSuggestion) {
          return res.status(404).json({ error: "Suggestion not found" });
        }

        return res.json({
          todo: updatedTodo,
          appliedSuggestionId: selected.suggestionId,
          suggestion: updatedSuggestion,
          idempotent: false,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/suggestions/:id/dismiss",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveAiUserId(req, res);
        if (!userId) return;
        if (!ensureDecisionAssistFeatureEnabled(res)) return;

        const id = String(req.params.id);
        validateId(id);
        validateDecisionAssistDismissInput(req.body);

        const suggestion = await suggestionStore.getById(userId, id);
        if (!suggestion) {
          return res.status(404).json({ error: "Suggestion not found" });
        }
        const isTodoBoundSuggestion = suggestion.type === TODO_BOUND_TYPE;
        const isTodayPlanSuggestion =
          suggestion.type === "plan_from_goal" &&
          suggestion.input &&
          typeof suggestion.input.surface === "string" &&
          suggestion.input.surface === TODAY_PLAN_SURFACE;
        if (!isTodoBoundSuggestion && !isTodayPlanSuggestion) {
          return res.status(400).json({
            error:
              "Only on_create/task_drawer/today_plan suggestions can be dismissed",
          });
        }
        const inputSurfaceRaw =
          typeof suggestion.input?.surface === "string"
            ? suggestion.input.surface
            : "";
        const inputSurface = inputSurfaceRaw as DecisionAssistSurface;
        if (
          !TODO_BOUND_SURFACES.has(inputSurface) &&
          inputSurface !== TODAY_PLAN_SURFACE
        ) {
          return res.status(400).json({
            error:
              "Only on_create/task_drawer/today_plan suggestions can be dismissed",
          });
        }

        // Schema-constrained behavior: dismissing any card rejects the whole suggestion set.
        const updated = await suggestionStore.updateStatus(
          userId,
          id,
          "rejected",
          {
            source: `${inputSurface}_dismiss`,
            updatedAt: new Date().toISOString(),
          },
        );
        if (!updated) {
          return res.status(404).json({ error: "Suggestion not found" });
        }

        return res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
