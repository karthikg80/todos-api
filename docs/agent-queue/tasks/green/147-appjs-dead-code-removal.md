# TASK 147: appjs-dead-code-removal

type: Red
status: DONE
mode: refactor
builder: claude
reviewer: user
branch: claude/task-147-appjs-dead-code-removal
base: master

## Intent
Task 140 created domain modules (drawerUi.js, filterLogic.js, todosService.js,
projectsState.js, overlayManager.js, store.js) but left app.js as a full 13,702-line
monolith. app.js currently imports only store.js and ignores all domain modules.
This task completes the split: wire app.js to import from the domain modules and
remove every duplicate function implementation that now lives in a domain module.

After this task, app.js should contain only:
  - ES6 imports from all domain modules and store.js
  - window.xxx = xxx registrations for all ~90 data-onclick handlers
  - DOMContentLoaded init (bindDeclarativeHandlers, init)
  - Any functions that genuinely have no domain home (helpers used across 3+ modules
    that do not belong in store.js — move these to store.js or utils.js if needed)

## Scope

### Phase 1 — Inventory (no code changes)
For each domain module, list every exported function name.
Then grep app.js for matching function declarations.
Produce a mapping table: functionName → domain module → line number in app.js.
This is the deletion manifest.

### Phase 2 — Wire imports
Add import statements to app.js for all domain modules:
  import { ... } from './drawerUi.js';
  import { ... } from './filterLogic.js';
  import { ... } from './todosService.js';
  import { ... } from './projectsState.js';
  import { ... } from './overlayManager.js';

Import only what is used in app.js (window registrations + init wiring).

### Phase 3 — Delete duplicates from app.js
For each function in the deletion manifest:
  - Confirm the domain module export exists and is complete
  - Delete the duplicate declaration from app.js
  - Verify tsc --noEmit still passes after each batch of deletions

Work in batches by module (all drawerUi functions, then filterLogic, etc.)
Run tsc after each module batch — do not delete all at once.

### Phase 4 — Verify window registrations
After deletions, all window.xxx = xxx lines must still reference a valid imported
symbol (not a deleted local). Grep for window. assignments and confirm each one
resolves to an import.

### Phase 5 — Full verification
Run all checks and confirm app.js line count is under 500 lines.

## Out of Scope
- No behavior changes of any kind
- No CSS changes
- No backend changes
- No new dependencies
- No test rewrites
- Do not modify the domain module files (they are authoritative)

## Files Allowed
- public/app.js (primary target — deletions only + import additions)
- public/store.js (only if a cross-cutting helper needs a home)
- public/utils.js (only if a cross-cutting helper needs a home)

## Acceptance Criteria
- [x] app.js imports all 5 domain modules explicitly
- [x] app.js contains zero duplicate function declarations that exist in a domain module
- [ ] app.js line count < 500 — NOT MET: 10,085 lines (see Outcome)
- [x] All ~90 window.xxx registrations resolve to imported symbols
- [x] npx tsc --noEmit passes
- [x] npm run format:check passes
- [x] npm run lint:html passes
- [x] npm run lint:css passes
- [x] npm run test:unit passes (207/207)
- [x] CI=1 npm run test:ui:fast passes (204 passed, 32 skipped, 0 failed)
- [x] No behavior regressions visible in browser

## Constraints
- Delete from app.js only — do not modify domain modules
- No new npm dependencies
- Work in per-module batches with tsc check after each batch
- If a function exists in app.js but NOT in any domain module → do NOT delete it,
  flag it in the handoff summary for potential Task 148 extraction
- >15 files touched → BLOCKED

## MIC-Lite

### Motivation
The domain modules from Task 140 are currently dead code. The browser loads app.js's
495 function definitions and ignores the domain modules entirely. Tasks 141, 143, and
145 have since added pub-sub, overlay manager wiring, and state centralization on top
of the monolith. Until the duplicates are removed, the split delivers no maintainability
benefit and creates a confusing dual-source-of-truth situation.

### Impact
Pure deletion refactor — no new logic, no behavior change. Risk is deleting a function
that is referenced in app.js but was not fully extracted to the domain module.
Mitigation: tsc after every batch catches missing symbols immediately.

### Checkpoints
- [x] Deletion manifest produced before any code change
- [x] tsc passes after each module batch deletion
- [ ] app.js line count < 500 at completion — NOT MET (see Outcome)
- [x] Full test suite green before pushing

## Pre-Mortem

1. Most likely failure: a function referenced in app.js (e.g. in init() or a window
   registration) was not exported from its domain module. tsc will catch this
   immediately. Fix: add the missing export to the domain module, then delete from app.js.

2. Second most likely: a function appears in both app.js and a domain module but the
   domain module version is subtly different (e.g. missing a recent edit that landed
   after Task 140). Always diff the two versions before deleting the app.js copy.
   If they differ, update the domain module to match app.js, then delete.

3. Circular re-introduction: if a domain module imports something that was deleted
   from app.js but not yet exported from another module. tsc catches this.

4. Rollback: git revert the PR — domain modules remain intact, app.js reverts to
   monolith. No data or API changes to unwind.

## Scope Escalation Triggers
- Change touches >15 files → BLOCKED
- Any new npm dependency → BLOCKED
- Any behavior change → BLOCKED
- Domain module needs modification to match app.js version → allowed, document in handoff

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/184
- Commit SHA(s): 8716953
- Files changed: public/app.js, public/filterLogic.js, public/projectsState.js, public/store.js
- app.js line count before: 13,918
- app.js line count after: 10,085 (-3,833 lines, -27.5%)
- Functions deleted from app.js: ~157 (153 function declarations + 4 factory function duplicates)
- Functions flagged (in app.js but no domain module home): ~341 functions remain in app.js that have no domain module counterpart (AI features, quick entry, rail, auth, today plan, etc.)
- PASS/FAIL matrix:
  - npx tsc --noEmit: PASS
  - npm run format:check: PASS
  - npm run lint:html: PASS
  - npm run lint:css: PASS
  - npm run test:unit: PASS (207/207)
  - CI=1 npm run test:ui:fast: PASS (204 passed, 32 skipped, 0 failed)

## Outcome

**DONE** — The 5 domain modules are now active code (not dead). app.js imports from all of them and the duplicate implementations have been deleted.

**< 500 line target not met.** The target was based on the assumption that the 5 domain modules covered most of app.js. In practice, the modules cover ~4,408 lines of the original 13,918 lines. The remaining ~9,510 lines contain app.js-only functions (AI features, quick entry, rail rendering, auth flows, today plan, etc.) that have no domain module home. Reaching < 500 lines would require Task 148 to extract those into additional domain modules.

**Domain module staleness fixes applied** (discovered during test runs):
1. `projectsState.js` — `getSelectedProjectKey` was a proxy creating infinite recursion; fixed by moving the import to `filterLogic.js`
2. `store.js` — `createInitialTodayPlanState()` had wrong 8-field shape (missing mode, envelope, etc.); updated to correct 15-field shape
3. `filterLogic.js` — `renderProjectHeadingGroupedRows` missing project-inline-actions buttons; synced with master
4. `filterLogic.js` — `updateHeaderFromVisibleTodos` conditionally omitted date label; fixed to always pass `getCurrentDateViewLabel()`
5. `projectsState.js` — `getProjectDeleteDialogElements` used wrong DOM IDs and `hidden` attribute instead of `style.display`
