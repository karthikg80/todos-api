import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

export function createPreferencesRouter(prisma: PrismaClient): Router {
  const router = Router();

  const defaults = {
    maxDailyTasks: null,
    preferredChunkMinutes: null,
    deepWorkPreference: null,
    weekendsActive: true,
    preferredContexts: [] as string[],
    waitingFollowUpDays: 7,
    workWindowsJson: null,
  };

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const prefs = await prisma.userPlanningPreferences.findUnique({
        where: { userId },
      });
      res.json(prefs ? toDto(prefs) : { ...defaults });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const prefs = await prisma.userPlanningPreferences.upsert({
        where: { userId },
        create: { userId, ...buildUpdate(req.body) },
        update: buildUpdate(req.body),
      });
      res.json(toDto(prefs));
    } catch (error) {
      next(error);
    }
  });

  function buildUpdate(body: Record<string, unknown>) {
    const update: Record<string, unknown> = {};
    if (body.maxDailyTasks !== undefined)
      update.maxDailyTasks = body.maxDailyTasks;
    if (body.preferredChunkMinutes !== undefined)
      update.preferredChunkMinutes = body.preferredChunkMinutes;
    if (body.deepWorkPreference !== undefined)
      update.deepWorkPreference = body.deepWorkPreference;
    if (body.weekendsActive !== undefined)
      update.weekendsActive = body.weekendsActive;
    if (body.preferredContexts !== undefined)
      update.preferredContexts = body.preferredContexts;
    if (body.waitingFollowUpDays !== undefined)
      update.waitingFollowUpDays = body.waitingFollowUpDays;
    if (body.workWindowsJson !== undefined)
      update.workWindowsJson = body.workWindowsJson;
    return update;
  }

  function toDto(p: {
    maxDailyTasks: number | null;
    preferredChunkMinutes: number | null;
    deepWorkPreference: string | null;
    weekendsActive: boolean;
    preferredContexts: string[];
    waitingFollowUpDays: number;
    workWindowsJson: unknown;
  }) {
    return {
      maxDailyTasks: p.maxDailyTasks,
      preferredChunkMinutes: p.preferredChunkMinutes,
      deepWorkPreference: p.deepWorkPreference,
      weekendsActive: p.weekendsActive,
      preferredContexts: p.preferredContexts,
      waitingFollowUpDays: p.waitingFollowUpDays,
      workWindowsJson: p.workWindowsJson,
    };
  }

  return router;
}
