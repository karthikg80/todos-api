# Harness Guide

Canonical map for the repo harness.

The harness exists to make long-running agent work repeatable and checkable.
It does not replace GitHub Issues or GitHub Projects as the source of task
state.

## What lives here

| Path                          | Purpose |
| ----------------------------- | ------- |
| `docs/harness/README.md`      | Harness doc map and scope |
| `docs/harness/SESSION_FLOW.md`| Required flow for starting and running a worktree session |
| `docs/harness/EVALS.md`       | Eval strategy, current runners, and artifact expectations |
| `docs/harness/INVARIANT_MATRIX.md` | Matrix of repo invariants, enforcement points, and gaps |
| `scripts/harness/`            | Bootstrap, session-start, and smoke scripts |

## Session artifacts

Each worktree should keep local harness artifacts under `.codex/`:

- `.codex/context-ack.json`
- `.codex/progress.md`
- `.codex/feature-checklist.json`

These files are intentionally gitignored. They are local run state, not task
tracking. Initialize them from `.codex/templates/`.

## Source of truth split

- GitHub Issues and GitHub Projects hold task state.
- `docs/` holds durable guidance.
- `.codex/` holds worktree-local session state.

## Current harness boundaries

- The harness is script-first and repo-native.
- The repo continues to use Node, Jest, Playwright, Prisma, and shell scripts.
- External harness platforms are intentionally out of scope for the first pass.

See `docs/harness/SESSION_FLOW.md` for how a session should use these files.
