# TASK 145: pubsub-state-update-pattern

type: Yellow
status: DONE
mode: implement
builder: claude
reviewer: user
branch: claude/task-145-pubsub-state-update-pattern
base: master

## Intent
Route all state mutations through a lightweight subscribe/dispatch pattern to eliminate hidden dependencies in applyFiltersAndRender() and make state transitions auditable.

## Scope
- Implement a minimal EventBus (subscribe/dispatch/unsubscribe) in app.js
- Identify all sites that mutate state and trigger re-renders
- Route mutations through dispatch(event, payload) and subscribe renderers to relevant events
- applyFiltersAndRender() becomes a subscriber, not an imperative call scattered across codebase

## Out of Scope
- No external state library (Zustand, Redux, etc.)
- No backend changes
- No CSS changes

## Files Allowed
- public/app.js

## Acceptance Criteria
- [x] EventBus singleton implemented (subscribe, dispatch, unsubscribe)
- [x] All state mutations dispatch events rather than calling render functions directly
- [x] applyFiltersAndRender() triggered only via subscriptions, not direct calls
- [x] All existing tests pass

## Constraints
- Vanilla JS only, no new dependencies
- Preserve filterTodos() and setSelectedProjectKey() as public API entry points

## MIC-Lite

### Motivation
Hidden dependencies between state variables and render calls make it impossible to reason about update order. A pub-sub pattern makes all state transitions explicit and interceptable.

### Impact
Internal plumbing change — no user-visible behavior change. Risk is missing a render subscription causing a stale UI state.

### Checkpoints
- [x] After wiring, manually verify that todo create/edit/delete all trigger correct re-renders
- [x] Run UI test suite

## Scope Escalation Triggers
- Change touches >10 files → BLOCKED (should be isolated to app.js)
- Adds new dependency → BLOCKED

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/185
- Commit SHA(s): 183d66e67f748c3a0f21b89da170cc51554ebbad
- Files changed: public/app.js (1 file, +30 -6 lines)
- PASS/FAIL matrix:
  - tsc --noEmit: PASS
  - format:check: PASS
  - lint:html: PASS
  - lint:css: PASS
  - test:unit: PASS (207/207)
  - test:ui:fast: PASS (204 passed, 0 failures)

## Outcome
Implemented a 20-line IIFE-based EventBus singleton in app.js (after the imports block). Two events were created:

- `todos:changed` — fired when state changes require a filter+render cycle; applyFiltersAndRender() is subscribed as the handler.
- `todos:render` — fired when a raw re-render (no filter) is needed; renderTodos() is subscribed as the handler.

**Hook intercept pattern:** The wireHooks() function previously assigned `hooks.applyFiltersAndRender = applyFiltersAndRender` and `hooks.renderTodos = renderTodos` directly. These are now replaced with thin dispatch wrappers, so all domain module calls that go through `hooks.applyFiltersAndRender(...)` are automatically routed through the EventBus without touching any domain module file.

**Direct call sites replaced (4 total):**
1. `applyFiltersAndRender({ reason: \`home-see-all-${tileKey}\` })` → `EventBus.dispatch("todos:changed", { reason: ... })`
2. `applyFiltersAndRender({ reason: "workspace-view" })` → `EventBus.dispatch("todos:changed", { reason: "workspace-view" })`
3. `filterTodos()` in syncSheetSearch() → `EventBus.dispatch("todos:changed")`
4. `filterTodos()` on Escape key clear → `EventBus.dispatch("todos:changed")`

filterTodos() and setSelectedProjectKey() signatures remain unchanged.
