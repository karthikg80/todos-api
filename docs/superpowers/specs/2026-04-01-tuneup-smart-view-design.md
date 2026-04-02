# Tune-Up Smart View — React Client

**Date:** 2026-04-01
**Client:** React (`client-react/`)
**Approach:** Wire existing backend agent endpoints into a new React view with inline actions, plus a summary tile on the Home dashboard.

## Problem

The backend exposes 4 analysis endpoints (duplicate detection, stale items, task quality, taxonomy suggestions) that the vanilla client uses in its Cleanup view. The React client has no equivalent — users have no way to discover or act on task hygiene issues.

## Scope

- New full Tune-up view in the React client (sidebar nav item)
- New Tune-up summary tile on the Home dashboard
- Shared `useTuneUp()` hook for data fetching + caching
- Inline actions (merge, archive, snooze, edit, dismiss) with undo support
- React client only — no vanilla client or backend changes

---

## Design

### 1. Data Layer — `useTuneUp` Hook

**4 backend endpoints called in parallel on mount:**

| Endpoint | Returns | Hook key |
|----------|---------|----------|
| `POST /agent/read/find_duplicate_tasks` body: `{}` | `{ exact, normalized, near }` duplicate group arrays | `duplicates` |
| `POST /agent/read/find_stale_items` body: `{ staleDays: 30 }` | `{ staleTasks, staleProjects }` arrays | `stale` |
| `POST /agent/read/analyze_task_quality` body: `{}` | Array of `{ taskId, title, issues[] }` | `quality` |
| `POST /agent/read/taxonomy_cleanup_suggestions` body: `{}` | `{ similarProjects, lowActivityProjects }` | `taxonomy` |

**Hook API:**
```typescript
type TuneUpSection = "duplicates" | "stale" | "quality" | "taxonomy";

interface TuneUpData {
  duplicates: DuplicateResults | null;
  stale: StaleResults | null;
  quality: QualityResults | null;
  taxonomy: TaxonomyResults | null;
}

interface TuneUpHook {
  data: TuneUpData;
  loading: Record<TuneUpSection, boolean>;
  error: Record<TuneUpSection, string | null>;
  dismissed: Set<string>;
  hasFetched: boolean;
  lastFetchedAt: number | null;
  refresh: () => void;
  refreshSection: (key: TuneUpSection) => void;
  dismiss: (findingKey: string) => void;
  patchTaskOut: (taskId: string) => void;
  patchProjectOut: (projectId: string) => void;
  patchQualityResolved: (taskId: string) => void;
  patchStaleResolved: (taskId: string) => void;
}
```

**`hasFetched` and `lastFetchedAt`:**
- `hasFetched: boolean` — true once at least one section has returned data. Distinguishes "never loaded" from "loaded and empty."
- `lastFetchedAt: number | null` — timestamp of the most recent successful section fetch (any section, not necessarily all four). Used by the Home tile for a generic freshness hint ("Last checked 5 min ago"). The tile does not imply all four sections refreshed together.

**Fetching behavior:**
- All 4 fire in parallel via `Promise.allSettled` — one failure doesn't block others
- Results cached in a module-level variable (not React state alone) so the same data is available to both the Home tile and the full view without re-fetching
- `refresh()` clears cache, clears dismissals, resets `lastFetchedAt`, and re-runs all 4
- `refreshSection(key)` re-runs one analysis only, updates `lastFetchedAt`

**Dismiss lifecycle:**
- `dismiss(findingKey)` adds to a `Set<string>` in hook state
- Finding keys must be semantically stable — not array indices. Examples:
  - Duplicates: `dup:exact:${sortedMemberIds.join(':')}` (sorted joined list of all member IDs, stable regardless of group size or payload order)
  - Stale: `stale:task:${taskId}`
  - Quality: `quality:${taskId}`
  - Taxonomy: `tax:similar:${sortedProjectIds.join(':')}` / `tax:low:${projectId}`
