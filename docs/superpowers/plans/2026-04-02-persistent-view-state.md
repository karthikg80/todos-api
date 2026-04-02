# Persistent View State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AppShell's ternary view rendering with a ViewRouter that keeps recently visited views mounted (hidden) using an LRU cache, with snapshot-based restoration for evicted views — so scroll position, selected task, and expanded sections survive navigation.

**Architecture:** A `<ViewRouter>` component manages an LRU-3 cache of mounted views. Active view is `display: block`; cached views are `display: none`. A `ViewActivityContext` signals active/inactive state to views so they can pause expensive effects. When a view is evicted from the cache, `useViewSnapshot` captures scroll + UI state for restoration on remount.

**Tech Stack:** React 19, TypeScript, vitest, @testing-library/react

**Spec:** `docs/superpowers/specs/2026-04-02-persistent-view-state-design.md`

**Critical context — current AppShell structure:**
- Lines 781-1273: ternary chain renders one view at a time, fully unmounting previous
- Lines 962-1272: "catch-all" handles all/today/upcoming/completed views + project views with a shared header
- Lines 1277-1298: TaskFullPage + TodoDrawer render OUTSIDE the chain (survive view switches)
- `handleSelectView` (line 495): sets activeView, collapses task nav, clears bulk selection
- `.app-content` has `overflow-y: auto` — this is the scroll container
- 26 useState calls in AppShell; filters/sort are global, drawer/bulk/scroll are view-local

**Key design decision:** The shared header for list views (all/today/upcoming/completed/project) must move INTO those views or be extracted as a shared component that each view renders. ViewRouter wraps entire view subtrees including their headers — it cannot share a header across views since each view is independently mounted/hidden.

---

### Task 1: ViewActivityContext + useViewActivity Hook

**Files:**
- Create: `client-react/src/components/layout/ViewActivityContext.tsx`

- [ ] **Step 1: Create the context and hook**

Create `client-react/src/components/layout/ViewActivityContext.tsx`:
```typescript
import { createContext, useContext } from "react";

interface ViewActivityState {
  isActive: boolean;
}

const ViewActivityContext = createContext<ViewActivityState>({ isActive: true });

export function ViewActivityProvider({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <ViewActivityContext.Provider value={{ isActive }}>
      {children}
    </ViewActivityContext.Provider>
  );
}

/**
 * Returns whether this view is currently active (visible) or cached (hidden).
 * Use to gate expensive effects: polling, timers, observers, animations.
 * Does NOT freeze rendering — views still receive prop updates when inactive.
 */
export function useViewActivity(): ViewActivityState {
  return useContext(ViewActivityContext);
}
```

- [ ] **Step 2: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client-react/src/components/layout/ViewActivityContext.tsx
git commit -m "feat(react): add ViewActivityContext with useViewActivity hook

Provides isActive boolean to views so they can pause expensive
effects when cached/hidden by ViewRouter."
```

---

### Task 2: useViewSnapshot Hook

**Files:**
- Create: `client-react/src/hooks/useViewSnapshot.ts`
- Create: `client-react/src/hooks/useViewSnapshot.test.ts`

- [ ] **Step 1: Create snapshot context and hook**

Create `client-react/src/hooks/useViewSnapshot.ts`:
```typescript
import { createContext, useContext, useEffect, useRef, useCallback } from "react";

interface ViewSnapshotContextValue {
  /** Register a capture function. Called on eviction. */
  registerCapture: (capture: () => unknown) => void;
  /** Snapshot to restore from (if this view was evicted and remounted). Null if first mount. */
  snapshot: unknown | null;
}

export const ViewSnapshotContext = createContext<ViewSnapshotContextValue>({
  registerCapture: () => {},
  snapshot: null,
});

interface UseViewSnapshotOptions<T> {
  /** Called on eviction. Must read from refs to avoid stale closures. Return a plain serializable object. */
  capture: () => T;
  /** Called once after remount if a snapshot exists. Restore state first, scroll second. */
  restore: (snapshot: T) => void;
  /** Schema version. Mismatched versions cause snapshot discard. */
  version: number;
}

