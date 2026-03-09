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
- [ ] EventBus singleton implemented (subscribe, dispatch, unsubscribe)
- [ ] All state mutations dispatch events rather than calling render functions directly
- [ ] applyFiltersAndRender() triggered only via subscriptions, not direct calls
- [ ] All existing tests pass

## Constraints
- Vanilla JS only, no new dependencies
- Preserve filterTodos() and setSelectedProjectKey() as public API entry points

## MIC-Lite

### Motivation
Hidden dependencies between state variables and render calls make it impossible to reason about update order. A pub-sub pattern makes all state transitions explicit and interceptable.

### Impact
Internal plumbing change — no user-visible behavior change. Risk is missing a render subscription causing a stale UI state.

### Checkpoints
- [ ] After wiring, manually verify that todo create/edit/delete all trigger correct re-renders
- [ ] Run UI test suite

## Scope Escalation Triggers
- Change touches >10 files → BLOCKED (should be isolated to app.js)
- Adds new dependency → BLOCKED

## Deliverable
- PR URL:
- Commit SHA(s):
- Files changed:
- PASS/FAIL matrix:

## Outcome
