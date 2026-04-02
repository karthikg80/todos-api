# What Next? Recommendation Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered "What Next?" Home tile that shows ranked task recommendations with energy/time filters and inline Start/Snooze/Dismiss actions, powered by the `decide_next_work` backend endpoint.

**Architecture:** A `useNextWork()` hook with keyed module-level caching and stale-while-revalidate calls `POST /agent/read/decide_next_work`. A `WhatNextTile` component renders collapsed (single recommendation) and expanded (top 5 with filters + actions) states on the Home dashboard. Actions use the existing todo mutation API (`PUT /todos/:id`) with optimistic UI and undo support.

**Tech Stack:** React 19, TypeScript, vitest, @testing-library/react (already installed)

**Spec:** `docs/superpowers/specs/2026-04-02-what-next-widget-design.md`

**Key endpoint detail:** `POST /agent/read/decide_next_work` with body `{ availableMinutes?, energy? }` returns `{ decision: { recommendedTasks: Array<{ taskId, projectId?, title, reason, impact, effort }> } }`. The `reason` field is server-generated natural language.

**Existing patterns to follow:**
- API: `apiCall()` from `client-react/src/api/client.ts` (same as tune-up API layer)
- Home tiles: `section.home-tile` with `data-home-tile`, header, body pattern (see HomeDashboard.tsx)
- Undo: `setUndoAction({ message, onUndo })` from AppShell (same as tune-up)
- CSS tokens: `--accent`, `--danger`, `--warning`, `--success`, `--muted`, `--surface-2`, `--surface-3` from `tokens.css`

---

### Task 1: Types + API Layer

**Files:**
- Create: `client-react/src/types/nextWork.ts`
- Create: `client-react/src/api/nextWork.ts`
- Create: `client-react/src/utils/localDate.ts`

- [ ] **Step 1: Create types**

Create `client-react/src/types/nextWork.ts`:
```typescript
export interface NextWorkInputs {
  availableMinutes?: number;
  energy?: "low" | "medium" | "high";
}

export interface NextWorkRecommendation {
  taskId: string;
  projectId?: string | null;
  title: string;
  reason: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
}

export interface NextWorkResult {
  recommendations: NextWorkRecommendation[];
  inputs: NextWorkInputs;
  fetchedAt: number;
}
```

- [ ] **Step 2: Create localDate utility**

Create `client-react/src/utils/localDate.ts`:
```typescript
/**
 * Format a Date as a local YYYY-MM-DD string without UTC drift.
 * Unlike toISOString().split("T")[0], this uses the local calendar date.
 */
export function toLocalDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Get tomorrow's local date as YYYY-MM-DD. */
export function tomorrowLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateString(d);
}
```

- [ ] **Step 3: Create API function**

Create `client-react/src/api/nextWork.ts`:
```typescript
import { apiCall } from "./client";
import type { NextWorkInputs, NextWorkRecommendation } from "../types/nextWork";

export async function fetchNextWork(
  inputs: NextWorkInputs,
): Promise<NextWorkRecommendation[]> {
  const body: Record<string, unknown> = {};
  if (inputs.availableMinutes != null) body.availableMinutes = inputs.availableMinutes;
  if (inputs.energy != null) body.energy = inputs.energy;

  const res = await apiCall("/agent/read/decide_next_work", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Next work recommendation failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.decision?.recommendedTasks)
    ? data.decision.recommendedTasks
    : [];
}
```

- [ ] **Step 4: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/types/nextWork.ts client-react/src/api/nextWork.ts client-react/src/utils/localDate.ts
git commit -m "feat(react): add What Next types, API layer, and localDate utility"
```

---

### Task 2: `useNextWork` Hook + Tests

**Files:**
- Create: `client-react/src/hooks/useNextWork.ts`
- Create: `client-react/src/hooks/useNextWork.test.ts`

- [ ] **Step 1: Create the hook**

Create `client-react/src/hooks/useNextWork.ts`:
```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import type { NextWorkInputs, NextWorkResult, NextWorkRecommendation } from "../types/nextWork";
import { fetchNextWork } from "../api/nextWork";

