import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { UserAdaptationService } from "../services/userAdaptationService";
import { AdaptationLlmInferenceService } from "../services/adaptationLlmInference";
import {
  AdaptationFlags,
  getDefaultFlags,
  isUserEligible,
  applyKillSwitches,
} from "../services/adaptationFlags";
import { createLogger } from "../infra/logging/logger";

const log = createLogger("adaptationRouter");

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdaptationRouterDeps {
  adaptationService: UserAdaptationService;
  llmInferenceService?: AdaptationLlmInferenceService;
  prisma?: PrismaClient;
  flags?: AdaptationFlags;
  resolveUserId: (req: Request, res: Response) => string | null;
}

// ─── Router Factory ─────────────────────────────────────────────────────────

export function createAdaptationRouter({
  adaptationService,
  llmInferenceService,
  prisma,
  flags,
  resolveUserId,
}: AdaptationRouterDeps): Router {
  const router = Router();
  const activeFlags = flags ?? getDefaultFlags();

  /**
   * GET /adaptation/profile
   * Returns the current user's adaptation profile.
   * Recomputes lazily if the stored profile is stale (>24h).
   */
  router.get(
    "/profile",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;

        const result = await adaptationService.getOrCreateProfile(userId);

        // Apply kill switches before returning
        const profile = applyKillSwitches(result.profile, activeFlags);

        // Check rollout eligibility
        const flagEligible = isUserEligible(userId, activeFlags);
        if (!flagEligible && activeFlags.enabled) {
          // User is not in rollout — return cold-start profile
          log.info("User not in rollout", { userId });
        }

        res.json(profile);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /adaptation/profile/compute
   * Forces recomputation of the user's adaptation profile.
   * Admin/debug endpoint — not for production client use.
   */
  router.post(
    "/profile/compute",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;

        const result = await adaptationService.computeProfile(userId);
        const profile = applyKillSwitches(result.profile, activeFlags);

        log.info("Forced profile recomputation", {
          userId,
          confidence: profile.confidence,
          eligibility: profile.eligibility,
        });

        res.json(profile);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /adaptation/flags
   * Returns current feature flag / kill switch state.
   */
  router.get(
    "/flags",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.json({
          ...activeFlags,
          // Don't expose the allowlist in production
          eligibleUserIds: activeFlags.eligibleUserIds
            ? `[${activeFlags.eligibleUserIds.length} users]`
            : undefined,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /adaptation/projects/:projectId/soft-inference
   * Returns LLM-based soft inference for a project.
   * Only used when behavioral confidence is low (< 0.4).
   * Never feeds the UserAdaptationProfile directly — advisory only.
   */
  router.get(
    "/projects/:projectId/soft-inference",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;

        const projectId = req.params.projectId;
        if (Array.isArray(projectId)) {
          return res.status(400).json({ error: "Invalid project ID" });
        }

        if (!llmInferenceService || !prisma) {
          return res.status(503).json({
            error: "LLM inference not configured",
            inference: null,
          });
        }

        // Fetch project data for inference
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId },
          select: {
            id: true,
            name: true,
            description: true,
            targetDate: true,
            createdAt: true,
          },
        });

        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }

        // Fetch tasks and headings
        const [todos, headings] = await Promise.all([
          prisma.todo.findMany({
            where: { userId, projectId, archived: false },
            select: { title: true, headingId: true, dueDate: true },
            take: 50,
          }),
          prisma.heading.findMany({
            where: { projectId },
            select: { name: true },
          }),
        ]);

        // Check behavioral confidence — only use LLM when low
        const profileResult =
          await adaptationService.getOrCreateProfile(userId);
        if (profileResult.profile.confidence >= 0.4) {
          // Behavioral data is sufficient — don't use LLM
          return res.json({
            inference: null,
            reason: "behavioral confidence sufficient — LLM inference skipped",
            behavioralConfidence: profileResult.profile.confidence,
          });
        }

        // Run LLM inference
        const inference = await llmInferenceService.inferProjectIntent({
          projectName: project.name,
          projectDescription: project.description,
          taskTitles: todos.map((t) => t.title),
          existingSectionNames: headings.map((h) => h.name),
        });

        log.info("Soft inference result", {
          userId,
          projectId,
          projectName: project.name,
          behavioralConfidence: profileResult.profile.confidence,
          llmConfidence: inference?.confidence ?? 0,
          inferredType: inference?.inferredProjectType,
        });

        res.json({
          inference,
          reason: inference
            ? "llm soft inference"
            : "llm provider not available",
          behavioralConfidence: profileResult.profile.confidence,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
