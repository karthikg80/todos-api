# TASK 144: server-side-filter-sort-aggregate

type: Red
status: READY
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-144-server-side-filter-sort-aggregate
base: master

## Intent
Move client-side filter, sort, and aggregate logic (filterTodosList, expandProjectTree, project counts) into PostgreSQL via Prisma queries, reducing client payload and eliminating derived-state race conditions.

## Scope
- Identify all filtering/sorting/aggregation currently done in filterTodosList and related functions
- Rewrite as Prisma queries with WHERE, ORDER BY, and aggregate clauses in relevant service files
- Update API endpoints to accept filter/sort parameters
- Update frontend to pass filter state as query params rather than filtering a full client-side array
- Keep filterTodos() as the client-side coordinator but remove the heavy computation from it

## Out of Scope
- No Prisma schema changes (use existing schema)
- No new npm dependencies
- No UI layout changes
- No test framework changes

## Files Allowed
- src/todoService.ts
- src/projectService.ts
- src/routes/
- public/app.js
- public/apiClient.js
- tests/ui/

## Acceptance Criteria
- [ ] Filter/sort operations execute in Postgres, not in JS array methods on the client
- [ ] Project counts/aggregates returned from API, not computed client-side
- [ ] filterTodos() on client becomes a thin coordinator (no heavy array processing)
- [ ] All existing filter behaviors produce identical results
- [ ] All tests pass

## Constraints
- Preserve filterTodos() and setSelectedProjectKey() as the external API contracts
- No schema migration required
- Keep response shape backward-compatible or update frontend atomically

## MIC-Lite

### Motivation
Client-heavy filtering is the primary source of UI jank on large datasets and the root cause of derived-state race conditions. Moving to server-side is the correct architectural boundary.

### Impact
Changes the data flow contract between frontend and backend. Risk is subtle filter behavioral differences or missed edge cases.

### Checkpoints
- [ ] For each filter type, verify output matches existing client-side behavior with test data
- [ ] Performance: measure filter latency before and after with 500+ todos

## Pre-Mortem

1. Most likely failure: a filter combination that worked client-side produces wrong results server-side due to a subtle join condition. Mitigation: comprehensive integration tests covering all filter combinations before deleting client logic.
2. Blast radius: if server filtering is wrong, all users see incorrect todo lists. Mitigation: keep client-side fallback path behind a feature flag during transition.
3. Rollback: revert API endpoint changes and restore client-side filter functions — no data model changes to unwind.

## Scope Escalation Triggers
- Modifies Prisma schema → BLOCKED, requires separate schema migration task
- Adds new dependency → requires approval
- Changes cross-module behavior contracts → pre-approved for this task

## Deliverable
- PR URL:
- Commit SHA(s):
- Files changed:
- PASS/FAIL matrix:

## Outcome
