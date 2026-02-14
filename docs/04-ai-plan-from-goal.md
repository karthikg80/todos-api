# 04-ai-plan-from-goal.md

## Scope

- `AiSuggestion.type = plan_from_goal` proposes daily or scoped plans from either:
  - Explicit user goal prompt.
  - Existing list context (Today, Project X, filtered views).

## Inputs

| Input type            | Contents                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Goal prompt           | optional free text goal from user                                                          |
| Task context          | candidate todos with due date/priority/project/completion                                  |
| User context          | timezone, selected scope, optional capacity hint                                           |
| Clarification context | optional `{ questionId, suggestionId, answer, answeredAt }` from prior `ask_clarification` |
| Constraints           | top N limit, safety rules, no auto-apply                                                   |

## Output Plan Structure

- `suggestions[]` using existing primitives:
  - create new todos (preview only, user-selected apply).
  - reprioritize existing todos via `set_priority`.
  - set due dates via `set_due_date`.
  - optionally split subtasks for 1 to 2 selected items.
- All suggestions include `suggestionId`; existing-todo mutations include `payload.todoId`.
- `planPreview` block:
  - ranked items.
  - rationale.
  - confidence.
  - `timeEstimateMin` UI-only.

## Safety Model

- No task creation or mutation until user confirms.
- Present preview list with checkboxes per item/change.
- Confirm action applies only selected rows.
- Respect `requiresConfirmation=true` for high-impact items (for example, past due-date or high-priority escalation without explicit intent).
- Destructive or bulk operations remain blocked unless explicitly requested.

## Plan Scoring

- Rank score combines:
  - impact.
  - urgency.
  - unblock value.
  - effort fit (time estimate).
- Limit output to top 3 or top 5.
- Include per-item rationale and confidence for transparency.

## Telemetry

| Metric                       | Definition                                     |
| ---------------------------- | ---------------------------------------------- |
| Plan acceptance rate         | accepted items / proposed items                |
| Suggestion view rate         | viewed suggestion cards / generated cards      |
| Completion-after-acceptance  | accepted items completed within window         |
| Undo rate                    | accepted then reverted within X minutes        |
| Undo rate by suggestion type | revert rate segmented by primitive             |
| Partial-apply rate           | selected subset / full plan                    |
| Time-to-first-apply          | latency from display to first apply            |
| Abstain rate per surface     | `must_abstain=true` frequency for `today_plan` |

## MVP Boundaries

- Keep time estimates UI-only; do not persist new time fields.
- Avoid introducing dependencies or calendar writes.
- Persist plan proposal and user actions through `AiSuggestion` records only.
