import type { UserAdaptationProfile } from "../types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdaptationFlags {
  /** Master toggle — disables all personalization when false. */
  enabled: boolean;
  /** When false, never auto-expand insights or show insights disclosure. */
  insightsPersonalization: boolean;
  /** When false, never show setup guidance. */
  guidancePersonalization: boolean;
  /** Rollout percentage (0-100). */
  rolloutPercentage: number;
  /** Allowlist for internal testing. If set, only these users are eligible. */
  eligibleUserIds?: string[];
}

// ─── Default Flags ──────────────────────────────────────────────────────────

/**
 * Default flags: disabled, 0% rollout.
 * Override via environment variables or config.
 */
export function getDefaultFlags(): AdaptationFlags {
  return {
    enabled: parseEnvBool("ADAPTATION_ENABLED", false),
    insightsPersonalization: parseEnvBool(
      "ADAPTATION_INSIGHTS_PERSONALIZATION",
      true,
    ),
    guidancePersonalization: parseEnvBool(
      "ADAPTATION_GUIDANCE_PERSONALIZATION",
      true,
    ),
    rolloutPercentage: parseEnvInt("ADAPTATION_ROLLOUT_PERCENTAGE", 0),
    eligibleUserIds: parseEnvAllowlist("ADAPTATION_ELIGIBLE_USER_IDS"),
  };
}

// ─── Eligibility Check ──────────────────────────────────────────────────────

/**
 * Check whether a user is eligible for adaptation based on current flags.
 */
export function isUserEligible(
  userId: string,
  flags: AdaptationFlags,
): boolean {
  if (!flags.enabled) return false;

  // If allowlist is set, only those users are eligible
  if (flags.eligibleUserIds && flags.eligibleUserIds.length > 0) {
    return flags.eligibleUserIds.includes(userId);
  }

  // Otherwise, use rollout percentage
  if (flags.rolloutPercentage <= 0) return false;
  if (flags.rolloutPercentage >= 100) return true;

  // Deterministic hash-based rollout
  const hash = simpleHash(userId) % 100;
  return hash < flags.rolloutPercentage;
}

/**
 * Apply kill switches to a profile, returning a neutralized profile
 * if personalization is disabled.
 */
export function applyKillSwitches(
  profile: UserAdaptationProfile,
  flags: AdaptationFlags,
): UserAdaptationProfile {
  if (!flags.enabled) {
    return {
      ...profile,
      eligibility: "none",
      confidenceReason: `${profile.confidenceReason} [adaptation disabled]`,
    };
  }

  if (!flags.insightsPersonalization) {
    return {
      ...profile,
      insightAffinity: "low",
      confidenceReason: `${profile.confidenceReason} [insights personalization disabled]`,
    };
  }

  if (!flags.guidancePersonalization) {
    return {
      ...profile,
      guidanceNeed: "low",
      confidenceReason: `${profile.confidenceReason} [guidance personalization disabled]`,
    };
  }

  return profile;
}

// ─── Env Parsing Helpers ────────────────────────────────────────────────────

function parseEnvBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === "true" || val === "1" || val === "yes";
}

function parseEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function parseEnvAllowlist(key: string): string[] | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Simple deterministic hash for rollout. */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