- Dismissals are session-only (not persisted to localStorage or backend)
- Dismissals survive navigation between views **as long as the module-level cache is alive** — navigating from Tune-up to Home and back does not clear them
- Dismissals are cleared only by: explicit `refresh()` call, or full page refresh (which resets the module-level cache)
- Counts displayed in the UI reflect visible findings only (after dismissals and optimistic patches), not raw server payload counts

**Cross-section reconciliation — two patch paths:**

Destructive actions (archive, merge) use `patchTaskOut(taskId)` / `patchProjectOut(projectId)`:
- Removes the task/project ID from ALL sections in cached data
- Appropriate because the entity is being archived/removed — it should vanish everywhere

Non-destructive actions (title edit, snooze) use targeted patchers:
- `patchQualityResolved(taskId)` — removes the task from the quality section only. Does NOT remove from stale or duplicates, because editing a title doesn't resolve staleness, and may or may not affect duplicate status.
- `patchStaleResolved(taskId)` — removes the task from `staleData.staleTasks` in the cache only. Does NOT remove from quality or duplicates, because snoozing doesn't fix title quality or duplicate status.

These are lightweight local patches, not re-fetches. The raw server data is only re-fetched on explicit `refresh()` or `refreshSection()`.

### 2. Full Tune-Up View

**Navigation:** New sidebar nav item "Tune-up" after "Completed". AppShell gets a new `activeView: "tuneup"` case.

**Layout:** Four collapsible sections, each loading independently:

**2a. Duplicates Section**
- Header: "Duplicates" + visible count badge
- Sub-groups: exact, normalized, near — each group shows task titles side by side
- Inline actions:
  - **Merge:** Calls a `mergeDuplicateGroup(group)` wrapper (see Section 4). Survivor is the first task by `createdAt` (oldest). This is explicit and deterministic — not payload order.
  - **Dismiss:** Session-only, removes group from view

**2b. Stale Items Section**
- Header: "Stale" + visible count badge
- Sub-groups: stale tasks, stale projects
- Each row: title + "last updated X days ago"
- Inline actions:
  - **Archive:** `PUT /todos/:id { archived: true }` — row disappears immediately (removed via `patchTaskOut` — cross-section removal)
  - **Snooze 30 days:** `PUT /todos/:id { reviewDate: +30d }` — row disappears from stale section only (patched out of `staleData.staleTasks` in cache, NOT full cross-section removal). The task may still appear in quality or duplicates.
  - **Open:** Navigates to task drawer

**2c. Quality Issues Section**
- Header: "Quality" + visible count badge
- Each row: task title + issue tags ("missing verb", "vague", "too long", "multi-action")
- Inline actions:
  - **Edit title:** Inline text input, commits on Enter/blur. Guards: reject empty titles, skip no-op edits (trimmed value === original). If the new title passes the quality heuristic (see Section 4), the row disappears via `patchQualityResolved(taskId)` — quality section only, not cross-section.
  - **Dismiss:** Session-only

**2d. Taxonomy Section**
- Header: "Taxonomy" + visible count badge
- Sub-groups: similar project names, low-activity projects
- Inline actions:
  - **Archive project:** `PUT /projects/:id { archived: true }` — row disappears via `patchProjectOut` (cross-section removal)
  - **Dismiss:** Session-only (for similar project suggestions)

**Loading state:** Each section shows a skeleton loader independently with `aria-busy="true"` on the section container. Sections stream in as endpoints respond.

**Empty state:** When a section has loaded successfully and has zero visible findings (after filtering out dismissed and patched items), show a green checkmark + "All clear" inline. Don't hide the section — users should see it was checked.

**Error state:** Per-section error with "Retry" button. A failed section NEVER shows "All clear" — it shows the error state. Other sections are unaffected.

### 3. Home Dashboard Tile

**Tile name:** "Tune-up"

**Loading state:** Shows "Analyzing..." with a subtle pulse animation. However, once any section has returned data that contains a top-tier finding (tiers 1-3), the tile shows that finding immediately even if other sections are still loading. This makes the tile feel faster. If no loaded section produces tiers 1-3 and fetches are still in flight, keep showing "Analyzing...". Only once all fetches settle does the tile compute from the full visible dataset (which may produce a lower-tier finding or "All clear").

