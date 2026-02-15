# State and Render Impact (M1)

## app.js Impact Summary
M1 should avoid filter logic rewrites. Keep existing filtering sources and functions intact.

## Existing Logic to Preserve
- Search: `#searchInput` + `filterTodos()`
- Project filter: `#categoryFilter` + `filterTodos()`
- Date state: `currentDateView` + `setDateView()` + `matchesDateView()`
- Reset: `clearFilters()`
- Export state: `updateIcsExportButtonState()` based on `getVisibleDueDatedTodos()`

## Required Wiring Changes
1. Add UI-only toggle state for More filters panel visibility.
- Use DOM class/attribute state only.
- Avoid new global data model for filtering.

2. Keep filter element IDs stable where practical.
- Preserve `searchInput`, `categoryFilter`, date button IDs, and `exportIcsButton` bindings.
- Moving controls must not break references in existing functions.

3. Optional active-filter summary rendering.
- If implemented, compute from existing DOM/state:
  - search query non-empty
  - project selected
  - `currentDateView` not `all`
- Summary is informational only and does not introduce new logic branches.

## renderTodos() Impact
- `renderTodos()` should not need filtering algorithm changes.
- Optional: expose a light summary count/chip near top controls; avoid coupling list rendering to panel toggle state.

## Global State Impact
- No changes to existing filter state variables.
- No changes to data fetching or persistence.
- Only UI visibility state for collapsible panel is introduced.

## Anti-Regression Guardrails
- Do not duplicate filtering conditions in new helper functions.
- Continue routing all filter effects through existing `filterTodos()`/`setDateView()`/`clearFilters()` entry points.
