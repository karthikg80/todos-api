# TASK 105: frontend-bootstrap-dedup-and-log-hygiene

type: Green
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-105-frontend-bootstrap-dedup-and-log-hygiene
base: master

## Intent *
Eliminate duplicated client bootstrap/fallback logic and remove production-path debug logging from the frontend.

## Scope
- Remove duplicate fallback implementations in `public/app.js` for `AppState` and `ApiClient` now that `state.js` and `apiClient.js` are first-class scripts.
- Keep one canonical implementation in `public/state.js` and `public/apiClient.js`.
- Remove debug `console.log` output that leaks todo content/notes.
- Keep operational `console.error` and intentional telemetry logging.

## Out of Scope
- Module-wide frontend decomposition.
- Backend logging changes.
- Any AI behavior change.

## Files Allowed
- public/app.js
- public/state.js
- public/apiClient.js
- tests/ui/**

## Acceptance Criteria *
- [ ] No duplicated `AppState`/`ApiClient` fallback implementation remains in `public/app.js`.
- [ ] Todo-content debug logs are removed from load/render paths.
- [ ] Auth/session behavior remains unchanged.
- [ ] Required checks pass: `npx tsc --noEmit`, `npm run format:check`, `npm run lint:html`, `npm run lint:css`, `npm run test:unit`, `CI=1 npm run test:ui:fast`.

## Constraints
- Preserve current script load order and static serving model.
- Do not remove telemetry event emission.

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
