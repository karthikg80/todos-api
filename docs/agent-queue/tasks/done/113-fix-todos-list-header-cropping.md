# TASK 113: fix-todos-list-header-cropping

type: Green
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: codex/fix-all-tasks-crop
base: master

## Intent *
Prevent the sticky `Projects / All tasks` header row from clipping/cropping in the main todos scroll panel when many todos are present.

## Scope
- Adjust the todos list header row alignment in `public/styles.css`
- Preserve existing filtering/project-selection behavior and event delegation patterns

## Out of Scope
- Backend/API changes
- Changes to todos filtering semantics
- HTML/JS behavior changes
- New tests or snapshot updates

## Files Allowed
- public/styles.css
- docs/agent-queue/tasks/done/113-fix-todos-list-header-cropping.md

## Acceptance Criteria *
- [ ] `Projects / All tasks` header text is not visually clipped in the sticky list header while scrolling long todo lists
- [ ] Change is limited to CSS layout styling for the todos list header

## Constraints
- Keep the sticky header behavior intact
- No changes to `public/app.js` event delegation or selection flows

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable
- PR URL: N/A (local merge requested)
- Commit SHA(s): pending
- Files changed: `public/styles.css`
- PASS/FAIL matrix: pending

## Outcome *
Implemented a one-line CSS fix in `.todos-list-header` (`align-items: baseline` -> `align-items: center`) to stop sticky-header text clipping inside the overflow-constrained todos scroll region. Required verification commands could not run in this local environment because several dev-tool binaries were unavailable after `npm ci` (`typescript`, `prettier`, `html-validate`, `stylelint`, `jest`, `playwright`).
