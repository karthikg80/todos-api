# TASK 108: api-driven-filtering-pagination-and-query-contract

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-108-api-driven-filtering-pagination-and-query-contract
base: master

## Intent *
Move toward API-driven filtering/pagination so frontend no longer depends on loading the entire todo dataset for core filtering operations.

## Scope
- Implement incremental adoption of backend query params from frontend list loading paths.
- Keep canonical client filter pipeline intact while delegating data selection to API where possible.
- Ensure search/project/date filters are mapped consistently and safely.
- Add tests for query mapping and backward compatibility.

## Out of Scope
- Removing `filterTodos()` or `setSelectedProjectKey(...)` contracts.
- Full-text search backend redesign.
- DB schema changes.

## Files Allowed
- public/app.js
- public/apiClient.js
- src/routes/todosRouter.ts
- src/validation.ts
- src/**/*.test.ts
- tests/ui/**

## Acceptance Criteria *
- [ ] Frontend todo-loading path sends query params for supported filters/pagination instead of always fetching all todos.
- [ ] Existing filter UX remains functionally consistent for end users.
- [ ] Query validation remains strict and backward-compatible.
- [ ] Required checks pass: `npx tsc --noEmit`, `npm run format:check`, `npm run lint:html`, `npm run lint:css`, `npm run test:unit`, `CI=1 npm run test:ui:fast`.

## Constraints
- No sleep-based waits in tests.
- Preserve deterministic behavior for date view and project selection.
- If API contract must change, include compatibility layer rather than breaking existing callers.

## MIC-Lite (Yellow/Red)

### Motivation
Client-side filtering over full datasets will not scale and causes avoidable transfer/render work.

### Impact
Changes data-fetch patterns and potentially impacts perceived list freshness/performance.

### Checkpoints
- [ ] Introduce query mapping with parity checks against current client-side results.
- [ ] Validate edge cases for empty filters, project hierarchy, and date views.
- [ ] Run full required check suite before handoff.

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed
- PASS/FAIL matrix

## Outcome *
(filled after completion: what actually happened vs. intent)
