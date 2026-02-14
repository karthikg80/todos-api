# 02-ai-output-contracts.md

## Contract Principles

- All AI output must be strict JSON and machine-validated before render/apply.
- UI renders only known suggestion types with known validated keys.
- Standard suggestion keys are fixed: `type`, `suggestionId`, `confidence`, `rationale`, `requiresConfirmation?`, `payload`.
- Per-type required fields must be under `payload.*`.
- Contracts map only to existing `Todo`/`Subtask` fields plus explicit preview actions.

## Global Envelope (all surfaces)

```json
{
  "contractVersion": 1,
  "requestId": "uuid-or-trace-id",
  "generatedAt": "2026-02-14T12:00:00.000Z",
  "surface": "on_create|task_drawer|today_plan",
  "must_abstain": false,
  "modelInfo": {
    "provider": "optional",
    "model": "optional",
    "version": "optional",
    "modelGeneratedAt": "optional-debug-timestamp"
  },
  "suggestions": []
}
```

## Envelope Semantics

- `contractVersion` is required and must equal `1`.
- `generatedAt` is required and should be server-generated canonical timestamp.
- Optional `modelInfo.modelGeneratedAt` may be present for debugging only.
- `must_abstain` may be overridden to `true` by server when no safe suggestions remain.

## Suggestion Primitive Schemas (JSON-Schema style)

| Type                     | Required `payload.*` fields                         | Optional `payload.*` fields                                | Constraints                                              | Maps to                                    |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ------------------------------------ |
| `set_due_date`           | `payload.dueDateISO`                                | `payload.todoId`, `payload.todoTempId`                     | ISO-8601; past date requires `requiresConfirmation=true` | `Todo.dueDate`                             |
| `set_priority`           | `payload.priority`                                  | `payload.todoId`, `payload.todoTempId`                     | enum `low                                                | medium                                     | high`; escalation to `high` may require confirmation | `Todo.priority`                      |
| `set_project`            | one of `payload.projectId` or `payload.projectName` | `payload.category`, `payload.todoId`, `payload.todoTempId` | no implicit project creation; max 50 chars for names     | `Todo.projectId`, optional `Todo.category` |
| `set_category`           | `payload.category`                                  | `payload.todoId`, `payload.todoTempId`                     | max 50 chars                                             | `Todo.category`                            |
| `rewrite_title`          | `payload.title`                                     | `payload.todoId`, `payload.todoTempId`                     | title max app limit                                      | `Todo.title`                               |
| `propose_next_action`    | one of `payload.title` or `payload.text`            | `payload.todoId`, `payload.todoTempId`                     | concise actionable phrasing                              | UI proposal / optional new todo flow       |
| `split_subtasks`         | `payload.subtasks`                                  | `payload.todoId`                                           | 1..5 subtasks; each `{title, order}`                     | `Subtask[]`                                |
| `ask_clarification`      | `payload.questionId`, `payload.question`            | `payload.choices`, `payload.todoId`, `payload.todoTempId`  | max one per response; choices 2..5                       | deterministic one-question UI              |
| `defer_task`             | `payload.strategy`                                  | `payload.todoId`, `payload.todoTempId`                     | enum `someday                                            | next_week                                  | next_month`                                          | via `dueDate/category/notes` mapping |
| `propose_create_project` | `payload.projectName`                               | none                                                       | projectName <= 50; preview-only                          | explicit user-confirmed project create     |

## Common Per-Suggestion Shape

```json
{
  "type": "set_due_date",
  "suggestionId": "uuid-or-stable-id",
  "confidence": 0.0,
  "rationale": "short deterministic explanation",
  "requiresConfirmation": false,
  "payload": {}
}
```

## Targeting Rules by Surface

- Any suggestion that mutates an existing todo MUST include `payload.todoId`.
- `on_create`: todo does not yet exist; targeting uses `payload.todoTempId` for draft suggestions.
- `task_drawer`: require `payload.todoId`.
- `today_plan`: require `payload.todoId`.

## Clarification Follow-up Contract

- `ask_clarification` must include stable `payload.questionId`.
- Follow-up input sent on next generation pass:

```json
{
  "context": {
    "clarification": {
      "questionId": "q-uuid",
      "suggestionId": "s-uuid",
      "answer": "Website Redesign",
      "answeredAt": "2026-02-14T12:02:00.000Z"
    }
  }
}
```

## Rationale Constraints

- `rationale` max 120 chars.
- Plain text only, no markdown.
- No long user-text quotes (for example, no quote block and no copied fragments > 40 chars).
- Prefer template-like deterministic explanations.

## Unknown Fields and Validation Policy

- Unknown envelope fields: ignore.
- Unknown suggestion `type`: reject that suggestion only.
- Unknown keys inside `payload` for known types: strip unknown keys, then validate required keys.
- If all suggestions are rejected/stripped invalid: return `suggestions=[]` and force `must_abstain=true`.

