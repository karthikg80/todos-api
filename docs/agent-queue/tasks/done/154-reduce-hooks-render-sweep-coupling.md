# TASK 154: reduce-hooks-render-sweep-coupling

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-154-reduce-hooks-render-sweep-coupling
base: master

## Intent
Replace direct `hooks.renderTodos?.()` calls in domain modules with EventBus dispatches so modules no longer command broad render sweeps — they signal state changes and let the view layer decide when to render.

## Background

The current wiring in app.js:
```js
hooks.renderTodos = () => EventBus.dispatch("todos:render");
EventBus.subscribe("todos:changed", applyFiltersAndRender);
EventBus.subscribe("todos:render", renderTodos);
```

This means `hooks.renderTodos()` already routes through EventBus. The problem is that domain modules call `hooks.renderTodos?.()` directly — 71 calls across the codebase — rather than dispatching a semantic event. This creates horizontal coupling where business logic explicitly commands render sweeps.

The fix: modules should dispatch `EventBus.dispatch("todos:changed", { reason })` instead of calling `hooks.renderTodos?.()`. Since `todos:changed` already triggers `applyFiltersAndRender`, this is a pure wiring change — behavior is identical.

However: NOT all `hooks.render*` calls should change. Some hooks render specific sub-surfaces (rail, plan panel, home dashboard) and those remain as-is. The scope is specifically `hooks.renderTodos?.()` calls in domain modules.

## Current hooks.renderTodos call inventory

Run `grep -rn "hooks.renderTodos" client/modules/` to get the exact list before touching anything.
Expected: ~17 in todosService.js, ~10 in filterLogic.js, ~9 in projectsState.js, ~14 in drawerUi.js.

## Scope

1. **Audit first** — run `grep -rn "hooks.renderTodos" client/modules/` and list every callsite with its surrounding context (what mutation just happened).

2. **Move EventBus** — EventBus is currently defined inline in app.js. Extract it to `client/modules/eventBus.js` so domain modules can import it:
   ```js
   // client/modules/eventBus.js
   export const EventBus = (() => {
     const subscribers = {};
     return {
       subscribe(event, fn) { ... },
       dispatch(event, payload) { ... },
     };
   })();
   ```
   Update app.js to import EventBus from eventBus.js instead of defining it inline.

3. **Replace calls** — In each domain module, replace:
   ```js
   hooks.renderTodos?.();
   ```
   with:
   ```js
   EventBus.dispatch("todos:changed", { reason: "<descriptive-reason>" });
   ```
   Where `reason` describes the mutation that just happened (e.g. "todo-deleted", "todo-toggled", "project-selected").

4. **Keep these hooks unchanged** — do NOT change these, they render specific surfaces:
   - `hooks.renderProjectsRail?.()`
   - `hooks.renderTodayPlanPanel?.()`
   - `hooks.renderHomeDashboard?.()`
   - `hooks.renderProjectHeadingCreateButton?.()`
   - `hooks.renderOnCreateAssistRow?.()`
   - Any `hooks.render*` that is NOT `hooks.renderTodos`

5. **app.js wiring** — After step 3, `hooks.renderTodos = () => EventBus.dispatch("todos:render")` in app.js may become unused. If no more callers exist, remove that assignment. Keep `EventBus.subscribe("todos:changed", applyFiltersAndRender)` intact.

6. Update `docs/memory/brief/BRIEF.md` Active Architecture Patterns — update EventBus description to reflect the expanded usage.

## Out of Scope
- Replacing hooks.render* calls for non-todos surfaces
- Reactive rendering model / observable state
- Changing applyFiltersAndRender behavior
- Virtual scroll or DOM diffing

## Files Allowed
- `client/modules/eventBus.js` (new)
- `client/modules/todosService.js`
- `client/modules/filterLogic.js`
- `client/modules/projectsState.js`
- `client/modules/drawerUi.js`
- `client/modules/aiWorkspace.js`
- `client/modules/onCreateAssist.js`
- `client/modules/taskDrawerAssist.js`
- `client/modules/todayPlan.js`
- `client/app.js`
- `docs/memory/brief/BRIEF.md`

## Acceptance Criteria
- [ ] `client/modules/eventBus.js` exists and is imported by app.js + domain modules
- [ ] Zero `hooks.renderTodos?.()` calls remain in any module under `client/modules/`
- [ ] `hooks.renderTodos` assignment in app.js is removed (no callers remain)
- [ ] `EventBus.subscribe("todos:changed", applyFiltersAndRender)` still wired in app.js
- [ ] All todo mutations (add, edit, delete, toggle, reorder, bulk) still trigger re-render
- [ ] `npm run test:unit` passes
- [ ] `CI=1 npm run test:ui:fast` passes

## Constraints
- Behavior must be identical — this is a wiring change only
- Each `EventBus.dispatch("todos:changed", { reason })` must have a meaningful reason string
- Do NOT change hooks that render specific sub-surfaces (rail, plan, home, heading create button)
- Do NOT introduce a new render event type — use existing `"todos:changed"` which already triggers `applyFiltersAndRender`
- BLOCKED if any todo mutation no longer triggers a re-render
- BLOCKED if touches >12 files

## MIC-Lite

### Motivation
71 `hooks.renderTodos?.()` calls across domain modules create horizontal coupling: business logic explicitly commands render sweeps. EventBus already exists and `todos:changed` already routes to `applyFiltersAndRender`. This is an incremental wiring improvement that reduces coupling without requiring a reactive rendering model.

### Impact
- No visible behavior change
- Domain modules gain an explicit dependency on EventBus (imported), lose implicit dependency on hooks.renderTodos
- Reason strings make render triggers searchable and auditable

### Checkpoints
- [ ] Audit output lists all callsites before any changes
- [ ] After extraction, `npx tsc --noEmit` passes
- [ ] UI smoke: add todo, complete todo, delete todo — all reflect correctly
- [ ] All test suites pass

## Scope Escalation Triggers
- Change touches >12 files → BLOCKED
- Any hooks.render* for non-todos surfaces is changed → BLOCKED
- Any todo mutation stops triggering re-render → BLOCKED

## Deliverable
- PR URL: see below
- Files changed: 9 (client/modules/eventBus.js new, client/app.js, client/modules/todosService.js, authUi.js, onCreateAssist.js, projectsState.js, overlayManager.js, todayPlan.js, drawerUi.js)
- Count of hooks.renderTodos calls replaced: 34
- PASS/FAIL matrix: tsc PASS, format:check PASS, test:unit PASS (209 tests), test:ui:fast PASS (205 passed, 33 skipped)

## Outcome
Extracted EventBus singleton from inline app.js IIFE into `client/modules/eventBus.js`. Replaced all 34 `hooks.renderTodos?.()` calls across 7 domain modules with `EventBus.dispatch("todos:changed", { reason: "..." })`. Removed the now-unused `hooks.renderTodos = ...` assignment from app.js wireHooks. Each dispatch carries a descriptive reason string (todo-added, todo-deleted, todo-toggled, todo-updated, todos-reordered, bulk-action, project-selected, drawer-state-changed, undo-applied, todos-loading, todos-loaded, todos-load-error, state-changed). Behavior is identical — `todos:changed` routes to `applyFiltersAndRender` as before.