// Module-level keyed cache — persists across navigations
const cache = new Map<string, NextWorkResult>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeInputs(raw: NextWorkInputs): NextWorkInputs {
  return {
    availableMinutes: raw.availableMinutes ?? undefined,
    energy: raw.energy ?? undefined,
  };
}

function cacheKey(inputs: NextWorkInputs): string {
  return JSON.stringify({ m: inputs.availableMinutes ?? null, e: inputs.energy ?? null });
}

function isFresh(result: NextWorkResult): boolean {
  return Date.now() - result.fetchedAt < CACHE_TTL_MS;
}

export function useNextWork() {
  const [inputs, setInputsState] = useState<NextWorkInputs>({});
  const [result, setResult] = useState<NextWorkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [actedOn, setActedOn] = useState<Set<string>>(new Set());

  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentInputsRef = useRef<NextWorkInputs>({});

  const doFetch = useCallback(async (normalized: NextWorkInputs, bypassTTL: boolean) => {
    const key = cacheKey(normalized);
    const cached = cache.get(key);

    // Fresh cache hit — no network needed
    if (cached && isFresh(cached) && !bypassTTL) {
      setResult(cached);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    // Stale cache hit — show stale data, revalidate in background
    if (cached && !bypassTTL) {
      setResult(cached);
      setLoading(false);
      setRefreshing(true);
    } else if (!cached) {
      setLoading(true);
      setRefreshing(false);
    } else {
      // bypassTTL with existing data
      setRefreshing(true);
    }

    const thisRequestId = ++requestIdRef.current;
    try {
      const recommendations = await fetchNextWork(normalized);
      if (requestIdRef.current !== thisRequestId) return; // stale response
      const newResult: NextWorkResult = {
        recommendations,
        inputs: normalized,
        fetchedAt: Date.now(),
      };
      cache.set(key, newResult);
      setResult(newResult);
      setError(null);
    } catch (err) {
      if (requestIdRef.current !== thisRequestId) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      // If we have stale data, keep it visible and just set error for subtle retry
      if (result) {
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      if (requestIdRef.current === thisRequestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [result]);

  // Debounced fetch triggered by input changes
  useEffect(() => {
    const normalized = normalizeInputs(inputs);
    currentInputsRef.current = normalized;

    // Synchronous cache check — serve immediately if fresh
    const key = cacheKey(normalized);
    const cached = cache.get(key);
    if (cached && isFresh(cached)) {
      setResult(cached);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    // Show stale data immediately if available
    if (cached) {
      setResult(cached);
      setLoading(false);
    }

    // Debounce the network call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doFetch(normalized, false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputs, doFetch]);

  const setInputs = useCallback((newInputs: NextWorkInputs) => {
    setInputsState(normalizeInputs(newInputs));
  }, []);

  const dismiss = useCallback((taskId: string) => {
    setDismissed((prev) => new Set(prev).add(taskId));
  }, []);

  const markActedOn = useCallback((taskId: string) => {
    setActedOn((prev) => new Set(prev).add(taskId));
  }, []);

  const unmarkActedOn = useCallback((taskId: string) => {
    setActedOn((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, []);

  // refresh: bypass TTL, clear exclusions, use current inputs
  const refresh = useCallback(() => {
    // Clear exclusion state — safe because acted-on tasks won't appear in fresh server results
    setDismissed(new Set());
    setActedOn(new Set());
    setError(null);
    doFetch(currentInputsRef.current, true);
  }, [doFetch]);

  // Derive visible recommendations
  const visible: NextWorkRecommendation[] = result
    ? result.recommendations.filter(
        (r) => !dismissed.has(r.taskId) && !actedOn.has(r.taskId),
      )
    : [];

  return {
    result,
    visible,
    loading,
    refreshing,
    error,
    inputs,
    dismissed,
    actedOn,
    setInputs,
    dismiss,
    markActedOn,
    unmarkActedOn,
    refresh,
  };
}

/** Reset module cache — for tests only. */
export function _resetNextWorkCache() {
  cache.clear();
}
```

- [ ] **Step 2: Write tests**

Create `client-react/src/hooks/useNextWork.test.ts`:
```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNextWork, _resetNextWorkCache } from "./useNextWork";

vi.mock("../api/nextWork", () => ({
  fetchNextWork: vi.fn().mockResolvedValue([
    { taskId: "t1", title: "Task 1", reason: "High priority.", impact: "high", effort: "low" },
    { taskId: "t2", title: "Task 2", reason: "Due soon.", impact: "medium", effort: "medium" },
  ]),
}));

import { fetchNextWork } from "../api/nextWork";

describe("useNextWork", () => {
  beforeEach(() => {
    _resetNextWorkCache();
    vi.clearAllMocks();
  });

  it("fetches on mount with default inputs", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toHaveLength(2);
    expect(fetchNextWork).toHaveBeenCalledTimes(1);
  });

  it("returns cached result for same inputs without re-fetching", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    vi.clearAllMocks();
    // Change inputs then change back
    act(() => result.current.setInputs({ energy: "low" }));
    await waitFor(() => expect(fetchNextWork).toHaveBeenCalledTimes(1));

    vi.clearAllMocks();
    act(() => result.current.setInputs({}));
    // Should serve from cache, no new fetch
    expect(result.current.visible).toHaveLength(2);
  });

  it("dismiss hides task from visible list", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => result.current.dismiss("t1"));
    expect(result.current.visible).toHaveLength(1);
    expect(result.current.visible[0].taskId).toBe("t2");
  });

  it("dismiss is session-global across input changes", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => result.current.dismiss("t1"));
    act(() => result.current.setInputs({ energy: "high" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.dismissed.has("t1")).toBe(true);
  });

  it("markActedOn hides task, unmarkActedOn restores it", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => result.current.markActedOn("t1"));
    expect(result.current.visible).toHaveLength(1);

    act(() => result.current.unmarkActedOn("t1"));
    expect(result.current.visible).toHaveLength(2);
  });

  it("refresh clears dismissed and actedOn", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => {
      result.current.dismiss("t1");
      result.current.markActedOn("t2");
    });
    expect(result.current.visible).toHaveLength(0);

    vi.clearAllMocks();
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.dismissed.size).toBe(0);
    expect(result.current.actedOn.size).toBe(0);
    expect(result.current.visible).toHaveLength(2);
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(fetchNextWork).mockRejectedValueOnce(new Error("Network error"));
    _resetNextWorkCache();
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd client-react && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/hooks/useNextWork.ts client-react/src/hooks/useNextWork.test.ts
git commit -m "feat(react): add useNextWork hook with keyed cache and stale-while-revalidate

Debounced input changes, per-instance race protection, module-level
keyed cache, separate loading/refreshing states, exclusion pipeline
(dismissed + actedOn)."
```

---

### Task 3: `WhatNextRow` Component

**Files:**
- Create: `client-react/src/components/home/WhatNextRow.tsx`

- [ ] **Step 1: Create the row component**

Create `client-react/src/components/home/WhatNextRow.tsx`:
```typescript
import { useState } from "react";
import type { NextWorkRecommendation } from "../../types/nextWork";
import { IconClock, IconXCircle } from "../shared/Icons";

interface Props {
  rec: NextWorkRecommendation;
  isTop: boolean;
  onStart: (taskId: string) => void;
  onSnooze: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
}

export function WhatNextRow({ rec, isTop, onStart, onSnooze, onDismiss }: Props) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [state, setState] = useState<"idle" | "acting" | "done">("idle");

  const handleStart = () => {
    setState("acting");
    onStart(rec.taskId);
    setTimeout(() => setState("done"), 300);
  };

  const handleSnooze = () => {
    setState("acting");
    onSnooze(rec.taskId);
    setTimeout(() => setState("done"), 300);
  };

  const handleDismiss = () => {
    setState("done");
    onDismiss(rec.taskId);
  };

  const rowClass = `whatnext-row${isTop ? " whatnext-row--top" : ""}${state === "acting" ? " whatnext-row--acting" : ""}${state === "done" ? " whatnext-row--done" : ""}`;

  return (
    <div className={rowClass}>
      <div className="whatnext-row__content">
        <div className="whatnext-row__title-line">
          <span className="whatnext-row__title">{rec.title}</span>
          <span className="whatnext-row__badges">
            <span className={`whatnext-badge whatnext-badge--impact-${rec.impact}`}>
              {rec.impact} impact
            </span>
            <span className={`whatnext-badge whatnext-badge--effort-${rec.effort}`}>
              {rec.effort} effort
            </span>
          </span>
          <span className="sr-only">{rec.impact} impact, {rec.effort} effort</span>
        </div>
        <button
          className="whatnext-row__why"
          onClick={(e) => { e.stopPropagation(); setReasonOpen((o) => !o); }}
          aria-expanded={reasonOpen}
        >
          {reasonOpen ? "Hide" : "Why?"}
        </button>
        {reasonOpen && (
          <div className="whatnext-row__reason">{rec.reason}</div>
        )}
      </div>
      {state === "idle" && (
        <div className="whatnext-row__actions">
          <button
            className="whatnext-btn whatnext-btn--start"
            onClick={(e) => { e.stopPropagation(); handleStart(); }}
            aria-label={`Start task: ${rec.title}`}
          >
            Start
          </button>
          <button
            className="whatnext-btn whatnext-btn--snooze"
            onClick={(e) => { e.stopPropagation(); handleSnooze(); }}
            aria-label={`Snooze task: ${rec.title}`}
            title="Snooze to tomorrow"
          >
            <IconClock size={13} />
          </button>
          <button
            className="whatnext-btn whatnext-btn--dismiss"
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            aria-label={`Dismiss: ${rec.title}`}
            title="Dismiss"
          >
            <IconXCircle size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client-react/src/components/home/WhatNextRow.tsx
git commit -m "feat(react): add WhatNextRow component with Start/Snooze/Dismiss actions"
```

---

### Task 4: `WhatNextExpanded` Component

**Files:**
- Create: `client-react/src/components/home/WhatNextExpanded.tsx`

- [ ] **Step 1: Create the expanded panel**

Create `client-react/src/components/home/WhatNextExpanded.tsx`:
```typescript
import type { NextWorkInputs, NextWorkRecommendation } from "../../types/nextWork";
import { WhatNextRow } from "./WhatNextRow";

const TIME_PRESETS: { label: string; minutes: number }[] = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "4h", minutes: 240 },
];

const ENERGY_OPTIONS: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
const ENERGY_LABELS: Record<string, string> = { low: "Low", medium: "Med", high: "High" };

interface Props {
  visible: NextWorkRecommendation[];
  inputs: NextWorkInputs;
  refreshing: boolean;
  error: string | null;
  onInputsChange: (inputs: NextWorkInputs) => void;
  onStart: (taskId: string) => void;
  onSnooze: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
  onRefresh: () => void;
  onCollapse: () => void;
}

export function WhatNextExpanded({
  visible,
  inputs,
  refreshing,
  error,
  onInputsChange,
  onStart,
  onSnooze,
  onDismiss,
  onRefresh,
  onCollapse,
}: Props) {
  const top5 = visible.slice(0, 5);

  return (
    <div className="whatnext-expanded">
      {/* Filter controls */}
      <div className="whatnext-filters">
        <div className="whatnext-filter-group">
          <span className="whatnext-filter-label">Time</span>
          <div className="whatnext-chips">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.minutes}
                className={`whatnext-chip${inputs.availableMinutes === p.minutes ? " whatnext-chip--active" : ""}`}
                onClick={() => onInputsChange({
                  ...inputs,
                  availableMinutes: inputs.availableMinutes === p.minutes ? undefined : p.minutes,
                })}
                aria-pressed={inputs.availableMinutes === p.minutes}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="whatnext-filter-group">
          <span className="whatnext-filter-label">Energy</span>
          <div className="whatnext-chips">
            {ENERGY_OPTIONS.map((e) => (
              <button
                key={e}
                className={`whatnext-chip${inputs.energy === e ? " whatnext-chip--active" : ""}`}
                onClick={() => onInputsChange({
                  ...inputs,
                  energy: inputs.energy === e ? undefined : e,
                })}
                aria-pressed={inputs.energy === e}
              >
                {ENERGY_LABELS[e]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Updating indicator */}
      {refreshing && <div className="whatnext-refreshing">Updating...</div>}

      {/* Error with retry (stale data still visible) */}
      {error && (
        <div className="whatnext-error-subtle">
          Couldn't refresh —{" "}
          <button className="whatnext-retry-link" onClick={onRefresh}>Retry</button>
        </div>
      )}

      {/* Recommendation list */}
      {top5.length > 0 ? (
        <div className="whatnext-list">
          {top5.map((rec, i) => (
            <WhatNextRow
              key={rec.taskId}
              rec={rec}
              isTop={i === 0}
              onStart={onStart}
              onSnooze={onSnooze}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      ) : (
        <div className="whatnext-empty">
          All caught up! Try different time or energy settings for more.
        </div>
      )}

      {/* Collapse */}
      <button className="whatnext-collapse" onClick={onCollapse}>
        Show less
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client-react/src/components/home/WhatNextExpanded.tsx
git commit -m "feat(react): add WhatNextExpanded with filter chips and recommendation list"
```

---

### Task 5: `WhatNextTile` Component + Wire to HomeDashboard

**Files:**
- Create: `client-react/src/components/home/WhatNextTile.tsx`
- Modify: `client-react/src/components/layout/HomeDashboard.tsx`
- Modify: `client-react/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Create WhatNextTile**

Create `client-react/src/components/home/WhatNextTile.tsx`:
```typescript
import { useState, useCallback } from "react";
import { useNextWork } from "../../hooks/useNextWork";
import { WhatNextExpanded } from "./WhatNextExpanded";
import { apiCall } from "../../api/client";
import { tomorrowLocal } from "../../utils/localDate";

interface Props {
  onUndo: (action: { message: string; onUndo: () => void }) => void;
}

export function WhatNextTile({ onUndo }: Props) {
  const hook = useNextWork();
  const { visible, loading, refreshing, error, inputs, setInputs, dismiss, markActedOn, unmarkActedOn, refresh } = hook;
  const [expanded, setExpanded] = useState(false);

  const top = visible[0] ?? null;

  const handleStart = useCallback(async (taskId: string) => {
    markActedOn(taskId);
    try {
      const res = await apiCall(`/todos/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!res.ok) {
        unmarkActedOn(taskId);
      }
    } catch {
      unmarkActedOn(taskId);
    }
  }, [markActedOn, unmarkActedOn]);

  const handleSnooze = useCallback(async (taskId: string) => {
    // Store prior values for undo
    let prevScheduledDate: string | null = null;
    let prevStatus: string | null = null;
    try {
      const taskRes = await apiCall(`/todos/${taskId}`);
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        prevScheduledDate = taskData.scheduledDate ?? null;
        prevStatus = taskData.status ?? null;
      }
    } catch { /* proceed with null priors */ }

    markActedOn(taskId);
    try {
      const res = await apiCall(`/todos/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ scheduledDate: tomorrowLocal(), status: "scheduled" }),
      });
      if (res.ok) {
        onUndo({
          message: "Snoozed to tomorrow",
          onUndo: async () => {
            await apiCall(`/todos/${taskId}`, {
              method: "PUT",
              body: JSON.stringify({ scheduledDate: prevScheduledDate, status: prevStatus ?? "next" }),
            });
            unmarkActedOn(taskId);
          },
        });
      } else {
        unmarkActedOn(taskId);
      }
    } catch {
      unmarkActedOn(taskId);
    }
  }, [markActedOn, unmarkActedOn, onUndo]);

  // Collapsed state
  if (!expanded) {
    return (
      <section className="home-tile" data-home-tile="what_next" aria-busy={loading}>
        <div className="home-tile__header">
          <div className="home-tile__title-row">
            <h3 className="home-tile__title">What Next?</h3>
          </div>
          {top && (
            <button className="mini-btn home-tile__see-all" onClick={() => setExpanded(true)}>
              See more
            </button>
          )}
        </div>
        <div className="home-tile__body">
          {loading ? (
            <p className="whatnext-loading">Finding your next task...</p>
          ) : error && !top ? (
            <p className="whatnext-error">
              Couldn't load recommendations —{" "}
              <button className="whatnext-retry-link" onClick={refresh}>Retry</button>
            </p>
          ) : top ? (
            <div className="whatnext-collapsed">
              <div className="whatnext-collapsed__title">{top.title}</div>
              <div className="whatnext-collapsed__reason">{top.reason}</div>
              <div className="whatnext-collapsed__badges">
                <span className={`whatnext-badge whatnext-badge--impact-${top.impact}`}>
                  {top.impact} impact
                </span>
                <span className={`whatnext-badge whatnext-badge--effort-${top.effort}`}>
                  {top.effort} effort
                </span>
              </div>
            </div>
          ) : (
            <p className="whatnext-empty-collapsed">No recommendations right now</p>
          )}
        </div>
      </section>
    );
  }

  // Expanded state
  return (
    <section className="home-tile home-tile--expanded" data-home-tile="what_next" aria-busy={loading}>
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <h3 className="home-tile__title">What Next?</h3>
        </div>
      </div>
      <div className="home-tile__body">
        <WhatNextExpanded
          visible={visible}
          inputs={inputs}
          refreshing={refreshing}
          error={error}
          onInputsChange={setInputs}
          onStart={handleStart}
          onSnooze={handleSnooze}
          onDismiss={dismiss}
          onRefresh={refresh}
          onCollapse={() => setExpanded(false)}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add WhatNextTile to HomeDashboard**

In `client-react/src/components/layout/HomeDashboard.tsx`:

Import:
```typescript
import { WhatNextTile } from "../home/WhatNextTile";
```

Add `onUndo` to the Props interface:
```typescript
interface Props {
  // ... existing props ...
  onUndo: (action: { message: string; onUndo: () => void }) => void;
}
```

Add to destructured props and render after the TuneUpTile:
```typescript
{/* Section 7: What Next? */}
<WhatNextTile onUndo={onUndo} />
```

- [ ] **Step 3: Wire onUndo from AppShell**

In AppShell.tsx, find the `<HomeDashboard>` render and add the `onUndo` prop:
```typescript
onUndo={(action) => setUndoAction({ message: action.message, onUndo: action.onUndo })}
```

- [ ] **Step 4: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/components/home/WhatNextTile.tsx client-react/src/components/layout/HomeDashboard.tsx client-react/src/components/layout/AppShell.tsx
git commit -m "feat(react): add WhatNextTile on Home dashboard with collapsed/expanded states

Collapsed: shows #1 recommendation with reason and badges.
Expanded: filter chips, top 5 list, Start/Snooze/Dismiss actions.
Wired to AppShell undo toast."
```

---

### Task 6: CSS Styles

**Files:**
- Modify: `client-react/src/styles/app.css`

- [ ] **Step 1: Append all What Next CSS**

Append to `client-react/src/styles/app.css`:
```css
/* === What Next Widget === */
.whatnext-loading {
  color: var(--muted);
  font-size: var(--fs-label);
  animation: pulse 1.5s infinite;
}
.whatnext-error {
  color: var(--danger);
  font-size: var(--fs-label);
}
.whatnext-retry-link {
  color: var(--danger);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  font: inherit;
  font-size: var(--fs-label);
}
.whatnext-empty-collapsed {
  color: var(--muted);
  font-size: var(--fs-label);
}

/* Collapsed state */
.whatnext-collapsed__title {
  font-weight: var(--fw-semibold);
  font-size: var(--fs-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.whatnext-collapsed__reason {
  font-size: var(--fs-label);
  color: var(--muted);
  margin-top: var(--s-1);
}
.whatnext-collapsed__badges {
  display: flex;
  gap: var(--s-1h);
  margin-top: var(--s-1h);
}

/* Badges */
.whatnext-badge {
  font-size: var(--fs-xs);
  padding: 1px var(--s-1h);
  border-radius: var(--r-sm);
  font-weight: var(--fw-medium);
}
.whatnext-badge--impact-high { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
.whatnext-badge--impact-medium { background: var(--surface-3); color: var(--muted); }
.whatnext-badge--impact-low { background: var(--surface-3); color: var(--muted); }
.whatnext-badge--effort-high { background: color-mix(in srgb, var(--warning) 10%, transparent); color: var(--warning); }
.whatnext-badge--effort-medium { background: var(--surface-3); color: var(--muted); }
.whatnext-badge--effort-low { background: color-mix(in srgb, var(--success) 10%, transparent); color: var(--success); }

/* Expanded panel */
.whatnext-expanded {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.whatnext-filters {
  display: flex;
  gap: var(--s-4);
  flex-wrap: wrap;
}
.whatnext-filter-group {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.whatnext-filter-label {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: var(--fw-medium);
}
.whatnext-chips {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
}
.whatnext-chip {
  padding: var(--s-1) var(--s-2);
  border-radius: var(--r-xs);
  border: none;
  background: none;
  color: var(--muted);
  font-size: var(--fs-xs);
  cursor: pointer;
  font-family: inherit;
}
.whatnext-chip--active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-0);
}
.whatnext-chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.whatnext-refreshing {
  font-size: var(--fs-xs);
  color: var(--muted);
  animation: pulse 1.5s infinite;
}
.whatnext-error-subtle {
  font-size: var(--fs-xs);
  color: var(--muted);
}
.whatnext-empty {
  color: var(--muted);
  font-size: var(--fs-label);
  text-align: center;
  padding: var(--s-4) 0;
}

/* Recommendation rows */
.whatnext-list {
  display: flex;
  flex-direction: column;
}
.whatnext-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--s-2) 0;
  border-bottom: 1px solid var(--border-light);
  gap: var(--s-2);
  transition: opacity var(--dur-base) var(--ease-out), max-height var(--dur-base) var(--ease-out);
  max-height: 200px;
  overflow: hidden;
}
.whatnext-row:last-child { border-bottom: none; }
.whatnext-row--top {
  border-left: 3px solid var(--accent);
  padding-left: var(--s-2);
}
.whatnext-row--acting {
  opacity: 0.5;
}
.whatnext-row--done {
  opacity: 0;
  max-height: 0;
  padding: 0;
  border: none;
}
@media (prefers-reduced-motion: reduce) {
  .whatnext-row--done { transition: none; }
}
.whatnext-row__content {
  flex: 1;
  min-width: 0;
}
.whatnext-row__title-line {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
}
.whatnext-row__title {
  font-weight: var(--fw-medium);
  font-size: var(--fs-label);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.whatnext-row__badges {
  display: flex;
  gap: var(--s-1);
  flex-shrink: 0;
}
.whatnext-row__why {
  font-size: var(--fs-xs);
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-top: var(--s-1);
}
.whatnext-row__reason {
  font-size: var(--fs-xs);
  color: var(--muted);
  margin-top: var(--s-1);
  line-height: var(--lh-snug);
}

/* Action buttons */
.whatnext-row__actions {
  display: flex;
  gap: var(--s-1);
  align-items: center;
  flex-shrink: 0;
}
.whatnext-btn {
  border: none;
  cursor: pointer;
  border-radius: var(--r-sm);
  font-family: inherit;
  line-height: 1;
}
.whatnext-btn--start {
  background: var(--accent);
  color: white;
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  padding: var(--s-1) var(--s-2);
}
.whatnext-btn--start:hover { opacity: 0.9; }
.whatnext-btn--snooze,
.whatnext-btn--dismiss {
  background: none;
  color: var(--muted);
  padding: var(--s-1);
}
.whatnext-btn--snooze:hover,
.whatnext-btn--dismiss:hover {
  color: var(--text);
  background: var(--surface-2);
}
.whatnext-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

/* Collapse link */
.whatnext-collapse {
  font-size: var(--fs-xs);
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  align-self: center;
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

- [ ] **Step 2: Verify build**

Run: `cd client-react && npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client-react/src/styles/app.css
git commit -m "feat(react): add What Next CSS styles with filter chips, badges, and fade animation"
```

---

### Task 7: Final Verification

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
- [ ] "What Next?" tile appears on Home dashboard
- [ ] Collapsed: shows top recommendation with title, reason, impact/effort badges
- [ ] "See more" expands inline
- [ ] Filter chips (15m/30m/1h/2h/4h + Low/Med/High) toggle on/off
- [ ] Changing filters updates recommendations (may show stale data then refresh)
- [ ] First recommendation has accent left border in expanded view
- [ ] "Why?" link reveals/hides reason text
- [ ] Start button: row shows "acting" state, fades out, task becomes in_progress
- [ ] Snooze button: row fades out, undo toast appears, undo restores row
- [ ] Dismiss button: row fades out immediately, no toast
- [ ] "Show less" collapses back to single-task view
- [ ] After all tasks actioned: "All caught up!" empty state
- [ ] Error state shows retry button
- [ ] Navigating away and back preserves cached data
