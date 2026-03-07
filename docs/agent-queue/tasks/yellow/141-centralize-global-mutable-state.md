# TASK 141: centralize-global-mutable-state

type: Yellow
status: READY
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
- [ ] No bare top-level mutable `let` variables remain for UI state
- [ ] All state reads/writes route through appState accessors
- [ ] All existing tests pass unchanged
- [ ] No behavior regressions

## Constraints
- Preserve filterTodos() and setSelectedProjectKey() as public API entry points
- Keep event delegation patterns intact

## MIC-Lite

### Motivation
Distributed global mutable state is the root cause of render glitches and hard-to-trace bugs. Centralizing it makes state transitions auditable and enables pub-sub in a follow-up task.

### Impact
Internal refactor only. No user-visible change. Risk is missing a state variable reference during the audit.

### Checkpoints
- [ ] All state variable usages identified and mapped before any changes
- [ ] After refactor, run full UI test suite

## Scope Escalation Triggers
- Change touches >10 files → BLOCKED (state should be isolated in app.js)
- Introduces new architectural pattern → pre-approved
- Adds new dependency → BLOCKED

## Deliverable
- PR URL:
- Commit SHA(s):
- Files changed:
- PASS/FAIL matrix:

## Outcome