interface VersionedSnapshot<T> {
  _v: number;
  data: T;
}

export function useViewSnapshot<T>(options: UseViewSnapshotOptions<T>) {
  const { registerCapture, snapshot } = useContext(ViewSnapshotContext);
  const captureRef = useRef(options.capture);
  const restoreRef = useRef(options.restore);
  const versionRef = useRef(options.version);
  const restoredRef = useRef(false);

  // Keep refs current
  captureRef.current = options.capture;
  restoreRef.current = options.restore;
  versionRef.current = options.version;

  // Register capture with ViewRouter
  useEffect(() => {
    registerCapture(() => {
      const data = captureRef.current();
      return { _v: versionRef.current, data } as VersionedSnapshot<T>;
    });
  }, [registerCapture]);

  // Restore once after mount (if snapshot exists and version matches)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (snapshot == null) return;
    const versioned = snapshot as VersionedSnapshot<T>;
    if (typeof versioned._v !== "number" || versioned._v !== versionRef.current) return;
    try {
      restoreRef.current(versioned.data);
    } catch {
      // Best-effort: silently skip invalid snapshots
    }
  }, []); // Mount-scoped: runs once
}
```

- [ ] **Step 2: Write tests**

Create `client-react/src/hooks/useViewSnapshot.test.ts`:
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { useViewSnapshot, ViewSnapshotContext } from "./useViewSnapshot";

function makeWrapper(registerCapture: (fn: () => unknown) => void, snapshot: unknown | null) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(ViewSnapshotContext.Provider, { value: { registerCapture, snapshot } }, children);
}

describe("useViewSnapshot", () => {
  it("registers capture callback on mount", () => {
    const register = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({ x: 1 }), restore: () => {}, version: 1 }),
      { wrapper: makeWrapper(register, null) },
    );
    expect(register).toHaveBeenCalledTimes(1);
    const captureWrapped = register.mock.calls[0][0];
    expect(captureWrapped()).toEqual({ _v: 1, data: { x: 1 } });
  });

  it("calls restore once with matching version snapshot", () => {
    const restore = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 2 }),
      { wrapper: makeWrapper(() => {}, { _v: 2, data: { scrollTop: 100 } }) },
    );
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith({ scrollTop: 100 });
  });

  it("skips restore on version mismatch", () => {
    const restore = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 3 }),
      { wrapper: makeWrapper(() => {}, { _v: 2, data: { scrollTop: 100 } }) },
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it("skips restore when snapshot is null", () => {
    const restore = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 1 }),
      { wrapper: makeWrapper(() => {}, null) },
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it("does not call restore on re-render", () => {
    const restore = vi.fn();
    const { rerender } = renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 1 }),
      { wrapper: makeWrapper(() => {}, { _v: 1, data: { x: 1 } }) },
    );
    rerender();
    rerender();
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd client-react && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/hooks/useViewSnapshot.ts client-react/src/hooks/useViewSnapshot.test.ts
git commit -m "feat(react): add useViewSnapshot hook for eviction-safe state restoration

Versioned snapshots with mount-scoped restore. Capture reads from
refs to avoid stale closures. Silent discard on version mismatch."
```

---

### Task 3: ViewRouter + ViewRoute Components + Tests

**Files:**
- Create: `client-react/src/components/layout/ViewRouter.tsx`
- Create: `client-react/src/components/layout/ViewRouter.test.tsx`

This is the core component. It manages the LRU cache, mount/hide/evict lifecycle, and provides activity + snapshot context to each view.

- [ ] **Step 1: Create ViewRouter and ViewRoute**

