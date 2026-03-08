# TASK 140: appjs-es6-module-split

type: Red
status: BLOCKED
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
- PR URL: N/A (BLOCKED before any split)
- Commit SHA(s): dependency-analysis commit only
- Files changed: public/app.js (dependency map comment added), docs/agent-queue/tasks/red/140-appjs-es6-module-split.md
- PASS/FAIL matrix: N/A

## Outcome
BLOCKED. Dependency graph analysis (pre-split, as required) found three independent
circular import chains that cannot be resolved within the given constraints:

① todosService.js ↔ filterLogic.js
  - loadTodos/addTodo/deleteTodo all call filterTodos() after mutations
  - filterTodos/renderTodos read the `todos` array owned by todosService
  - Cannot import each other without a cycle

② projectsState.js ↔ filterLogic.js
  - setSelectedProjectKey() calls applyFiltersAndRender()
  - applyFiltersAndRender/renderTodos reads customProjects, projectRecords,
    projectHeadingsByProjectId owned by projectsState
  - Cannot import each other without a cycle

③ drawerUi.js ↔ filterLogic.js
  - applyFiltersAndRender() calls syncTodoDrawerStateWithRender() (drawerUi)
  - Drawer open/close functions call filterTodos/renderTodos (filterLogic)
  - Cannot import each other without a cycle

Additional concern: the data-onclick dispatcher (line ~13318) resolves ~90 handler
functions via window[functionName]. Switching to type="module" removes automatic
global exposure, requiring explicit window.xxx assignments for all ~90 handlers —
making app.js non-thin.

Resolution options that would unblock this task:
1. Add a public/store.js shared mutable state module to the allowed file list.
   All 5 modules import from store.js; store.js has no imports. No cycles.
2. Allow an event-bus/pubsub pattern (CustomEvent) for post-mutation rerenders
   instead of direct function calls. This decouples the modules at cost of async
   semantics where currently synchronous.
3. Significantly different module boundaries where filterLogic.js co-locates both
   the todos state and the filter/render pipeline, eliminating chain ①. Chains
   ② and ③ would still need option 1 or 2 to resolve.
