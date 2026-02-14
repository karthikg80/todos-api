# 03-ai-task-critic.md

## Scope

- `AiSuggestion.type = task_critic` supports task-level improvement suggestions in selected-task drawer and optionally on create.

## Input JSON (to model)

| Field                      | Source                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `todo.id`                  | `Todo.id`                                                                                             |
| `todo.title`               | `Todo.title`                                                                                          |
| `todo.description`         | `Todo.description`                                                                                    |
| `todo.notes`               | `Todo.notes`                                                                                          |
| `todo.completed`           | `Todo.completed`                                                                                      |
| `todo.priority`            | `Todo.priority`                                                                                       |
| `todo.dueDate`             | `Todo.dueDate`                                                                                        |
| `todo.projectId`           | `Todo.projectId`                                                                                      |
| `todo.category`            | `Todo.category`                                                                                       |
| `todo.updatedAt/createdAt` | timestamps                                                                                            |
| `subtasks[]`               | `Subtask.title`, `Subtask.completed`, `Subtask.order`                                                 |
| `context`                  | current surface, user timezone, `today` anchor date                                                   |
| `context.clarification`    | optional follow-up `{ questionId, suggestionId, answer, answeredAt }` when user answered one question |

## Output JSON (from model)

- Envelope from contract doc with `contractVersion`, `generatedAt`, and `surface=task_drawer|on_create`.
- `suggestions[]` limited to known primitives with required `suggestionId`.
- `must_abstain=true` if insufficient confidence or conflicting interpretation.

## State Transitions

| Event                                             | AiSuggestion.status |
| ------------------------------------------------- | ------------------- |
| Suggestion generated and stored                   | `pending`           |
| User applies at least one suggestion from record  | `accepted`          |
| User dismisses all suggestions / explicit dismiss | `rejected`          |

Suggestion-level analytics:

- Track apply/dismiss/undo at `suggestionId` granularity inside `feedback` and telemetry events.
- `AiSuggestion.status` remains record-level aggregate for compatibility.

## Apply Flow Persistence

- On generation:
  - Write `AiSuggestion` with `input` snapshot JSON and validated `output` JSON.
- On apply:
  - Mutate `Todo`/`Subtask` deterministically from selected suggestion payload (`payload.todoId` or `payload.todoTempId` mapping).
  - Set `AiSuggestion.status = accepted`.
  - Set `AiSuggestion.appliedAt = now`.
  - Insert `AiSuggestionAppliedTodo` row(s) for affected todos.
  - Optionally store `AiSuggestion.appliedTodoIds` JSON mirror for read optimization.
  - Persist applied `suggestionId` in `feedback` trail for audit and undo correlation.
- On dismiss:
  - Set `AiSuggestion.status = rejected`.
  - Keep `input/output` for telemetry/audit.
  - Persist dismissed `suggestionId` in `feedback` trail.

## Confidence Gating

- `confidence >= 0.75`: propose direct apply suggestions.
- `0.45 <= confidence < 0.75`: prefer one clarifying question or low-risk suggestions only.
- `< 0.45`: abstain, optionally ask one clarification.
- Never auto-apply regardless of confidence.
- If suggestion implies past due date or `high` escalation without explicit user intent, set `requiresConfirmation=true`.

## Abstain + Ask Policy

- If ambiguity cannot be resolved safely, set `must_abstain=true`.
- Permit exactly one `ask_clarification` suggestion, including stable `payload.questionId`.
- If clarification absent and abstaining, UI shows `No safe suggestion right now`.

## UI Rendering Rules

- Show 3 to 6 suggestions max.
- Sort by:
  - User impact first (next-action, due-date, priority, title clarity).
  - Then confidence descending.
- Each suggestion card includes:
  - Deterministic label.
  - Short rationale.
  - `Apply` and `Dismiss`.
  - Confirmation step when `requiresConfirmation=true`.
- Hide or disable suggestions rejected by validator.

## Planned Tests

- Schema validation tests:
  - Accept valid payloads, reject malformed/destructive payloads.
  - Unknown type rejects only that suggestion.
  - Strip unknown payload keys for known types.
  - Enforce `contractVersion`, `generatedAt`, `suggestionId`, and surface-targeting requirements.
  - Enforce past-date + `requiresConfirmation=true` rule.
- Deterministic mapping tests:
  - Each primitive maps to expected DB writes only.
  - No unmapped side effects.
- UI smoke tests:
  - Renders max-card limits.
  - Apply and dismiss mutate status correctly.
  - Clarification path shows only one question.
