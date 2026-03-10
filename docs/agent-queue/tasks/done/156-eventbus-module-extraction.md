# TASK 156: eventbus-module-extraction

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-154-eventbus (merged as PR #199)
pr: https://github.com/karthikg80/todos-api/pull/199
merged: 2026-03-09
sha: a9717eb

## Problem
EventBus was defined as an inline IIFE inside app.js and `hooks.renderTodos?.()` was
called directly across 34 sites in 7 domain modules. Business logic was directly
commanding renders rather than emitting state-change events.

## What Changed
- Extracted EventBus singleton from app.js into `client/modules/eventBus.js`
- Replaced all 34 `hooks.renderTodos?.()` calls with `EventBus.dispatch("todos:changed", { reason: "..." })`
- Each dispatch carries a descriptive reason string (todo-added, todo-deleted, todo-toggled, etc.)
- Removed the now-unused `hooks.renderTodos = ...` assignment from app.js wireHooks
- Behavior identical: todos:changed still routes to applyFiltersAndRender

## Files Changed (9)
- client/modules/eventBus.js (new)
- client/app.js
- client/modules/todosService.js
- client/modules/authUi.js
- client/modules/onCreateAssist.js
- client/modules/projectsState.js
- client/modules/overlayManager.js
- client/modules/todayPlan.js
- client/modules/drawerUi.js

## Verification
- npx tsc --noEmit: PASS
- npm run format:check: PASS
- npm run test:unit: PASS (209 tests)
- CI=1 npm run test:ui:fast: PASS (205 passed, 33 skipped)

## Outcome
EventBus is now a proper module. Domain modules emit events; the render pipeline
subscribes. 34 direct render commands replaced with 13 distinct reason-tagged
dispatches across 7 modules. This is the P1 capstone: business logic no longer
commands renders directly.
