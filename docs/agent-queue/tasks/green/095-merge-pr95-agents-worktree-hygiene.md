# TASK 095: merge-pr95-agents-worktree-hygiene

type: Green
status: READY
mode: implement
builder: codex
reviewer: claude
branch: codex/task-095-merge-pr95-agents-worktree-hygiene
base: master

## Intent *
Merge PR #95 (AGENTS.md worktree hygiene) with squash + delete branch to enforce protocol.

## Scope
- Merge PR #95 using squash merge
- Verify required checks are green prior to merge
- Delete branch after merge

## Out of Scope
- Any further edits to AGENTS.md beyond what’s in PR #95

## Files Allowed
- (none)

## Acceptance Criteria *
- [ ] PR #95 is merged to `master` via squash merge
- [ ] Branch for PR #95 is deleted after merge
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
- PR URL: https://github.com/karthikg80/todos-api/pull/95
- Commit SHA(s)
- Files changed: none
- PASS/FAIL matrix (checks green)

## Outcome *
(filled after completion: what actually happened vs. intent)
