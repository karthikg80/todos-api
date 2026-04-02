# Persistent View State — React Client

**Date:** 2026-04-02
**Client:** React (`client-react/`)
**Approach:** Replace AppShell's ternary rendering chain with a `ViewRouter` that keeps recently visited views mounted (hidden via `display: none`) using an LRU cache, with snapshot-based restoration for evicted views.

## Problem

Switching views in the React client fully unmounts the previous view. Scroll position, selected task, expanded sections, and all component-local state are lost. Returning to a view always starts from scratch. This makes the app feel like a collection of separate pages rather than a cohesive workspace.

## Scope

- New `ViewRouter` component replacing the conditional ternary chain in AppShell
- `ViewActivityContext` with `useViewActivity()` hook for inactive view behavior
- `useViewSnapshot()` hook for eviction-safe state restoration
- LRU cache keeping the 3 most recently visited views mounted
- React client only — no backend changes, no vanilla client changes

---

## Design

### 1. ViewRouter — Replacing the Ternary Chain

**What exists:** AppShell.tsx has a ~500-line ternary chain that conditionally renders one view at a time. Switching views fully unmounts the previous view's React tree.

**What we build:** A `<ViewRouter>` component that manages a bounded cache of mounted views.

**Core model:**
- `ViewRouter` receives `activeViewKey` as a prop
- It maintains an ordered list of cached view keys (most recent first)
- All cached views are mounted simultaneously in the DOM
- Only the active view is visible (`display: block`); cached views are hidden (`display: none`)
- Cache capacity: 3. On the 4th unique activation, the least-recently-used view is evicted (unmounted).
- LRU updates on activation, not on mount or prop change — revisiting a cached view moves it to the front

**View keys — composite, encoding full screen identity:**

| View | Key | Notes |
|------|-----|-------|
| Home | `"home"` | Static |
| Desk/Triage | `"triage"` | Static |
| Everything | `"all"` | Filters/sort live in AppShell, not view-local |
| Today | `"today"` | Static |
| Upcoming | `"upcoming"` | Static |
| Completed | `"completed"` | Static |
| Tune-up | `"tuneup"` | Static |
| Project view | `"project:{projectId}"` | Dynamic — each project is a separate cache entry |

The test for key identity: if two visits should restore the same preserved UI state, they share a key. If not, they need different keys.

**What happens on activation:**
1. View already in cache → flip to `display: block`, set `isActive: true` via context. No remount. State and DOM preserved. Minimal re-render (only if props changed while hidden).
2. View evicted but snapshotted → mount fresh, restore from snapshot (see Section 3).
3. View never visited → mount fresh, no snapshot.

**What happens on deactivation:**
- View flips to `display: none`, set `isActive: false` via context.
- React state, DOM, scroll position all preserved automatically.

**What happens on eviction:**
1. Call the view's registered `capture()` function (if any) to snapshot restorable state.
2. Store snapshot in module-level `Map<string, unknown>`.
3. Unmount the React tree.

**Hidden views receive normal prop updates.** They stay logically current — AppShell state changes (todos, projects, filters) flow through as normal React props. Views should not wake up stale after being cached. The better rule: gate expensive effects, not normal React updates. If a view has expensive `useMemo` (grouping, filtering, sorting), consider guarding with `isActive` or hoisting the computation to a shared level.

**Router API surface:**
```tsx
<ViewRouter activeViewKey={activeViewKey} capacity={3}>
  <ViewRoute viewKey="home">
    <HomeDashboard {...homeProps} />
  </ViewRoute>
  <ViewRoute viewKey="triage">
    <DeskView {...deskProps} />
  </ViewRoute>
  <ViewRoute viewKey="tuneup">
    <TuneUpView {...tuneUpProps} />
  </ViewRoute>
  <ViewRoute viewKey="all">
    <SortableTodoList {...listProps} />
  </ViewRoute>
  {/* ...other static views... */}
  {selectedProjectId && (
    <ViewRoute viewKey={`project:${selectedProjectId}`}>
      <SortableTodoList {...projectListProps} />
    </ViewRoute>
  )}
</ViewRouter>
```

`ViewRoute` is a thin wrapper that registers the view key with the router. The router decides which `ViewRoute` children to mount/hide/evict based on `activeViewKey` and the LRU cache.

**AppShell refactor scope:** The ternary chain is replaced by `<ViewRouter>` + `<ViewRoute>` children. AppShell still owns all shared state (todos, projects, search, filters, sort). Views receive props as today. The only change is the rendering mechanism.

**Guarantee:** No remount for cached views. State and DOM preserved. Minimal re-render if props are stable. This is NOT "no render ever" — parent prop changes may still trigger renders in hidden views.

### 2. `useViewActivity` Hook — Inactive Behavior

**Purpose:** Let view components know whether they're active (visible) or cached (hidden), so they can pause expensive work.

