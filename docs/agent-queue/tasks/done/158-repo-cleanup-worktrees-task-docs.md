# TASK 158: repo-cleanup-worktrees-task-docs

type: Green
status: DONE
mode: chore
builder: human
reviewer: n/a
branch: cleanup/worktrees-and-task-docs (merged as PR #201)
pr: https://github.com/karthikg80/todos-api/pull/201
merged: 2026-03-09
sha: 4eb4b6b

## Problem
Six stale .worktrees/* entries (submodule refs) had accumulated from prior sprints.
Task docs for 151 and 152 were still sitting in yellow/ after those tasks had shipped.

## What Changed
- Removed obsolete .worktrees/* submodule entries:
  collapsed-rail-followup, collapsed-rail-polish, dnd-heading-flake-fix,
  heading-move-fix, project-actions, task-144, task-151-naming
- Moved task docs 151 and 152 from yellow/ to done/
- Removed associated markdown files for obsolete worktrees

## Files Changed
- .worktrees/* (7 removed)
- docs/agent-queue/tasks/yellow/151-* → done/
- docs/agent-queue/tasks/yellow/152-* → done/

## Outcome
Repo is clean: no stale worktree refs, done tasks in done/.
