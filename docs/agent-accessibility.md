# Agent Accessibility

First-pass design note for making this repo safely usable by machine agents.

## What It Means Here

In this repo, "agent-accessible" means an AI agent can:

- discover a stable server-side capability contract
- read task and project state without scraping the UI
- perform bounded mutations through explicit task-oriented actions
- recover from failures using structured, machine-usable errors

This is intentionally a thin layer over the existing Express routers and service/domain logic. It is not a second business-logic stack and it does not move rules into the frontend.

## Initial Surface

The initial machine-readable contract lives in `src/agent/agent-manifest.json` and is exposed at runtime through `GET /agent/manifest`.

The remote assistant-facing MCP adapter that builds on this internal layer is documented in `docs/assistant-mcp.md`, with auth and scope details in `docs/remote-mcp-auth.md`.
The planner runtime that now sits under the planning tools is documented in
`docs/planner-runtime.md`.
Public deployment and connector validation runbooks live under `docs/ops/`.
Supported actions:

- `list_tasks`
- `search_tasks`
- `get_task`
- `get_project`
- `create_task`
- `update_task`
- `complete_task`
- `archive_task`
- `delete_task`
- `add_subtask`
- `update_subtask`
- `delete_subtask`
- `move_task_to_project`
- `list_today`
- `list_next_actions`
- `list_waiting_on`
- `list_upcoming`
- `list_stale_tasks`
- `list_projects`
- `list_projects_without_next_action`
- `review_projects`
- `plan_project`
- `ensure_next_action`
- `weekly_review`
- `decide_next_work`
- `analyze_project_health`
- `analyze_work_graph`
- `create_project`
- `update_project`
- `rename_project`
- `delete_project`
- `archive_project`

## Planner Runtime

Planning behavior now routes through a dedicated planner layer instead of
living directly in MCP handlers, agent routes, or UI code:

- MCP tools / AI routes / UI routes
- `PlannerService`
- planner engines
- canonical `projectService` / `todoService`
- database

Current engine boundaries:

- `ProjectPlanningEngine`: `plan_project`, `ensure_next_action`
- `ReviewEngine`: `weekly_review`, `analyze_project_health`
- `DecisionEngine`: `decide_next_work`
- `WorkGraphEngine`: `analyze_work_graph`

This keeps planning logic reusable for MCP today and AI/UI surfaces later
without introducing a second business-logic stack.

## Read vs Write

The server keeps read-only and mutating actions on separate route groups:

- reads: `/agent/read/*`
- writes: `/agent/write/*`

That split is reflected in both code and the manifest metadata.

## Safety Boundaries

- Agent actions reuse the existing `todoService` and `projectService` implementations.
- Existing server-side validation remains the source of truth for create/update rules.
- The first pass preserves the current project/category compatibility path already used by the server. `projectId` is the canonical project relationship, while `category` remains available for backward compatibility and transition.
- Project deletion defaults to unassigning linked tasks unless a target project ID is provided for reassignment.
- Task deletion defaults to archival unless `hardDelete=true` is explicitly requested.
- Project archiving is metadata-only in this pass. Archived projects still appear in list responses with `archived: true`.
- Bulk operations and natural-language resolution are intentionally not part of this first pass.

## Errors

Agent endpoints return a structured error envelope with:

- stable `error.code`
- human-readable `error.message`
- `error.retryable`
- `error.hint` when the caller can take a concrete next step
- per-request trace metadata

This keeps the existing app routes unchanged while making the agent surface predictable.

## Idempotency

The first pass adds idempotency for create flows through the optional `Idempotency-Key` header on:

- `create_task`
- `create_project`

Current behavior:

- same key + same input => replay the original success response
- same key + different input => structured conflict error
- production/runtime storage is durable across restarts and multiple app instances

Current limitation:

- idempotency is still only implemented for the create flows that currently need safe retries

## Traceability

Agent actions emit lightweight structured logs and a lightweight persisted audit record with:

- action name
- read/write flag
- request status
- user ID
- request ID
- agent identifier
- idempotency key when supplied

This is enough for operational debugging without introducing a separate analytics platform.

## Known Gaps / Follow-Up

- extend idempotency beyond create flows if retry semantics are needed for more writes
- decide when the project/category compatibility path can be retired in favor of `projectId` only
- add destructive confirmation patterns before exposing broader delete or bulk write actions
- add richer audit reporting or revocation UI if operational needs outgrow the current trace tables
