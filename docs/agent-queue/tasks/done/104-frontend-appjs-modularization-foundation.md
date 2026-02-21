# TASK 104: frontend-appjs-modularization-foundation

type: Red
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-104-frontend-appjs-modularization-foundation
base: master

## Intent *
Split the monolithic frontend controller into maintainable modules while preserving existing UX behavior and load-bearing event-delegation/filter contracts.

## Scope
- Introduce a modular frontend structure under `public/` (feature modules + shared runtime helpers).
- Move code out of `public/app.js` in phases:
  - shell/bootstrap
  - auth/session
  - project rail/filter controls
  - todo list/drawer flows
  - AI workspace flows
- Keep delegated event handling model intact (no direct listeners on dynamic children).
- Keep `filterTodos()` pipeline and `setSelectedProjectKey(...)` as canonical entry points.
- Keep script loading in static/no-build mode (deferred script tags, no bundler).

## Out of Scope
- Backend API contract changes.
- Prisma schema changes or migrations.
- New npm dependencies.
- Redesign of UI visuals.

## Files Allowed
- public/app.js
- public/index.html
- public/*.js
- tests/ui/**
- docs/ui-revamp/**

## Acceptance Criteria *
- [ ] `public/app.js` is reduced to orchestration/bootstrap responsibilities; major feature blocks are moved to dedicated modules.
- [ ] All current critical flows still work: auth, todo CRUD, filters, projects rail, task drawer, AI surfaces.
- [ ] Event delegation architecture is preserved and verified by existing UI tests.
- [ ] `filterTodos()` and `setSelectedProjectKey(...)` behavior remains unchanged.
- [ ] Required checks pass: `npx tsc --noEmit`, `npm run format:check`, `npm run lint:html`, `npm run lint:css`, `npm run test:unit`, `CI=1 npm run test:ui:fast`.

## Constraints
- Do not introduce a framework or build pipeline.
- Preserve DOM IDs/classes used by existing Playwright tests unless test updates are explicitly included.
- Prefer pure functions for extracted logic where feasible.

## MIC-Lite (Yellow/Red)

### Motivation
`public/app.js` is currently a high-coupling hotspot and blocks safe iteration. Modularization lowers regression risk and improves ownership.

### Impact
Large frontend refactor with broad touchpoints; highest risk is behavior drift in subtle UI states.

### Checkpoints
- [ ] Establish module boundaries and move one subsystem at a time with passing tests between moves.
- [ ] Run `CI=1 npm run test:ui:fast` after each subsystem extraction batch.
- [ ] Confirm no direct child-event listeners were introduced.

## Pre-Mortem (Red only)

Before implementation is approved, answer:
1. What is the most likely way this fails?
- Hidden coupling between features causes regressions after extraction.
2. What is the blast radius if it does fail?
- Broad frontend instability across auth, tasks, and AI interaction surfaces.
3. What is the rollback path?
- Revert module extraction commits incrementally to restore prior single-file behavior.

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