Create `client-react/src/components/layout/ViewRouter.tsx`:
```typescript
import {
  useState,
  useRef,
  useCallback,
  useMemo,
  type ReactElement,
  Children,
  isValidElement,
} from "react";
import { ViewActivityProvider } from "./ViewActivityContext";
import { ViewSnapshotContext } from "../../hooks/useViewSnapshot";

// Module-level snapshot store — survives view eviction
const snapshotStore = new Map<string, unknown>();

/** Clear all snapshots. Call on logout/workspace change. */
export function clearSnapshotStore() {
  snapshotStore.clear();
}

/** Delete a specific snapshot (e.g., on project delete). */
export function deleteSnapshot(viewKey: string) {
  snapshotStore.delete(viewKey);
}

// --- ViewRoute: thin child marker ---

interface ViewRouteProps {
  viewKey: string;
  children: React.ReactNode;
}

export function ViewRoute({ children }: ViewRouteProps) {
  // ViewRoute is a marker component. ViewRouter reads its props directly.
  // It just renders children when ViewRouter decides to mount it.
  return <>{children}</>;
}

// --- ViewRouter ---

interface ViewRouterProps {
  activeViewKey: string;
  capacity?: number;
  children: React.ReactNode;
}

interface CachedView {
  key: string;
  element: ReactElement;
}

export function ViewRouter({ activeViewKey, capacity = 3, children }: ViewRouterProps) {
  // Extract ViewRoute children
  const routes = useMemo(() => {
    const map = new Map<string, ReactElement>();
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === ViewRoute) {
        const key = (child.props as ViewRouteProps).viewKey;
        map.set(key, child);
      }
    });
    return map;
  }, [children]);

  // LRU cache: ordered list of cached view keys (most recent first)
  const [lru, setLru] = useState<string[]>([]);
  const captureRegistryRef = useRef<Map<string, () => unknown>>(new Map());

  // Update LRU on activeViewKey change
  const currentLru = useMemo(() => {
    const next = [activeViewKey, ...lru.filter((k) => k !== activeViewKey)];
    return next.slice(0, capacity);
  }, [activeViewKey, lru, capacity]);

  // Detect evictions
  const prevLruRef = useRef<string[]>([]);
  const evictedKeys = prevLruRef.current.filter((k) => !currentLru.includes(k));
  if (evictedKeys.length > 0) {
    for (const key of evictedKeys) {
      // Capture snapshot before eviction
      const capture = captureRegistryRef.current.get(key);
      if (capture) {
        try {
          snapshotStore.set(key, capture());
        } catch {
          // Best-effort
        }
        captureRegistryRef.current.delete(key);
      }
    }
  }
  prevLruRef.current = currentLru;

  // Sync LRU state (deferred to avoid render-loop)
  if (lru.join(",") !== currentLru.join(",")) {
    setLru(currentLru);
  }

  // Build snapshot context for each cached view
  const makeSnapshotCtx = useCallback(
    (viewKey: string) => ({
      registerCapture: (capture: () => unknown) => {
        captureRegistryRef.current.set(viewKey, capture);
      },
      snapshot: snapshotStore.get(viewKey) ?? null,
    }),
    [],
  );

  return (
    <>
      {currentLru.map((viewKey) => {
        const route = routes.get(viewKey);
        if (!route) return null;
        const isActive = viewKey === activeViewKey;
        return (
          <div
            key={viewKey}
            className="view-router__slot"
            style={{ display: isActive ? "block" : "none" }}
            data-view-key={viewKey}
          >
            <ViewActivityProvider isActive={isActive}>
              <ViewSnapshotContext.Provider value={makeSnapshotCtx(viewKey)}>
                {route}
              </ViewSnapshotContext.Provider>
            </ViewActivityProvider>
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Write tests**

Create `client-react/src/components/layout/ViewRouter.test.tsx`:
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import { ViewRouter, ViewRoute } from "./ViewRouter";
import { useViewActivity } from "./ViewActivityContext";

function ActivitySpy({ id, onActivity }: { id: string; onActivity: (id: string, active: boolean) => void }) {
  const { isActive } = useViewActivity();
  onActivity(id, isActive);
  return <div data-testid={`view-${id}`}>{id}: {isActive ? "active" : "inactive"}</div>;
}

function TestHarness({ capacity = 3 }: { capacity?: number }) {
  const [active, setActive] = useState("a");
  const activityLog: Record<string, boolean> = {};
  const onActivity = (id: string, a: boolean) => { activityLog[id] = a; };
  return (
    <div>
      <button data-testid="goto-a" onClick={() => setActive("a")}>A</button>
      <button data-testid="goto-b" onClick={() => setActive("b")}>B</button>
      <button data-testid="goto-c" onClick={() => setActive("c")}>C</button>
      <button data-testid="goto-d" onClick={() => setActive("d")}>D</button>
      <ViewRouter activeViewKey={active} capacity={capacity}>
        <ViewRoute viewKey="a"><ActivitySpy id="a" onActivity={onActivity} /></ViewRoute>
        <ViewRoute viewKey="b"><ActivitySpy id="b" onActivity={onActivity} /></ViewRoute>
        <ViewRoute viewKey="c"><ActivitySpy id="c" onActivity={onActivity} /></ViewRoute>
        <ViewRoute viewKey="d"><ActivitySpy id="d" onActivity={onActivity} /></ViewRoute>
      </ViewRouter>
    </div>
  );
}

describe("ViewRouter", () => {
  it("renders only the active view initially", () => {
    const { queryByTestId } = render(<TestHarness />);
    expect(queryByTestId("view-a")).toBeTruthy();
    expect(queryByTestId("view-b")).toBeNull();
  });

  it("keeps previous view mounted when switching", () => {
    const { queryByTestId, getByTestId } = render(<TestHarness />);
    act(() => getByTestId("goto-b").click());
    expect(queryByTestId("view-a")).toBeTruthy();
    expect(queryByTestId("view-b")).toBeTruthy();
  });

  it("hides inactive view with display:none", () => {
    const { getByTestId } = render(<TestHarness />);
    act(() => getByTestId("goto-b").click());
    const slotA = getByTestId("view-a").closest(".view-router__slot") as HTMLElement;
    expect(slotA.style.display).toBe("none");
    const slotB = getByTestId("view-b").closest(".view-router__slot") as HTMLElement;
    expect(slotB.style.display).toBe("block");
  });

  it("evicts oldest view when exceeding capacity", () => {
    const { queryByTestId, getByTestId } = render(<TestHarness capacity={2} />);
    act(() => getByTestId("goto-b").click());
    act(() => getByTestId("goto-c").click());
    // Capacity 2: 'a' should be evicted
    expect(queryByTestId("view-a")).toBeNull();
    expect(queryByTestId("view-b")).toBeTruthy();
    expect(queryByTestId("view-c")).toBeTruthy();
  });

  it("re-activation moves view to front of LRU", () => {
    const { queryByTestId, getByTestId } = render(<TestHarness capacity={2} />);
    act(() => getByTestId("goto-b").click());
    // LRU: [b, a]
    act(() => getByTestId("goto-a").click());
    // LRU: [a, b] — a moved to front
    act(() => getByTestId("goto-c").click());
    // LRU: [c, a] — b evicted (oldest), a survives
    expect(queryByTestId("view-a")).toBeTruthy();
    expect(queryByTestId("view-b")).toBeNull();
    expect(queryByTestId("view-c")).toBeTruthy();
  });

  it("provides isActive=true to active view and isActive=false to cached", () => {
    const log: Record<string, boolean> = {};
    const spy = (id: string, active: boolean) => { log[id] = active; };
    const { getByTestId } = render(
      <div>
        <ViewRouter activeViewKey="a" capacity={3}>
          <ViewRoute viewKey="a"><ActivitySpy id="a" onActivity={spy} /></ViewRoute>
          <ViewRoute viewKey="b"><ActivitySpy id="b" onActivity={spy} /></ViewRoute>
        </ViewRouter>
      </div>
    );
    // Only 'a' is mounted initially
    expect(log["a"]).toBe(true);
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
git add client-react/src/components/layout/ViewRouter.tsx client-react/src/components/layout/ViewRouter.test.tsx
git commit -m "feat(react): add ViewRouter with LRU-3 cache and eviction snapshots

Keeps recently visited views mounted (display:none) for instant return.
Evicted views snapshot state to module-level store. ViewActivityProvider
signals active/inactive. ViewSnapshotContext provides capture/restore."
```

