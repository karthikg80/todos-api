# M2 Roadmap and PR Breakdown

## PR1: Drawer shell + row visual skeleton (non-functional drawer)
### Files to touch
- `public/index.html`
- `public/styles.css`

### Scope
- Add hidden drawer/sheet container markup.
- Add row slot styling for calm layout (state/content/metadata/actions).
- No behavior wiring yet.

### Acceptance criteria
- Todo rows visually use new slot layout.
- Drawer container exists but stays hidden.
- No behavior regressions in existing flows.

### Verification commands
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `npm run test:ui`

## PR2: Selection/open/close wiring
### Files to touch
- `public/app.js`
- `public/styles.css` (only if visibility class hooks needed)

### Scope
- Add `selectedTodoId` state and active-row marking.
- Wire open/close drawer actions and `Escape` close behavior.
- Focus restore to launching row.

### Acceptance criteria
- Row open works by click/Enter.
- Checkbox and kebab do not accidentally open drawer.
- Escape closes and returns focus correctly.

### Verification commands
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run test:unit`
- `CI=1 npm run test:ui`

## PR3: Essentials editing in drawer
### Files to touch
- `public/app.js`
- `public/index.html` (drawer field markup if not templated in JS)
- `public/styles.css`

### Scope
- Implement editable Essentials fields in drawer.
- Reuse existing todo update/save logic and validation.
- Keep edit modal temporarily available until parity confirmed.

### Acceptance criteria
- Title/completed/due date/project/priority edits save correctly.
- Existing API/update behavior unchanged.
- Error/success messages continue via existing system.

### Verification commands
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `npm run test:unit`
- `CI=1 npm run test:ui`

## PR4: Details accordion + action consolidation
### Files to touch
- `public/app.js`
- `public/styles.css`
- `public/index.html` (if static accordion scaffold needed)

### Scope
- Add collapsed-by-default Details section.
- Move rare row actions to kebab/overflow.
- Keep delete in drawer danger zone.

### Acceptance criteria
- Details collapsed by default and toggles accessibly.
- Rare actions no longer clutter each row.
- Delete and advanced edits still reachable.

### Verification commands
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:css`
- `npm run test:unit`
- `CI=1 npm run test:ui`

## PR5: UI test updates + drawer-focused specs
### Files to touch
- `tests/ui/app-smoke.spec.ts`
- `tests/ui/more-filters.spec.ts` (ensure no regressions)
- `tests/ui/*drawer*.spec.ts` (new)

### Scope
- Add tests for drawer open/close/focus restore/Essentials save.
- Ensure M1 more-filters behavior still passes.

### Acceptance criteria
- Tests cover keyboard and focus restoration.
- No flaky waits or style-coupled assertions.

### Verification commands
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run test:unit`
- `CI=1 npm run test:ui`

## PR6 (optional): Mobile sheet behavior + scroll lock polish
### Files to touch
- `public/styles.css`
- `public/app.js`
- `tests/ui/*drawer*.spec.ts`

### Scope
- Responsive sheet/full-screen transitions on mobile.
- Background scroll lock and safe-area polish.

### Acceptance criteria
- Mobile editing usable without background scroll bleed.
- Close/focus behavior remains consistent.

### Verification commands
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run test:unit`
- `CI=1 npm run test:ui`
