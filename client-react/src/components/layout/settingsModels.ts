import type { SoulProfile, UserPlanningPreferences } from "../../types";

type PlanningPreferencesPatch = Omit<
  Partial<UserPlanningPreferences>,
  "soulProfile"
> & {
  soulProfile?: Partial<SoulProfile> | null;
};

export const DEFAULT_SOUL_PROFILE: SoulProfile = {
  lifeAreas: [],
  failureModes: [],
  planningStyle: "both",
  energyPattern: "variable",
  goodDayThemes: [],
  tone: "calm",
  dailyRitual: "neither",
};

export const DEFAULT_USER_PREFERENCES: UserPlanningPreferences = {
  maxDailyTasks: null,
  preferredChunkMinutes: null,
  deepWorkPreference: null,
  weekendsActive: true,
  preferredContexts: [],
  waitingFollowUpDays: 7,
  workWindowsJson: null,
  soulProfile: DEFAULT_SOUL_PROFILE,
};

export const CHUNK_MINUTE_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
];

export const SOUL_PLANNING_STYLE_OPTIONS = [
  { value: "structure", label: "Prefer structure" },
  { value: "flexibility", label: "Prefer flexibility" },
  { value: "both", label: "Need both" },
] as const;

export const SOUL_ENERGY_PATTERN_OPTIONS = [
  { value: "morning", label: "Best in the morning" },
  { value: "afternoon", label: "Best in the afternoon" },
  { value: "evening", label: "Best in the evening" },
  { value: "variable", label: "Energy varies" },
] as const;

export const SOUL_TONE_OPTIONS = [
  { value: "calm", label: "Calm" },
  { value: "focused", label: "Focused" },
  { value: "encouraging", label: "Encouraging" },
  { value: "direct", label: "Direct" },
] as const;

export const SOUL_DAILY_RITUAL_OPTIONS = [
  { value: "morning_plan", label: "Morning plan" },
  { value: "evening_reset", label: "Evening reset" },
  { value: "both", label: "Both" },
  { value: "neither", label: "Neither" },
] as const;

export function mergePlanningPreferences(
  incoming: PlanningPreferencesPatch | null | undefined,
): UserPlanningPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...incoming,
    preferredContexts: Array.isArray(incoming?.preferredContexts)
      ? incoming.preferredContexts
      : DEFAULT_USER_PREFERENCES.preferredContexts,
    soulProfile: {
      ...DEFAULT_SOUL_PROFILE,
      ...(incoming?.soulProfile ?? {}),
    },
  };
}

export function parsePreferredContexts(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