---

### Task 4: Extract Shared List Header Component

**Files:**
- Create: `client-react/src/components/layout/ListViewHeader.tsx`

**Why:** The current catch-all view (lines 962-1272) has a shared desktop/mobile header used by all/today/upcoming/completed/project views. With ViewRouter, each view must include its own header since views are independently mounted. Rather than duplicating the header in each view, extract it as a shared component.

- [ ] **Step 1: Read the current header structure**

Read AppShell.tsx lines 962-1230 to understand the full desktop + mobile header. The implementer must extract this into a standalone `<ListViewHeader>` component that accepts the necessary props.

The header renders:
- Mobile: menu button, title, new task/dark toggle/logout buttons
- Desktop: breadcrumb, task count, filters button, view toggle (list/board), sort control, new task, export, dark toggle, logout
- Below header: verification banner, tag filter bar, today coaching banner, filter panel, bulk toolbar, quick entry, project headings, mobile search

- [ ] **Step 2: Create ListViewHeader**

Create `client-react/src/components/layout/ListViewHeader.tsx` that renders the entire header + toolbar area. Props should include everything the header needs from AppShell:

```typescript
interface ListViewHeaderProps {
  // Identity
  headerTitle: string;
  activeView: string;
  selectedProjectId: string | null;
  projectName?: string;
  isMobile: boolean;

  // Counts
  activeCount: number;

  // Filters
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
  activeTagFilter: string;
  onClearTagFilter: () => void;

  // Sort + view mode
  viewMode: "list" | "board";
  onViewModeChange: (mode: "list" | "board") => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;

  // Actions
  onOpenNav: () => void;
  onNewTask: () => void;
  onToggleDark: () => void;
  onLogout: () => void;

  // Bulk
  bulkMode: boolean;
  selectedCount: number;
  onBulkAction: (action: string) => void;
  onExitBulk: () => void;

  // Quick entry
  uiMode: string;
  onAddTodo: (dto: CreateTodoDto) => void;
  quickEntryPlaceholder: string;

  // Project headings
  activeHeadingId: string | null;
  onSelectHeading: (id: string | null) => void;

  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;

  // Misc
  user: User | null;
  dark: boolean;
  overdueCount?: number;
}
```

