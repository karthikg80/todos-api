# TASK 106: ai-router-usecase-decomposition

type: Red
status: READY
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-106-ai-router-usecase-decomposition
base: master

## Intent *
Refactor the AI HTTP layer into thin routes plus dedicated application use-cases/services to reduce coupling and improve testability.

## Scope
- Decompose `src/routes/aiRouter.ts` responsibilities into separate application-layer units:
  - quota/usage service
  - suggestion normalization/validation orchestrator
  - suggestion apply/dismiss use-cases
  - insights/feedback aggregation service
- Keep route handlers focused on HTTP translation (request validation, response mapping, status codes).
- Keep existing endpoint paths and response contracts stable.
- Add targeted tests for extracted services and keep existing route integration coverage green.

## Out of Scope
- New AI product features.
- Changes to external provider protocol.
- Prisma schema changes.
- New runtime dependencies.

## Files Allowed
- src/routes/aiRouter.ts
- src/ai*.ts
- src/decisionAssist*.ts
- src/**/ai*.test.ts
- src/**/*.test.ts
- docs/**

## Acceptance Criteria *
- [ ] `src/routes/aiRouter.ts` is materially reduced and contains route/HTTP concerns only.
- [ ] Business rules for quota, apply/dismiss semantics, and throttle checks are covered by focused tests outside the router file.
- [ ] Existing AI endpoint behavior remains backward-compatible.
- [ ] Required checks pass: `npx tsc --noEmit`, `npm run format:check`, `npm run test:unit`, `CI=1 npm run test:ui:fast`.

## Constraints
- Preserve response codes and payload shapes for existing clients.
- Keep deterministic fallback behavior in `AiPlannerService` unchanged.
- Avoid introducing circular dependencies between router and services.

## MIC-Lite (Yellow/Red)

### Motivation
The current AI router combines transport, orchestration, and policy logic in one place, increasing regression risk and slowing feature changes.

### Impact
High-touch backend refactor with risk around behavior parity and error mapping.

### Checkpoints
- [ ] Extract one use-case at a time with parity tests before removing inline router logic.
- [ ] Validate AI contract tests and integration tests after each extraction milestone.
- [ ] Confirm no endpoint contract drift via existing API tests.

## Pre-Mortem (Red only)

Before implementation is approved, answer:
1. What is the most likely way this fails?
- Subtle route behavior changes (status codes/fields) during extraction.
2. What is the blast radius if it does fail?
- Frontend AI panels may break or show inconsistent behavior.
3. What is the rollback path?
- Revert extraction commits and restore previous router code path.

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
