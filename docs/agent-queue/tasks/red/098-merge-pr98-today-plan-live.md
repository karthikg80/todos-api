status: DONE
type: red
title: Today Planner live (server-backed today_plan decision assist)
owner: codex
surface: today_plan
builder: codex
reviewer: claude
branch: codex/feat-today-plan-live
base: origin/master
worktree: /private/tmp/todos-api-today-plan-live
---

## Motivation (WHY)

The Today view currently uses a mocked generator for the “Plan My Day” panel.

We need to make this a real Decision Assist surface so it behaves like:
- task drawer suggestions
- on-create live suggestions

The system should:
- generate a daily plan from actual todos
- allow selective apply
- preserve explicit apply + undo UX
- persist across reload
- remain contract-safe

This turns Today from a visualization into an actionable planning workflow.

---

## Impact (WHAT CHANGES)

### Backend
Extend AiSuggestion flow to support a global planning surface (`surface=today_plan`)
without being tied to a single todoId.

### UI
Replace mocked today generator with server-backed retrieval + apply/dismiss.

### Tests
Add integration + UI fast coverage.

No schema changes.
No new dependencies.

---

## Checkpoints (ACCEPTANCE CRITERIA)

1) Generate
- Clicking "Plan My Day" calls backend stub
- A pending suggestion persists
- Reload shows same plan

2) Selective Apply
- Only selected rows modify todos
- Guardrails respected
- Undo still works locally

3) Dismiss
- Reject removes plan after reload

4) Safety
- If AI returns must_abstain → safe empty state
- No contract validation failures

---

## Constraints (MUST NOT BREAK)

- No DB schema changes
- Reuse existing endpoints
- Backward compatible apply behavior
- Validate AI output before render/apply
- Do not duplicate shared UI helpers
- No new dependencies

Apply endpoint rule:
If `selectedTodoIds` is omitted → preserve legacy behavior

---

## Scope Estimate

Expected modules:
- src/routes/aiRouter.ts
- validation layer
- integration tests
- public/app.js
- UI tests

---

## Pre-Mortem (RISKS)

| Risk | Mitigation |
|-----|------|
| Apply modifies unintended todos | Only operate on selectedTodoIds |
| Breaking legacy apply | Make new fields optional |
| Timezone errors | Use provided user timezone anchor |
| Empty suggestion loops | Handle must_abstain safely |
| UI drift from server state | Reload after apply/dismiss |

Rollback:
Revert PR — no schema migrations involved.

---

## Implementation Plan (HIGH LEVEL)

Backend:
- allow surface=today_plan retrieval
- stub accepts goal + candidate todos
- persist as pending AiSuggestion
- apply selectedTodoIds only
- dismiss unchanged

UI:
- generate → stub + latest
- preview rows with checkboxes
- apply selected
- local undo snapshot

Tests:
- integration persistence + apply filtering
- UI preview + reload behavior

---

## Builder Protocol Requirements

Before coding:
- Read AGENT_RULES.md
- Read SAFETY_GUARDRAILS.md
- Read DUAL_AGENT_PROTOCOL.md

If:
- touching >10 files
- adding dependency
- changing schema
- breaking endpoint contract

→ STOP and mark BLOCKED with SCOPE_ESCALATION

---

## Definition of Done

- All verification commands pass
- PR opened with revert plan
- Task moved to REVIEW
