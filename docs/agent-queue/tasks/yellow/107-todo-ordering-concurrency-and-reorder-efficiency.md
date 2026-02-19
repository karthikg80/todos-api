# TASK 107: todo-ordering-concurrency-and-reorder-efficiency

type: Yellow
status: READY
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-107-todo-ordering-concurrency-and-reorder-efficiency
base: master

## Intent *
Harden todo ordering semantics under concurrency and improve reorder write efficiency without changing user-facing behavior.

## Scope
- Audit and harden create/reorder ordering logic in `PrismaTodoService`.
- Reduce N-update reorder patterns where practical.
- Add/expand tests for concurrent create/reorder correctness and stable ordering.
- Document any deferred schema-level hardening if needed.

## Out of Scope
- UI behavior redesign.
- Changes to project/category product semantics.
- New dependencies.

## Files Allowed
- src/prismaTodoService.ts
- src/prismaTodoService.test.ts
- src/**/*.integration.test.ts
- prisma/schema.prisma (only if explicitly approved during escalation)
- docs/**

## Acceptance Criteria *
- [ ] Ordering behavior is deterministic under concurrent todo creation/reorder scenarios.
- [ ] Reorder implementation reduces avoidable per-item write overhead or clearly documents a bounded strategy.
- [ ] Tests cover race/consistency cases and pass.
- [ ] Required checks pass: `npx tsc --noEmit`, `npm run format:check`, `npm run test:unit`, `CI=1 npm run test:ui:fast`.

## Constraints
- Preserve API responses and existing sorting semantics.
- If schema/index change is required, task must move to BLOCKED and get explicit re-approval before modifying Prisma schema.

## MIC-Lite (Yellow/Red)

### Motivation
Current order assignment and reorder patterns are correctness/performance hotspots as task volume and concurrency increase.

### Impact
Touches persistence logic; risk is order regressions or accidental behavior drift in list rendering.

### Checkpoints
- [ ] Reproduce baseline ordering behavior with tests before refactor.
- [ ] Validate post-change order stability across create/update/reorder paths.
- [ ] Re-run fast UI suite to ensure drag/order behavior remains intact.

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
