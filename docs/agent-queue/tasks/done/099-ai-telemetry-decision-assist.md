# TASK 099: ai-telemetry-decision-assist

type: Red
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: codex/task-099-ai-telemetry-decision-assist
base: master

## Intent *
Add non-fatal telemetry events for Decision Assist suggestion lifecycle (generate/view/apply/dismiss/undo) across task_drawer, on_create, and today_plan surfaces.

## Scope
- Emit structured telemetry events (server-side preferred; UI only for local undo if needed)
- Cover surfaces: `task_drawer`, `on_create`, `today_plan`
- Document event names + payload fields in PR description

## Out of Scope
- No personalization or ranking changes
- No new dependencies
- No DB schema changes
- No dashboard building (just emit/log events)

## Files Allowed
- src/**
- public/app.js (only if needed for local undo event)
- tests/**

## Acceptance Criteria *
- [ ] Emits events (non-fatal) for:
  - `ai_suggestion_generated`
  - `ai_suggestion_viewed`
  - `ai_suggestion_applied`
  - `ai_suggestion_dismissed`
  - `ai_suggestion_undo` (if undo is local-only, emit from UI)
- [ ] Telemetry failures do not break user flows (try/catch and continue)
- [ ] Unit/integration coverage added where appropriate
- [ ] No prisma schema changes

## Constraints
- Keep event payloads small and privacy-safe (no raw model text beyond existing stored fields)
- Reuse existing logging/utilities; do not add dependencies
- Do not change endpoint contracts

## MIC-Lite (Yellow/Red)

### Motivation
Now that all main surfaces are live, we need measurable signals (acceptance, undo, dismiss) to improve quality and detect regressions.

### Impact
Adds event emission code paths. Risk: accidental coupling causing request failures or noisy logs.

### Checkpoints
- [ ] Confirm no new dependencies added
- [ ] Confirm events are emitted without affecting response codes
- [ ] Confirm payload includes surface + AiSuggestion id + counts (not sensitive text)

## Pre-Mortem (Red only)

Before implementation is approved, answer:
1. What is the most likely way this fails?
- Telemetry throws or blocks requests under error conditions.
2. What is the blast radius if it does fail?
- Could break apply/generate endpoints or slow UX if not isolated.
3. What is the rollback path?
- Revert PR; telemetry is additive and should be isolated to a small diff.

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