## Example JSON: On-create Assist

```json
{
  "contractVersion": 1,
  "requestId": "a5c0e2a1-7cb4-4dd0-a7d2-4513c0014ab3",
  "generatedAt": "2026-02-14T12:00:00.000Z",
  "surface": "on_create",
  "must_abstain": false,
  "suggestions": [
    {
      "type": "set_due_date",
      "suggestionId": "sug-001",
      "confidence": 0.84,
      "rationale": "Detected explicit time phrase in task draft.",
      "requiresConfirmation": false,
      "payload": {
        "todoTempId": "tmp-1",
        "dueDateISO": "2026-02-20T17:00:00Z"
      }
    },
    {
      "type": "set_priority",
      "suggestionId": "sug-002",
      "confidence": 0.62,
      "rationale": "Urgency language suggests elevated priority.",
      "requiresConfirmation": true,
      "payload": {
        "todoTempId": "tmp-1",
        "priority": "high"
      }
    },
    {
      "type": "ask_clarification",
      "suggestionId": "sug-003",
      "confidence": 0.58,
      "rationale": "Project mapping is ambiguous across existing names.",
      "payload": {
        "questionId": "q-001",
        "todoTempId": "tmp-1",
        "question": "Which project should this belong to?",
        "choices": ["Website Redesign", "Marketing Site", "No project"]
      }
    }
  ]
}
```

## Example JSON: Selected-task Drawer

```json
{
  "contractVersion": 1,
  "requestId": "d5b362c8-2934-4900-93d4-b9f0a29f5d15",
  "generatedAt": "2026-02-14T12:05:00.000Z",
  "surface": "task_drawer",
  "must_abstain": false,
  "suggestions": [
    {
      "type": "rewrite_title",
      "suggestionId": "sug-101",
      "confidence": 0.77,
      "rationale": "Title is vague and can be made outcome-specific.",
      "payload": {
        "todoId": "todo_123",
        "title": "Draft Q1 launch email outline"
      }
    },
    {
      "type": "split_subtasks",
      "suggestionId": "sug-102",
      "confidence": 0.81,
      "rationale": "Task appears multi-step and benefits from decomposition.",
      "payload": {
        "todoId": "todo_123",
        "subtasks": [
          { "title": "Collect launch requirements", "order": 1 },
          { "title": "Draft email copy", "order": 2 },
          { "title": "Review with PM", "order": 3 }
        ]
      }
    }
  ]
}
```

## Example JSON: Daily Plan

```json
{
  "contractVersion": 1,
  "requestId": "e7f13c6b-d5bf-428c-a4fc-916fcfd5c1e5",
  "generatedAt": "2026-02-14T12:10:00.000Z",
  "surface": "today_plan",
  "must_abstain": false,
  "suggestions": [
    {
      "type": "set_priority",
      "suggestionId": "sug-201",
      "confidence": 0.73,
      "rationale": "Task has near-term deadline and high impact.",
      "requiresConfirmation": true,
      "payload": { "todoId": "todo_123", "priority": "high" }
    },
    {
      "type": "set_due_date",
      "suggestionId": "sug-202",
      "confidence": 0.69,
      "rationale": "Schedule alignment requires explicit due date.",
      "requiresConfirmation": true,
      "payload": { "todoId": "todo_123", "dueDateISO": "2026-02-13T22:00:00Z" }
    }
  ],
  "planPreview": {
    "topN": 3,
    "items": [
      {
        "todoId": "todo_123",
        "rank": 1,
        "timeEstimateMin": 45,
        "rationale": "Highest impact"
      },
      {
        "todoId": "todo_456",
        "rank": 2,
        "timeEstimateMin": 30,
        "rationale": "Unblocks others"
      },
      {
        "todoId": "todo_789",
        "rank": 3,
        "timeEstimateMin": 25,
        "rationale": "Quick win"
      }
    ]
  }
}
```

## Rejection Rules

- Envelope-level hard reject when:
  - invalid JSON, missing required envelope fields, or wrong `contractVersion`.
- Suggestion-level reject when:
  - unknown `type`.
  - missing `suggestionId`.
  - `confidence` outside 0..1.
  - missing required `payload.*` keys for the type.
  - invalid enums (`priority`, `strategy`, `surface`).
  - > 1 `ask_clarification` in one response.
  - subtasks count > 5.
  - rationale violations (length/markdown/quote constraints).
  - due date is in the past and `requiresConfirmation` is missing or `false`.
  - `set_project` implies creating a missing project (must use `propose_create_project`).
  - surface targeting violations (missing `payload.todoId` where required).
- Post-validation behavior:
  - Strip unknown payload keys for known types.
  - Keep only valid suggestions.
  - If none remain, force `must_abstain=true` and return empty actionable list.
