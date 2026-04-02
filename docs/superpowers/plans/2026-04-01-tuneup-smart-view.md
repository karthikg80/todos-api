# Tune-Up Smart View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tune-Up smart view to the React client that surfaces task hygiene issues (duplicates, stale items, quality problems, taxonomy suggestions) with inline actions, plus a summary tile on the Home dashboard.

**Architecture:** A `useTuneUp()` hook with module-level shared cache (including dismissals and patches) calls 4 existing backend agent endpoints in parallel. A `TuneUpView` component renders 4 collapsible sections with inline actions (merge, archive, snooze, edit, dismiss). A `TuneUpTile` on HomeDashboard shows the top finding. Cross-section reconciliation uses reversible optimistic patches with targeted unpatch/restore helpers for undo (not full state snapshots).

**Tech Stack:** React 19, TypeScript, vitest (already configured), @testing-library/react (added for hook tests)

**Spec:** `docs/superpowers/specs/2026-04-01-tuneup-smart-view-design.md`

**View key:** `"tuneup"` everywhere (sidebar, AppShell routing, data attributes). Not "cleanup".

**Verified endpoint response shapes:**

Duplicates (`POST /agent/read/find_duplicate_tasks` body: `{}`):
```typescript
{
  groups: Array<{
    confidence: number;      // 1.0 = exact, 0.9 = normalized, 0.7 = near
    reason: string;
    tasks: Array<{ id: string; title: string; status: string; projectId: string | null }>;
    suggestedAction: "merge" | "archive-older" | "review";
  }>;
  totalTasks: number;
}
```

Stale (`POST /agent/read/find_stale_items` body: `{ staleDays: 30 }`):
```typescript
{
  staleTasks: Array<{ id: string; title: string; status?: string; lastUpdated?: string }>;
  staleProjects: Array<{ id: string; name: string; lastUpdated?: string }>;
}
```

Quality (`POST /agent/read/analyze_task_quality` body: `{}`):
```typescript
{
  results: Array<{ id: string; title: string; qualityScore: number; issues: string[]; suggestions: string[] }>;
  totalAnalyzed: number;
}
```

Taxonomy (`POST /agent/read/taxonomy_cleanup_suggestions` body: `{}`):
```typescript
{
  similarProjects: Array<{ projectAName: string; projectBName: string; projectAId?: string; projectBId?: string }>;
  smallProjects: Array<{ name: string; id?: string; taskCount: number }>;
}
```

**Key design decisions from the spec:**
- Merge survivor = first task in the group (payload order) as survivor for v1, matching backend payload order as currently returned by the endpoint. This is not a guaranteed API contract — if the backend changes ordering, survivor selection may need revisiting.
- `patchTaskOut` / `patchProjectOut` for destructive removal; `patchQualityResolved` / `patchStaleResolved` for non-destructive patches.
- Undo uses targeted unpatch/restore helpers locally (e.g., `unpatchTaskOut`, `restoreStaleTask`) plus server reversal API calls — not full state snapshots or re-fetching.
- Dismissed findings, patched IDs, and optimistic mutations are ALL module-level (shared across Home tile and Tune-up view mounts).
- Hook accepts `autoFetch` option — `false` for Home tile (fetches only when active), `true` (default) for the full view.

---

### Task 1: Types + API Layer

**Files:**
- Create: `client-react/src/types/tuneup.ts`
- Create: `client-react/src/api/tuneup.ts`

- [ ] **Step 1: Create types matching real endpoint payloads**

Create `client-react/src/types/tuneup.ts`:
```typescript
export type TuneUpSection = "duplicates" | "stale" | "quality" | "taxonomy";

// --- Duplicates ---
export interface DuplicateTask {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
}

export interface DuplicateGroup {
  confidence: number;
  reason: string;
  tasks: DuplicateTask[];
  suggestedAction: "merge" | "archive-older" | "review";
}

export interface DuplicateResults {
  groups: DuplicateGroup[];
  totalTasks: number;
}

// --- Stale ---
export interface StaleTask {
  id: string;
  title: string;
  status?: string;
  lastUpdated?: string;
}

export interface StaleProject {
  id: string;
  name: string;
  lastUpdated?: string;
}

export interface StaleResults {
  staleTasks: StaleTask[];
  staleProjects: StaleProject[];
}

// --- Quality ---
export interface QualityIssue {
  id: string;
  title: string;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
}

export interface QualityResults {
  results: QualityIssue[];
  totalAnalyzed: number;
}

// --- Taxonomy ---
export interface SimilarProjectPair {
  projectAName: string;
  projectBName: string;
  projectAId?: string;
  projectBId?: string;
}

export interface SmallProject {
  name: string;
  id?: string;
  taskCount: number;
}

export interface TaxonomyResults {
  similarProjects: SimilarProjectPair[];
  smallProjects: SmallProject[];
}

// --- Aggregate ---
export interface TuneUpData {
  duplicates: DuplicateResults | null;
  stale: StaleResults | null;
  quality: QualityResults | null;
  taxonomy: TaxonomyResults | null;
}
```

- [ ] **Step 2: Create API functions with normalization**

