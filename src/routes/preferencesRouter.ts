import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const VALID_LIFE_AREAS = [
  "work",
  "personal",
  "family",
  "health",
  "side_projects",
] as const;
const VALID_FAILURE_MODES = [
  "overwhelmed",
  "forgetful",
  "perfectionist",
  "overcommitted",
  "inconsistent",
] as const;
const VALID_PLANNING_STYLES = ["structure", "flexibility", "both"] as const;
const VALID_ENERGY_PATTERNS = [
  "morning",
  "afternoon",
  "evening",
  "variable",
] as const;
const VALID_GOOD_DAY_THEMES = [
  "important_work",
  "life_admin",
  "avoid_overload",
  "visible_progress",
  "protect_rest",
] as const;
const VALID_TONES = ["calm", "focused", "encouraging", "direct"] as const;
const VALID_DAILY_RITUALS = [
  "morning_plan",
  "evening_reset",
  "both",
  "neither",
] as const;

const soulDefaults = {
  lifeAreas: [] as string[],
  failureModes: [] as string[],
  planningStyle: "both",
  energyPattern: "variable",
  goodDayThemes: [] as string[],
  tone: "calm",
  dailyRitual: "neither",
};

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
    soulProfile: { ...soulDefaults },
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

      const existing = await prisma.userPlanningPreferences.findUnique({
        where: { userId },
      });
      const update = buildUpdate(req.body, existing?.soulProfile ?? null);
      const prefs = await prisma.userPlanningPreferences.upsert({
        where: { userId },
        create: { userId, ...update },
        update,
      });
      res.json(toDto(prefs));
    } catch (error) {
      next(error);
    }
  });

  function buildUpdate(
    body: Record<string, unknown>,
    currentSoulProfile: unknown,
  ) {
    const update: Record<string, unknown> = {};
    if (body.maxDailyTasks !== undefined) {
      update.maxDailyTasks = body.maxDailyTasks;
    }
    if (body.preferredChunkMinutes !== undefined) {
      update.preferredChunkMinutes = body.preferredChunkMinutes;
    }
    if (body.deepWorkPreference !== undefined) {
      update.deepWorkPreference = body.deepWorkPreference;
    }
    if (body.weekendsActive !== undefined) {
      update.weekendsActive = body.weekendsActive;
    }
    if (body.preferredContexts !== undefined) {
      update.preferredContexts = body.preferredContexts;
    }
    if (body.waitingFollowUpDays !== undefined) {
      update.waitingFollowUpDays = body.waitingFollowUpDays;
    }
    if (body.workWindowsJson !== undefined) {
      update.workWindowsJson = body.workWindowsJson;
    }
    if (body.soulProfile !== undefined) {
      update.soulProfile = mergeSoulProfile(
        currentSoulProfile,
        body.soulProfile,
      );
    }
    return update;
  }

  function toStringList<T extends string>(
    value: unknown,
    valid: readonly T[],
    maxItems: number,
  ): T[] {
    if (!Array.isArray(value)) return [];
    return value
      .map(
        (item) =>
          String(item || "")
            .trim()
            .toLowerCase() as T,
      )
      .filter(
        (item, index, items) =>
          !!item && valid.includes(item) && items.indexOf(item) === index,
      )
      .slice(0, maxItems);
  }

  function toEnumValue<T extends string>(
    value: unknown,
    valid: readonly T[],
    fallback: T,
  ): T {
    const normalized = String(value || "")
      .trim()
      .toLowerCase() as T;
    return valid.includes(normalized) ? normalized : fallback;
  }

  function mergeSoulProfile(current: unknown, incoming: unknown) {
    const currentValue =
      current && typeof current === "object"
        ? (current as Record<string, unknown>)
        : {};
    const nextValue =
      incoming && typeof incoming === "object"
        ? (incoming as Record<string, unknown>)
        : {};
    return {
      lifeAreas:
        nextValue.lifeAreas !== undefined
          ? toStringList(nextValue.lifeAreas, VALID_LIFE_AREAS, 6)
          : toStringList(currentValue.lifeAreas, VALID_LIFE_AREAS, 6),
      failureModes:
        nextValue.failureModes !== undefined
          ? toStringList(nextValue.failureModes, VALID_FAILURE_MODES, 6)
          : toStringList(currentValue.failureModes, VALID_FAILURE_MODES, 6),
      planningStyle:
        nextValue.planningStyle !== undefined
          ? toEnumValue(nextValue.planningStyle, VALID_PLANNING_STYLES, "both")
          : toEnumValue(
              currentValue.planningStyle,
              VALID_PLANNING_STYLES,
              soulDefaults.planningStyle,
            ),
      energyPattern:
        nextValue.energyPattern !== undefined
          ? toEnumValue(
              nextValue.energyPattern,
              VALID_ENERGY_PATTERNS,
              "variable",
            )
          : toEnumValue(
              currentValue.energyPattern,
              VALID_ENERGY_PATTERNS,
              soulDefaults.energyPattern,
            ),
      goodDayThemes:
        nextValue.goodDayThemes !== undefined
          ? toStringList(nextValue.goodDayThemes, VALID_GOOD_DAY_THEMES, 6)
          : toStringList(currentValue.goodDayThemes, VALID_GOOD_DAY_THEMES, 6),
      tone:
        nextValue.tone !== undefined
          ? toEnumValue(nextValue.tone, VALID_TONES, "calm")
          : toEnumValue(currentValue.tone, VALID_TONES, soulDefaults.tone),
      dailyRitual:
        nextValue.dailyRitual !== undefined
          ? toEnumValue(nextValue.dailyRitual, VALID_DAILY_RITUALS, "neither")
          : toEnumValue(
              currentValue.dailyRitual,
              VALID_DAILY_RITUALS,
              soulDefaults.dailyRitual,
            ),
    };
  }

  function toDto(p: {
    maxDailyTasks: number | null;
    preferredChunkMinutes: number | null;
    deepWorkPreference: string | null;
    weekendsActive: boolean;
    preferredContexts: string[];
    waitingFollowUpDays: number;
    workWindowsJson: unknown;
    soulProfile: unknown;
  }) {
    return {
      maxDailyTasks: p.maxDailyTasks,
      preferredChunkMinutes: p.preferredChunkMinutes,
      deepWorkPreference: p.deepWorkPreference,
      weekendsActive: p.weekendsActive,
      preferredContexts: p.preferredContexts,
      waitingFollowUpDays: p.waitingFollowUpDays,
      workWindowsJson: p.workWindowsJson,
      soulProfile: {
        ...soulDefaults,
        ...mergeSoulProfile(null, p.soulProfile),
      },
    };
  }

  return router;
}
