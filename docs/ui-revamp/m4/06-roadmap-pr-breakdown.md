# M4 Roadmap and PR Breakdown

## PR1: Rail shell + layout integration (no behavior rewrite)
### Files to touch
- `public/index.html`
- `public/styles.css`
- `public/app.js` (minimal render mount + inert markup wiring)

### Scope
- Add left rail containers and mobile sheet shell.
- Move project UI affordances visually out of top bar/quick-entry area.
- Keep existing category filter controls available internally until PR2 wiring.

### Risks
- CSS collisions with existing responsive rules.
- Drawer/rail overlap z-index issues.

### Acceptance criteria
- Rail visible on desktop and sheet shell available on mobile.
- No functional regressions in existing flows.

### Verification
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `CI=1 npm run test:ui`

## PR2: Rail selection wiring + counts + keyboard
### Files to touch
- `public/app.js`
- `public/styles.css` (focus/active states only)
- `tests/ui/projects-rail.spec.ts` (new)

### Scope
- Introduce `selectedProjectKey`, derive project counts from `todos`.
- Wire row select to existing filter path (`categoryFilter` behavior unchanged).
- Add keyboard navigation and active-state persistence.

### Risks
- Duplicate filter logic if selection bypasses existing path.
- Focus loss across rerenders.

### Acceptance criteria
- Project click/Enter switches list via current filtering semantics.
- Active project highlight stable across rerenders.

### Verification
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run test:unit`
- `CI=1 npm run test:ui`

## PR3: Project CRUD UX (no prompt) + overflow menu hardening
### Files to touch
- `public/app.js`
- `public/styles.css`
- `tests/ui/projects-rail.spec.ts`

### Scope
- Add create/rename/delete in-app controls (inline/modal), remove prompt dependency.
- Add overflow menu open/close/escape/outside handling.
- Reuse existing project create/rename/delete logic and messages.

### Risks
- Menu event propagation conflicts with list/drawer handlers.
- Validation mismatch with existing project normalization.

### Acceptance criteria
- Create/rename/delete works through rail UI with confirmation/validation.
- No prompt dialogs used.

### Verification
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:css`
- `npm run test:unit`
- `CI=1 npm run test:ui`

## PR4: Mobile polish + regression hardening
### Files to touch
- `public/app.js`
- `public/styles.css`
- `tests/ui/projects-rail.spec.ts`
- `tests/ui/app-smoke.spec.ts`

### Scope
- Mobile sheet focus trap-lite + body scroll lock reuse.
- Final a11y and keyboard edge-case polish.
- Regression assertions for drawer/AI/more-filters unaffected.

### Risks
- Mobile scroll lock interference with drawer lock.
- Escape priority conflicts between rail, kebab, drawer.

### Acceptance criteria
- Mobile rail feels stable, closes cleanly, restores focus.
- Existing M1-M3 flows remain green.

### Verification
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:css`
- `npm run test:unit`
- `CI=1 npm run test:ui`
