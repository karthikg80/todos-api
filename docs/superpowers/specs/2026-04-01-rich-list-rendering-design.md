# Rich List Rendering — Everything View

**Date:** 2026-04-01
**Client:** React (`client-react/`)
**Approach:** Layered Enhancement — extend existing rendering pipeline, no rewrite

## Problem

The Everything view renders tasks as a flat list with no grouping, a single fixed density, and minimal visual differentiation. It reads like a database table, not a productivity tool. Users can't scan for urgency, group by mental model, or control information density.

## Scope

This spec covers the Everything view in the React client only. Other views (Today, Upcoming, project views) and the vanilla client are out of scope. The design is intentionally contained — each of the four sections ships independently.

## Design

### 1. Switchable Group By

**UI:** A dropdown in the list toolbar, next to the existing `SortControl`.

**Options:**

| Group By | Section Headers |
|----------|----------------|
| None (default) | Current flat list behavior |
| Project | Category name with task count |
| Status | Next → In Progress → Waiting → Scheduled → Someday → Inbox |
| Priority | High → Medium → Low → None |
| Due Date | Overdue → Today → This Week → Next Week → Later → No Date |

**Behavior:**
- Each group section is collapsible (click header to toggle)
- Collapsed state persists in `localStorage` (key: `todos:collapsed-groups`)
- Empty groups are hidden
- Group header shows: chevron + section name (uppercase) + item count badge
- Drag-and-drop reordering works within groups only — each group gets its own `SortableContext`
- User's selected grouping persists in `localStorage` (key: `todos:group-by`)

**Implementation:**
- New `useGroupBy` hook — mirrors `useDensity` pattern (localStorage-persisted state + setter)
- Pure function `groupTodos(todos: Todo[], groupBy: GroupBy): { key: string; label: string; todos: Todo[] }[]` — lives in a new `utils/groupTodos.ts`
- `SortableTodoList` renders group headers between `SortableContext` sections when `groupBy !== "none"`
- New `GroupHeader` component: chevron, label, count badge, collapse toggle

### 2. Functional Density Modes

**What exists:** `useDensity` hook with `compact | normal | spacious`, sets `data-density` on `<html>`, persists to localStorage. Settings page has a cycle button. But the CSS and JSX don't respond to it yet.

**What we add:** Make density control what's visible on each `TodoRow`.

| Mode | What's Visible | Approx Row Height |
|------|---------------|-------------------|
| Compact | Checkbox + title + priority color dot only. No chips, no inline actions on idle. | ~32px |
| Normal (default) | Title + chips (due, priority, category, up to 3 tags) + inline hover actions | ~44px |
| Spacious | Title, description preview, all chips (no limit), subtask count with mini progress bar, notes indicator | ~72px |

**Implementation:**
- CSS-driven for compact/normal: `[data-density="compact"] .todo-chips { display: none }` etc. No re-render.
- `TodoRow` receives density context (via `useDensity` or `data-density` attribute check) and conditionally renders extra content in spacious mode: description preview, subtask progress bar, notes indicator.
- Density toggle in toolbar: three icon buttons (compact/normal/spacious) in a pill group, next to the Group By dropdown. Clicking cycles or direct-selects.

### 3. Visual Status Indicators

Three layers of scan-friendly visual cues on `TodoRow`:

**Priority left border:**
- 3px left border on `.todo-item`:
  - `high` → `var(--error)` (red)
  - `medium` → `var(--warning)` (amber)
  - `low` / none → `transparent`
- Visible at all density levels — even compact mode communicates priority

**Overdue glow:**
- Tasks with overdue `dueDate` get a subtle red-tinted background: `rgba(var(--error-rgb), 0.05)`
- Respects `prefers-reduced-motion` — no animation, just a static tint
- Stacks with priority border

**Subtask progress indicator (spacious mode only):**
- Inline `<progress>` element next to subtask count text: `3/5 ████░░`
- Pure CSS styling, no JS animation
- Only renders when `todo.subtasks?.length > 0` (requires subtask data in the Todo type — check if already present)

**What we're NOT adding:**
- No status badges per row (the Group By status view handles this)
- No completion streak indicators (separate "progress & momentum" feature)
- No full-row background coloring (too noisy — left border is enough)

### 4. Smarter Chip Layout

**Current state:** `TodoRow` renders chips in fixed order: due date → priority → category → tags (max 3). No chip limit enforcement beyond tags.

**New priority-based chip ordering:**
1. Overdue due date (most urgent signal)
2. Status chip — only for non-obvious states: `waiting`, `scheduled`, `blocked`
3. Priority chip — only `medium` and `high` (low is noise)
4. Due date (if not overdue)
5. Category/project
6. Tags

**Density-aware chip limits:**

| Density | Max Chips |
|---------|-----------|
| Compact | 0 (hidden) |
| Normal | 4 + overflow `+N` pill |
| Spacious | Unlimited |

**New chip types not currently rendered:**
- **Blocked:** `🔒 Blocked by N` — when `todo.dependsOnTaskIds?.length > 0` and not completed
- **Waiting-on:** `⏳ @person` — when `todo.waitingOn` is set
- **Subtask count (normal mode):** `☑ 3/5` — compact indicator when spacious mode's full progress bar isn't shown

**What we're NOT doing:**
- No emoji in standard chips — use color and subtle styling instead (calm/professional aesthetic)
- No animated chips
- No additional chip click handlers (tags already have `onTagClick`)

## Files Affected

| File | Change |
|------|--------|
| `client-react/src/hooks/useGroupBy.ts` | New hook — localStorage-persisted group-by state |
| `client-react/src/utils/groupTodos.ts` | New pure function — groups todos by key |
| `client-react/src/components/todos/GroupHeader.tsx` | New component — collapsible section header |
| `client-react/src/components/todos/SortableTodoList.tsx` | Render group headers, per-group `SortableContext` |
| `client-react/src/components/todos/TodoRow.tsx` | Priority border, overdue tint, density-aware chip rendering, new chip types, spacious mode extras |
| `client-react/src/components/layout/AppShell.tsx` | Add GroupBy dropdown + density toggle to toolbar |
| `client-react/src/styles/app.css` | Density-driven show/hide rules (`[data-density]` selectors), priority border classes, overdue tint, chip color variants, group header styles |

## Data Dependencies

All required data fields already exist on the `Todo` type:
- `priority`, `status`, `category`, `dueDate`, `tags` — already used in `TodoRow`
- `dependsOnTaskIds` — exists on `Todo` type, not currently rendered in React
- `waitingOn` — exists on `Todo` type, not currently rendered in React
- `subtasks` — already on the `Todo` type as `subtasks?: Subtask[]` (optional, may be undefined if not fetched — guard with `todo.subtasks?.length`)

## Testing Strategy

- Unit tests for `groupTodos()` — pure function, easy to test all grouping modes + edge cases (empty groups, missing fields)
- Unit tests for chip ordering logic
- Visual regression via existing Playwright UI tests — verify no regressions on existing list behavior
- Manual verification of density modes, group collapse, and drag-drop within groups

## Out of Scope

- Applying rich rendering to other views (Today, Upcoming, project views)
- Vanilla client (`client/`) changes
- Board view enhancements
- Progress/momentum features (streaks, burndown)
- Smart/computed views (blocked chains, neglected projects)
- Virtual scrolling / performance optimization for very large lists
