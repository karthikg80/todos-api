# Rich List Rendering — Everything View

**Date:** 2026-04-01
**Client:** React (`client-react/`)
**Approach:** Layered Enhancement — extend existing rendering pipeline, no rewrite

## Problem

The Everything view renders tasks as a flat list with no grouping, a single fixed density, and minimal visual differentiation. It reads like a database table, not a productivity tool. Users can't scan for urgency, group by mental model, or control information density.

## Scope

This spec covers the Everything view in the React client only. Other views (Today, Upcoming, project views) and the vanilla client are out of scope. The design is intentionally contained — each of the four sections ships independently.

## Terminology

The backend field `category` represents the project/category a task belongs to. In the UI, we display this as "Project" to match user mental models. This spec uses "category" when referring to the data field and "project" when referring to the UI label.

---

## Design

### 1. Switchable Group By

**UI:** A `<GroupByControl>` dropdown rendered inside `SortableTodoList` (not `AppShell`), since this control is specific to the Everything list view. It sits in a local toolbar row above the task list, alongside the existing `SortControl` and view-mode toggle which should also move down from `AppShell` into the list container.

**Options:**

| Group By | Section Headers | Stable Key |
|----------|----------------|------------|
| None (default) | Current flat list behavior | — |
| Project | Category display name, task count | `projectId` field value (UUID, stable across renames). Falls back to `category` string only if `projectId` is null. |
| Status | Ordered: next → in_progress → waiting → scheduled → someday → inbox | `TaskStatus` enum value |
| Priority | Ordered: urgent → high → medium → low → (none) | `Priority` enum value or `"none"` |
| Due Date | Ordered: overdue → today → this-week → next-week → later → no-date | Bucket key (see below) |

