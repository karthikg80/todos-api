import { Router, Request, Response, NextFunction } from "express";
import { InsightType, InsightPeriodType } from "@prisma/client";
import { InsightsService } from "../services/insightsService";
import { InsightsComputeService } from "../services/insightsComputeService";

const VALID_INSIGHT_TYPES = new Set<string>([
  "completion_velocity",
  "overcommitment_ratio",
  "stale_task_count",
  "streak_days",
  "most_productive_hour",
  "project_health",
]);

const VALID_PERIOD_TYPES = new Set<string>(["daily", "weekly"]);

interface InsightsRouterDeps {
  insightsService?: InsightsService;
  insightsComputeService?: InsightsComputeService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

export function createInsightsRouter({
  insightsService,
  insightsComputeService,
  resolveUserId,
}: InsightsRouterDeps): Router {
  const router = Router();

  /**
   * GET /insights
   * Returns all current insights for the authenticated user.
   */
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = resolveUserId(req, res);
      if (!userId) return;

      if (!insightsService) {
        return res.status(503).json({ error: "Insights not configured" });
      }

      const periodType = req.query.periodType as string | undefined;
      const insightType = req.query.insightType as string | undefined;

      const opts: {
        periodType?: InsightPeriodType;
        insightType?: InsightType;
      } = {};

      if (periodType && VALID_PERIOD_TYPES.has(periodType)) {
        opts.periodType = periodType as InsightPeriodType;
      }
      if (insightType && VALID_INSIGHT_TYPES.has(insightType)) {
        opts.insightType = insightType as InsightType;
      }

      const insights = await insightsService.getInsights(userId, opts);
      res.json(insights);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /insights/trend/:type
   * Returns trend data for a specific insight type.
   */
  router.get(
    "/trend/:type",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;

        if (!insightsService) {
          return res.status(503).json({ error: "Insights not configured" });
        }

        const type = req.params.type as string;
        if (!VALID_INSIGHT_TYPES.has(type)) {
          return res.status(400).json({ error: "Invalid insight type" });
        }

        const periods = Math.min(
          30,
          Math.max(1, Number(req.query.periods) || 7),
        );

        const trend = await insightsService.getInsightTrend(
          userId,
          type as InsightType,
          periods,
        );
        res.json(trend);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /insights/project-health
   * Returns health scores for all projects.
   */
  router.get(
    "/project-health",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;

        if (!insightsService) {
          return res.status(503).json({ error: "Insights not configured" });
        }

        const health = await insightsService.getProjectHealthScores(userId);
        res.json(health);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /insights/compute
   * Triggers on-demand insights computation for the user.
   */
  router.post(
    "/compute",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;

        if (!insightsComputeService) {
          return res
            .status(503)
            .json({ error: "Insights compute not configured" });
        }

        await insightsComputeService.computeAll(userId);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
