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
Supported actions:

- `list_tasks`
- `search_tasks`
- `get_task`
- `create_task`
- `update_task`
- `complete_task`
- `list_projects`
- `create_project`

## Read vs Write

The server keeps read-only and mutating actions on separate route groups:

- reads: `/agent/read/*`
- writes: `/agent/write/*`

That split is reflected in both code and the manifest metadata.

## Safety Boundaries

- Agent actions reuse the existing `todoService` and `projectService` implementations.
- Existing server-side validation remains the source of truth for create/update rules.
- The first pass preserves the current project/category compatibility path already used by the server. Task payloads still use the current task shape rather than inventing a parallel domain model.
- Destructive deletes, bulk operations, and natural-language resolution are intentionally not part of this first pass.

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

Current limitation:

- storage is process-local and in-memory, so it protects retry behavior within a running server instance but is not yet durable across restarts or multiple app instances

## Traceability

Agent actions emit lightweight structured logs with:

- action name
- read/write flag
- request status
- user ID
- request ID
- agent identifier
- idempotency key when supplied

This is enough for first-pass auditability without introducing a new persistence layer.

## Known Gaps / Follow-Up

- extend idempotency beyond create flows if retry semantics are needed for more writes
- decide whether project/category compatibility should eventually become a first-class `projectId` agent contract
- add destructive confirmation patterns before exposing delete or bulk write actions
- add richer persisted audit storage if log-only tracing is no longer sufficient
