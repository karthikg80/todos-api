# M4 Information Architecture

## Layout Zones
1. Left rail (new): project navigation and project actions.
2. Main column (existing): Todos top bar + more filters + list.
3. Right drawer (existing): task details/editing.

## What Moves Out of Top Bar
- Project dropdown filter (`#categoryFilter`) stops being primary visible navigation.
- Create/rename project controls in quick-entry row move to rail actions.

## What Stays in Top Bar
- Title/count summary.
- Search.
- Primary Add Task CTA.
- More filters toggle and panel.

## Left Rail Content Model
- Static entries:
  - `All tasks`
  - `Inbox` (optional alias for uncategorized tasks)
- Dynamic section:
  - Project tree/list (flat in M4, nested optional later).
  - Per-project count badge (computed from currently loaded todos).
- Rail footer actions:
  - `Create project`
  - Per-row overflow actions: `Rename`, `Delete`.

## Data and State Shape (minimal)
- `selectedProjectKey` (maps to existing project filter value or empty for all).
- `isProjectsRailCollapsed` (desktop).
- `isProjectsRailOpenMobile` (mobile sheet).
- `projectCountsByKey` (derived from `todos`, no API write).

## Rendering Strategy
- Continue full rerender model (`renderTodos()` orchestration).
- Add `renderProjectsRail()` called whenever todos/project metadata changes.
- Keep existing category filter path as source of truth; rail writes to it, not parallel logic.
