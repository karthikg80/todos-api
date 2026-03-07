# TASK 143: universal-overlay-manager

type: Yellow
status: READY
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
- PR URL:
- Commit SHA(s):
- Files changed:
- PASS/FAIL matrix:

## Outcome