**Content — top finding preview:**
Shows the single most impactful finding. Priority order with tiebreaker rules:

1. Exact duplicates (highest signal)
2. Quality issues with "multi-action" flag
3. Stale tasks > 60 days old
4. Near duplicates
5. Stale tasks 30-60 days old
6. Other quality issues (missing verb, vague, too long)
7. Taxonomy suggestions (lowest urgency)

**Tiebreaker:** When multiple findings share the same priority tier, rank by count (higher count = more impactful), then by strongest actionability (merge > archive > edit > suggest).

**Phrasing:** Concrete, not categorical.
- "3 exact duplicate tasks found" (not "Duplicates detected")
- "2 tasks should be split into subtasks" (not "Quality issues found")
- "5 tasks untouched for 60+ days" (not "Stale items")

**Severity cue:**
- Priority tiers 1-3: "Needs attention" label in `var(--danger)` styling
- Priority tiers 4-6: neutral styling, no label
- Priority tier 7: muted styling

**"View all" link:** Navigates to the full Tune-up view.

**Zero findings:** "All clear — nothing to clean up" with green checkmark. Freshness hint derived from `lastFetchedAt`: "Last checked just now" / "Last checked 5 min ago" / etc.

**Error state (all 4 failed):** Compact "Couldn't analyze — Retry" treatment, not blank.

**When to fetch:** Only when Home is the active view. Does not eagerly fetch on app load. If the full Tune-up view was already visited this session, cached data is shown instantly (with `lastFetchedAt` freshness hint).

Note: If the user lands on the full Tune-up view first (not Home), the view fetches immediately on mount. The Home tile then uses cached data when the user navigates there.

### 4. Inline Action Mechanics

**Optimistic updates:**
All actions update UI immediately before the API call resolves. Undo reverses from the same local mutation layer — no refetch needed for undo.

**Undo pattern:**
Reuse the existing `UndoToast` component. All destructive actions (archive, merge) show undo for 5 seconds. Undo reverses the API call (`PUT /todos/:id { archived: false }` for archive undo, etc.).

**`mergeDuplicateGroup(group)` wrapper:**
A dedicated function (not a sequence of raw archive calls) that:
1. Determines the survivor: the task with the oldest `createdAt` timestamp. This is explicit and deterministic.
2. Optimistically removes all non-survivors from the UI immediately
3. Fires archive calls for each non-survivor in sequence (not parallel — avoids race conditions)
4. On full success: show "Merged N duplicates" toast with undo
5. On partial failure: failed rows reappear in-place with inline error state (red border + "Failed to archive" text on the row), not just a toast. Succeeded items stay archived.
6. Undo: un-archives all archived items in the group

