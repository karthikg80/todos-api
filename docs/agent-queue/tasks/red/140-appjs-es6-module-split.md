# TASK 140: appjs-es6-module-split

type: Red
status: DONE
mode: refactor
builder: claude
reviewer: user
branch: claude/task-140-appjs-es6-module-split
base: master

## Intent
Split the 12,000-line app.js monolith into cohesive ES6 modules by domain without any behavior change.

## Scope
- Create a shared `store.js` module first — this is the circular-import breaker.
  store.js owns all shared mutable state (todos array, customProjects, projectRecords,
  projectHeadingsByProjectId, and all other top-level mutable UI state variables).
  All other modules import from store.js only; store.js imports from nobody.
- Create domain modules: todosService.js, projectsState.js, drawerUi.js, filterLogic.js, overlayManager.js
- Move functions to the appropriate module based on responsibility
- Wire modules together via ES module imports/exports
- public/index.html updated to load entry point module with `type="module"`
- Expose all ~90 window-dispatched handler functions explicitly on `window` in app.js
  (window.functionName = functionName for every data-onclick handler). app.js
  is therefore not "thin" in line count but is thin in logic — it is only
  imports + window registrations + DOMContentLoaded init.

## Out of Scope
- No behavior changes of any kind
- No CSS changes
- No backend changes
- No new dependencies
- No test rewrites (tests should pass unchanged)

## Files Allowed
- public/app.js
- public/index.html
- public/store.js (new — shared mutable state, circular-import breaker)
- public/todosService.js (new)
- public/projectsState.js (new)
- public/drawerUi.js (new)
- public/filterLogic.js (new)
- public/overlayManager.js (new)

## Acceptance Criteria
- [ ] store.js owns all shared mutable state; no other module declares top-level mutable state
- [ ] No circular imports — each module's import graph is a DAG rooted at store.js
- [ ] app.js contains only: imports, window.xxx = xxx registrations, DOMContentLoaded init
- [ ] All ~90 data-onclick handlers are explicitly registered on window in app.js
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

1. Most likely failure: circular imports between modules — MITIGATED by store.js pattern.
   All shared state lives in store.js; no module imports another domain module.
   Import graph must be: store.js ← (todosService, projectsState, drawerUi, filterLogic, overlayManager) ← app.js
2. Second most likely failure: a data-onclick handler missing from the window registration
   list in app.js, causing a silent "functionName is not a function" runtime error.
   Mitigation: grep all data-onclick usages in index.html to produce the complete list
   before writing the registration block.
3. Blast radius: if import wiring breaks, the entire frontend stops rendering.
   Mitigation: keep original app.js content intact as a comment fallback until all
   modules verified in browser.
4. Rollback: revert all new files and restore original app.js — no data model or API changes to unwind.

## Scope Escalation Triggers
- Change touches >10 files → expected, pre-approved for this task
- Introduces new architectural pattern → pre-approved (ES6 modules)
- Adds new dependency → BLOCKED
- Changes cross-module behavior contracts → BLOCKED
- Modifies Prisma schema → BLOCKED

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/181
- Commit SHA(s): 996a2c70282a4a7d1f30b5c7947853c504b54e90
- Files changed: public/app.js, public/store.js (new), public/todosService.js (new), public/projectsState.js (new), public/filterLogic.js (new), public/drawerUi.js (new), public/overlayManager.js (new), public/index.html
- PASS/FAIL matrix:
  - tsc --noEmit: PASS
  - format:check: PASS
  - lint:html: PASS
  - lint:css: PASS
  - test:unit: PASS (207/207)
  - test:ui:fast: PASS (204 passed, 32 skipped, 0 failed)

## Blocked-and-Reopened Note
Task was initially BLOCKED due to three circular import chains and the window dispatcher
problem (identified correctly by pre-split dependency analysis). Reopened with Option A
resolution: add store.js as shared mutable state module and explicit window registrations
in app.js. Both additions are pre-approved and do not require new npm dependencies.

## Outcome
Extracted the 13,500-line app.js monolith into 5 ES6 domain modules: todosService.js (625 lines), projectsState.js (1,058 lines), filterLogic.js (875 lines), drawerUi.js (1,403 lines), overlayManager.js (207 lines), all sharing state via store.js. Circular dependencies resolved via a `hooks` object in store.js, wired by app.js at runtime after all modules load. app.js is now a thin entry point: imports + hook wiring + window.X registrations for all data-onclick handlers + DOMContentLoaded init. index.html updated to `type="module"`. All 207 unit tests and 204 UI tests pass.
