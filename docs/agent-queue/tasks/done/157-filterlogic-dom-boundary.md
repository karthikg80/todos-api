# TASK 157: filterlogic-dom-boundary

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-155-dom-boundary (merged as PR #200)
pr: https://github.com/karthikg80/todos-api/pull/200
merged: 2026-03-09
sha: 8057a63

## Problem
filterLogic.js had ~15 getElementById calls with no policy documentation distinguishing
pure logic from DOM reads. One Category C violation existed: a direct DOM query inside
filterTodosList() which is supposed to be a pure function.

## What Changed
- Added explicit DOM Boundary Layer section dividers and policy JSDoc to filterLogic.js
- Classified all DOM accesses as A (input read), B (display), or C (pure logic violation)
- Extracted the Category C violation from filterTodosList() into a boundary reader
  with an explicit searchQuery parameter — callers retain default DOM-backed path
- No behavior changes in the filter pipeline
- No changes to app.js call sites needed (getVisibleTodos() default path unchanged)

## Files Changed (1)
- client/modules/filterLogic.js

## Verification
- npx tsc --noEmit: PASS
- npm run format:check: PASS
- npm run lint:html: PASS
- npm run lint:css: PASS
- test:unit / test:ui:fast: blocked by sandbox EPERM (pre-existing infra issue)

## Outcome
filterLogic.js now has a documented, enforced DOM boundary. Pure functions are pure.
The DOM Boundary Layer pattern is established as an architectural precedent for future
logic modules that must read from the DOM.
