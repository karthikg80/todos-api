# What Next? Recommendation Widget — React Client

**Date:** 2026-04-02
**Client:** React (`client-react/`)
**Approach:** Wire `decide_next_work` backend endpoint into a Home dashboard tile with collapsed/expanded states, filter controls, and inline actions.
**Phase:** 1 of 2. This spec covers the quick recommendation widget. Phase 2 (full day planner powered by `plan_today`) is a separate future spec.

## Problem

The React client's "Today's Focus" tile uses simple local priority sorting to pick a focus task. The backend has a sophisticated `decide_next_work` endpoint that scores tasks using priority, due dates, energy matching, goal alignment, dependency graphs, and personalized soul profile modifiers — but no client calls it. Users have no way to get AI-ranked "what should I do next?" recommendations filtered by their current time and energy.

## Scope

- New "What Next?" Home dashboard tile (collapsed + expanded inline)
- `useNextWork()` hook with keyed caching and stale-while-revalidate
- Inline actions: Start (in_progress), Snooze (tomorrow), Dismiss (session-only)
- React client only — no backend changes

---

## Design

### 1. Data Layer

**Endpoint:** `POST /agent/read/decide_next_work`

**Request:**
```typescript
{ availableMinutes?: number, energy?: "low" | "medium" | "high" }
```
(`context` parameter exists but is not used in v1 — simplifies the cache key space.)

**Verified response shape:**
```typescript
{
  decision: {
    recommendedTasks: Array<{
      taskId: string;
      projectId?: string | null;
      title: string;
      reason: string;        // Human-readable from buildDecisionReason()
      impact: "low" | "medium" | "high";
      effort: "low" | "medium" | "high";
    }>
  }
}
```

The `reason` field is server-generated natural language built from scoring signals: status, due date proximity, dependency unblocking count, priority. Examples:
- "It is already in progress and it is overdue."
- "It is due soon and it unblocks 2 other tasks."
- "It has elevated priority."
- "It is one of the clearest actionable tasks available right now."

### 2. `useNextWork` Hook

**Hook API:**
```typescript
interface NextWorkInputs {
  availableMinutes?: number;
  energy?: "low" | "medium" | "high";
}

interface NextWorkRecommendation {
  taskId: string;
  projectId?: string | null;
  title: string;
  reason: string;
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
}

interface NextWorkResult {
  recommendations: NextWorkRecommendation[];
  inputs: NextWorkInputs;      // normalized echo of what was requested
  fetchedAt: number;
}

interface UseNextWorkHook {
  result: NextWorkResult | null;
  loading: boolean;             // true ONLY when no usable data is available
  refreshing: boolean;          // true when background revalidation is in flight
  error: string | null;
  dismissed: Set<string>;       // session-only dismissed taskIds
  actedOn: Set<string>;         // taskIds where Start or Snooze succeeded
  setInputs: (inputs: NextWorkInputs) => void;
  dismiss: (taskId: string) => void;
  markActedOn: (taskId: string) => void;
  unmarkActedOn: (taskId: string) => void;  // for snooze undo
  refresh: () => void;          // re-fetch using current normalized inputs, bypass TTL, clear dismissals + actedOn
}
```

**Naming:** `setInputs` (not `fetch`) because the hook debounces and may serve from cache — the caller is expressing intent, not commanding a network call. `setInputs()` updates the local filter state immediately (UI reflects the new selection instantly). Only the network call is debounced — cache lookups are synchronous.

**Cache design — keyed by normalized inputs:**
- Module-level `Map<string, NextWorkResult>` persists across navigations
- Cache key: `JSON.stringify({ m: inputs.availableMinutes ?? null, e: inputs.energy ?? null })`
- Inputs are normalized before keying (undefined → null)
- Cache TTL: 5 minutes. Entries older than 5 minutes are considered stale.
- Cache size is naturally bounded: the input space is at most ~18 combinations (5 time presets + no-filter × 3 energy levels + no-filter). No eviction policy needed for v1.

**Stale-while-revalidate:**
- Fresh cache hit (< 5 min): return immediately, `loading: false`, `refreshing: false`
- Stale cache hit (>= 5 min): return stale data immediately (`loading: false`), trigger background fetch (`refreshing: true`), replace when new data arrives
- Cache miss: `loading: true`, `result: null`, trigger fetch