**Edit title flow:**
- Click "Edit" → inline input appears, pre-filled with current title
- Enter or blur → commit (skip if empty or unchanged)
- `PUT /todos/:id { title: newTitle }`
- Quality heuristic (best-effort, not a correctness rule): if the new title is ≤80 chars, starts with a common English verb (check against a small hardcoded list of ~30 action verbs like "add", "fix", "update", "review", "create", "send", etc.), and contains no splitting words ("and", "then", "also"), consider quality issues resolved for that task. Call `patchQualityResolved(taskId)`.
- This is a v1 approximation. Don't overfit tests to English grammar edge cases — a small utility with predictable behavior is enough.
- Toast copy: "Title updated" (not "Quality fixed" — the heuristic is approximate, don't make definitive claims)
- No undo for edits — the user can just re-edit

**Snooze flow:**
- `PUT /todos/:id { reviewDate: today + 30 days }`
- Call `patchStaleResolved(taskId)` (stale section only, not cross-section)
- Row disappears from stale section immediately
- Show "Snoozed for 30 days" toast with undo
- Undo: `PUT /todos/:id { reviewDate: previousValue }` — the toast stores the prior `reviewDate` value so undo restores it correctly (may be null or a pre-existing date), then re-inserts the task into the stale cache

**After any action, reconcile:**
- Destructive (archive, merge): `patchTaskOut(taskId)` — removes from ALL sections
- Non-destructive (edit): `patchQualityResolved(taskId)` — removes from quality section only
- Non-destructive (snooze): `patchStaleResolved(taskId)` — removes from stale section only
- Section count badges update immediately from visible findings
- Home tile re-evaluates top finding from the same patched cache

---

## Files Affected

| File | Change |
|------|--------|
| `client-react/src/hooks/useTuneUp.ts` | New hook — 4 parallel fetches, module-level caching, dismiss, destructive + non-destructive patch paths |
| `client-react/src/api/tuneup.ts` | New API functions — POST wrappers for the 4 agent endpoints |
| `client-react/src/types/tuneup.ts` | New types — response shapes for all 4 endpoints |
| `client-react/src/utils/qualityHeuristic.ts` | New utility — best-effort title quality check |
| `client-react/src/utils/topFinding.ts` | New utility — priority-ranked finding selection for Home tile |
| `client-react/src/components/tuneup/TuneUpView.tsx` | New component — full view with 4 sections |
| `client-react/src/components/tuneup/DuplicatesSection.tsx` | New component — duplicate groups with merge/dismiss |
| `client-react/src/components/tuneup/StaleSection.tsx` | New component — stale items with archive/snooze |
| `client-react/src/components/tuneup/QualitySection.tsx` | New component — quality issues with inline edit |
| `client-react/src/components/tuneup/TaxonomySection.tsx` | New component — project suggestions with archive |
| `client-react/src/components/tuneup/TuneUpTile.tsx` | New component — Home dashboard tile |
| `client-react/src/components/tuneup/SectionHeader.tsx` | New shared component — collapsible header with count |
| `client-react/src/components/tuneup/mergeDuplicateGroup.ts` | New action wrapper — sequential archive with partial failure handling |
| `client-react/src/components/layout/AppShell.tsx` | Add "tuneup" to activeView, render TuneUpView |
| `client-react/src/components/layout/HomeDashboard.tsx` | Add TuneUpTile |
| `client-react/src/components/projects/Sidebar.tsx` | Add Tune-up nav item |
| `client-react/src/styles/app.css` | Tune-up view styles, section styles, action button styles, inline error state |

## Data Dependencies

All 4 endpoints already exist and are used by the vanilla client. No backend changes needed.

The API calls use the agent router pattern: `POST /agent/read/{endpoint}` with a JSON body (e.g., `{ staleDays: 30 }` for stale items, `{}` for the others). Auth token is passed via the existing API client.

Response types should be defined in `client-react/src/types/tuneup.ts` based on the actual endpoint responses. The vanilla client's `cleanupUi.js` documents the response shapes.

## Accessibility

- Section headers use `<button>` with `aria-expanded`
- Count badges are `aria-hidden="true"` (decorative)
- Inline edit inputs have `aria-label="Edit task title"`
- Action buttons have descriptive `aria-label` (e.g., "Archive task: {title}")
- Loading skeletons use `aria-busy="true"` on the section container
- Undo toast is announced via `role="status"` (existing UndoToast behavior)
- Inline error state on failed merge rows uses `role="alert"`

## Testing Strategy

- **`useTuneUp` hook tests:** fetch behavior, caching across mounts, dismiss persistence across navigation, `patchTaskOut` cross-section removal, `patchQualityResolved` quality-only removal, `patchStaleResolved` stale-only removal
- **Optimistic mutation + undo tests:** verify optimistic state, verify undo restores previous state from local mutation layer (not refetch), verify partial failure revert in `mergeDuplicateGroup`
- **`topFinding` utility tests:** priority ordering, tiebreaker by count, tiebreaker by actionability, early return when top-tier data arrives while others are still loading
- **`qualityHeuristic` utility tests:** basic verb detection, length check, splitting word detection. Do NOT overfit to grammar edge cases — test the predictable happy path and a few clear negatives.
- Integration: manual verification with real data against the 4 endpoints

## Out of Scope

- Backend changes to the 4 analysis endpoints
- Vanilla client changes
- Persisting dismissals to backend
- Auto-refreshing tune-up data on a timer
- Project merge (combining two similar projects) — archive only for v1
- The other 4 smart view features (project health, decide next work, friction patterns, today's plan lifecycle)