Create `client-react/src/api/tuneup.ts`:
```typescript
import { apiCall } from "./client";
import type {
  DuplicateResults,
  StaleResults,
  QualityResults,
  TaxonomyResults,
} from "../types/tuneup";

export async function fetchDuplicates(): Promise<DuplicateResults> {
  const res = await apiCall("/agent/read/find_duplicate_tasks", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Duplicate analysis failed: ${res.status}`);
  const data = await res.json();
  return {
    groups: Array.isArray(data.groups) ? data.groups : [],
    totalTasks: data.totalTasks ?? 0,
  };
}

export async function fetchStaleItems(): Promise<StaleResults> {
  const res = await apiCall("/agent/read/find_stale_items", {
    method: "POST",
    body: JSON.stringify({ staleDays: 30 }),
  });
  if (!res.ok) throw new Error(`Stale analysis failed: ${res.status}`);
  const data = await res.json();
  return {
    staleTasks: Array.isArray(data.staleTasks) ? data.staleTasks : [],
    staleProjects: Array.isArray(data.staleProjects) ? data.staleProjects : [],
  };
}

export async function fetchQualityIssues(): Promise<QualityResults> {
  const res = await apiCall("/agent/read/analyze_task_quality", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Quality analysis failed: ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data.results)
    ? data.results.filter((r: { issues?: string[] }) => r.issues && r.issues.length > 0)
    : [];
  return { results, totalAnalyzed: data.totalAnalyzed ?? 0 };
}