The implementer should move the JSX from AppShell lines ~964-1226 into this component. The component returns a `<>` fragment containing all the header/toolbar elements.

- [ ] **Step 3: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/components/layout/ListViewHeader.tsx
git commit -m "refactor(react): extract ListViewHeader from AppShell catch-all header

Shared header for all/today/upcoming/completed/project views.
Includes desktop header, mobile header, filter panel, bulk toolbar,
quick entry, and project headings."
```

---

### Task 5: Refactor AppShell to Use ViewRouter

**Files:**
- Modify: `client-react/src/components/layout/AppShell.tsx`
- Modify: `client-react/src/styles/app.css`

This is the critical integration task. Replace the ternary chain with ViewRouter.

- [ ] **Step 1: Read the current AppShell thoroughly**

Read the full file to understand all the wiring. The implementer must understand:
- Which views go into ViewRouter (workspace views)
- Which views stay as direct conditionals (page-level views: settings, ai, admin, feedback, review)
- How `activeViewKey` is computed from `activeView` + `selectedProjectId`
- What props each view needs

- [ ] **Step 2: Compute activeViewKey**

Add to AppShell:
```typescript
const activeViewKey = selectedProjectId
  ? `project:${selectedProjectId}`
  : activeView;
```

- [ ] **Step 3: Replace workspace view ternary with ViewRouter**

Replace the workspace view section (after page-level checks) with:
```tsx
<ViewRouter activeViewKey={activeViewKey} capacity={3}>
  <ViewRoute viewKey="home">
    {/* HomeDashboard with its own headers */}
    {isMobile && <MobileHeader title="Focus" ... />}
    {!isMobile && <DesktopHomeHeader ... />}
    <div className="app-content">
      <HomeDashboard {...homeProps} />
    </div>
  </ViewRoute>

  <ViewRoute viewKey="triage">
    {isMobile && <MobileHeader title="Desk" ... />}
    <div className="app-content">
      <DeskView {...deskProps} />
    </div>
  </ViewRoute>

  <ViewRoute viewKey="tuneup">
    <div className="app-content">
      <TuneUpView {...tuneUpProps} />
    </div>
  </ViewRoute>

  {/* List views with shared header */}
  {["all", "today", "upcoming", "completed"].map((view) => (
    <ViewRoute key={view} viewKey={view}>
      <ListViewHeader {...headerPropsFor(view)} />
      <div className="app-content">
        {viewMode === "board" ? <BoardView ... /> : <SortableTodoList ... />}
      </div>
    </ViewRoute>
  ))}

  {/* Dynamic project view */}
  {selectedProjectId && (
    <ViewRoute viewKey={`project:${selectedProjectId}`}>
      <ListViewHeader {...headerPropsFor("project")} />
      <div className="app-content">
        {viewMode === "board" ? <BoardView ... /> : <SortableTodoList ... />}
      </div>
    </ViewRoute>
  )}
