# Workflow Guide

How work moves through this repository.

## Source of Truth

Task state lives in GitHub Issues and GitHub Projects, not markdown docs.

- GitHub Issues are the unit of work.
- GitHub Projects is the live queue, review board, and agent routing surface.
- Markdown docs are for durable guidance only: workflow rules, briefs, specs, architecture notes, and operating runbooks.

For the repo-specific operating model, see `docs/ops/github-issues-projects-operating-model.md`.

## Creating Work

Use the GitHub issue forms:

- `Task` for implementation work
- `Bug` for defects and regressions
- `Brief Update` for durable guidance changes

## Recommended Lifecycle

`Backlog -> Ready -> In Progress -> In Review -> Blocked -> Done`

## Handoff Between Agents

Codex and Claude can still alternate builder/reviewer roles, but the linked GitHub Issue and Project state should carry the active handoff state.

- Builder work should end with a linked PR and verification notes.
- Reviewer feedback should be recorded on the PR.
- Durable guidance changes should update docs in the same PR or an immediate follow-up.

## Legacy Markdown Queue

`docs/agent-queue/tasks/` is legacy archive material from the pre-Issues workflow.

- Do not create new markdown task files for live work.
- When resuming an old markdown task, move the active state into a GitHub Issue instead of duplicating status in docs.
- Do not backfill the entire archive.

## Memory Compaction

When `docs/memory/brief/BRIEF.md` exceeds ~2 pages:

1. Extract any new universal rules into `docs/memory/canon/CANON.md`.
2. Archive the old brief under `docs/memory/archive/`.
3. Write a fresh brief with current context only.
4. Update `docs/memory/index/INDEX.md` if pointers changed.