**Status group order:** Matches the canonical `TaskStatus` type: `inbox | next | in_progress | waiting | scheduled | someday | done | cancelled`. The Everything view excludes `done` and `cancelled` by default (they're filtered out before grouping). Display order for active statuses: next → in_progress → waiting → scheduled → someday → inbox (inbox last since it represents unsorted items).

**Note on "blocked":** There is no `blocked` status in the `TaskStatus` enum. "Blocked" is a derived display state computed from `dependsOnTaskIds.length > 0` on an incomplete task. It appears only as a chip indicator, not as a group.

**Due date bucket definitions (calendar-based, user's local timezone):**

| Bucket | Rule |
|--------|------|
| Overdue | `dueDate` < start of today (local) |
| Today | `dueDate` falls on today (local) |
| This Week | `dueDate` > today AND <= end of current calendar week. Week starts Monday (ISO 8601). |
| Next Week | `dueDate` falls within next calendar week (Monday–Sunday, ISO 8601). |
| Later | `dueDate` > end of next calendar week |
| No Date | `dueDate` is null/undefined |

All comparisons use date-only (ignore time component of `dueDate`). Tasks with `scheduledDate` but no `dueDate` fall into "No Date" — scheduled date is not a due date substitute for this grouping.

**Collapse behavior:**
- Default collapsed state is expanded (all groups open)
- Collapsed state persists in `localStorage` (key: `todos:collapsed-groups`)
- Storage format: `Record<string, string[]>` — keyed by grouping mode, values are arrays of collapsed stable group keys. Example: `{ "status": ["someday", "inbox"], "priority": ["none"] }`
- Changing group mode does not inherit collapse state from another mode
- Collapsed groups do not render their child rows (DOM not mounted, not just hidden)

**Drag-and-drop ordering:**
- `groupBy: "none"` — current ordering semantics unchanged (global manual order)
- `groupBy: "project"` — drag reorder within each project group. Persisted as today using the underlying `order` field.
- `groupBy: "status" | "priority" | "dueDate"` — **drag reorder disabled in v1**. These are derived groups where the membership is determined by task properties, not user arrangement. Enabling reorder here creates confusing persistence semantics (what does "order" mean within a priority group?). The sort control still works within derived groups.

Rationale: disabling drag for derived groups avoids subtle ordering bugs. If users want manual arrangement, they use `groupBy: none` or `groupBy: project`.

**Implementation:**
- New `useGroupBy` hook — mirrors `useDensity` pattern (localStorage-persisted state + setter). Defensive parsing: unknown values fall back to `"none"`.
- Pure function `groupTodos(todos: Todo[], groupBy: GroupBy): GroupedSection[]` in `utils/groupTodos.ts`. Returns `{ key: string; label: string; todos: Todo[] }[]`. Must be memoized at the list boundary (`useMemo` with `[todos, groupBy]` deps).
- `SortableTodoList` renders `GroupHeader` + per-group `SortableContext` when `groupBy !== "none"`. When groupBy is a derived mode, `SortableContext` is replaced with a plain `div` (no drag handles rendered).
- New `GroupHeader` component: `<button>` with `aria-expanded`, chevron, label, count badge. Count badge is excluded from accessible name (decorative).

### 2. Functional Density Modes

**What exists:** `useDensity` hook with `compact | normal | spacious`, sets `data-density` on `<html>`, persists to localStorage. Settings page has a cycle button. The CSS and JSX don't respond to it yet.

**What we add:** Make density control what's visible on each `TodoRow`.

| Mode | What's Visible | Approx Row Height |
|------|---------------|-------------------|
| Compact | Checkbox + title + priority left border. No chips, no inline actions on idle. | ~32px |
| Normal (default) | Title + selected chips (max 4) + inline hover actions | ~44px |
| Spacious | Title, description preview, all chips (no limit), subtask progress bar, notes indicator | ~72px |

**Note on compact mode:** The priority left border (from Section 3) is the only priority signal in compact mode. No separate priority color dot — the border already communicates this, and adding a dot would be redundant.

**Rendering strategy:**
- **Compact:** Chips are not rendered (JSX not mounted, not CSS-hidden). This keeps DOM weight low for large lists in compact mode.
- **Normal:** Standard chip set rendered (up to limit). Spacious-only elements not mounted.
- **Spacious:** Full chip set + description + subtask progress + notes indicator rendered.

Tradeoff: toggling density causes a re-render because chip mount/unmount changes the DOM. This is acceptable for v1 — density changes are infrequent user actions, not continuous. If performance becomes an issue on very large lists, CSS-only hiding can be reconsidered.

**Density toggle UI:** Three icon buttons in a pill group, rendered in the list-local toolbar (same row as GroupBy and Sort). Each button is direct-select (not cycle). Active button has `aria-pressed="true"`.

### 3. Visual Status Indicators

Three layers of scan-friendly visual cues on `TodoRow`:

**Priority left border:**
- 3px left border on `.todo-item`:
  - `urgent` → `var(--error)` (red, same as high for now — urgent is rare)
  - `high` → `var(--error)` (red)
  - `medium` → `var(--warning)` (amber)
  - `low` / none → `transparent`
- Visible at all density levels

**Overdue tint:**
- Tasks with `dueDate` before today (local) get a subtle red-tinted background: `rgba(var(--error-rgb), 0.05)`
- Static tint only — no animation. Respects `prefers-reduced-motion` by design (nothing to reduce).
- Stacks with priority border
- Note: a medium-priority overdue task will show amber border + red tint. This is intentional — the border communicates priority, the tint communicates urgency. They are separate signals. If visual testing reveals this is too busy, the tint can be reduced to `0.03`.

**Subtask progress indicator (spacious mode only):**
- Div-based progress bar (not `<progress>` — easier to style cross-browser) next to subtask count text: `3 of 5`
- Bar uses `var(--accent)` fill on `var(--bg-tertiary)` background
- Accessible label: `aria-label="3 of 5 subtasks complete"`
- Only renders when `todo.subtasks?.length > 0`

**What we're NOT adding:**
- No status badges per row (the Group By status view handles this)
- No completion streak indicators (separate "progress & momentum" feature)
- No full-row background coloring beyond the overdue tint

### 4. Smarter Chip Layout

**Chip selection algorithm:**

Build candidate chips in this priority order:
1. **Overdue due date** — always first when applicable (`dueDate` < today)
2. **Blocked** — `dependsOnTaskIds?.length > 0` AND not completed. Note: `dependsOnTaskIds` represents informational dependencies in this app. A task with dependencies is displayed as "blocked" but is not prevented from completion. The chip is a visual signal, not a workflow gate.
3. **Waiting-on** — `waitingOn` is set (can co-exist with Blocked if both conditions are true)
4. **Priority** — only `urgent`, `high`, `medium` (low is noise)
5. **Due date** — if not already shown as overdue
6. **Subtask count** (normal mode only) — `☑ 3/5` when subtasks exist
7. **Category/project**
8. **Tags** — last-fill: tags only appear if chip budget allows after higher-priority chips

**Density-aware chip limits:**

| Density | Behavior |
|---------|----------|
| Compact | No chips rendered |
| Normal | Show first 4 candidates from the ordered list above. If more candidates exist, show `+N` overflow pill. Tags are last-fill — they only get slots remaining after items 1–7. |
| Spacious | All candidates rendered, no limit |

**Truncation example:**
A task with: overdue + blocked + high priority + due date + project + 3 tags
→ Normal mode shows: `overdue | blocked | high | due date` + `+4` overflow
→ Spacious mode shows all 8 chips

**Chip styling:**
- Overdue: `background: rgba(error, 0.12); color: var(--error)`
- Blocked: `background: rgba(error, 0.08); color: var(--error)`
- Waiting-on: `background: rgba(accent, 0.1); color: var(--accent)`
- Priority high/urgent: `background: rgba(error, 0.1); color: var(--error)`
- Priority medium: `background: rgba(warning, 0.1); color: var(--warning)`
- Due date, project, subtask count, tags: `background: var(--bg-tertiary); color: var(--text-secondary)`

**Implementation:** Extract chip derivation into a pure helper `buildChips(todo: Todo, density: Density): ChipData[]` in `utils/buildChips.ts`. This function handles ordering, filtering, and truncation.

---

## Toolbar Ownership

The existing view-toggle (list/board) and `SortControl` currently live in `AppShell.tsx`. Since grouping, density, and sort are all specific to the list view within the Everything context, these controls should move into the `SortableTodoList` component (or a new `ListToolbar` wrapper).

This avoids:
- AppShell needing view-specific conditional toolbar logic
- Controls appearing in views where they don't apply (Home, Triage, etc.)
- Prop drilling group-by and density state through AppShell

The view-mode toggle (list/board) can stay in AppShell since it applies at a higher level.

## State Ownership

Both `useGroupBy` and `useDensity` are self-contained hooks that own their own localStorage persistence. They are called directly inside `ListToolbar` (for the UI controls) and `SortableTodoList` (for rendering logic). No props from a common parent are needed — both hooks read from the same localStorage key and return the same value regardless of where they're called. This is the same pattern `useDensity` already uses today (called in both `AppShell` and `SettingsPage`).

Summary:
- `useGroupBy()` — called in `ListToolbar` (dropdown) and `SortableTodoList` (grouping logic)
- `useDensity()` — called in `ListToolbar` (toggle buttons) and `TodoRow` (conditional rendering)
- No prop drilling or context provider needed for v1

---

## Files Affected

| File | Change |
|------|--------|
| `client-react/src/hooks/useGroupBy.ts` | New hook — localStorage-persisted group-by state with defensive fallback |
| `client-react/src/utils/groupTodos.ts` | New pure function — groups todos by key, memoized at call site |
| `client-react/src/utils/buildChips.ts` | New pure function — chip ordering, filtering, truncation |
| `client-react/src/components/todos/GroupHeader.tsx` | New component — collapsible section header with a11y |
| `client-react/src/components/todos/ListToolbar.tsx` | New component — contains GroupBy, density, sort controls |
| `client-react/src/components/todos/SortableTodoList.tsx` | Render grouped sections, conditional drag-drop, integrate ListToolbar |
| `client-react/src/components/todos/TodoRow.tsx` | Priority border, overdue tint, density-aware rendering, new chip types, spacious mode extras |
| `client-react/src/components/layout/AppShell.tsx` | Move SortControl out, keep view-mode toggle |
| `client-react/src/styles/app.css` | Priority border classes, overdue tint, chip color variants, group header styles, density-specific row sizing |

## Data Dependencies

All required data fields already exist on the `Todo` type:
- `priority`, `status`, `category`, `dueDate`, `tags` — already used in `TodoRow`
- `dependsOnTaskIds` — exists on `Todo` type, not currently rendered in React
- `waitingOn` — exists on `Todo` type, not currently rendered in React
- `subtasks` — on the `Todo` type as `subtasks?: Subtask[]` (optional — guard with `todo.subtasks?.length`)

## Accessibility Requirements

- **GroupHeader:** The toggle element is a `<button>` element (not a div with click handler). It carries `aria-expanded="true|false"`. Count badge is decorative (`aria-hidden="true"`).
- **Density toggle:** Each button uses `aria-pressed="true|false"` and descriptive `aria-label` (e.g., "Compact density").
- **Priority border:** Color is not the sole indicator — in normal/spacious modes, the priority chip provides text. In compact mode, priority is communicated visually only via border; this is acceptable because compact mode is an opt-in density reduction where users trade information for scannability.
- **Overdue state:** Conveyed by the overdue chip text in normal/spacious modes, not just the background tint.
- **Subtask progress bar:** Includes `role="progressbar"`, `aria-valuenow`, `aria-valuemax`, and `aria-label="N of M subtasks complete"`.
- **Keyboard:** GroupHeader toggle works with Enter/Space. Density buttons are keyboard-focusable.

## localStorage Keys and Resilience

| Key | Shape | Default |
|-----|-------|---------|
| `todos:group-by` | `string` (one of `GroupBy` values) | `"none"` |
| `todos:collapsed-groups` | `JSON: Record<string, string[]>` | `{}` |
| `todos:density` | `string` (one of `Density` values) | `"normal"` (already exists) |

All reads use defensive parsing: invalid/corrupt values silently fall back to defaults. No versioning needed for v1 — the shapes are simple enough that fallback-on-invalid handles all cases.

## Performance Notes

- `groupTodos()` must be wrapped in `useMemo` with `[todos, groupBy]` dependencies
- `buildChips()` is a pure helper called per-row — keep it lightweight (no allocations beyond the return array). It only runs for mounted rows; collapsed groups skip rendering entirely, so their rows never call `buildChips()`.
- **Collapsed groups must not render child rows.** This is the most impactful optimization — if a group with 50 tasks is collapsed, those 50 `TodoRow` components should not mount.
- Multiple `SortableContext` instances (one per group) add some overhead from `@dnd-kit`. Acceptable for typical list sizes (<200 visible tasks). If performance becomes an issue, derived groups already skip `SortableContext` entirely.

## Testing Strategy

- **`groupTodos()` unit tests:** All grouping modes, empty groups excluded, missing fields (null dueDate, no category), due-date bucket boundary cases (exactly midnight, end of week)
- **`buildChips()` unit tests:** Chip ordering correctness, truncation to limit, overflow count, edge cases (all chip types present, no chips applicable)
- **Collapse persistence tests:** Parse/fallback for corrupt localStorage, mode isolation (collapsing in status mode doesn't affect priority mode)
- **Due-date bucket boundary tests:** Today vs yesterday, end-of-week boundary, timezone handling
- **GroupHeader keyboard tests:** Enter/Space toggle, aria-expanded state
- **Drag-and-drop tests:** Verify drag works in `none` and `project` modes, verify drag handles are absent in derived group modes
- **Visual regression:** Existing Playwright UI tests to verify no regressions on current list behavior

## Recommended Implementation Order

1. `groupTodos()` + unit tests (pure function, no UI)
2. `GroupHeader` component + collapse persistence
3. Render grouped sections in `SortableTodoList` (without drag changes)
4. `ListToolbar` — move sort/density controls out of AppShell, add GroupBy dropdown
5. Density toggle CSS + conditional rendering in `TodoRow`
6. `TodoRow` visual indicators (priority border, overdue tint)
7. `buildChips()` + chip ordering/limits in `TodoRow`
8. Spacious-mode extras (description, subtask progress bar, notes indicator)
9. Drag-and-drop: disable for derived groups, verify for none/project modes

## Out of Scope

- Applying rich rendering to other views (Today, Upcoming, project views)
- Vanilla client (`client/`) changes
- Board view enhancements
- Progress/momentum features (streaks, burndown)
- Smart/computed views (blocked chains, neglected projects)
- Virtual scrolling / performance optimization for very large lists
- Cross-group drag-and-drop (moving a task between status/priority groups via drag)
