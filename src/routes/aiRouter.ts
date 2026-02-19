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
  DecisionAssistSurface,
  validateDecisionAssistOutput,
} from "../aiContracts";
import { validateId } from "../validation";
import { ITodoService } from "../interfaces/ITodoService";
import { config } from "../config";
import { IProjectService } from "../interfaces/IProjectService";
import * as decisionAssistTelemetry from "../decisionAssistTelemetry";
import { evaluateDecisionAssistThrottle } from "../decisionAssistThrottle";
import {
  AiQuotaService,
  buildLimitsByPlan,
  buildInsightsRecommendation,
  UserPlan,
} from "../aiQuotaService";
import {
  TASK_DRAWER_SURFACE,
  ON_CREATE_SURFACE,
  TODAY_PLAN_SURFACE,
  TODO_BOUND_TYPE,
  TODO_BOUND_SURFACES,
  normalizeTodoBoundEnvelope,
  normalizeTodayPlanEnvelope,
  parsePlanTasks,
  buildThrottleAbstainEnvelope,
  parseOptionalTopN,
  findLatestPendingDecisionAssistSuggestion,
  findLatestPendingTodayPlanSuggestion,
  NormalizedTodoBoundEnvelope,
  NormalizedTodoBoundSuggestion,
  NormalizedTodayPlanEnvelope,
  NormalizedTodayPlanSuggestion,
} from "../aiNormalizationService";
import {
  applyTodoBoundSuggestion,
  applyTodayPlanSuggestions,
} from "../aiApplyService";
import { validateDismissable } from "../aiDismissService";

