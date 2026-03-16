import { Request, Response, Router } from "express";
import { AgentEnrollmentService } from "../services/agentEnrollmentService";
import { AuthService } from "../services/authService";
import { authMiddleware } from "../middleware/authMiddleware";

interface AgentEnrollmentRouterDeps {
  enrollmentService: AgentEnrollmentService;
  authService?: AuthService;
}

export function createAgentEnrollmentRouter({
  enrollmentService,
  authService,
}: AgentEnrollmentRouterDeps): Router {
  const router = Router();

  // ── Runner-facing endpoint (no user auth — token IS the credential) ────────
  // Mounted BEFORE the auth middleware so the runner can reach it unauthenticated.
  router.get("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const status = await enrollmentService.getStatus(userId);
    res.json({ ok: true, enrollment: status });
  });

  /** POST /api/agent-enrollment — enroll or re-enroll */
  router.post("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { timezone, dailyEnabled, weeklyEnabled } = req.body ?? {};
    const enrollment = await enrollmentService.enroll(userId, {
      timezone,
      dailyEnabled,
      weeklyEnabled,
    });
    res.status(201).json({ ok: true, enrollment });
  });

  /** PATCH /api/agent-enrollment — update settings without re-enrolling */
  router.patch("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { timezone, dailyEnabled, weeklyEnabled } = req.body ?? {};
    try {
      const enrollment = await enrollmentService.update(userId, {
        timezone,
        dailyEnabled,
        weeklyEnabled,
      });
      res.json({ ok: true, enrollment });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "NOT_ENROLLED") {
        res.status(404).json({ ok: false, error: "Not enrolled. POST first." });
        return;
      }
      throw err;
    }
  });

  /** DELETE /api/agent-enrollment — revoke */
  router.delete("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await enrollmentService.revoke(userId);
    res.json({ ok: true, message: "Automation enrollment revoked." });
  });

  /**
   * POST /api/agent-enrollment/exchange
   *
   * The agent runner calls this at the start of each per-user job.
   * Body: { refreshToken: string }
   * Response: { accessToken: string, expiresIn: number }
   *
   * No user auth required — the refreshToken IS the credential.
   * Rate-limited by the global apiLimiter applied to /api in app.ts.
   */
  router.post("/exchange", async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken || typeof refreshToken !== "string") {
      res.status(400).json({ ok: false, error: "refreshToken is required" });
      return;
    }

    try {
      const result = await enrollmentService.exchangeToken(refreshToken);
      res.json({ ok: true, ...result });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "INVALID_ENROLLMENT_TOKEN") {
        res.status(401).json({ ok: false, error: "Invalid or revoked token" });
        return;
      }
      throw err;
    }
  });

  // Apply user auth for all remaining (user-facing) routes.
  if (authService) {
    router.use(authMiddleware(authService));
  }

  // ── User-facing endpoints ──────────────────────────────────────────────────

  /** GET /api/agent-enrollment — return current enrollment status */
  router.get("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const status = await enrollmentService.getStatus(userId);
    res.json({ ok: true, enrollment: status });
  });

  /** POST /api/agent-enrollment — enroll or re-enroll */
  router.post("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { timezone, dailyEnabled, weeklyEnabled } = req.body ?? {};
    const enrollment = await enrollmentService.enroll(userId, {
      timezone,
      dailyEnabled,
      weeklyEnabled,
    });
    res.status(201).json({ ok: true, enrollment });
  });

  /** PATCH /api/agent-enrollment — update settings without re-enrolling */
  router.patch("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { timezone, dailyEnabled, weeklyEnabled } = req.body ?? {};
    try {
      const enrollment = await enrollmentService.update(userId, {
        timezone,
        dailyEnabled,
        weeklyEnabled,
      });
      res.json({ ok: true, enrollment });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "NOT_ENROLLED") {
        res.status(404).json({ ok: false, error: "Not enrolled. POST first." });
        return;
      }
      throw err;
    }
  });

  /** DELETE /api/agent-enrollment — revoke */
  router.delete("/", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    await enrollmentService.revoke(userId);
    res.json({ ok: true, message: "Automation enrollment revoked." });
  });

  return router;
}
