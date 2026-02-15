# Codex Implementation Prompts (M2)

## PR1 Prompt
Implement M2 PR1 only: add Todo Details drawer/sheet shell and row visual slot layout, with no JS behavior changes.

- Files: `public/index.html`, `public/styles.css`
- Behaviors:
  - Add hidden drawer container markup with close affordance placeholder.
  - Update row CSS to stable slot layout: state/content/metadata/actions.
  - Keep current handlers/ids untouched.
- Constraints:
  - No `public/app.js` changes.
  - No feature/behavior changes.
  - Keep M1 top bar + More filters intact.
- Verification:
  - `npm run format:check`
  - `npm run lint:html`
  - `npm run lint:css`
  - `npm run test:ui`
- No regression checklist:
  - more-filters panel still present and collapsed by default
  - quick entry still visible/usable
  - AI workspace layout untouched

## PR2 Prompt
Implement M2 PR2 only: wire row selection + drawer open/close state using existing delegated patterns.

- Files: `public/app.js` (+ minimal `public/styles.css` class hook only if needed)
- Behaviors:
  - Introduce `selectedTodoId` state.
  - Click row content or Enter opens drawer for that todo.
  - Escape closes drawer and restores focus to opening row trigger.
  - Checkbox and kebab interactions do not open drawer.
- Constraints:
  - No filter logic changes.
  - No backend/API changes.
  - Reuse delegated `data-onclick` style.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`
- No regression checklist:
  - M1 more-filters toggle still works with keyboard
  - bulk actions unchanged
  - AI panel unaffected

## PR3 Prompt
Implement M2 PR3 only: Essentials editing inside drawer, reusing existing save/update logic.

- Files: `public/app.js`, `public/index.html`, `public/styles.css`
- Behaviors:
  - Essentials fields editable: title, completed, due date, project, priority.
  - Save uses existing update endpoint and validation path.
  - Success/error feedback uses existing message system.
- Constraints:
  - Do not duplicate validation/update logic.
  - Keep old edit modal callable until parity confirmed.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run lint:html`
  - `npm run lint:css`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`
- No regression checklist:
  - edit modal still opens and saves
  - drawer edits persist after refresh
  - due date/project filters still function

## PR4 Prompt
Implement M2 PR4 only: Details accordion + row action consolidation (kebab).

- Files: `public/app.js`, `public/styles.css`, optional `public/index.html` hooks
- Behaviors:
  - Add Details accordion, collapsed by default.
  - Move rare row actions into kebab/overflow.
  - Keep delete in drawer danger zone.
- Constraints:
  - Keep one source of truth for action handlers.
  - Avoid introducing nested click conflicts.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run lint:css`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`
- No regression checklist:
  - checkbox click still toggles only completion
  - row click opens drawer consistently
  - delete still requires current confirmation behavior

## PR5 Prompt
Implement M2 PR5 only: add/update UI tests for drawer behavior and preserve M1 coverage.

- Files: `tests/ui/app-smoke.spec.ts`, `tests/ui/more-filters.spec.ts`, new `tests/ui/todo-drawer.spec.ts`
- Behaviors to test:
  - drawer opens from row click/Enter
  - Escape closes and restores focus
  - Essentials edit/save path works
  - kebab actions reachable
  - M1 more-filters tests remain green
- Constraints:
  - No production code changes unless a test reveals a real bug.
  - Prefer stable selectors and aria/focus assertions.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`
- No regression checklist:
  - avoid flake-prone timing sleeps
  - assertions not coupled to pixel layout

## PR6 Prompt (Optional)
Implement M2 PR6 only: mobile bottom-sheet/full-screen behavior and scroll lock polish.

- Files: `public/styles.css`, `public/app.js`, `tests/ui/todo-drawer.spec.ts`
- Behaviors:
  - mobile drawer becomes sheet/full-screen.
  - background scroll lock while sheet open.
  - close/focus restoration preserved.
- Constraints:
  - No desktop regressions.
  - Keep AI workspace and top bar unchanged.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`
- No regression checklist:
  - sheet safe-area and close affordance always visible
  - keyboard escape handling still works on desktop
