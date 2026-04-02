import type { TuneUpData, TuneUpSection } from "../types/tuneup";

export interface TopFinding {
  section: TuneUpSection;
  tier: number;
  label: string;
  count: number;
  severity: "danger" | "neutral" | "muted";
}

/**
 * Compute the single most impactful finding across all tune-up data.
 *
 * Priority tiers (lower = more important):
 * 1. Exact duplicates (confidence >= 0.95)
 * 2. Multi-action quality issues
 * 3. Very stale tasks (60+ days)
 * 4. Near duplicates (confidence < 0.95)
 * 5. Moderately stale tasks (30-60 days)
 * 6. Other quality issues
 * 7. Taxonomy suggestions
 *
 * Tiebreaker: higher count wins, then merge > archive > edit > suggest.
 */
export function computeTopFinding(
  data: TuneUpData,
  dismissed: Set<string>,
  patchedTaskIds: Set<string>,
  patchedProjectIds: Set<string>,
): TopFinding | null {
  const candidates: TopFinding[] = [];

  if (data.duplicates) {
    const exact = data.duplicates.groups.filter((g) => {
      const key = dupGroupKey(g.tasks.map((t) => t.id));
      return !dismissed.has(key) && !g.tasks.some((t) => patchedTaskIds.has(t.id)) && g.confidence >= 0.95;
    });
    if (exact.length > 0) {
      candidates.push({
        section: "duplicates",
        tier: 1,
        label: `${exact.length} exact duplicate task${exact.length !== 1 ? " groups" : " group"} found`,
        count: exact.length,
        severity: "danger",
      });
    }

    const near = data.duplicates.groups.filter((g) => {
      const key = dupGroupKey(g.tasks.map((t) => t.id));
      return !dismissed.has(key) && !g.tasks.some((t) => patchedTaskIds.has(t.id)) && g.confidence < 0.95;
    });
    if (near.length > 0) {
      candidates.push({
        section: "duplicates",
        tier: 4,
        label: `${near.length} similar task${near.length !== 1 ? " groups" : " group"} to review`,
        count: near.length,
        severity: "neutral",
      });
    }
  }

  if (data.quality) {
    const multiAction = data.quality.results.filter((r) =>
      !dismissed.has(`quality:${r.id}`) && !patchedTaskIds.has(r.id) && r.issues.includes("multi-action"),
    );
    if (multiAction.length > 0) {
      candidates.push({
        section: "quality",
        tier: 2,
        label: `${multiAction.length} task${multiAction.length !== 1 ? "s" : ""} should be split into subtasks`,
        count: multiAction.length,
        severity: "danger",
      });
    }

    const other = data.quality.results.filter((r) =>
      !dismissed.has(`quality:${r.id}`) && !patchedTaskIds.has(r.id) && !r.issues.includes("multi-action"),
    );
    if (other.length > 0) {
      candidates.push({
        section: "quality",
        tier: 6,
        label: `${other.length} task${other.length !== 1 ? "s" : ""} with title quality issues`,
        count: other.length,
        severity: "neutral",
      });
    }
  }

  if (data.stale) {
    const veryStale = data.stale.staleTasks.filter((t) => {
      if (dismissed.has(`stale:task:${t.id}`) || patchedTaskIds.has(t.id)) return false;
      if (!t.lastUpdated) return true;
      const days = Math.floor((Date.now() - new Date(t.lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
      return days > 60;
    });
    if (veryStale.length > 0) {
      candidates.push({
        section: "stale",
        tier: 3,
        label: `${veryStale.length} task${veryStale.length !== 1 ? "s" : ""} untouched for 60+ days`,
        count: veryStale.length,
        severity: "danger",
      });
    }

    const moderateStale = data.stale.staleTasks.filter((t) => {
      if (dismissed.has(`stale:task:${t.id}`) || patchedTaskIds.has(t.id)) return false;
      if (!t.lastUpdated) return false;
      const days = Math.floor((Date.now() - new Date(t.lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
      return days >= 30 && days <= 60;
    });
    if (moderateStale.length > 0) {
      candidates.push({
        section: "stale",
        tier: 5,
        label: `${moderateStale.length} task${moderateStale.length !== 1 ? "s" : ""} untouched for 30+ days`,
        count: moderateStale.length,
        severity: "neutral",
      });
    }
  }

  if (data.taxonomy) {
    const similar = data.taxonomy.similarProjects.filter((p) => {
      const key = taxSimilarKey(p.projectAId, p.projectBId, p.projectAName, p.projectBName);
      return !dismissed.has(key);
    });
    const small = data.taxonomy.smallProjects.filter((p) =>
      p.id ? !dismissed.has(`tax:low:${p.id}`) && !patchedProjectIds.has(p.id) : true,
    );
    const total = similar.length + small.length;
    if (total > 0) {
      candidates.push({
        section: "taxonomy",
        tier: 7,
        label: `${total} project organization suggestion${total !== 1 ? "s" : ""}`,
        count: total,
        severity: "muted",
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort: lower tier first, then higher count, then actionability (lower tier = more actionable)
  candidates.sort((a, b) => a.tier - b.tier || b.count - a.count);
  return candidates[0];
}

/** Stable key for a duplicate group: sorted task IDs joined by colon. */
export function dupGroupKey(taskIds: string[]): string {
  return "dup:" + [...taskIds].sort().join(":");
}

/** Stable key for a similar-projects pair. */
/** Stable key for a similar-projects pair. Falls back to names when IDs are missing. */
export function taxSimilarKey(aId?: string, bId?: string, aName?: string, bName?: string): string {
  const a = aId ?? aName ?? "?";
  const b = bId ?? bName ?? "?";
  return "tax:similar:" + [a, b].sort().join(":");
}
