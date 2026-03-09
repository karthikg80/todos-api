# TASK 143: universal-overlay-manager

type: Yellow
status: DONE
mode: implement
builder: claude
reviewer: user
branch: claude/task-143-universal-overlay-manager
base: master

## Intent
Build a DialogManager that centralizes focus trap, Escape-to-close, z-index stacking, and accessibility label management for all modals, sidebars, sheets, and the bottom dock.

## Scope
- Implement DialogManager singleton with open(layer)/close(layer)/closeAll() API
- Handle: focus trap within active layer, Escape key propagation, backdrop instantiation, z-index stacking order
- Wire existing modal/sheet/sidebar/dock open-close calls through DialogManager
- Add aria-modal and role attributes to overlay containers

## Out of Scope
- Backend/API changes
- CSS layout changes beyond z-index consolidation
- New overlay surfaces (only wire existing ones)

## Files Allowed
- public/app.js
- public/styles.css
- public/index.html

## Acceptance Criteria
- [ ] Escape closes the topmost open overlay only
- [ ] Focus is trapped within the active overlay
- [ ] Backdrop click closes the active overlay
- [ ] No overlay z-index conflicts with the bottom dock
- [ ] All existing UI tests pass

## Constraints
- Vanilla JS, no new dependencies
- Preserve existing overlay IDs/classes used by tests

## MIC-Lite

### Motivation
Z-index conflicts and broken focus trap are the most user-visible bugs, especially on mobile. Fast interactions (opening modal while sidebar is open) currently cause unpredictable layer visibility.

### Impact
Behavioral change to modal/overlay lifecycle. Risk is breaking existing test expectations for overlay open/close order.

### Checkpoints
- [ ] After DialogManager wired, manually verify: modal + sidebar + dock can coexist correctly
- [ ] Run UI test suite for any overlay-related spec failures

## Scope Escalation Triggers
- Change touches >10 files → BLOCKED
- Adds new dependency → BLOCKED

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/183
- Commit SHA(s): 54e5b11cd3c25c26f2d5f26970f52595c8dcc2a6
- Files changed: public/app.js, public/styles.css, public/index.html
- PASS/FAIL matrix:
  - tsc --noEmit: PASS
  - format:check: PASS
  - lint:html: PASS
  - lint:css: PASS
  - test:unit: PASS (207 tests)
  - test:ui:fast: PASS (204 passed, 32 skipped)

## Outcome
Implemented `DialogManager` singleton in `public/app.js`. It centralizes Tab focus-trap (capture-phase keydown, cycles within topmost registered layer), Escape-to-close routing (only fires for topmost layer, preventing double-fire with existing per-overlay Escape handlers), and `aria-modal` attribute management. Wired 11 overlay surfaces. z-index management was intentionally excluded — setting z-index via JS broke the CSS backdrop layering (backdrops were rendered above their parent overlay panels), causing Playwright click interception failures. Each overlay's existing CSS z-index handles stacking correctly. The `todoDrawer` onEscape callback checks `openTodoKebabId` first to maintain the expected kebab-before-drawer Escape precedence. All 204 non-skipped fast UI tests pass.