export { UserPlan } from "../aiQuotaService";

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

  const limitsByPlan = buildLimitsByPlan({
    aiDailySuggestionLimit,
    aiDailySuggestionLimitByPlan,
  });

  const quotaService = new AiQuotaService({
    suggestionStore,
    limitsByPlan,
    resolveUserPlan: resolveAiUserPlan,
  });

  // ── Shared HTTP helpers ──

  const enforceDailyQuota = async (userId: string, res: Response) => {
    const exceeded = await quotaService.checkQuota(userId);
    if (exceeded) {
      res.status(429).json({
        error: "Daily AI suggestion limit reached",
        usage: exceeded,
      });
      return false;
    }
    return true;
  };

  const isExplicitDecisionAssistRequest = (req: Request): boolean => {
    const rawHeader = req.header("x-ai-explicit-request");
    if (typeof rawHeader !== "string") {
      return false;
    }
    const normalized = rawHeader.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  };

  const shouldThrottleDecisionAssist = async (
    userId: string,
    surface: DecisionAssistSurface,
  ) => {
    const records = await suggestionStore.listByUser(userId, 120);
    return evaluateDecisionAssistThrottle({
      records,
      surface,
      now: new Date(),
    });
  };

  const ensureDecisionAssistFeatureEnabled = (res: Response): boolean => {
    if (decisionAssistEnabled) {
      return true;
    }
    res.status(403).json({ error: "Decision assist disabled" });
    return false;
  };

  const emitDecisionAssistTelemetrySafe = (
    event: decisionAssistTelemetry.DecisionAssistTelemetryEvent,
  ) => {
    try {
      decisionAssistTelemetry.emitDecisionAssistTelemetry(event);
    } catch (error) {
      console.warn("Decision assist telemetry emit failed:", error);
    }
  };

  // ── Routes ──

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
        const shouldBypassThrottle = isExplicitDecisionAssistRequest(req);
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
        if (!shouldBypassThrottle) {
          const throttle = await shouldThrottleDecisionAssist(
            userId,
            input.surface,
          );
          if (throttle.throttled) {
            const output = validateDecisionAssistOutput(
              buildThrottleAbstainEnvelope(input.surface, input.topN),
            );
            return res.json({
              ...output,
              suggestionId: `throttle-${input.surface}-${Date.now()}`,
            });
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

        emitDecisionAssistTelemetrySafe({
          eventName: "ai_suggestion_generated",
          surface: input.surface,
          aiSuggestionDbId: suggestion.id,
          suggestionId:
            typeof output.requestId === "string" ? output.requestId : undefined,
          todoId: input.todoId,
          suggestionCount: output.suggestions.length,
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
        const feedbackContext = await quotaService.getFeedbackContext(userId);
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
        const feedbackContext = await quotaService.getFeedbackContext(userId);
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

        const usage = await quotaService.getUsage(userId);
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
          quotaService.getUsage(userId),
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
              suggestionStore,
              userId,
              String(todoId || ""),
              surface,
            )
          : await findLatestPendingTodayPlanSuggestion(suggestionStore, userId);
        if (!latest) {
          const throttle = await shouldThrottleDecisionAssist(userId, surface);
          if (throttle.throttled) {
            return res.json({
              aiSuggestionId: "",
              status: "pending",
              outputEnvelope: buildThrottleAbstainEnvelope(
                surface,
                parseOptionalTopN(
                  typeof req.query.topN === "string"
                    ? Number.parseInt(req.query.topN, 10)
                    : undefined,
                ),
              ),
            });
          }
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
          emitDecisionAssistTelemetrySafe({
            eventName: "ai_suggestion_viewed",
            surface,
            aiSuggestionDbId: latest.id,
            suggestionId:
              typeof outputEnvelope.requestId === "string"
                ? outputEnvelope.requestId
                : undefined,
            todoId: isTodoBound ? String(todoId || "") : undefined,
            suggestionCount: outputEnvelope.suggestions.length,
          });
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

        const feedbackContext = await quotaService.getFeedbackContext(userId);
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

        // ── Today-plan apply path ──
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

            const applyResult = await applyTodayPlanSuggestions({
              applicableSuggestions,
              todoService,
              userId,
              confirmed,
            });

            if (!applyResult.ok) {
              return res
                .status(applyResult.status)
                .json({ error: applyResult.error });
            }

            const updatedSuggestion = await suggestionStore.markApplied(
              userId,
              id,
              applyResult.appliedTodoIds,
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

            emitDecisionAssistTelemetrySafe({
              eventName: "ai_suggestion_applied",
              surface: TODAY_PLAN_SURFACE,
              aiSuggestionDbId: id,
              suggestionId:
                typeof envelope.requestId === "string"
                  ? envelope.requestId
                  : undefined,
              suggestionCount: applicableSuggestions.length,
              selectedTodoIdsCount: selectedSet.size,
            });

            return res.json({
              updatedCount: applyResult.updatedTodos.length,
              todos: applyResult.updatedTodos,
              suggestion: updatedSuggestion,
              idempotent: false,
            });
          }

          // ── Legacy plan_from_goal apply (non-today_plan) ──
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

        // ── Todo-bound apply path ──
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

        const applyResult = await applyTodoBoundSuggestion({
          selected,
          todoService,
          projectService,
          userId,
          inputTodoId,
          todo,
          confirmed,
        });

        if (!applyResult.ok) {
          return res
            .status(applyResult.status)
            .json({ error: applyResult.error });
        }

        const todoIdsApplied = [inputTodoId];
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

        emitDecisionAssistTelemetrySafe({
          eventName: "ai_suggestion_applied",
          surface: inputSurface,
          aiSuggestionDbId: id,
          suggestionId: selected.suggestionId,
          todoId: inputTodoId,
          suggestionCount: envelopeSuggestions.length,
          selectedTodoIdsCount: 1,
        });

        return res.json({
          todo: applyResult.updatedTodo,
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

        const dismissValidation = validateDismissable(suggestion);
        if (!dismissValidation.ok) {
          return res
            .status(dismissValidation.status)
            .json({ error: dismissValidation.error });
        }
        const inputSurface = dismissValidation.surface;

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

        emitDecisionAssistTelemetrySafe({
          eventName: "ai_suggestion_dismissed",
          surface: inputSurface,
          aiSuggestionDbId: id,
          suggestionCount: Array.isArray(updated.output?.suggestions)
            ? updated.output.suggestions.length
            : undefined,
          todoId:
            typeof updated.input?.todoId === "string"
              ? updated.input.todoId
              : undefined,
        });

        return res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