**API:**
```typescript
const { isActive } = useViewActivity();
```

**Context provider:** `ViewRouter` wraps each cached view in `<ViewActivityContext.Provider value={{ isActive }}>`.

**Core rule:** `isActive` gates expensive side effects and visibility-dependent work; it does NOT freeze rendering or component updates.

**What MUST stop when inactive:**
- Polling and interval timers
- Debounce-triggered network calls
- Scroll/intersection/resize observers
- Focus side effects
- Animation loops and requestAnimationFrame

**What MAY continue:**
- Ordinary renders from prop changes
- Cheap memo recomputation
- Passive local state retention
- Cheap shared subscriptions needed for freshness

**What MUST NOT happen while inactive:**
- Layout measurement (hidden views have zero dimensions)
- Scroll-linked effects
- Recovery work for missing data or invalid measurements (defer to activation)

**Integration pattern:**
```typescript
const { isActive } = useViewActivity();
useEffect(() => {
  if (!isActive) return;
  const timer = setInterval(doWork, interval);
  return () => clearInterval(timer);
}, [isActive, ...deps]);
```

**Debounce semantics:** When a view becomes inactive mid-debounce, cancel the pending debounce. On reactivation, restart from scratch (do not fire the stale pending call).

**Existing hooks to update:**
- `useTuneUp`: guard the initial `autoFetch` effect and any background re-fetch with `isActive`
- `useNextWork`: clear debounce timer when inactive, restart on reactivation
- Any future hooks with timers/polling should follow the same pattern

**Context value shape:** `{ isActive: boolean }` only. Resist adding lifecycle phases like "visible" / "hidden" / "evicting". A single boolean keeps the contract simple and debuggable.

**Optional ergonomic helper:** If the `isActive` guard pattern appears in many effects, extract a `useActiveEffect(effect, deps)` helper that automatically skips when inactive. Not required for v1, but available as a future optimization.

### 3. `useViewSnapshot` — Eviction-Safe State Restoration

**Purpose:** When a view is evicted from the LRU cache, capture its restorable state. When remounted, restore from the snapshot.

**Contract:**
- `ViewRouter` owns cache lifetime and snapshot storage
- Each view optionally provides a persistence adapter via `useViewSnapshot`
- Restore is partial and best-effort: restore local UI state first, then restore scroll after layout is ready

**API:**
```typescript
useViewSnapshot({
  capture: () => ({
    _v: 1,
    scrollTop: scrollRef.current?.scrollTop ?? 0,
    selectedTaskId: activeTodoId ?? null,
    expandedHeadings: [...expandedSet],
  }),
  restore: (snapshot) => {
    // Phase 1: state restore (runs in useEffect after mount)
    if (snapshot.selectedTaskId) {
      setActiveTodoId(snapshot.selectedTaskId);
    }
    // Phase 2: scroll restore (after layout ready)
    if (snapshot.scrollTop != null && snapshot.scrollTop > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0, snapshot.scrollTop);
      });
    }
  },
});
```

**How it works internally:**
1. `useViewSnapshot` registers the `capture` callback with `ViewRouter` via context
2. **WARNING: `capture()` must always observe current state; stale closures during eviction are a correctness bug.** Read from refs, not render closures. Re-register the callback whenever capture dependencies change.
3. On eviction, `ViewRouter` calls the registered `capture()` and stores the result in a module-level `Map<string, unknown>` keyed by view key
4. On remount, `ViewRouter` provides the stored snapshot via context
5. The view's `restore` callback runs once in `useEffect` after mount — mount-scoped, not re-triggered on unrelated re-renders
6. Once consumed, the snapshot remains in the store as a baseline (available if the view is evicted and remounted again)

**Restore order:**
1. Restore local React state first (selected task, expanded sections)
2. Let the view render with restored state
3. Restore scroll after layout stabilizes (`requestAnimationFrame`, or views with delayed content can defer further)

**Snapshot versioning:** Every snapshot includes `_v: number`. If the stored `_v` doesn't match the current schema version, the snapshot is silently discarded. No migration.

**Snapshot validation:** On restore, validate each field:
- Task IDs that no longer exist → skip silently
- Deleted projects → skip silently
- `scrollTop` of `0` → don't skip (check `!= null`, not truthiness)
- Invalid or corrupt data → discard entire snapshot

**What gets snapshotted per view:**

| View | Snapshot fields |
|------|----------------|
| Everything (SortableTodoList) | `scrollTop`, `expandedTodoId`, `collapsedGroups` |
| Today / Upcoming / Completed | `scrollTop` |
| Home | `scrollTop`, `expandedTileKeys` (e.g., What Next expanded state) |
| Triage (DeskView) | `scrollTop`, `selectedCaptureId` |
| Tune-up | `scrollTop`, `collapsedSections` |
| Project views | `scrollTop`, `expandedTodoId`, `activeHeadingId` |