**Revalidation failure:** If a background revalidation fetch fails while stale data is being shown, keep the stale data visible. Show a subtle inline "Couldn't refresh — Retry" affordance (not a full error state). Do NOT drop back to `result: null` or show the empty state if usable stale data exists. The error state (`error: string | null, loading: true, result: null`) only applies when there is truly no cached data at all.

**Debounce:**
- Input changes debounce at 300ms before triggering network calls
- Cache lookups are synchronous and immediate (no debounce for cache hits)

**Race condition guard:**
- Per-instance `useRef<number>` tracking the latest request ID — not module-level. Each hook instance manages its own race protection while sharing the module-level cache.

**Dismiss behavior:**
- Session-global: dismissing a task hides it across all input combinations. This is intentional — if the user says "not this task right now," the intent spans energy/time contexts.
- Dismissals are a client-side exclusion layer. Cached server results are never mutated by dismissals.
- `refresh()` clears both `dismissed` and `actedOn` sets. Clearing `actedOn` is safe because acted-on tasks (started or snoozed) will naturally be absent from fresh server results — the clear only resets the client-side hiding state, not the server mutations. Document this rationale in code comments.

**Acted-on behavior:**
- Separate `actedOn: Set<string>` tracks tasks where Start or Snooze succeeded optimistically.
- Applied as a second exclusion layer after dismissed.
- `unmarkActedOn(taskId)` exists for Snooze undo.
- `refresh()` clears `actedOn`.

**Visible recommendations derived pipeline:**
```
cached recommendations → minus dismissed → minus actedOn → rendered result
```

**Not shared across mounts (unlike useTuneUp):**
Standard `useState` + `useEffect` with module-level cache `Map`. Only one consumer (Home tile). If Phase 2 adds a second consumer, promote to `useSyncExternalStore`.

### 3. Home Tile — Collapsed + Expanded

**Tile name:** "What Next?"

**Collapsed state (default):**
Shows the #1 visible recommendation after exclusions. Follows existing `section.home-tile` pattern.

- Task title (one line, truncated)
- Reason text below in muted styling
- Impact + effort as small pills (e.g., `High impact · Low effort`)
- "See more" link to expand

**Collapsed fallback states:**
- Loading (first fetch, no cache): "Finding your next task..." with pulse animation
- Error: "Couldn't load recommendations — Retry" (Retry is a clickable button, not just text)
- Empty (zero recommendations): "No recommendations right now"
- All actioned: re-evaluates from cached data minus exclusions. Shows next available or empty state.

**Expanded state (inline, not a separate page):**

**Filter controls at the top:**
- Available time: preset chip buttons `15m | 30m | 1h | 2h | 4h` (maps to `availableMinutes: 15 | 30 | 60 | 120 | 240`)
- Energy: `Low | Med | High` toggle
- Active selection highlighted. No selection = no filter (all recommendations).
- Changing a filter calls `setInputs()` which debounces → cache check → possible fetch

**Recommendation list (up to 5 visible after exclusions):**
- First item: slightly stronger card treatment (subtle left accent border) to preserve "#1 pick" signal
- Items 2-5: standard rows
- Each row shows:
  - Task title
  - Impact + effort badges (inline, compact)
  - "Why?" text link that reveals the `reason` text below the title (small chevron or text affordance — NOT whole-row tap)
  - Action buttons: **Start** (filled accent button, primary), **Snooze** (clock icon, muted), **Dismiss** (X icon, most muted)

**Expanded empty state:**
After all visible tasks are actioned/dismissed: "All caught up! Try different time or energy settings for more."

**"Updating..." indicator:**
When `refreshing: true` (stale-while-revalidate in flight), show a subtle inline indicator (small text or dot animation) — NOT a full spinner or skeleton. Existing data remains visible.

**Collapse link:** "Show less" at the bottom returns to collapsed single-task view.

### 4. Action Mechanics

**Start (primary):**
- `PUT /todos/:taskId { status: "in_progress" }`
- Visual: filled accent-colored button, most prominent
- Optimistic: row immediately shows "Started" state (muted title, check icon)
- After brief confirmation (300ms), row preserves its height momentarily then collapses with a smooth animation
- `markActedOn(taskId)` called immediately
- On API failure: row reverts from "Started" to normal, show inline error text or toast. `unmarkActedOn(taskId)` to restore visibility.
- No undo — starting is a forward action

