// =============================================================================
// soulConfig.js — Shared Soul MVP defaults, option catalogs, copy, and helpers
// =============================================================================

export const SOUL_PROFILE_DEFAULTS = {
  lifeAreas: [],
  failureModes: [],
  planningStyle: "both",
  energyPattern: "variable",
  goodDayThemes: [],
  tone: "calm",
  dailyRitual: "neither",
};

export const SOUL_LIFE_AREAS = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "family", label: "Family / caregiving" },
  { value: "health", label: "Health" },
  { value: "side_projects", label: "Side projects" },
];

export const SOUL_FAILURE_MODES = [
  { value: "overwhelmed", label: "Overwhelmed" },
  { value: "forgetful", label: "Forgetful" },
  { value: "perfectionist", label: "Perfectionist" },
  { value: "overcommitted", label: "Overcommitted" },
  { value: "inconsistent", label: "Inconsistent" },
];

export const SOUL_PLANNING_STYLES = [
  { value: "structure", label: "I like structure" },
  { value: "flexibility", label: "I like flexibility" },
  { value: "both", label: "I need both" },
];

export const SOUL_ENERGY_PATTERNS = [
  { value: "morning", label: "Best in mornings" },
  { value: "afternoon", label: "Best in afternoons" },
  { value: "evening", label: "Best in evenings" },
  { value: "variable", label: "Varies a lot" },
];

export const SOUL_GOOD_DAY_THEMES = [
  { value: "important_work", label: "Finish important work" },
  { value: "life_admin", label: "Stay on top of life admin" },
  { value: "avoid_overload", label: "Avoid overload" },
  { value: "visible_progress", label: "Make visible progress" },
  { value: "protect_rest", label: "Protect time for family / rest" },
];

export const SOUL_TONES = [
  { value: "calm", label: "Calm" },
  { value: "focused", label: "Focused" },
  { value: "encouraging", label: "Encouraging" },
  { value: "direct", label: "Direct" },
];

export const SOUL_DAILY_RITUALS = [
  { value: "morning_plan", label: "Morning plan" },
  { value: "evening_reset", label: "Evening reset" },
  { value: "both", label: "Both" },
  { value: "neither", label: "Neither" },
];

export const TODO_EMOTIONAL_STATES = [
  { value: "", label: "None" },
  { value: "avoiding", label: "Avoiding" },
  { value: "unclear", label: "Unclear" },
  { value: "heavy", label: "Heavy" },
  { value: "exciting", label: "Exciting" },
  { value: "draining", label: "Draining" },
];

export const TODO_EFFORT_OPTIONS = [
  { value: "", label: "None" },
  { value: "1", label: "Tiny" },
  { value: "2", label: "Small" },
  { value: "3", label: "Medium" },
  { value: "4", label: "Deep" },
];

export const SOUL_COPY = {
  onboardingBelief: "This app helps you make steady progress without guilt.",
  rescueIntro:
    "When your day blows up, rescue mode helps you replan without shame.",
  taskPromptPrimary: "What needs your attention?",
  taskPromptSecondary: "What would help today feel lighter?",
  saved: "Saved.",
  updated: "Updated.",
  gotIt: "Got it.",
  rolledOverHeading: "A few things rolled over.",
  rolledOverSubheading: "Let’s make the day smaller before it gets louder.",
  todayHeading: "A few things worth your energy.",
  todayEmptyHeading: "Today is clear.",
  todayEmptySubheading: "Nothing pressing — that's the goal.",
  listEmptyHeading: "All clear here.",
  listEmptySubheading: "Capture what matters next.",
  movedLater: "Moved. You can pick this up later.",
  droppedFromList: "Dropped from the list. You can bring it back if needed.",
  rescueActive: "Rescue mode is on. Keep today intentionally small.",
  rescuePrompt: "Heavy day? Switch to rescue mode and keep only what matters.",
  reviewIntro:
    "Run a gentle weekly review to see what moved, what got stuck, and what to carry forward.",
};

export function normalizeSoulProfile(profile) {
  const value = profile && typeof profile === "object" ? profile : {};
  const dedupeList = (items) =>
    Array.isArray(items)
      ? Array.from(
          new Set(
            items.map((item) => String(item || "").trim()).filter(Boolean),
          ),
        )
      : [];

  return {
    ...SOUL_PROFILE_DEFAULTS,
    ...value,
    lifeAreas: dedupeList(value.lifeAreas),
    failureModes: dedupeList(value.failureModes),
    goodDayThemes: dedupeList(value.goodDayThemes),
  };
}

export function getEffortScoreLabel(score) {
  const numeric = Number.parseInt(String(score ?? ""), 10);
  if (numeric === 1) return "Tiny";
  if (numeric === 2) return "Small";
  if (numeric === 3) return "Medium";
  if (numeric === 4) return "Deep";
  return "";
}

export function getEffortScoreValue(rawValue) {
  const value = Number.parseInt(String(rawValue ?? ""), 10);
  if (value >= 1 && value <= 4) return value;
  return null;
}

export function getExampleSeedTasks(profile = SOUL_PROFILE_DEFAULTS) {
  const soulProfile = normalizeSoulProfile(profile);
  const examples = [];
  const pushExample = (title) => {
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

export function getTonePreview(tone) {
  if (tone === "direct") return "Clear, quiet nudges. No guilt.";
  if (tone === "encouraging") return "Warm support that still stays grounded.";
  if (tone === "focused") return "A steadier, sharper plan with less noise.";
  return "Calm guidance that helps you start without pressure.";
}

export function buildRescueSuggestion({
  rolledOverCount = 0,
  plannedEffortScoreTotal = 0,
  repeatedDeferrals = 0,
} = {}) {
  const reasons = [];
  if (rolledOverCount >= 5) {
    reasons.push(`${rolledOverCount} items are still waiting`);
  }
  if (plannedEffortScoreTotal >= 10) {
    reasons.push("today already looks heavy");
  }
  if (repeatedDeferrals >= 3) {
    reasons.push("a few tasks keep slipping");
  }
  if (reasons.length === 0) return "";
  return `${SOUL_COPY.rescuePrompt} ${reasons.join(", ")}.`;
}
