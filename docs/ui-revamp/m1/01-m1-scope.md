# M1 Scope: Declutter Todos Top Bar + More Filters

## Objective
Reduce cognitive load in the Todos view by simplifying the top controls and moving rare/advanced controls behind a default-collapsed "More filters" disclosure.

## In Scope (M1)
- Recompose Todos top area into a calm top bar with one primary action.
- Keep a minimal set of always-visible controls.
- Add a default-collapsed "More filters" disclosure surface.
- Move low-frequency filter/utilities into "More filters".
- Add optional active-filter summary text/chip (read-only UI summary, no behavior change).
- Preserve current view architecture:
  - section-based views (`#todosView`, `#profileView`, `#adminView`)
  - delegated `data-on*` event handling
  - existing filtering functions and state model

## Explicitly Out of Scope (M1)
- No redesign of task rows/list composition (M2 scope).
- No edit drawer/modal redesign (M3 scope).
- No AI workspace docking/collapse redesign (M4 scope).
- No API changes.
- No schema/state model changes.
- No keyboard-shortcut redesign.

## No Behavior Changes Contract
M1 is UI-organization only. Filter semantics and outcomes must remain identical:
- `searchInput` still filters title/description/category via `filterTodosList()`.
- `categoryFilter` still filters project paths the same way.
- Date filtering still uses `setDateView()` + `matchesDateView()` with existing values (`all`, `today`, `upcoming`, `next_month`, `someday`).
- `clearFilters()` still resets project + search + date view to `all`.
- Bulk actions behavior remains unchanged.
- Quick entry behavior remains unchanged.
