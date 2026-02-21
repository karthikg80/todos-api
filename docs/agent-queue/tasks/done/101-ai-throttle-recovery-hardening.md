# TASK 101: ai-throttle-recovery-hardening

type: Red
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: codex/task-101-ai-throttle-recovery-hardening
base: master

## Intent *
Implement adaptive throttle + recovery for Decision Assist to reduce suggestion frequency after repeated rejects/undos and restore after consistent accepts (no schema changes).

## Scope
- Add throttle logic per user/surface that:
  - decreases frequency after repeated dismiss/undo within window
  - increases after accepts without quick revert
- Ensure behavior applies to `task_drawer`, `on_create`, `today_plan`
- Persist throttle state without schema changes (reuse existing storage or safe lightweight mechanism)

## Out of Scope
- Personalization model
- Calendar integrations
- Any new dependencies
- DB schema changes

## Files Allowed
- src/**
- public/app.js (only if needed for undo signal)
- tests/**

## Acceptance Criteria *
- [ ] After N rejects/undos, suggestion generation is throttled (observable)
- [ ] After M accepts without quick revert, throttling relaxes
- [ ] Throttle never blocks explicit user-requested generation (e.g., pressing Generate)
- [ ] No schema changes; no new deps
- [ ] Coverage added for throttle transitions

## Constraints
- Must be non-fatal (never break create/drawer/today flows)
- Prefer “no-op” over risky mutation when throttled
- Feature flag compatible (Decision Assist off => no throttle behavior executed)

## MIC-Lite (Yellow/Red)

### Motivation
Without throttling, low-quality suggestions can annoy users and degrade trust; throttling creates a trust-preserving feedback loop.

### Impact
Changes when suggestions appear. Risk: suppressing helpful suggestions too aggressively.

### Checkpoints
- [ ] Confirm throttle affects only auto-fetch/generate paths, not explicit user actions
- [ ] Confirm state resets/recovers as intended
- [ ] Confirm no schema changes

## Pre-Mortem (Red only)

Before implementation is approved, answer:
1. What is the most likely way this fails?
- Throttle state becomes “sticky” and suppresses suggestions permanently.
2. What is the blast radius if it does fail?
- Users may stop seeing suggestions; feature looks broken.
3. What is the rollback path?
- Disable throttle via config constant/flag or revert PR.

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
