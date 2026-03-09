# TASK 141: centralize-global-mutable-state

type: Yellow
status: DONE
mode: refactor
builder: claude
reviewer: user
branch: claude/task-141-centralize-global-mutable-state
base: master

## Intent
Replace all window-level let/var state variables with a single typed state object and accessor functions, eliminating implicit state dependencies.

## Scope
- Audit all top-level mutable variables (isTodoDrawerOpen, editingTodoId, currentWorkspaceView, etc.)
- Create a single `appState` object with typed getters/setters
- Replace direct variable reads/writes throughout app.js with accessor calls
- No UI behavior changes

## Out of Scope
- No CSS changes
- No backend/API changes
- No test rewrites
- No module splitting (that is T-01 / Task 140)

## Files Allowed
- public/app.js

## Acceptance Criteria
- [x] No bare top-level mutable `let` variables remain for UI state
- [x] All state reads/writes route through appState accessors
- [x] All existing tests pass unchanged
- [x] No behavior regressions

## Constraints
- Preserve filterTodos() and setSelectedProjectKey() as public API entry points
- Keep event delegation patterns intact

## MIC-Lite

### Motivation
Distributed global mutable state is the root cause of render glitches and hard-to-trace bugs. Centralizing it makes state transitions auditable and enables pub-sub in a follow-up task.

### Impact
Internal refactor only. No user-visible change. Risk is missing a state variable reference during the audit.

### Checkpoints
- [x] All state variable usages identified and mapped before any changes
- [x] After refactor, run full UI test suite

## Scope Escalation Triggers
- Change touches >10 files → BLOCKED (state should be isolated in app.js)
- Introduces new architectural pattern → pre-approved
- Adds new dependency → BLOCKED

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/182
- Commit SHA(s): 83fd55a22ec1e3b9e82ed6f6682700e3ff397600
- Files changed: public/app.js (1 file, 1290 insertions, 1233 deletions)
- PASS/FAIL matrix:
  - tsc --noEmit: PASS
  - format:check: PASS
  - lint:html: PASS
  - lint:css: PASS
  - test:unit (207 tests): PASS
  - test:ui:fast (204 tests): PASS

## Outcome
Removed 103 top-level `let` declarations from `app.js` that shadowed the `state` object imported from `store.js`. All bare variable references (e.g. `isTodoDrawerOpen`) now read/write through `state.varName`. Two parameter-shadowing regressions introduced by the automated migration were fixed: `setDrawerSaveState(state, ...)` parameter renamed to `newState`, and the local alias `const state = taskDrawerAssistState` in `renderTaskDrawerAssistSection` renamed to `assistState` to eliminate a TDZ (temporal dead zone) error.
