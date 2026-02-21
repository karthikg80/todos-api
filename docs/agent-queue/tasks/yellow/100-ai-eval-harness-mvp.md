# TASK 100: ai-eval-harness-mvp

type: Yellow
status: REVIEW
mode: implement
builder: codex
reviewer: claude
branch: codex/task-100-ai-eval-harness-mvp
base: master

## Intent *
Add a minimal eval harness with golden fixtures that validate Decision Assist contract stability and rejection rules (contract-break detection, not subjective quality scoring).

## Scope
- Add deterministic fixture inputs/outputs for:
  - `task_drawer`
  - `on_create`
  - `today_plan`
- Add unit tests that:
  - validate fixtures pass schema/validator
  - validate malformed payloads are rejected per rules
- Keep harness small and easy to extend

## Out of Scope
- No model quality scoring or ranking evaluation
- No CI snapshot updates
- No new dependencies

## Files Allowed
- src/**
- docs/** (optional)

## Acceptance Criteria *
- [x] Fixtures exist for the three surfaces (readable JSON)
- [x] Unit test validates fixtures pass contract validator
- [x] Unit test validates rejection behavior for malformed payloads
- [x] No DB schema changes; no new deps

## Constraints
- Deterministic and fast (unit-test tier)
- Fail only on contract breaks, not on subjective “quality”

## MIC-Lite (Yellow/Red)

### Motivation
We need a regression tripwire so future prompt/contract changes don’t silently break UI rendering/apply safety.

### Impact
Adds tests/fixtures only. Risk: brittle tests if fixtures are too strict.

### Checkpoints
- [x] Ensure tests validate schema/contract only (not ordering or exact phrasing unless required)
- [x] Ensure runtime remains fast (unit test tier)

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
Task requirements are satisfied via `src/aiContracts.test.ts` and deterministic JSON fixtures under `src/aiEval/fixtures/`. Valid fixture coverage exists for `task_drawer`, `on_create`, and `today_plan`; malformed fixtures are asserted to fail contract validation (unknown type, duplicate clarification, invalid confidence range, too many subtasks). No schema or dependency changes were required.