**What is NOT snapshotted:**
- Fetched data (recomputed from shared state + hooks with module-level caches)
- Loading/error states (transient)
- Bulk selection state (intentionally reset on view switch — deliberate UX, not a loss)
- Drawer/full-page task state (managed by `useTaskNavigation` in AppShell)
- Derived data that can be recomputed

**Snapshot store maintenance:**
- Snapshots are small plain objects with a handful of primitives/arrays
- The snapshot store is intentionally allowed to accumulate for the session (no max-size pruning). The count is bounded by unique view keys visited, which is small in practice (7 static views + a handful of dynamic project keys).
- Explicit deletion when: project deleted, user logs out, workspace changes, shared dataset reset/full re-sync
- Version mismatch → silent discard

**Scroll container:** Standardize on the `.app-content` div as the primary scroll container for all views. Views with nested scroll regions (e.g., individual tiles) restore those independently.

---

## Behavioral Rules

These rules define the contract between ViewRouter, views, and the activity/snapshot systems:

1. **Cache key = full view identity.** If two visits should restore the same UI, they share a key.
2. **Inactive views must pause background work.** `isActive` gates expensive effects, not rendering.
3. **Snapshot restore is partial and best-effort.** Restore state first, scroll second. Invalid state is silently skipped. Views with async or delayed layout may defer scroll restoration until content is ready; `requestAnimationFrame` is the default, not a guarantee.
4. **Hidden views stay logically current.** They receive prop updates normally. Gate derived computation only if it's measurably expensive.
5. **LRU updates on activation only.** Not on mount, not on prop change.
6. **Bulk selection intentionally resets on view switch.** This is a UX decision, not a bug. `handleSelectView` continues to clear bulk state.

---

## Files Affected

| File | Change |
|------|--------|
| `client-react/src/components/layout/ViewRouter.tsx` | New — LRU cache, mount/hide/evict lifecycle |
| `client-react/src/components/layout/ViewActivityContext.tsx` | New — context + `useViewActivity()` hook |
| `client-react/src/hooks/useViewSnapshot.ts` | New — capture/restore adapter for views |
| `client-react/src/components/layout/AppShell.tsx` | Replace ternary chain with `<ViewRouter>`, pass view children |
| `client-react/src/components/layout/HomeDashboard.tsx` | Add `useViewSnapshot` for scroll + expanded tiles |
| `client-react/src/components/todos/SortableTodoList.tsx` | Add `useViewSnapshot` for scroll + expandedTodoId + collapsedGroups |
| `client-react/src/components/tuneup/TuneUpView.tsx` | Add `useViewSnapshot` for scroll + collapsed sections |
| `client-react/src/components/desk/DeskView.tsx` | Add `useViewSnapshot` for scroll + selectedCaptureId |
| `client-react/src/hooks/useTuneUp.ts` | Guard auto-fetch with `isActive` |
| `client-react/src/hooks/useNextWork.ts` | Guard debounce with `isActive` |
| `client-react/src/styles/app.css` | View container display rules |

## Accessibility

- Hidden views use `display: none` which removes them from the accessibility tree — correct behavior, screen readers should not encounter cached views
- Focus management: when activating a view, do not force focus to a specific element unless the user action implies it (e.g., keyboard navigation)
- View transitions do not introduce ARIA live regions or announcements for v1

## Testing Strategy

- **ViewRouter unit tests:** LRU ordering (activation moves to front), eviction fires at capacity, cache key identity, re-activation of cached view skips remount
- **useViewActivity tests:** isActive flips on activation/deactivation, context propagates to nested components
- **useViewSnapshot tests:** capture called on eviction, restore called once after remount, version mismatch discards snapshot, invalid fields skipped
- **Integration:** scroll position preserved when switching between 2 views, scroll restored from snapshot after eviction + remount
- Manual: navigate Home → Everything → Today → Home (should be instant, scroll preserved), then navigate to Upcoming (Home gets evicted), return to Home (should restore from snapshot)

## Performance Notes

- The mounted view set is capped at 3 React trees total (the active view plus up to 2 cached hidden views). This is bounded and acceptable.
- Hidden views still re-render on AppShell state changes. If profiling shows this is expensive, memoize view components or their heavy subtrees.
- Snapshot capture is synchronous and cheap (reads from refs). Eviction is not a performance concern.
- Dynamic project keys can create churn if users visit many projects. The LRU cap handles this — at most 3 project views cached at once.

## Out of Scope

- View transition animations (separate future feature — CSS transitions between active view changes)
- Task lifecycle animations (separate feature — animate tasks on complete/snooze/move)
- View rationalization (product decision about reducing/clarifying overlapping views)
- React Router migration
- URL-based deep linking for views (except existing hash-based task navigation)
- Per-view filter/sort state (currently global in AppShell — could become per-view in a future spec)