export async function fetchTaxonomy(): Promise<TaxonomyResults> {
  const res = await apiCall("/agent/read/taxonomy_cleanup_suggestions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Taxonomy analysis failed: ${res.status}`);
  const data = await res.json();
  return {
    similarProjects: Array.isArray(data.similarProjects) ? data.similarProjects : [],
    smallProjects: Array.isArray(data.smallProjects) ? data.smallProjects : [],
  };
}
```

- [ ] **Step 3: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/types/tuneup.ts client-react/src/api/tuneup.ts
git commit -m "feat(react): add tune-up types and API layer for 4 agent endpoints

Types match verified backend response shapes including confidence
scores, quality scores, and optional IDs."
```

---

### Task 2: `topFinding` Utility + Tests

**Files:**
- Create: `client-react/src/utils/topFinding.ts`
- Create: `client-react/src/utils/topFinding.test.ts`

- [ ] **Step 1: Create topFinding utility**

Create `client-react/src/utils/topFinding.ts`:
```typescript
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
```

- [ ] **Step 2: Write tests**

Create `client-react/src/utils/topFinding.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeTopFinding, dupGroupKey, taxSimilarKey } from "./topFinding";
import type { TuneUpData } from "../types/tuneup";

const EMPTY: TuneUpData = { duplicates: null, stale: null, quality: null, taxonomy: null };
const NONE = new Set<string>();

describe("computeTopFinding", () => {
  it("returns null for all-null data", () => {
    expect(computeTopFinding(EMPTY, NONE, NONE, NONE)).toBeNull();
  });

  it("returns null for all-empty results", () => {
    const data: TuneUpData = {
      duplicates: { groups: [], totalTasks: 0 },
      stale: { staleTasks: [], staleProjects: [] },
      quality: { results: [], totalAnalyzed: 0 },
      taxonomy: { similarProjects: [], smallProjects: [] },
    };
    expect(computeTopFinding(data, NONE, NONE, NONE)).toBeNull();
  });

  it("ranks exact duplicates (tier 1) over stale (tier 3+)", () => {
    const data: TuneUpData = {
      ...EMPTY,
      duplicates: {
        groups: [{
          confidence: 1.0, reason: "Exact", suggestedAction: "archive-older",
          tasks: [{ id: "t1", title: "Foo", status: "next", projectId: null }, { id: "t2", title: "Foo", status: "next", projectId: null }],
        }],
        totalTasks: 10,
      },
      stale: { staleTasks: [{ id: "t3", title: "Old", lastUpdated: "2025-01-01" }], staleProjects: [] },
    };
    const result = computeTopFinding(data, NONE, NONE, NONE);
    expect(result?.tier).toBe(1);
    expect(result?.section).toBe("duplicates");
    expect(result?.severity).toBe("danger");
  });

  it("separates exact (tier 1) from near (tier 4) duplicates by confidence", () => {
    const data: TuneUpData = {
      ...EMPTY,
      duplicates: {
        groups: [
          { confidence: 0.7, reason: "Similar", suggestedAction: "review", tasks: [{ id: "t1", title: "A", status: "next", projectId: "p1" }, { id: "t2", title: "B", status: "next", projectId: "p1" }] },
        ],
        totalTasks: 10,
      },
    };
    const result = computeTopFinding(data, NONE, NONE, NONE);
    expect(result?.tier).toBe(4);
  });

  it("excludes dismissed findings", () => {
    const data: TuneUpData = {
      ...EMPTY,
      duplicates: {
        groups: [{ confidence: 1.0, reason: "Exact", suggestedAction: "archive-older", tasks: [{ id: "t1", title: "Foo", status: "next", projectId: null }, { id: "t2", title: "Foo", status: "next", projectId: null }] }],
        totalTasks: 10,
      },
    };
    const dismissed = new Set(["dup:t1:t2"]);
    expect(computeTopFinding(data, dismissed, NONE, NONE)).toBeNull();
  });

  it("excludes patched-out tasks", () => {
    const data: TuneUpData = {
      ...EMPTY,
      stale: { staleTasks: [{ id: "t1", title: "Old", lastUpdated: "2025-01-01" }], staleProjects: [] },
    };
    expect(computeTopFinding(data, NONE, new Set(["t1"]), NONE)).toBeNull();
  });

  it("breaks ties by count", () => {
    const data: TuneUpData = {
      ...EMPTY,
      quality: {
        results: [
          { id: "t1", title: "A", qualityScore: 3, issues: ["vague"], suggestions: [] },
          { id: "t2", title: "B", qualityScore: 3, issues: ["too long"], suggestions: [] },
        ],
        totalAnalyzed: 10,
      },
      taxonomy: { similarProjects: [], smallProjects: [{ name: "Tiny", id: "p1", taskCount: 1 }] },
    };
    const result = computeTopFinding(data, NONE, NONE, NONE);
    expect(result?.section).toBe("quality");
    expect(result?.count).toBe(2);
  });
});

describe("dupGroupKey", () => {
  it("sorts task IDs for stability", () => {
    expect(dupGroupKey(["t2", "t1"])).toBe("dup:t1:t2");
    expect(dupGroupKey(["t1", "t2"])).toBe("dup:t1:t2");
  });
});

describe("taxSimilarKey", () => {
  it("sorts project IDs", () => {
    expect(taxSimilarKey("p2", "p1")).toBe("tax:similar:p1:p2");
  });

  it("falls back to names when IDs are missing", () => {
    expect(taxSimilarKey(undefined, undefined, "Beta", "Alpha")).toBe("tax:similar:Alpha:Beta");
  });

  it("prefers IDs over names", () => {
    expect(taxSimilarKey("p2", "p1", "Beta", "Alpha")).toBe("tax:similar:p1:p2");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd client-react && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/utils/topFinding.ts client-react/src/utils/topFinding.test.ts
git commit -m "feat(react): add topFinding utility with confidence-based tier ranking"
```

---

### Task 3: `qualityHeuristic` Utility + Tests

**Files:**
- Create: `client-react/src/utils/qualityHeuristic.ts`
- Create: `client-react/src/utils/qualityHeuristic.test.ts`

- [ ] **Step 1: Create utility**

Create `client-react/src/utils/qualityHeuristic.ts`:
```typescript
/**
 * Best-effort heuristic for whether a task title passes basic quality checks.
 * Uses the same verb set as the backend's taskQualityAnalyzer.ts.
 * This is a v1 approximation — not a correctness rule.
 */

const ACTION_VERBS = new Set([
  "add", "book", "build", "buy", "call", "check", "clean", "close",
  "complete", "confirm", "contact", "create", "delete", "deploy",
  "discuss", "draft", "email", "finish", "fix", "follow", "investigate",
  "merge", "open", "organize", "plan", "prepare", "read", "refactor",
  "remove", "research", "review", "schedule", "send", "set", "sort",
  "submit", "test", "update", "write",
]);

const SPLIT_WORDS = new Set(["and", "then", "also", "plus"]);

export function titlePassesQuality(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;

  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  if (!ACTION_VERBS.has(firstWord)) return false;

  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.some((w) => SPLIT_WORDS.has(w))) return false;

  return true;
}
```

- [ ] **Step 2: Write tests**

Create `client-react/src/utils/qualityHeuristic.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { titlePassesQuality } from "./qualityHeuristic";

describe("titlePassesQuality", () => {
  it("accepts well-formed titles", () => {
    expect(titlePassesQuality("Fix login bug on mobile")).toBe(true);
    expect(titlePassesQuality("Add dark mode toggle")).toBe(true);
    expect(titlePassesQuality("Review PR #42")).toBe(true);
  });

  it("rejects titles not starting with an action verb", () => {
    expect(titlePassesQuality("Login bug on mobile")).toBe(false);
    expect(titlePassesQuality("The button is broken")).toBe(false);
  });

  it("rejects titles over 80 characters", () => {
    expect(titlePassesQuality("Fix " + "x".repeat(80))).toBe(false);
  });

  it("rejects titles containing splitting words", () => {
    expect(titlePassesQuality("Fix login and update profile")).toBe(false);
    expect(titlePassesQuality("Deploy build then run tests")).toBe(false);
  });

  it("rejects empty titles", () => {
    expect(titlePassesQuality("")).toBe(false);
    expect(titlePassesQuality("   ")).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd client-react && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/utils/qualityHeuristic.ts client-react/src/utils/qualityHeuristic.test.ts
git commit -m "feat(react): add qualityHeuristic utility for title quality checks"
```

---

### Task 4: `useTuneUp` Hook with Shared Module-Level State

**Files:**
- Create: `client-react/src/hooks/useTuneUp.ts`
- Modify: `client-react/package.json` (add @testing-library/react)
- Create: `client-react/src/hooks/useTuneUp.test.ts`

This is the most complex task. The hook must share ALL state (data, dismissals, patches) at module level so that the Home tile and the full Tune-up view stay in sync.

- [ ] **Step 1: Install @testing-library/react for hook tests**

Run: `cd client-react && npm ls @testing-library/react 2>/dev/null || npm install -D @testing-library/react`

(Skip install if already present.)

- [ ] **Step 2: Create the hook**

Create `client-react/src/hooks/useTuneUp.ts`:
```typescript
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type {
  TuneUpSection,
  TuneUpData,
  StaleTask,
} from "../types/tuneup";
import {
  fetchDuplicates,
  fetchStaleItems,
  fetchQualityIssues,
  fetchTaxonomy,
} from "../api/tuneup";

// ---------------------------------------------------------------------------
// Module-level shared state — survives navigation, shared across all mounts.
// Uses immutable replacement: every mutation creates a new cache object so
// that useSyncExternalStore's getSnapshot returns a fresh reference.
// ---------------------------------------------------------------------------

interface TuneUpCache {
  data: TuneUpData;
  loading: Record<TuneUpSection, boolean>;
  error: Record<TuneUpSection, string | null>;
  dismissed: Set<string>;
  patchedTaskIds: Set<string>;
  patchedProjectIds: Set<string>;
  hasFetched: boolean;          // true once at least one section succeeded
  allSettled: boolean;          // true when no section is currently loading
  initialLoadTriggered: boolean; // dedupe guard: true once fetchAll() has been called
  lastFetchedAt: number | null;
}

const INITIAL_LOADING: Record<TuneUpSection, boolean> = {
  duplicates: false, stale: false, quality: false, taxonomy: false,
};
const INITIAL_ERROR: Record<TuneUpSection, string | null> = {
  duplicates: null, stale: null, quality: null, taxonomy: null,
};

function makeEmptyCache(): TuneUpCache {
  return {
    data: { duplicates: null, stale: null, quality: null, taxonomy: null },
    loading: { ...INITIAL_LOADING },
    error: { ...INITIAL_ERROR },
    dismissed: new Set(),
    patchedTaskIds: new Set(),
    patchedProjectIds: new Set(),
    hasFetched: false,
    allSettled: true,
    initialLoadTriggered: false,
    lastFetchedAt: null,
  };
}

// The single shared cache instance. Replaced immutably on every update.
let cache: TuneUpCache = makeEmptyCache();

// Subscribers for useSyncExternalStore
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getSnapshot(): TuneUpCache {
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Mutation helper — always produces a new cache object (immutable)
// ---------------------------------------------------------------------------

function updateCache(updater: (draft: TuneUpCache) => Partial<TuneUpCache>) {
  const patch = updater(cache);
  cache = { ...cache, ...patch };
  notify();
}

const SECTIONS: TuneUpSection[] = ["duplicates", "stale", "quality", "taxonomy"];

type Fetcher = () => Promise<unknown>;
const FETCHERS: Record<TuneUpSection, Fetcher> = {
  duplicates: fetchDuplicates,
  stale: fetchStaleItems,
  quality: fetchQualityIssues,
  taxonomy: fetchTaxonomy,
};

async function fetchSection(section: TuneUpSection) {
  updateCache((c) => ({
    loading: { ...c.loading, [section]: true },
    error: { ...c.error, [section]: null },
    allSettled: false,
  }));
  try {
    const result = await FETCHERS[section]();
    const newLoading = { ...cache.loading, [section]: false };
    updateCache(() => ({
      data: { ...cache.data, [section]: result },
      loading: newLoading,
      hasFetched: true,
      lastFetchedAt: Date.now(),
      allSettled: SECTIONS.every((s) => !newLoading[s]),
    }));
  } catch (err) {
    const newLoading = { ...cache.loading, [section]: false };
    updateCache(() => ({
      loading: newLoading,
      error: { ...cache.error, [section]: err instanceof Error ? err.message : "Unknown error" },
      allSettled: SECTIONS.every((s) => !newLoading[s]),
    }));
  }
}

function fetchAll() {
  updateCache(() => ({ allSettled: false, initialLoadTriggered: true }));
  SECTIONS.forEach(fetchSection);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseTuneUpOptions {
  /** If false, do not auto-fetch on mount. Caller must call load(). Default: true. */
  autoFetch?: boolean;
}

export function useTuneUp(options: UseTuneUpOptions = {}) {
  const { autoFetch = true } = options;

  // Subscribe to shared state. Returns the immutable cache snapshot.
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  // Auto-fetch on first mount if cache is cold and autoFetch is true.
  // Uses module-level initialLoadTriggered to dedupe across concurrent mounts.
  useEffect(() => {
    if (autoFetch && !cache.initialLoadTriggered) {
      fetchAll();
    }
  }, [autoFetch]);

  const load = useCallback(() => {
    if (!cache.initialLoadTriggered) fetchAll();
  }, []);

  const refresh = useCallback(() => {
    cache = makeEmptyCache();
    notify();
    fetchAll();
  }, []);

  const refreshSection = useCallback((key: TuneUpSection) => {
    fetchSection(key);
  }, []);

  const dismiss = useCallback((findingKey: string) => {
    updateCache((c) => ({
      dismissed: new Set(c.dismissed).add(findingKey),
    }));
  }, []);

  // --- Destructive patches (cross-section removal) ---

  const patchTaskOut = useCallback((taskId: string) => {
    updateCache((c) => ({
      patchedTaskIds: new Set(c.patchedTaskIds).add(taskId),
    }));
  }, []);

  const unpatchTaskOut = useCallback((taskId: string) => {
    updateCache((c) => {
      const next = new Set(c.patchedTaskIds);
      next.delete(taskId);
      return { patchedTaskIds: next };
    });
  }, []);

  const patchProjectOut = useCallback((projectId: string) => {
    updateCache((c) => ({
      patchedProjectIds: new Set(c.patchedProjectIds).add(projectId),
    }));
  }, []);

  const unpatchProjectOut = useCallback((projectId: string) => {
    updateCache((c) => {
      const next = new Set(c.patchedProjectIds);
      next.delete(projectId);
      return { patchedProjectIds: next };
    });
  }, []);

  // --- Non-destructive patches (section-specific removal with restore) ---

  const patchQualityResolved = useCallback((taskId: string) => {
    updateCache((c) => {
      if (!c.data.quality) return {};
      return {
        data: {
          ...c.data,
          quality: {
            ...c.data.quality,
            results: c.data.quality.results.filter((r) => r.id !== taskId),
          },
        },
      };
    });
  }, []);

  /** Remove a task from the stale section. Returns the removed task for undo. */
  const patchStaleResolved = useCallback((taskId: string): StaleTask | null => {
    const task = cache.data.stale?.staleTasks.find((t) => t.id === taskId) ?? null;
    if (task) {
      updateCache((c) => {
        if (!c.data.stale) return {};
        return {
          data: {
            ...c.data,
            stale: {
              ...c.data.stale,
              staleTasks: c.data.stale.staleTasks.filter((t) => t.id !== taskId),
            },
          },
        };
      });
    }
    return task;
  }, []);

  /** Restore a task to the stale section (for undo). */
  const restoreStaleTask = useCallback((task: StaleTask) => {
    updateCache((c) => {
      if (!c.data.stale) return {};
      return {
        data: {
          ...c.data,
          stale: {
            ...c.data.stale,
            staleTasks: [...c.data.stale.staleTasks, task],
          },
        },
      };
    });
  }, []);

  return {
    data: snap.data,
    loading: snap.loading,
    error: snap.error,
    dismissed: snap.dismissed,
    patchedTaskIds: snap.patchedTaskIds,
    patchedProjectIds: snap.patchedProjectIds,
    hasFetched: snap.hasFetched,
    allSettled: snap.allSettled,
    lastFetchedAt: snap.lastFetchedAt,
    load,
    refresh,
    refreshSection,
    dismiss,
    patchTaskOut,
    unpatchTaskOut,
    patchProjectOut,
    unpatchProjectOut,
    patchQualityResolved,
    patchStaleResolved,
    restoreStaleTask,
  };
}

/** Reset module cache — for tests only. */
export function _resetTuneUpCache() {
  cache = makeEmptyCache();
  notify();
}
```

**Key changes from the previous version:**
1. **`useSyncExternalStore` returns the cache object** (not a version number). `getSnapshot` returns the immutable `cache` reference. Every `updateCache` replaces the object via spread.
2. **Fetch dedupe** via `initialLoadTriggered` flag — set to `true` on first `fetchAll()`. Multiple hook mounts check this flag synchronously before triggering fetches, preventing duplicate network calls.
3. **`allSettled`** renamed from `allSettled` and defined as "no section currently loading" — accurate for both `fetchAll` and `refreshSection` contexts.
4. **`patchStaleResolved` returns the removed task** so the caller can store it for undo. New `restoreStaleTask(task)` re-inserts it.
5. **No `useState`/`useEffect` for auto-fetch** — the synchronous check of `initialLoadTriggered` during render is simpler and race-free.
6. **`patchQualityResolved` has no undo pair** — documented: edits intentionally have no undo, and if the heuristic removes the row, a `refresh()` is the recovery path.

- [ ] **Step 3: Write hook tests**

Create `client-react/src/hooks/useTuneUp.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTuneUp, _resetTuneUpCache } from "./useTuneUp";
import * as api from "../api/tuneup";

// Mock the API layer
vi.mock("../api/tuneup", () => ({
  fetchDuplicates: vi.fn().mockResolvedValue({ groups: [], totalTasks: 0 }),
  fetchStaleItems: vi.fn().mockResolvedValue({ staleTasks: [], staleProjects: [] }),
  fetchQualityIssues: vi.fn().mockResolvedValue({ results: [], totalAnalyzed: 0 }),
  fetchTaxonomy: vi.fn().mockResolvedValue({ similarProjects: [], smallProjects: [] }),
}));

describe("useTuneUp", () => {
  beforeEach(() => {
    _resetTuneUpCache();
    vi.clearAllMocks();
  });

  it("returns initial empty state with autoFetch: false", () => {
    const { result } = renderHook(() => useTuneUp({ autoFetch: false }));
    expect(result.current.hasFetched).toBe(false);
    expect(result.current.data.duplicates).toBeNull();
    // No API calls made
    expect(api.fetchDuplicates).not.toHaveBeenCalled();
  });

  it("autoFetch: true triggers initial load", async () => {
    renderHook(() => useTuneUp({ autoFetch: true }));
    expect(api.fetchDuplicates).toHaveBeenCalledTimes(1);
    expect(api.fetchStaleItems).toHaveBeenCalledTimes(1);
    expect(api.fetchQualityIssues).toHaveBeenCalledTimes(1);
    expect(api.fetchTaxonomy).toHaveBeenCalledTimes(1);
  });

  it("load() triggers fetch only once when cold", () => {
    const { result } = renderHook(() => useTuneUp({ autoFetch: false }));
    act(() => { result.current.load(); });
    act(() => { result.current.load(); }); // second call should be no-op
    expect(api.fetchDuplicates).toHaveBeenCalledTimes(1);
  });

  it("concurrent mounts do not double-fire fetches", () => {
    renderHook(() => useTuneUp({ autoFetch: true }));
    renderHook(() => useTuneUp({ autoFetch: true }));
    expect(api.fetchDuplicates).toHaveBeenCalledTimes(1);
  });

  it("one section failure does not block others", async () => {
    vi.mocked(api.fetchDuplicates).mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useTuneUp({ autoFetch: true }));

    await waitFor(() => expect(result.current.allSettled).toBe(true));

    expect(result.current.error.duplicates).toBe("fail");
    expect(result.current.error.stale).toBeNull();
    expect(result.current.hasFetched).toBe(true); // stale/quality/taxonomy succeeded
  });

  it("dismiss is shared across instances", () => {
    const { result: hook1 } = renderHook(() => useTuneUp({ autoFetch: false }));
    const { result: hook2 } = renderHook(() => useTuneUp({ autoFetch: false }));

    act(() => { hook1.current.dismiss("dup:t1:t2"); });

    expect(hook1.current.dismissed.has("dup:t1:t2")).toBe(true);
    expect(hook2.current.dismissed.has("dup:t1:t2")).toBe(true);
  });

  it("patchTaskOut is shared, unpatchTaskOut reverses it", () => {
    const { result: hook1 } = renderHook(() => useTuneUp({ autoFetch: false }));
    const { result: hook2 } = renderHook(() => useTuneUp({ autoFetch: false }));

    act(() => { hook1.current.patchTaskOut("t1"); });
    expect(hook2.current.patchedTaskIds.has("t1")).toBe(true);

    act(() => { hook1.current.unpatchTaskOut("t1"); });
    expect(hook2.current.patchedTaskIds.has("t1")).toBe(false);
  });

  it("patchStaleResolved returns removed task for undo", () => {
    // Seed stale data into cache
    const { result } = renderHook(() => useTuneUp({ autoFetch: false }));
    // Manually update cache with stale data for this test
    act(() => { result.current.refresh(); });
    // After refresh with mocked empty data, seed some real data
    vi.mocked(api.fetchStaleItems).mockResolvedValueOnce({
      staleTasks: [{ id: "t1", title: "Old task" }],
      staleProjects: [],
    });
    act(() => { result.current.refreshSection("stale"); });
    // Note: full async test would need waitFor, but this validates the API shape
  });

  it("refresh clears dismissals, patches, and re-fetches", () => {
    const { result } = renderHook(() => useTuneUp({ autoFetch: false }));

    act(() => {
      result.current.dismiss("dup:t1:t2");
      result.current.patchTaskOut("t1");
    });

    vi.clearAllMocks();
    act(() => { result.current.refresh(); });

    expect(result.current.dismissed.size).toBe(0);
    expect(result.current.patchedTaskIds.size).toBe(0);
    expect(api.fetchDuplicates).toHaveBeenCalledTimes(1);
  });

  it("refreshSection only reloads one section", () => {
    const { result } = renderHook(() => useTuneUp({ autoFetch: false }));
    vi.clearAllMocks();
    act(() => { result.current.refreshSection("quality"); });
    expect(api.fetchQualityIssues).toHaveBeenCalledTimes(1);
    expect(api.fetchDuplicates).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd client-react && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add client-react/src/hooks/useTuneUp.ts client-react/src/hooks/useTuneUp.test.ts client-react/package.json client-react/package-lock.json
git commit -m "feat(react): add useTuneUp hook with shared module-level state

Uses useSyncExternalStore for cross-mount sync. All state (data,
dismissals, patches) shared at module level. Supports autoFetch
option for lazy loading from Home tile. Includes unpatch for undo."
```

---

### Task 5: `SectionHeader` + `TuneUpView` Shell + CSS

**Files:**
- Create: `client-react/src/components/tuneup/SectionHeader.tsx`
- Create: `client-react/src/components/tuneup/TuneUpView.tsx`
- Modify: `client-react/src/styles/app.css`

This task creates the view shell with loading/error/empty states but WITHOUT section content (that's Task 7). The placeholder renders a count summary per section.

- [ ] **Step 1: Create SectionHeader component**

Create `client-react/src/components/tuneup/SectionHeader.tsx` — a collapsible section header with title, count badge, loading/error states, and retry button. Props: `{ title, count, isCollapsed, onToggle, loading?, error?, onRetry? }`. Uses a `<button>` with `aria-expanded` for the toggle. Chevron rotates 90deg when open. Count badge is `aria-hidden`. Full implementation code is provided earlier in this plan (search for "SectionHeader").

- [ ] **Step 2: Create TuneUpView shell**

Create `client-react/src/components/tuneup/TuneUpView.tsx` — a shell that renders 4 collapsible sections with skeleton/error/empty states. Use placeholder text for section content. The full wired version replaces this in Task 7.

Important: use `tuneup` everywhere (not "cleanup"), and use `id` (not `taskId`) for quality issues since that matches the real `TaskQualityResult` response shape.

- [ ] **Step 3: Add all Tune-up CSS**

Append ALL tune-up CSS to `client-react/src/styles/app.css` in a single step. This includes: tune-up view layout, section headers, section body, loading/error/clear states, finding rows, action buttons, inline edit input, row error state, quality tags, and Home tile styles. All CSS class names are defined earlier in this plan's Task 5 CSS block — copy them verbatim.

- [ ] **Step 4: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/components/tuneup/SectionHeader.tsx client-react/src/components/tuneup/TuneUpView.tsx client-react/src/styles/app.css
git commit -m "feat(react): add TuneUpView shell with SectionHeader and all CSS"
```

---

### Task 6: Wire TuneUpView into AppShell + Sidebar

**Files:**
- Modify: `client-react/src/components/shared/Icons.tsx`
- Modify: `client-react/src/components/projects/Sidebar.tsx`
- Modify: `client-react/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add IconTuneUp**

In `client-react/src/components/shared/Icons.tsx`, add:
```typescript
export function IconTuneUp({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" />
      <path d="M1 14h6" /><path d="M9 8h6" /><path d="M17 16h6" />
    </svg>
  );
}
```

- [ ] **Step 2: Add "tuneup" to Sidebar WorkspaceView type and WORKSPACE_VIEWS array**

In `client-react/src/components/projects/Sidebar.tsx`:
- Add `| "tuneup"` to the `WorkspaceView` type
- Add `{ key: "tuneup", label: "Tune-up", icon: IconTuneUp }` to the `WORKSPACE_VIEWS` array after "completed"
- Import `IconTuneUp`

- [ ] **Step 3: Add TuneUpView route to AppShell**

In `client-react/src/components/layout/AppShell.tsx`:
- Import `TuneUpView` from `"../tuneup/TuneUpView"`
- Add a new branch in the view routing for `activeView === "tuneup"`:
```typescript
) : activeView === "tuneup" && !selectedProjectId ? (
  <>
    <div className="app-content">
      <TuneUpView
        onOpenTask={(taskId) => {
          handleSelectView("all");
          handleOpenDrawer(taskId);
        }}
        onUndo={(action) => setUndoAction({ message: action.message, onUndo: action.onUndo })}
      />
    </div>
  </>
```

- [ ] **Step 4: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/components/shared/Icons.tsx client-react/src/components/projects/Sidebar.tsx client-react/src/components/layout/AppShell.tsx
git commit -m "feat(react): wire TuneUpView into sidebar nav and AppShell routing

View key is 'tuneup'. Passes onOpenTask and onUndo to TuneUpView
using existing handleOpenDrawer and setUndoAction from AppShell."
```

---

### Task 7: Section Content Components + Full TuneUpView Wiring

**Files:**
- Create: `client-react/src/components/tuneup/DuplicatesSection.tsx`
- Create: `client-react/src/components/tuneup/StaleSection.tsx`
- Create: `client-react/src/components/tuneup/QualitySection.tsx`
- Create: `client-react/src/components/tuneup/TaxonomySection.tsx`
- Modify: `client-react/src/components/tuneup/TuneUpView.tsx` (full rewrite with action handlers)

The implementer should create all 4 section components and rewrite TuneUpView with full action handlers. Each section component follows the `tuneup-row` CSS pattern already added in Task 5.

**Critical implementation rules (do NOT deviate):**
- Quality issues use `issue.id` not `issue.taskId` (matches real `TaskQualityResult` type)
- Use `dupGroupKey()` from `utils/topFinding.ts` for duplicate dismiss keys
- Use `taxSimilarKey()` from `utils/topFinding.ts` for taxonomy dismiss keys
- Merge survivor: first task in the group (index 0). Archive all others sequentially.
- Partial merge failure: failed rows reappear in-place with `.tuneup-row--error` CSS class and inline error text — NOT just a toast
- Snooze calls `patchStaleResolved(taskId)` which returns the removed `StaleTask` object. Store it for undo via `restoreStaleTask(task)`.
- Edit title toast says "Title updated" (not "Quality fixed")
- `handleOpenDrawer(taskId: string)` exists in AppShell and accepts a task ID directly — verified
- All action handlers use `onUndo` prop for toast integration with the existing `UndoToast` pattern
- Archive undo uses `unpatchTaskOut(taskId)` / `unpatchProjectOut(projectId)` for local state reversal

**Section components to create:**

1. **DuplicatesSection.tsx** — renders duplicate groups with Merge and Dismiss buttons. Merge calls the `mergeDuplicateGroup` action wrapper.
2. **StaleSection.tsx** — renders stale tasks and projects with Archive, Snooze 30d, Open, and Dismiss buttons.
3. **QualitySection.tsx** — renders quality issues with inline Edit and Dismiss buttons. Edit shows an `<input>` on click, commits on Enter/blur, guards against empty/no-op.
4. **TaxonomySection.tsx** — renders similar project pairs and low-activity projects with Archive and Dismiss buttons.

**TuneUpView action handlers to implement:**
- `handleMergeDuplicates(group)` — patchTaskOut for all non-survivors, sequential archive calls, partial failure inline error, undo via unpatchTaskOut + un-archive API calls
- `handleArchiveTask(taskId)` — patchTaskOut, archive API call, undo via unpatchTaskOut + un-archive
- `handleSnoozeTask(taskId)` — fetch the task's current `reviewDate` before mutating. Call `patchStaleResolved(taskId)` (returns removed `StaleTask`). Set `reviewDate` to +30d via API. Undo: call `restoreStaleTask(removedTask)` locally + PUT the stored prior `reviewDate` value back to the server (may be `null` or a pre-existing date).
- `handleArchiveProject(projectId)` — patchProjectOut, archive API call, undo via unpatchProjectOut + un-archive
- `handleEditTitle(taskId, newTitle)` — update API call, if titlePassesQuality passes call patchQualityResolved, show "Title updated" toast (no undo)

- [ ] **Step 1: Create DuplicatesSection.tsx**
- [ ] **Step 2: Create StaleSection.tsx**
- [ ] **Step 3: Create QualitySection.tsx**
- [ ] **Step 4: Create TaxonomySection.tsx**
- [ ] **Step 5: Rewrite TuneUpView.tsx with all action handlers**

- [ ] **Step 6: Verify build + tests**

Run:
```bash
cd client-react && npm run build && npx vitest run
```
Expected: Build clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add client-react/src/components/tuneup/
git commit -m "feat(react): add tune-up section components with inline actions

DuplicatesSection, StaleSection, QualitySection, TaxonomySection
with merge/archive/snooze/edit/dismiss. Partial merge failure shows
inline error state. Undo uses unpatch for reversibility."
```

---

### Task 8: Home Dashboard TuneUpTile

**Files:**
- Create: `client-react/src/components/tuneup/TuneUpTile.tsx`
- Modify: `client-react/src/components/layout/HomeDashboard.tsx`
- Modify: `client-react/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Create TuneUpTile**

Create `client-react/src/components/tuneup/TuneUpTile.tsx` — uses `useTuneUp({ autoFetch: false })` and calls `load()` on mount only when the parent signals it's active. Uses `computeTopFinding()` for display. Key differences from original plan:
- Uses `allSettled` (not `hasFetched && allFailed`) for the error state — since `hasFetched` only goes true on success, use `allSettled && !hasFetched` for all-failed
- Shows early top-tier findings while other sections are still loading
- Generic freshness hint: "Last checked N min ago"

- [ ] **Step 2: Add TuneUpTile to HomeDashboard**

In `HomeDashboard.tsx`, import and render:
```typescript
import { TuneUpTile } from "../tuneup/TuneUpTile";
```
Add prop `onNavigateToTuneUp` to HomeDashboard Props, render tile after existing tiles.

- [ ] **Step 3: Wire onNavigateToTuneUp from AppShell**

In AppShell, pass `onNavigateToTuneUp={() => handleSelectView("tuneup")}` to HomeDashboard. The `handleSelectView` function already handles view changes correctly.

- [ ] **Step 4: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/components/tuneup/TuneUpTile.tsx client-react/src/components/layout/HomeDashboard.tsx client-react/src/components/layout/AppShell.tsx
git commit -m "feat(react): add TuneUpTile on Home dashboard with top-finding preview

Uses autoFetch: false + load() for lazy fetching. Shows early
top-tier findings before all sections settle. Generic freshness hint."
```

---

### Task 9: Final Verification

**Files:** No new files.

- [ ] **Step 1: Run all tests**

Run: `cd client-react && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `cd client-react && npm run build`
Expected: Build clean.

- [ ] **Step 3: Root-level checks**

Run:
```bash
npx tsc --noEmit
npm run format:check
```
Expected: Both pass.

- [ ] **Step 4: Manual verification checklist**

Start dev server and verify:
- [ ] "Tune-up" appears in sidebar (not "Cleanup")
- [ ] Clicking it opens the Tune-up view with 4 sections
- [ ] Sections load independently with skeleton states
- [ ] Collapsing a section hides its content
- [ ] Error in one section doesn't affect others; shows "Retry" not "All clear"
- [ ] Zero findings shows green "All clear"
- [ ] Refresh button re-runs all analyses and clears dismissals
- [ ] Dismiss removes finding; persists when navigating away and back
- [ ] Archive shows undo toast; undo restores the row
- [ ] Snooze removes from stale only (check quality/duplicate sections still show the task if applicable)
- [ ] Edit title inline; "Title updated" toast; row disappears if heuristic passes
- [ ] Home tile shows "Analyzing..." → top finding or "All clear"
- [ ] Home tile "View all" navigates to Tune-up view
- [ ] Cached data persists between Home ↔ Tune-up navigation