**Snooze (secondary):**
- `PUT /todos/:taskId { scheduledDate: tomorrowLocalISO, status: "scheduled" }`
  - `tomorrowLocalISO`: computed using local calendar date formatting to avoid UTC drift:
    ```typescript
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const tomorrowLocalISO = `${yyyy}-${mm}-${dd}`;
    ```
    Note: the existing `handleLifecycleAction("snooze-tomorrow")` in AppShell.tsx uses `toISOString().split("T")[0]` which serializes in UTC, not local time. This can produce the wrong date near midnight in non-UTC timezones. The What Next widget should use explicit local formatting as shown above. If this is the first instance of local date formatting, extract it as a shared utility (`utils/localDate.ts`). Also sets `status: "scheduled"` to match existing snooze behavior.
- Visual: clock icon button, muted
- Optimistic: `markActedOn(taskId)`, row fades out with height preservation
- On success: undo toast "Snoozed to tomorrow" for 5 seconds
- Undo: `PUT /todos/:taskId { scheduledDate: previousScheduledDate, status: previousStatus }` (stores both prior values before mutation) + `unmarkActedOn(taskId)` to restore row
- On API failure: `unmarkActedOn(taskId)`, row reappears, show error

**Dismiss (tertiary):**
- Client-side only: `dismiss(taskId)`
- Visual: X icon button, most muted
- Row fades out with brief height preservation
- No undo toast — dismissals are session-only, cleared on `refresh()`
- Does not mutate server or cache

**Row fade-out behavior:**
All three actions use the same fade-out pattern:
1. Action fires → row enters "success" visual state (opacity reduction or check mark)
2. Brief pause (300ms) to show the success state
3. Row height collapses smoothly (CSS transition on `max-height` + `opacity`, ~200ms)
4. Row removed from rendered list

This prevents jarring instant removal, especially when actioning multiple rows in sequence.

---

## Files Affected

| File | Change |
|------|--------|
| `client-react/src/types/nextWork.ts` | New — response types, hook types |
| `client-react/src/api/nextWork.ts` | New — POST wrapper for `decide_next_work` |
| `client-react/src/hooks/useNextWork.ts` | New — hook with keyed cache, debounce, stale-while-revalidate |
| `client-react/src/components/home/WhatNextTile.tsx` | New — collapsed state tile |
| `client-react/src/components/home/WhatNextExpanded.tsx` | New — expanded state with filters + recommendation list |
| `client-react/src/components/home/WhatNextRow.tsx` | New — single recommendation row with actions + "Why?" reveal |
| `client-react/src/components/layout/HomeDashboard.tsx` | Add WhatNextTile |
| `client-react/src/styles/app.css` | What Next tile styles, filter chips, row actions, fade animation |

## Accessibility

- Filter chip buttons use `aria-pressed="true|false"`
- "Why?" reveal uses `aria-expanded` on the trigger, content in an `aria-labelledby` region
- Action buttons have descriptive `aria-label` (e.g., "Start task: {title}", "Snooze task: {title}")
- Loading state uses `aria-busy="true"` on the tile container
- Row fade-out respects `prefers-reduced-motion` (instant removal instead of animation)
- Impact/effort badges are NOT `aria-hidden` — they convey information not always present in the reason text. Badges themselves should be readable by assistive tech (text content is sufficient). Additionally, include a visually hidden summary span (`<span class="sr-only">`) within the row that reads "High impact, low effort" — do NOT use `aria-label` on the row container, as that can flatten or obscure nested interactive controls.

## Testing Strategy

- **`useNextWork` hook tests:** keyed caching (same inputs = cache hit), stale detection (>5 min = revalidate), debounce (rapid input changes don't fire multiple fetches), race condition (stale response discarded), dismiss/actedOn exclusion pipeline, refresh clears state
- **Visible recommendation derivation tests:** cached result minus dismissed minus actedOn = rendered list
- **Action handler tests:** Start marks actedOn, Snooze stores prior scheduledDate for undo, Dismiss is client-only
- Integration: manual verification with real endpoint

## Out of Scope

- `context` parameter for the endpoint (v1 ignores it)
- Full day planner view (Phase 2 — separate spec using `plan_today`)
- Replacing the existing "Today's Focus" tile (coexist for now, evaluate after Phase 1 ships)
- Day context integration (energy from `set_day_context` — Phase 2 can auto-populate filters)
- Persisting filter selections across sessions
- Backend changes to `decide_next_work` response shape
