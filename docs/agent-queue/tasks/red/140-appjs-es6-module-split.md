# TASK 140: appjs-es6-module-split

type: Red
status: READY
mode: refactor
builder: claude
reviewer: user
branch: claude/task-140-appjs-es6-module-split
base: master

## Intent
Split the 12,000-line app.js monolith into cohesive ES6 modules by domain without any behavior change.

## Scope
- Create domain modules: todosService.js, projectsState.js, drawerUi.js, filterLogic.js, overlayManager.js
- Move functions to the appropriate module based on responsibility
- Wire modules together via ES module imports/exports
- public/index.html updated to load entry point module with `type="module"`

## Out of Scope
- No behavior changes of any kind
- No CSS changes
- No backend changes
- No new dependencies
- No test rewrites (tests should pass unchanged)

## Files Allowed
- public/app.js
- public/index.html
- public/todosService.js (new)
- public/projectsState.js (new)
- public/drawerUi.js (new)
- public/filterLogic.js (new)
- public/overlayManager.js (new)

## Acceptance Criteria
- [ ] app.js is reduced to a thin entry point / orchestrator
- [ ] All existing Playwright and unit tests pass unchanged
- [ ] No global scope leaks introduced
- [ ] No behavior regressions visible in browser
- [ ] `npx tsc --noEmit` passes

## Constraints
- Preserve ALL existing DOM IDs, classes, and event delegation patterns
- Do not change filterTodos(), setSelectedProjectKey(), or waitForTodosViewIdle() signatures
- No new npm dependencies

## MIC-Lite

### Motivation
The 12k-line app.js is the single largest maintainability risk in the codebase. It makes parallel work impossible and every PR a merge conflict. This refactor unblocks all subsequent architecture tasks.

### Impact
Pure file reorganization — no user-visible behavior change. Risk is introducing import order bugs or missing re-exports.

### Checkpoints
- [ ] After module extraction, verify all function references resolve (tsc --noEmit)
- [ ] After wiring entry point, verify UI renders correctly in browser
- [ ] Run full UI test suite before declaring done

## Pre-Mortem

1. Most likely failure: circular imports between modules (e.g. drawerUi calls filterLogic which calls projectsState which calls drawerUi). Mitigation: map dependency graph before cutting.
2. Blast radius: if import wiring breaks, the entire frontend stops rendering. Mitigation: keep app.js intact as fallback until all modules verified.
3. Rollback: revert to original app.js — no data model or API changes to unwind.

## Scope Escalation Triggers
- Change touches >10 files → expected, pre-approved for this task
- Introduces new architectural pattern → pre-approved (ES6 modules)
- Adds new dependency → BLOCKED
- Changes cross-module behavior contracts → BLOCKED
- Modifies Prisma schema → BLOCKED

## Deliverable
- PR URL:
- Commit SHA(s):
- Files changed:
- PASS/FAIL matrix:

## Outcome
