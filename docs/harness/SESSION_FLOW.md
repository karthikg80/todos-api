# Session Flow

Required flow for a code-changing harness session.

## 1. Create a fresh worktree

Use the repo-required worktree flow from `AGENTS.md`. One branch and one
worktree should correspond to one issue or PR.

## 2. Get bearings before editing

At the start of a session:

1. run `git status --porcelain`
2. confirm the current working directory and branch
3. read:
   - `AGENTS.md`
   - `docs/WORKFLOW.md`
   - `docs/architecture/AGENT_RULES.md`
   - this harness directory
4. inspect recent relevant git history if the area has moved recently
5. initialize local `.codex/` session artifacts from `.codex/templates/`

## 3. Create local session artifacts

Every code-changing session should have:

- `.codex/context-ack.json`
- `.codex/progress.md`
- `.codex/feature-checklist.json`

Minimum expectations:

- `context-ack.json` records the docs/invariants that were acknowledged
- `progress.md` records what happened during the run
- `feature-checklist.json` captures the execution checklist for the current
  issue or slice

These are local harness artifacts, not durable task tracking.

## 4. Establish a baseline

Before editing code, establish whether the current worktree is healthy.

The harness baseline should include:

- typecheck
- formatting check
- HTML validation
- CSS lint
- fast unit tests when relevant to the area
- a deterministic UI/browser smoke when the task touches the app surface

The upcoming session scripts should automate this, but the flow is mandatory
even before those scripts exist.

## 5. Make the smallest coherent change

- keep changes scoped to the current issue
- reuse canonical services and route patterns
- do not create parallel business-logic paths
- update durable docs when the behavior or operating model changes

## 6. Re-run required verification

For code changes, run the repo-required checks:

- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `npm run test:unit`
- `CI=1 npm run test:ui:fast`

If a failure is unrelated, record that explicitly in the local progress log and
handoff instead of silently working around it.

## 7. Prepare handoff

The final handoff should include:

- branch name and head SHA
- changed files
- what was implemented
- verification results
- PR creation URL

The local `.codex/` artifacts can support that handoff, but GitHub remains the
durable task record.
