# Roadmap and PR Plan

## Delivery Strategy
Implement in six small, reviewable PRs that preserve current architecture and behavior while reducing UI density incrementally.

All milestones target:
- No framework migration
- Keep delegated handlers and `innerHTML` render pattern
- Reuse existing IDs/functions where possible to avoid regressions

## M0: Tokens + Typography Reset (No Layout Changes)

Scope:
- Introduce semantic token layer and shared typography/spacing primitives.
- Remove obvious hardcoded one-off style values where safe.

Files to touch:
- `public/styles.css`
- `public/index.html` (remove/replace inline style hotspots only if needed)
- `public/app.js` (only inline template styles replaced with classes/tokens)

Acceptance criteria:
- Existing layouts remain structurally identical.
- Core colors/radii/shadows/typography map to new tokens.
- No functional behavior changes.

Risks:
- Visual regressions from token remapping.
- Inline-style precedence conflicts.

Verification commands:
- `npm run build`
- `npm run format:check`
- `npm run lint:css`
- `npm run lint:html`
- `npm run test:unit`
- `npm run test:ui`

## M1: Declutter Todos Header + More Filters

Scope:
- Recompose Todos top controls into minimal default row.
- Add "More filters" disclosure for rare controls.
- Move export/project-maintenance/low-frequency controls under disclosure.

Files to touch:
- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `tests/ui/*.spec.ts` (update selectors/assertions for control placement)

Acceptance criteria:
- Default Todos header shows only high-frequency controls + primary CTA.
- More filters panel contains advanced controls and works with current filtering logic.
- Clear visual hierarchy in top viewport.

Risks:
- Selector breakage in UI tests.
- Event binding bugs if moved elements lose `data-on*` attributes.

Verification commands:
- `npm run build`
- `npm run format:check`
- `npm run lint:css`
- `npm run lint:html`
- `npm run test:unit`
- `npm run test:ui`

## M2: List Row Redesign + Metadata Alignment

Scope:
- Redesign todo row anatomy for calmer scanning.
- Normalize metadata slots and action placement.
- Tone down visual intensity of chips and destructive actions.

Files to touch:
- `public/app.js` (mainly `renderTodos()` templates)
- `public/styles.css`
- `tests/ui/*.spec.ts`

Acceptance criteria:
- Rows expose consistent slots: state, content, metadata, actions.
- Metadata no longer uses competing saturated colors by default.
- Drag/select/complete/edit/delete behavior remains intact.

Risks:
- Regressions in row interactions (drag/drop, select all, toggles).
- Overflow issues on mobile row wrapping.

Verification commands:
- `npm run build`
- `npm run format:check`
- `npm run lint:css`
- `npm run test:unit`
- `npm run test:ui`

## M3: Details Drawer + Edit Flow Cleanup

Scope:
- Replace generic edit modal flow with drawer-first (modal fallback on small screens).
- Add Essentials vs Details progressive disclosure.

Files to touch:
- `public/index.html` (drawer container structure)
- `public/styles.css` (drawer + disclosure styles)
- `public/app.js` (`openEditTodoModal`, `closeEditTodoModal`, `saveEditedTodo` orchestration)
- `tests/ui/*.spec.ts`

Acceptance criteria:
- Edit opens in dedicated details surface.
- Essentials fields visible first; Details section collapsible.
- Save/cancel and focus behavior stay accessible.

Risks:
- Focus trap/focus return regressions.
- Mobile fallback layout issues.

Verification commands:
- `npm run build`
- `npm run format:check`
- `npm run lint:css`
- `npm run lint:html`
- `npm run test:unit`
- `npm run test:ui`

## M4: AI Workspace Dock/Collapse + Calmer History

Scope:
- Convert AI workspace into dockable/collapsible panel (default collapsed).
- Keep goal planning primary, push insights/history deeper in disclosure.

Files to touch:
- `public/index.html`
- `public/styles.css`
- `public/app.js` (`renderAi*`, panel open/close state, load behavior)
- `tests/ui/*.spec.ts`

Acceptance criteria:
- AI panel starts collapsed on Todos load.
- Expand reveals planning controls; history/insights still available behind nested disclosure.
- No loss of existing AI API flows.

Risks:
- Hidden-state confusion if persistence not handled clearly.
- Increased complexity in AI panel state sync.

Verification commands:
- `npm run build`
- `npm run format:check`
- `npm run lint:css`
- `npm run test:unit`
- `npm run test:ui`

## M5: Accessibility + Keyboard Polish

Scope:
- Audit and refine focus order, focus styles, keyboard shortcuts, and hit targets.
- Ensure all disclosure surfaces are keyboard operable and announced.

Files to touch:
- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `tests/ui/*.spec.ts`

Acceptance criteria:
- Visible focus ring on all interactive controls.
- Drawer/collapsible controls accessible via keyboard.
- Status/empty/error surfaces continue using `aria-live` patterns.

Risks:
- Shortcut conflicts with new disclosure controls.
- Hidden content still reachable by focus when collapsed.

Verification commands:
- `npm run build`
- `npm run format:check`
- `npm run lint:css`
- `npm run lint:html`
- `npm run test:unit`
- `npm run test:ui`
