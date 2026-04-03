import type { SoulProfile, UserPlanningPreferences } from "../../types";

type PreferencesInput = Omit<
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

export const SOUL_COPY = {
  onboardingBelief: "This app helps you make steady progress without guilt.",
  rescueIntro:
    "When your day blows up, rescue mode helps you replan without shame.",
  taskPromptPrimary: "What needs your attention?",
  taskPromptSecondary: "What would help today feel lighter?",
};

export const SOUL_LIFE_AREAS = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "family", label: "Family / caregiving" },
  { value: "health", label: "Health" },
  { value: "side_projects", label: "Side projects" },
] as const;

export const SOUL_FAILURE_MODES = [
  { value: "overwhelmed", label: "Overwhelmed" },
  { value: "forgetful", label: "Forgetful" },
  { value: "perfectionist", label: "Perfectionist" },
  { value: "overcommitted", label: "Overcommitted" },
  { value: "inconsistent", label: "Inconsistent" },
] as const;

export const SOUL_PLANNING_STYLES = [
  { value: "structure", label: "I like structure" },
  { value: "flexibility", label: "I like flexibility" },
  { value: "both", label: "I need both" },
] as const;

export const SOUL_ENERGY_PATTERNS = [
  { value: "morning", label: "Best in mornings" },
  { value: "afternoon", label: "Best in afternoons" },
  { value: "evening", label: "Best in evenings" },
  { value: "variable", label: "Varies a lot" },
] as const;

export const SOUL_GOOD_DAY_THEMES = [
  { value: "important_work", label: "Finish important work" },
  { value: "life_admin", label: "Stay on top of life admin" },
  { value: "avoid_overload", label: "Avoid overload" },
  { value: "visible_progress", label: "Make visible progress" },
  { value: "protect_rest", label: "Protect time for family / rest" },
] as const;

export const SOUL_TONES = [
  { value: "calm", label: "Calm" },
  { value: "focused", label: "Focused" },
  { value: "encouraging", label: "Encouraging" },
  { value: "direct", label: "Direct" },
] as const;

export const SOUL_DAILY_RITUALS = [
  { value: "morning_plan", label: "Morning plan" },
  { value: "evening_reset", label: "Evening reset" },
  { value: "both", label: "Both" },
  { value: "neither", label: "Neither" },
] as const;

export function normalizeSoulProfile(
  profile: Partial<SoulProfile> | null | undefined,
): SoulProfile {
  const value = profile && typeof profile === "object" ? profile : {};
  const dedupeList = (items: unknown): string[] =>
    Array.isArray(items)
      ? Array.from(
          new Set(
            items.map((item) => String(item || "").trim()).filter(Boolean),
          ),
        )
      : [];

  return {
    ...DEFAULT_SOUL_PROFILE,
    ...value,
    lifeAreas: dedupeList(value.lifeAreas),
    failureModes: dedupeList(value.failureModes),
    goodDayThemes: dedupeList(value.goodDayThemes),
  };
}

export function getExampleSeedTasks(
  profile: Partial<SoulProfile> | null | undefined,
): string[] {
  const soulProfile = normalizeSoulProfile(profile);
  const examples: string[] = [];

  const pushExample = (title: string) => {
    if (!title || examples.includes(title) || examples.length >= 3) return;
    examples.push(title);
  };

  if (soulProfile.lifeAreas.includes("work")) {
    pushExample("Email Sarah about the design review");
  }
  if (soulProfile.lifeAreas.includes("personal")) {
    pushExample("Take the first step on taxes");
  }
  if (soulProfile.lifeAreas.includes("family")) {
    pushExample("Check in about the family schedule");
  }
  if (soulProfile.lifeAreas.includes("health")) {
    pushExample("Rest for 20 minutes");
  }
  if (soulProfile.lifeAreas.includes("side_projects")) {
    pushExample("Open the notes for the next side-project step");
  }

  pushExample("Clear one small piece of life admin");
  pushExample("Write down the next action for something you keep postponing");

  return examples.slice(0, 3);
}

export function getTonePreview(tone: SoulProfile["tone"]): string {
  if (tone === "direct") return "Clear, quiet nudges. No guilt.";
  if (tone === "encouraging") return "Warm support that still stays grounded.";
  if (tone === "focused") return "A steadier, sharper plan with less noise.";
  return "Calm guidance that helps you start without pressure.";
}

export function mergePreferences(
  prefs: PreferencesInput | null | undefined,
): UserPlanningPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...prefs,
    preferredContexts: Array.isArray(prefs?.preferredContexts)
      ? prefs.preferredContexts
      : DEFAULT_USER_PREFERENCES.preferredContexts,
    soulProfile: normalizeSoulProfile(prefs?.soulProfile),
  };
}
