# GitHub Issues and Projects Operating Model

This repository uses GitHub-native task management.

## Source of Truth

- GitHub Issues are the source of truth for actionable work.
- GitHub Projects is the live execution board and agent queue.
- Markdown docs are for durable guidance only: workflow rules, briefs, ADR-like decisions, specs, and operating notes.

Do not use markdown task files as live task state.

## When to Open Which Issue

- Use the `Task` issue form for implementation work.
- Use the `Bug` issue form for defects or regressions.
- Use the `Brief Update` issue form when durable repo guidance needs to change.

## Recommended Lifecycle

`Backlog -> Ready -> In Progress -> In Review -> Blocked -> Done`

Project status should reflect the live state of the issue.

## Project Operating Model

The GitHub Project should carry the execution metadata that changes often:

- Status
- Priority
- Type
- Area
- Agent
- Brief Required

Use the project board for queueing, routing, and review flow. Keep labels lean and use them mainly for filtering and triage.

## Agent Routing

- `Codex` = implementation
- `Claude` = review, polish, spec refinement
- `Human` = decisions, approvals, validation

## When a Docs PR Is Required

Open or update a docs PR when a change affects durable guidance, including:

- workflow rules
- agent protocol
- architecture invariants
- canonical product behavior that future work must preserve
- operational setup steps that should be repeatable

Do not create docs-only changes just to mirror task status.

## Branch Naming

Recommended examples:

- `feat/123-short-name`
- `bugfix/144-sidebar-spacing`
- `brief/155-agent-queue-rules`

## Pull Request Convention

- Every implementation PR should link its GitHub Issue.
- The PR template should state why the change exists, what changed, how it was verified, and whether durable docs were updated.

## Migration Note

Move active work from markdown task docs into GitHub Issues as it is picked up.

Do not backfill the entire historical markdown archive. Leave old task docs in place as history unless they are being actively resumed.
