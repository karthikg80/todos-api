# Dual-Agent Protocol (Codex + Claude)

This protocol defines how Codex and Claude collaborate without manual babysitting.

## Objective
- Keep execution autonomous and safe.
- Ensure every change is reviewed by the other agent.
- Merge only when CI and cross-agent review are both green.

## Roles
- `builder`: writes code, tests, and PR updates.
- `reviewer`: performs adversarial review and validation only.
- Roles alternate by task.

## Workflow
1. Pick next queue item in `READY` state.
2. Builder executes scoped implementation and opens PR.
3. Reviewer reviews code and posts findings.
4. Builder addresses findings and pushes updates.
5. Reviewer signs off when no blocking findings remain.
6. Merge only after required checks are green.

## State Machine
- `READY` -> `RUNNING`
- `RUNNING` -> `REVIEW`
- `REVIEW` -> `FIX`
- `FIX` -> `REVIEW`
- `REVIEW` -> `MERGE`
- `MERGE` -> `DONE`
- Any state -> `BLOCKED` (with reason + owner)

## Review Contract
- Reviewer output must include:
  - Findings ordered by severity (`P1`, `P2`, `P3`)
  - File references and exact repro notes
  - Missing test coverage (if any)
- If no issues: explicit `NO_FINDINGS` statement plus residual risk.

## Merge Gates
- Required checks must be green:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run lint:html`
  - `npm run lint:css`
  - `npm run test:unit`
  - `CI=1 npm run test:ui:fast`
- Reviewer approval required before merge.

## Task Classification

Tasks are classified by blast radius. Classification determines required ceremony.

| Type   | Scope                        | Ceremony Budget | Required Sections          |
|--------|------------------------------|-----------------|----------------------------|
| Green  | Local, ≤~5 files             | ~2 min          | Intent, AC, Outcome        |
| Yellow | Bounded, single module       | ~10 min         | + MIC-Lite                 |
| Red    | Cross-module, new pattern    | ~20 min         | + MIC-Lite + Pre-Mortem    |

Use `TEMPLATE_V2.md` and place tasks in `tasks/green/`, `tasks/yellow/`, or `tasks/red/`.

### Red Pre-Mortem Requirement

Before a Red task moves from `READY` to `RUNNING`, the builder must answer:
1. What is the most likely way this fails?
2. What is the blast radius if it does fail?
3. What is the rollback path?

Reviewer must confirm the pre-mortem is adequate before approving implementation.

## Scope Escalation

If during implementation any of these thresholds are crossed, the builder must:
1. Set task status to `BLOCKED`.
2. Note which threshold was crossed.
3. Wait for re-approval before continuing.

**Escalation thresholds (defaults):**
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new npm dependency
- Changes cross-module behavior contracts
- Modifies data model (`prisma/schema.prisma`)

A Green task that escalates becomes Yellow or Red. Update the task file accordingly.

## Survival Mode

When time-pressured, only three things are mandatory:
1. **Intent** — what the task achieves
2. **Acceptance criteria** — how to verify success
3. **Outcome** — what actually happened

All other ceremony can be skipped without breaking the workflow.

## Guardrails
- One task per PR.
- Small, reviewable diffs.
- No backend/API changes unless task explicitly allows.
- Do not commit untracked `docs/` content unless task explicitly allows.
- Preserve existing delegated event model and filter semantics unless task says otherwise.

## Failure Policy
- If CI fails:
  - Builder fixes and re-pushes up to 2 cycles.
  - If still failing, set task to `BLOCKED` with failing check + logs.
- If rebase conflict:
  - Rebase onto `origin/master`.
  - Keep only task-scoped changes.
  - Re-run required checks before returning to `REVIEW`.

## Handoff Formats
Builder handoff to reviewer:
- Branch
- PR URL
- Commits
- Files changed
- Commands run and PASS/FAIL matrix
- Known risks

Reviewer handoff to builder:
- `NO_FINDINGS` OR severity findings list
- Required fixes
- Tests to add/update
- Recheck commands

## Ownership Rotation
- Task `N`: builder `codex`, reviewer `claude`
- Task `N+1`: builder `claude`, reviewer `codex`

