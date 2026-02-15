# M4 Interaction and Accessibility

## Selection and Filtering
- Rail select action updates existing project filter path (same behavior as current `categoryFilter` change).
- `All tasks` maps to empty project filter.
- Optional `Inbox` maps to uncategorized/null project value.

## Create / Rename / Delete Flows
- Create project:
  - In-rail inline form or small modal (prefer inline expand row for minimal code).
  - Validation: non-empty, normalized path, duplicate prevention.
  - Feedback via existing message system (`showMessage`).
- Rename project:
  - Inline rename state on selected row or compact modal.
  - Reuse existing rename implementation logic and normalization.
- Delete project:
  - Confirm before delete.
  - Reuse existing remove/move behavior semantics; no data loss surprises.

## Keyboard Model
- `Tab` enters rail and actions naturally.
- `ArrowUp/ArrowDown` moves active focus between project rows.
- `Enter` selects focused project row.
- `Escape` closes rail sheet on mobile and closes row overflow menu if open.
- Overflow menu keyboard:
  - `Enter/Space` opens.
  - `Escape` closes and restores focus to row/menu trigger.

## ARIA Semantics
- Rail container: `nav` with `aria-label="Projects"`.
- Project list: `role="listbox"` (or semantic list + `aria-current`; pick one consistently).
- Active project row: `aria-current="page"` (if semantic nav list chosen).
- Mobile sheet: `aria-modal="true"` style semantics if implemented as dialog region.

## Focus Management
- Opening mobile rail sends focus to first actionable element.
- Closing mobile rail restores focus to opener (`#projectsRailMobileOpen`).
- Overflow menu close restores focus to its trigger.
- No focus jumps during todos rerenders; preserve focused rail item by project key.
