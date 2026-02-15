# Task Template v2

Copy this file into the appropriate subdirectory:
- `tasks/green/` — small, local, fast-path
- `tasks/yellow/` — meaningful but bounded
- `tasks/red/` — cross-module, new pattern, or data model change

Name the file `NNN-short-name.md`.

---

```md
# TASK NNN: short-name

type: Green | Yellow | Red
status: READY
mode: plan | implement | refactor
builder: codex | claude
reviewer: claude | codex
branch: <agent>/task-NNN-short-name
base: master

## Intent *
What outcome this task achieves (one sentence).

## Scope
- In-scope item 1
- In-scope item 2

## Out of Scope
- (list exclusions)

## Files Allowed
- path/to/file.ext

## Acceptance Criteria *
- [ ] Criterion 1
- [ ] Criterion 2

## Constraints
- (architectural limits, performance budgets, etc.)

<!-- ===== YELLOW / RED only — delete this block for Green ===== -->

## MIC-Lite (Yellow/Red)

### Motivation
Why this change matters now.

### Impact
What existing behavior changes and what's at risk.

### Checkpoints
- [ ] Checkpoint 1 (verify before continuing)
- [ ] Checkpoint 2

<!-- ===== RED only — delete this block for Yellow/Green ===== -->

## Pre-Mortem (Red only)

Before implementation is approved, answer:
1. What is the most likely way this fails?
2. What is the blast radius if it does fail?
3. What is the rollback path?

<!-- ===== end conditional sections ===== -->

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed
- PASS/FAIL matrix

## Outcome *
(filled after completion: what actually happened vs. intent)
```

## Notes

- Fields marked `*` are required even in **survival mode** (time-pressured).
- **Green fast path:** delete the MIC-Lite and Pre-Mortem sections entirely. Keep it short.
- **Yellow:** include MIC-Lite, delete Pre-Mortem.
- **Red:** include both MIC-Lite and Pre-Mortem. Pre-mortem must be answered before implementation begins.
- The existing `TEMPLATE.md` remains valid for simple tasks. This template adds classification and escalation.
