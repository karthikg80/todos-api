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
| `scripts/check-architecture-invariants.mjs` | Mechanical guard for architecture rules |
| `scripts/check-harness-drift.mjs` | Mechanical guard for docs/runtime drift |
| `scripts/harness/cleanup-report.mjs` | Recurring cleanup report generator |

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

## Recurring cleanup loop

Run these locally when touching harness-sensitive areas:

- `npm run check:architecture`
- `npm run check:harness-drift`
- `npm run harness:cleanup-report`

The cleanup report writes actionable output under
`artifacts/harness/cleanup-report/`.

Every meaningful production bug or review finding should become one of:

- a new eval case
- a new mechanical guard
- or a durable docs update

See `docs/harness/SESSION_FLOW.md` for how a session should use these files.
