# TASK 146: debounce-render-filter-triggers

type: Green
status: READY
mode: implement
builder: claude
reviewer: user
branch: claude/task-146-debounce-render-filter-triggers
base: master

## Intent
Add debouncing (150-300ms) to any render or filter call triggered by keystroke events to prevent re-render thrashing on text input.

## Scope
- Identify all event listeners wired to keystroke/input events that call filterTodos() or renderTodos()
- Wrap them with a debounce(fn, 250) utility
- Implement a minimal debounce utility inline (no lodash dependency)

## Out of Scope
- No CSS changes
- No backend changes
- No test rewrites

## Files Allowed
- public/app.js

## Acceptance Criteria
- [ ] No filter or render call fires on every keystroke
- [ ] Debounce delay is 150-300ms (configurable constant)
- [ ] All existing tests pass (debounce transparent to test assertions)

## Constraints
- No new npm dependencies (inline utility only)

## Deliverable
- PR URL:
- Commit SHA(s):
- Files changed:
- PASS/FAIL matrix:

## Outcome
