# Tune-Up Smart View — React Client

**Date:** 2026-04-01
**Client:** React (`client-react/`)
**Approach:** Wire existing backend agent endpoints into a new React view with inline actions, plus a summary tile on the Home dashboard.

## Problem

The backend exposes 4 analysis endpoints (duplicate detection, stale items, task quality, taxonomy suggestions) that the vanilla client uses in its Cleanup view. The React client has no equivalent — users have no way to discover or act on codebase-level task hygiene issues.

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
| `/agent/read/find_duplicate_tasks` | `{ exact, normalized, near }` duplicate group arrays | `duplicates` |
| `/agent/read/find_stale_items` | `{ staleTasks, staleProjects }` arrays | `stale` |
| `/agent/read/analyze_task_quality` | Array of `{ taskId, title, issues[] }` | `quality` |
| `/agent/read/taxonomy_cleanup_suggestions` | `{ similarProjects, lowActivityProjects }` | `taxonomy` |

**Hook API:**
```typescript
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
  refresh: () => void;
  refreshSection: (key: TuneUpSection) => void;
  dismiss: (findingKey: string) => void;
  patchTaskOut: (taskId: string) => void;
  patchProjectOut: (projectId: string) => void;
}
```

**Fetching behavior:**
- All 4 fire in parallel via `Promise.allSettled` — one failure doesn't block others
- Results cached in a module-level variable (not React state alone) so the same data is available to both the Home tile and the full view without re-fetching
- `refresh()` clears cache and re-runs all 4
- `refreshSection(key)` re-runs one analysis only

**Cross-section reconciliation:**
When a task is archived, merged, or edited, the hook exposes `patchTaskOut(taskId)` which removes that task ID from ALL sections in the cached data — not just the section where the action happened. This prevents contradictions (e.g., a merged duplicate still showing up as a stale item).

Similarly, `patchProjectOut(projectId)` removes a project from all sections.

These are lightweight local patches, not re-fetches. The raw server data is only re-fetched on explicit `refresh()` or `refreshSection()`.

**Dismissed findings:**
- `dismiss(findingKey)` adds to a `Set<string>` in hook state
- Finding keys must be semantically stable (e.g., `dup:exact:${taskId1}:${taskId2}`, `stale:task:${taskId}`, `quality:${taskId}`) — not array indices
- Dismissals are session-only (not persisted). Re-mounting the hook or calling `refresh()` clears them.
- Counts displayed in the UI reflect visible findings only (after dismissals and optimistic patches), not raw server payload counts.

### 2. Full Tune-Up View

**Navigation:** New sidebar nav item "Tune-up" after "Completed". AppShell gets a new `activeView: "tuneup"` case.

**Layout:** Four collapsible sections, each loading independently:

**2a. Duplicates Section**
- Header: "Duplicates" + visible count badge
- Sub-groups: exact, normalized, near — each group shows task titles side by side
- Inline actions:
  - **Merge:** Calls a `mergeDuplicateGroup(group)` wrapper that archives all but the first task in sequence, with explicit revert logic for partial failure. On success: fade out archived rows, show undo toast. On partial failure: revert optimistic state for failed items, show error for specific failures.
  - **Dismiss:** Session-only, removes group from view

**2b. Stale Items Section**
- Header: "Stale" + visible count badge
- Sub-groups: stale tasks, stale projects
- Each row: title + "last updated X days ago"
- Inline actions:
  - **Archive:** `PUT /todos/:id { archived: true }` — row disappears immediately (removed via `patchTaskOut`)
  - **Snooze 30 days:** `PUT /todos/:id { reviewDate: +30d }` — row disappears from stale section (it no longer qualifies). Does NOT move to bottom — it's resolved.
  - **Open:** Navigates to task drawer

**2c. Quality Issues Section**
- Header: "Quality" + visible count badge
- Each row: task title + issue tags ("missing verb", "vague", "too long", "multi-action")
- Inline actions:
  - **Edit title:** Inline text input, commits on Enter/blur. Guards: reject empty titles, skip no-op edits (trimmed value === original). If the new title resolves all quality issues for that task, the row disappears from the section.
  - **Dismiss:** Session-only

**2d. Taxonomy Section**
- Header: "Taxonomy" + visible count badge
- Sub-groups: similar project names, low-activity projects
- Inline actions:
  - **Archive project:** `PUT /projects/:id { archived: true }` — row disappears via `patchProjectOut`
  - **Dismiss:** Session-only (for similar project suggestions)

**Loading state:** Each section shows a skeleton loader independently. Sections stream in as endpoints respond.

