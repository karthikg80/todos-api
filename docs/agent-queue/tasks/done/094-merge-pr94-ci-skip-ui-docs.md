# TASK 094: merge-pr94-ci-skip-ui-docs

type: Green
status: READY
mode: implement
builder: codex
reviewer: claude
branch: codex/task-094-merge-pr94-ci-skip-ui-docs
base: master

## Intent *
Merge PR #94 (CI optimization) with squash + delete branch, ensuring required checks remain satisfied.

## Scope
- Merge PR #94 using squash merge
- Verify required checks are green prior to merge
- Delete branch after merge

## Out of Scope
- Any edits to workflow files
- Changes to branch protection settings

## Files Allowed
- (none)

## Acceptance Criteria *
- [ ] PR #94 is merged to `master` via squash merge
- [ ] Branch `codex/ci-skip-ui-tests-docs-only` is deleted after merge
- [ ] Post-merge `master` is green on GitHub required checks

## Constraints
- Do not modify code; merge-only task.

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/94
- Commit SHA(s)
- Files changed: none
- PASS/FAIL matrix (checks green)

## Outcome *
(filled after completion: what actually happened vs. intent)
