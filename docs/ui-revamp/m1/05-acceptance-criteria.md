# M1 Acceptance Criteria

## Functional Parity Checklist
- [ ] Search still filters todos as before.
- [ ] Project filter still filters todos as before.
- [ ] Date filtering values (`all/today/upcoming/next_month/someday`) still work identically.
- [ ] Clear filters still resets search + project + date view to defaults.
- [ ] ICS export remains available and behaves the same when visible/applicable.
- [ ] Bulk actions toolbar appears only when items are selected (unchanged).
- [ ] Quick entry is still accessible and remains the primary task creation path.
- [ ] AI workspace remains accessible (no redesign required in M1).

## UI/Hierarchy Checklist
- [ ] Top controls show one obvious primary action (Add Task).
- [ ] Always-visible controls are minimal and calm (no dense multi-row control competition).
- [ ] More filters panel is collapsed by default.
- [ ] Advanced/rare controls are moved into More filters.

## Accessibility Checklist
- [ ] More filters toggle updates `aria-expanded` correctly.
- [ ] Toggle references panel via `aria-controls`.
- [ ] Panel can be opened/closed by keyboard.
- [ ] Escape closes panel and restores focus to toggle.
- [ ] Focus ring remains visible and consistent under M0 tokens.

## Responsive Checklist
- [ ] No layout regressions at mobile widths (<=768px and <=480px breakpoints already used).
- [ ] Top bar controls wrap predictably without overlap.
- [ ] More panel content remains readable and operable on mobile.

## Regression Checklist
- [ ] No changes to backend/API behavior.
- [ ] No changes to todo data model or stored state.
- [ ] Existing delegated event model continues to work for moved controls.
