/**
 * Shared recommendation payload schema used by all AI-facing MCP tools.
 * All AI recommendation endpoints return items conforming to this type.
 */
export const RECOMMENDATION_SCHEMA_VERSION = "1" as const;

export type ProposedAction =
  | "create"
  | "update"
  | "archive"
  | "merge"
  | "review"
  | "discard";

export interface Recommendation {
  id: string;
  kind: string;
  confidence: number; // 0.0 – 1.0
  why: string; // human-readable rationale, NOT raw chain-of-thought
  proposedAction: ProposedAction;
  entityRefs: string[]; // IDs of referenced tasks/projects/captures
  warnings: string[]; // non-fatal issues, e.g. "duplicate detected"
  dryRunPatch: Record<string, unknown> | null; // populated when dryRun: true
  schemaVersion: typeof RECOMMENDATION_SCHEMA_VERSION;
}

export function makeRecommendation(
  partial: Omit<Recommendation, "schemaVersion">,
): Recommendation {
  return { ...partial, schemaVersion: RECOMMENDATION_SCHEMA_VERSION };
}

export function validateRecommendation(r: unknown): r is Recommendation {
  if (!r || typeof r !== "object") return false;
  const rec = r as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    typeof rec.kind === "string" &&
    typeof rec.confidence === "number" &&
    rec.confidence >= 0 &&
    rec.confidence <= 1 &&
    typeof rec.why === "string" &&
    typeof rec.proposedAction === "string" &&
    Array.isArray(rec.entityRefs) &&
    Array.isArray(rec.warnings) &&
    rec.schemaVersion === RECOMMENDATION_SCHEMA_VERSION
  );
}
