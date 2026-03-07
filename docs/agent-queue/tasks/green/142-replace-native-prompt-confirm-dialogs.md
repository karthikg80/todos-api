# TASK 142: replace-native-prompt-confirm-dialogs

type: Green
status: READY
mode: implement
builder: claude
reviewer: user
branch: claude/task-142-replace-native-prompt-confirm-dialogs
base: master

## Intent
Replace all native browser confirm() and prompt() calls with styled ConfirmDialog and InputDialog components consistent with the existing modal design system.

## Scope
- Audit all confirm() and prompt() call sites in app.js
- Build reusable ConfirmDialog(message, onConfirm) and InputDialog(prompt, onSubmit) helpers
- Replace each native call site with the styled equivalent
- Style dialogs to match existing modal/sheet design system in styles.css

## Out of Scope
- Backend/API changes
- Test rewrites
- Changes to existing modal infrastructure beyond the two new dialog helpers

## Files Allowed
- public/app.js
- public/styles.css
- public/index.html

## Acceptance Criteria
- [ ] No confirm() or prompt() calls remain in app.js
- [ ] All confirmation/input flows use styled dialogs
- [ ] Dialogs are keyboard-accessible (Enter confirms, Escape cancels)
- [ ] Visual style consistent with existing modals
- [ ] All existing tests pass

## Constraints
- Vanilla JS only, no new dependencies
- Keep existing event delegation model

## Deliverable
- PR URL:
- Commit SHA(s):
- Files changed:
- PASS/FAIL matrix:

## Outcome
