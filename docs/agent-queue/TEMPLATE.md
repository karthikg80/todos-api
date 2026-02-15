# Task Template (Dual-Agent Queue)

Copy this file into `docs/agent-queue/tasks/` as `NNN-short-name.md`.

```md
# TASK_ID: NNN

status: READY
builder: codex
reviewer: claude
branch: codex/task-NNN-short-name
base: master
labels: agent,safe-ui

## Goal
One-sentence outcome.

## Scope
- In scope item 1
- In scope item 2

## Out of Scope
- No backend/API changes
- No filter semantics changes
- No event model rewrites

## Files Allowed
- public/styles.css
- tests/ui/example.spec.ts

## Acceptance Criteria
- Criterion 1
- Criterion 2

## Required Commands
- npx tsc --noEmit
- npm run format:check
- npm run lint:html
- npm run lint:css
- npm run test:unit
- CI=1 npm run test:ui:fast

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed
- PASS/FAIL matrix
```

## Notes
- Use one task per PR.
- Keep branch prefix `codex/` for Codex-owned execution.
- Reviewer must provide either `NO_FINDINGS` or severity-ranked findings.

