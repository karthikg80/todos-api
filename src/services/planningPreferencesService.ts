import { PrismaClient, UserPlanningPreferences } from "@prisma/client";

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

export interface SoulProfileDto {
  lifeAreas: string[];
  failureModes: string[];
  planningStyle: string;
  energyPattern: string;
  goodDayThemes: string[];
  tone: string;
  dailyRitual: string;
}

export interface PlanningPreferencesDto {
  maxDailyTasks: number | null;
  preferredChunkMinutes: number | null;
  deepWorkPreference: string | null;
  weekendsActive: boolean;
  preferredContexts: string[];
  waitingFollowUpDays: number;
  workWindowsJson: unknown;
  soulProfile: SoulProfileDto;
}

const defaults: PlanningPreferencesDto = {
  maxDailyTasks: null,
  preferredChunkMinutes: null,
  deepWorkPreference: null,
  weekendsActive: true,
  preferredContexts: [] as string[],
  waitingFollowUpDays: 7,
  workWindowsJson: null,
  soulProfile: { ...soulDefaults },
};

export class PlanningPreferencesService {
  constructor(private readonly prisma: PrismaClient) {}

  async getForUser(userId: string): Promise<PlanningPreferencesDto> {
    const prefs = await this.prisma.userPlanningPreferences.findUnique({
      where: { userId },
    });

    return prefs ? this.toDto(prefs) : { ...defaults };
  }

  async updateForUser(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<PlanningPreferencesDto> {
    const existing = await this.prisma.userPlanningPreferences.findUnique({
      where: { userId },
    });
    const update = this.buildUpdate(body, existing?.soulProfile ?? null);
    const prefs = await this.prisma.userPlanningPreferences.upsert({
      where: { userId },
      create: { userId, ...update },
      update,
    });

    return this.toDto(prefs);
  }

  private buildUpdate(
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
      update.soulProfile = this.mergeSoulProfile(
        currentSoulProfile,
        body.soulProfile,
      );
    }
    return update;
  }

  private toStringList<T extends string>(
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

  private toEnumValue<T extends string>(
    value: unknown,
    valid: readonly T[],
    fallback: T,
  ): T {
    const normalized = String(value || "")
      .trim()
      .toLowerCase() as T;
    return valid.includes(normalized) ? normalized : fallback;
  }

  private mergeSoulProfile(current: unknown, incoming: unknown) {
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
          ? this.toStringList(nextValue.lifeAreas, VALID_LIFE_AREAS, 6)
          : this.toStringList(currentValue.lifeAreas, VALID_LIFE_AREAS, 6),
      failureModes:
        nextValue.failureModes !== undefined
          ? this.toStringList(nextValue.failureModes, VALID_FAILURE_MODES, 6)
          : this.toStringList(
              currentValue.failureModes,
              VALID_FAILURE_MODES,
              6,
            ),
      planningStyle:
        nextValue.planningStyle !== undefined
          ? this.toEnumValue(
              nextValue.planningStyle,
              VALID_PLANNING_STYLES,
              "both",
            )
          : this.toEnumValue(
              currentValue.planningStyle,
              VALID_PLANNING_STYLES,
              soulDefaults.planningStyle,
            ),
      energyPattern:
        nextValue.energyPattern !== undefined
          ? this.toEnumValue(
              nextValue.energyPattern,
              VALID_ENERGY_PATTERNS,
              "variable",
            )
          : this.toEnumValue(
              currentValue.energyPattern,
              VALID_ENERGY_PATTERNS,
              soulDefaults.energyPattern,
            ),
      goodDayThemes:
        nextValue.goodDayThemes !== undefined
          ? this.toStringList(nextValue.goodDayThemes, VALID_GOOD_DAY_THEMES, 6)
          : this.toStringList(
              currentValue.goodDayThemes,
              VALID_GOOD_DAY_THEMES,
              6,
            ),
      tone:
        nextValue.tone !== undefined
          ? this.toEnumValue(nextValue.tone, VALID_TONES, "calm")
          : this.toEnumValue(currentValue.tone, VALID_TONES, soulDefaults.tone),
      dailyRitual:
        nextValue.dailyRitual !== undefined
          ? this.toEnumValue(
              nextValue.dailyRitual,
              VALID_DAILY_RITUALS,
              "neither",
            )
          : this.toEnumValue(
              currentValue.dailyRitual,
              VALID_DAILY_RITUALS,
              soulDefaults.dailyRitual,
            ),
    };
  }

  private toDto(prefs: UserPlanningPreferences): PlanningPreferencesDto {
    return {
      maxDailyTasks: prefs.maxDailyTasks,
      preferredChunkMinutes: prefs.preferredChunkMinutes,
      deepWorkPreference: prefs.deepWorkPreference,
      weekendsActive: prefs.weekendsActive,
      preferredContexts: prefs.preferredContexts,
      waitingFollowUpDays: prefs.waitingFollowUpDays,
      workWindowsJson: prefs.workWindowsJson,
      soulProfile: {
        ...soulDefaults,
        ...this.mergeSoulProfile(null, prefs.soulProfile),
      },
    };
  }
}
