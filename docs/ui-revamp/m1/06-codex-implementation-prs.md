# M1 Implementation PR Breakdown

## PR1: Layout Recomposition + More Filters Markup/CSS
Title suggestion: `UI M1 PR1: Todos top bar declutter + More filters surface`

Files to touch:
- `public/index.html`
- `public/styles.css`

Exact steps:
1. Introduce new top bar container in `#todosView` with:
- title/count area
- search area
- right actions (`Add Task`, `More filters`)
2. Keep minimal always-visible filters:
- project dropdown
- compact date summary/toggle placeholder
3. Move full date pills, clear, export (+ helper copy) into inline collapsible panel container.
4. Add M0-token-aligned styles for top bar + collapsible.

Verification commands:
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`

## PR2: app.js Wiring (UI Toggle + Optional Summary)
Title suggestion: `UI M1 PR2: wire More filters toggle and filter summary`

Files to touch:
- `public/app.js`
- optional minor updates in `public/index.html` for attributes/IDs

Exact steps:
1. Add toggle handler for More filters panel open/close.
2. Synchronize `aria-expanded` and panel visibility state.
3. Add Escape handling scoped to More filters panel.
4. Ensure moved controls still call existing functions:
- `filterTodos()`
- `setDateView()`
- `clearFilters()`
- `exportVisibleTodosToIcs()`
5. Optional: add active-filter summary chip/text derived from existing filter state.

Verification commands:
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `npm run test:unit`

## PR3: UI Test Updates
Title suggestion: `UI M1 PR3: update UI tests for decluttered controls`

Files to touch:
- `tests/ui/*.spec.ts` (only affected specs)

Exact steps:
1. Update selectors/assertions for relocated controls.
2. Add/adjust tests for:
- More filters default-collapsed state
- open/close behavior
- keyboard toggle/Escape close
- unchanged filter behavior through relocated controls
3. Keep smoke tests for quick entry, bulk actions, and AI access intact.

Verification commands:
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `npm run test:unit`
- `npm run test:ui`

## Suggested Merge Checklist (for each PR)
- [ ] Scope limited to planned files
- [ ] No behavior changes beyond intended UI visibility reorganization
- [ ] Mobile layout sanity check completed
- [ ] Delegated handlers verified for moved controls
- [ ] CI commands pass