</ViewRouter>
```

**IMPORTANT:** The implementer must carefully move all props, callbacks, and conditional rendering from the current ternary chain into the ViewRouter children. This is the largest single step.

The page-level views (settings, ai, admin, feedback, review) REMAIN as direct conditionals above ViewRouter — they are not cached.

TaskFullPage and TodoDrawer REMAIN outside ViewRouter at the bottom of the render tree — they are overlay components.

- [ ] **Step 4: Add CSS for view-router__slot**

Append to `client-react/src/styles/app.css`:
```css
/* === ViewRouter === */
.view-router__slot {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.view-router__slot[style*="display: none"] {
  /* Hidden views should not contribute to layout */
  position: absolute;
  visibility: hidden;
  pointer-events: none;
}
```

Note: Using both `display: none` (via inline style) and `visibility: hidden` + `position: absolute` as a belt-and-suspenders approach. The inline `display: none` is primary; the CSS class handles edge cases where the inline style might be overridden.

- [ ] **Step 5: Verify build**

Run: `cd client-react && npm run build`
Expected: No type errors.

- [ ] **Step 6: Run tests**

Run: `cd client-react && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add client-react/src/components/layout/AppShell.tsx client-react/src/components/layout/ListViewHeader.tsx client-react/src/styles/app.css
git commit -m "refactor(react): replace AppShell ternary chain with ViewRouter

Workspace views now render inside ViewRouter with LRU-3 caching.
Page-level views (settings, ai, admin) remain as direct conditionals.
ListViewHeader shared across list views."
```

---

### Task 6: Integrate useViewActivity into Existing Hooks

**Files:**
- Modify: `client-react/src/hooks/useTuneUp.ts`
- Modify: `client-react/src/hooks/useNextWork.ts`

- [ ] **Step 1: Guard useTuneUp auto-fetch with isActive**

In `client-react/src/hooks/useTuneUp.ts`, the hook currently auto-fetches on mount. Since views now stay mounted when hidden, guard the initial fetch:

The implementer should:
1. Accept an optional `isActive` parameter or have the TuneUpView pass it
2. Guard the `useEffect` that triggers `fetchAll()` with `isActive`
3. When a view becomes active again after being inactive, check if data is stale and re-fetch if needed

Simplest approach: the `TuneUpView` component checks `isActive` before calling `load()` or `refresh()`:
```typescript
const { isActive } = useViewActivity();
useEffect(() => {
  if (isActive && !hook.hasFetched) {
    hook.load();
  }
}, [isActive, hook.hasFetched]);
```

- [ ] **Step 2: Guard useNextWork debounce with isActive**

In `client-react/src/hooks/useNextWork.ts` or the `WhatNextTile` component:
- Clear debounce timer when `!isActive`
- On reactivation, if inputs changed while inactive, restart debounce from scratch

Simplest approach: the `WhatNextTile` checks `isActive` and skips `setInputs` calls when inactive.

- [ ] **Step 3: Verify build + tests**

Run: `cd client-react && npm run build && npx vitest run`
Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/hooks/useTuneUp.ts client-react/src/hooks/useNextWork.ts client-react/src/components/tuneup/TuneUpView.tsx client-react/src/components/home/WhatNextTile.tsx
git commit -m "feat(react): guard useTuneUp and useNextWork with view activity

Pauses auto-fetch and debounce timers when view is cached/hidden.
Resumes on reactivation."
```

---

### Task 7: Add useViewSnapshot to Key Views

**Files:**
- Modify: `client-react/src/components/todos/SortableTodoList.tsx`
- Modify: `client-react/src/components/layout/HomeDashboard.tsx`
- Modify: `client-react/src/components/tuneup/TuneUpView.tsx`
- Modify: `client-react/src/components/desk/DeskView.tsx`

Each view that benefits from snapshot restoration on eviction should integrate `useViewSnapshot`.

- [ ] **Step 1: Add snapshot to SortableTodoList**

The implementer should:
1. Add a ref to the scroll container (`.app-content` parent)
2. Call `useViewSnapshot`:
```typescript
const scrollRef = useRef<HTMLDivElement>(null);
const expandedTodoRef = useRef(expandedTodoId);
expandedTodoRef.current = expandedTodoId;

useViewSnapshot({
  capture: () => ({
    scrollTop: scrollRef.current?.scrollTop ?? 0,
    expandedTodoId: expandedTodoRef.current,
  }),
  restore: (snap) => {
    if (snap.expandedTodoId) {
      // Signal to parent that this task was expanded
      onClick(snap.expandedTodoId);
    }
    if (snap.scrollTop != null && snap.scrollTop > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0, snap.scrollTop);
      });
    }
  },
  version: 1,
});
```

Note: The scroll container ref needs to point to the `.app-content` div that wraps this component. The implementer may need to pass this ref from the parent or use a callback ref pattern.

- [ ] **Step 2: Add snapshot to HomeDashboard**

Snapshot: `scrollTop` + which tiles are expanded (e.g., What Next expanded state).

- [ ] **Step 3: Add snapshot to TuneUpView**

Snapshot: `scrollTop` + collapsed section state.

- [ ] **Step 4: Add snapshot to DeskView**

Snapshot: `scrollTop` + selected capture item ID.

- [ ] **Step 5: Verify build + tests**

Run: `cd client-react && npm run build && npx vitest run`
Expected: Both pass.

- [ ] **Step 6: Commit**

```bash
git add client-react/src/components/todos/SortableTodoList.tsx client-react/src/components/layout/HomeDashboard.tsx client-react/src/components/tuneup/TuneUpView.tsx client-react/src/components/desk/DeskView.tsx
git commit -m "feat(react): add useViewSnapshot to key views for eviction restoration

SortableTodoList: scroll + expandedTodoId
HomeDashboard: scroll + expanded tiles
TuneUpView: scroll + collapsed sections
DeskView: scroll + selectedCaptureId"
```

---

### Task 8: Final Verification

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
- [ ] Navigate Home → Everything → scroll down → back to Home → Home scroll preserved
- [ ] Home → Everything → Today → back to Everything → scroll position preserved (cached)
- [ ] Home → Everything → Today → Upcoming (Home evicted at capacity 3) → back to Home → Home remounts, scroll restored from snapshot
- [ ] Open quick-edit on a task in Everything → switch to Today → back to Everything → quick-edit state preserved (cached view)
- [ ] Project A → Project B → Project C → back to Project A → Project A snapshot restored
- [ ] Tune-up view: expand all, collapse one section → switch away → return → collapsed state preserved
- [ ] Settings page → return to last workspace view → view preserved
- [ ] Task drawer still opens/closes correctly from any cached view
- [ ] Search/filter changes reflected in all cached views (shared state)
- [ ] No visible flash or layout shift when switching between cached views