**Empty state:** When a section has zero visible findings (after filtering out dismissed items), show a green checkmark + "All clear" inline. Don't hide the section — users should see it was checked.

**Error state:** Per-section error with "Retry" button. Doesn't affect other sections.

### 3. Home Dashboard Tile

**Tile name:** "Tune-up"

**Loading state:** Shows "Analyzing..." with a subtle pulse animation while any of the 4 endpoints are in flight.

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

**Zero findings:** "All clear — nothing to clean up" with green checkmark + "Last checked just now" freshness hint.

**Error state (all 4 failed):** Compact "Couldn't analyze — Retry" treatment, not blank.

**When to fetch:** Only when Home is the active view. Does not eagerly fetch on app load. If the full Tune-up view was already visited this session, cached data is shown instantly.

Note: If the user lands on the full Tune-up view first (not Home), the view fetches immediately on mount. The Home tile then uses cached data when the user navigates there.

### 4. Inline Action Mechanics

**Optimistic updates:**
All actions update UI immediately before the API call resolves. Undo reverses from the same local mutation layer — no refetch needed for undo.

**Undo pattern:**
Reuse the existing `UndoToast` component. All destructive actions (archive, merge) show undo for 5 seconds. Undo reverses the API call (`PUT /todos/:id { archived: false }` for archive undo, etc.).

**`mergeDuplicateGroup(group)` wrapper:**
A dedicated function (not a sequence of raw archive calls) that:
1. Optimistically removes all but the first task from the UI
2. Fires archive calls for each duplicate in sequence (not parallel — avoids race conditions)
3. On full success: show "Merged N duplicates" toast with undo
4. On partial failure: revert optimistic state for failed items, show error listing which ones failed, keep succeeded ones archived
5. Undo: un-archives all archived items in the group

**Edit title flow:**
- Click "Edit" → inline input appears, pre-filled with current title
- Enter or blur → commit (skip if empty or unchanged)
- `PUT /todos/:id { title: newTitle }`
- If the edit resolves all quality issues for that task (server would need to re-evaluate, but for v1 we use a client-side heuristic: if the new title is ≤80 chars, starts with a verb, and contains no "and"/"then" splitting words, remove the quality finding)
- No undo for edits — the user can just re-edit

**After any action, reconcile:**
- `patchTaskOut(taskId)` removes the task from ALL sections (duplicates, stale, quality)
- Section count badges update immediately from visible (non-dismissed, non-patched) findings
- Home tile re-evaluates top finding from the same patched cache

---

## Files Affected

| File | Change |
|------|--------|
| `client-react/src/hooks/useTuneUp.ts` | New hook — 4 parallel fetches, caching, dismiss, patch |
| `client-react/src/api/tuneup.ts` | New API functions — wrappers for the 4 agent endpoints |
| `client-react/src/components/tuneup/TuneUpView.tsx` | New component — full view with 4 sections |
| `client-react/src/components/tuneup/DuplicatesSection.tsx` | New component — duplicate groups with merge/dismiss |
| `client-react/src/components/tuneup/StaleSection.tsx` | New component — stale items with archive/snooze |
| `client-react/src/components/tuneup/QualitySection.tsx` | New component — quality issues with inline edit |
| `client-react/src/components/tuneup/TaxonomySection.tsx` | New component — project suggestions with archive |
| `client-react/src/components/tuneup/TuneUpTile.tsx` | New component — Home dashboard tile |
| `client-react/src/components/tuneup/SectionHeader.tsx` | New shared component — collapsible header with count |
| `client-react/src/components/layout/AppShell.tsx` | Add "tuneup" to activeView, render TuneUpView |
| `client-react/src/components/layout/HomeDashboard.tsx` | Add TuneUpTile |
| `client-react/src/components/projects/Sidebar.tsx` | Add Tune-up nav item |
| `client-react/src/styles/app.css` | Tune-up view styles, section styles, action button styles |

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

## Testing Strategy

- Unit tests for `useTuneUp` hook: fetch behavior, caching, dismiss, patchTaskOut cross-section reconciliation
- Unit tests for top-finding priority selection logic
- Unit tests for quality issue client-side heuristic (verb detection, length check)
- Integration: manual verification with real data against the 4 endpoints

## Out of Scope

- Backend changes to the 4 analysis endpoints
- Vanilla client changes
- Persisting dismissals to backend
- Auto-refreshing tune-up data on a timer
- Project merge (combining two similar projects) — archive only for v1
- The other 4 smart view features (project health, decide next work, friction patterns, today's plan lifecycle)
