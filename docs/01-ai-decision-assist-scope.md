# 01-ai-decision-assist-scope.md

## Definition

- Decision Assist is a non-chatbot AI layer that proposes structured task decisions at key workflow moments.
- It does not execute changes autonomously; it generates constrained suggestions that users explicitly apply.
- It is an operator-grade assistant: safe defaults, measurable outcomes, deterministic rendering, full auditability via `AiSuggestion`.

## Non-goals

- No open-ended chat UX.
- No autonomous deletes, bulk edits, or silent rescheduling.
- No free-form model text rendered directly to users.
- No hard dependency on calendar integrations for MVP.
- No schema expansion beyond existing models unless proven necessary.

## Decision Moments

- Capture to organize: infer `dueDate`, `priority`, `project/category` during task creation.
- Stuck task nudges: detect no due date, stale tasks, or missing next action.
- Conflict resolution: detect too many `high` priorities and suggest rebalancing.
- Today planning: propose top tasks and optional timeboxes in Today view.

## MVP Features (fits current schema)

- Field extraction suggestions:
  - `dueDate` extraction.
  - `priority` extraction.
  - `project` inference with category/project duality handling.
- Task critic suggestions:
  - Split into subtasks.
  - Define a next action.
  - Add/adjust due date.
  - Rewrite unclear titles.
- Uncertainty handling:
  - Ask exactly one clarifying question when confidence is below threshold.
- Today planner:
  - Top-3 or Top-5 suggested plan.
  - Optional goal prompt as additional context.
- Interaction pattern:
  - Preview suggestions in deterministic UI.
  - Per-suggestion `Apply` / `Dismiss`.
  - Undo after apply.

## V2 Ideas

- Personalization from accept/reject/undo history.
- Lightweight dependency hints encoded in `notes` or `category` conventions (for example, `waiting_on:`).
- Timeboxing improvements:
  - Pre-calendar integration: UI-only `estimated minutes`.
  - Post-calendar integration: optional scheduling handoff.

## Product Principle

- Default interaction: explicit `Apply` button.
- Every AI change is preview-first and reversible.
- `Safe preview + undo` is mandatory on all surfaces.

## Success Criteria

| Metric                                     |         MVP Target | Why it matters                                 |
| ------------------------------------------ | -----------------: | ---------------------------------------------- |
| Suggestion acceptance rate                 |             >= 25% | Indicates relevance without forcing behavior   |
| Suggestion view rate                       |             >= 85% | Confirms placement and discoverability         |
| Undo-after-apply rate (within 10 min)      |             <= 15% | Proxy for suggestion quality and trust         |
| Undo rate by suggestion type               | track + trend down | Isolates low-trust primitives                  |
| Time-to-first-apply                        | track + trend down | Measures decision friction                     |
| Abstain rate per surface                   |    track + bounded | Ensures safe fallbacks without over-abstaining |
| Time-to-organize on create                 |   -20% vs baseline | Measures capture flow efficiency               |
| Dismiss-without-viewing-details            |             <= 40% | Indicates concise, understandable suggestions  |
| AI-related error rate (validation rejects) |               < 1% | Structured output reliability                  |

## “Good” UX Definition

- Suggestions appear at the right moment, not as interruptions.
- Users understand each suggestion quickly from concise rationale.
- Applying a suggestion is one click and instantly reflected.
- Undo is obvious and reliable.
- No surprising data mutations across category/project fields.
