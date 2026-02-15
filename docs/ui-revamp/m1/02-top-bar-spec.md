# M1 Top Bar Spec

## Primary CTA Decision
Primary CTA: **Add Task**

Rationale:
- It maps directly to the core Todos workflow.
- It can focus/reveal the existing quick-entry area (`#todoInput`) without changing create behavior.
- Keeps one clear high-emphasis action in the top bar.

## Top Bar Layout (Desktop)
Single row, 3 zones:
1. Left:
- `Todos` title
- Optional count text (`N active`) sourced from current visible/incomplete count.

2. Center:
- Search input (`#searchInput`) always visible.

3. Right:
- Primary button: `Add Task`
- Secondary button: `More filters` (disclosure toggle)

## Minimal Always-Visible Controls
Keep at most 2 filter controls always visible:
1. Project filter dropdown (`#categoryFilter`)
2. Date scope **summary/toggle** control (compact):
- preferred compact form: a single button/cycle/mini-menu showing current date view label
- still backed by existing date view values

Always-visible controls total (max 4 including actions):
- Search
- Project filter
- Add Task (primary)
- More filters

## Controls Moved Behind “More filters”
- Full date pill set (`All`, `Today`, `Upcoming`, `Next Month`, `Someday`)
- `Clear` filters button (kept available but not always visible)
- `Export .ics` button and helper text
- Any future low-frequency filter toggles/sort controls

## Placement Relative to Existing Structure
- New top bar and minimal filters should stay in `#todosView` above bulk actions and quick entry.
- Quick entry remains below top controls and is unchanged functionally.
- Bulk actions toolbar remains state-driven and separate from top bar.
