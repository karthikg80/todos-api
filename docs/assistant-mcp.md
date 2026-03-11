# Assistant MCP

Thin remote MCP layer for connecting registered Todos app users from ChatGPT, Claude, or similar assistant clients.

## What This Layer Does

- keeps `/agent` as the internal task-oriented capability surface
- exposes `/mcp` as the public remote MCP adapter over that internal layer
- reuses the shared internal agent executor instead of duplicating todo or project rules
- requires every MCP call to resolve to a concrete authenticated app user

This is the public connector layer. The internal machine-facing contract still lives in `docs/agent-accessibility.md`.

## Public Endpoints

Runtime endpoints:

- `GET /mcp`
  SSE-style stream endpoint for remote MCP clients that expect long-lived transport.
- `POST /mcp`
  Streamable HTTP JSON-RPC endpoint for MCP methods and tool calls.
- `GET /.well-known/oauth-protected-resource`
  OAuth protected-resource metadata for remote clients.
- `GET /.well-known/oauth-authorization-server`
  Authorization server metadata.
- `POST /oauth/register`
  Dynamic client registration for public PKCE clients.
- `GET /oauth/authorize`
  Browser-based user sign-in and consent page.
- `POST /oauth/token`
  Authorization code exchange for an MCP bearer token.
- `GET /healthz`
  Liveness signal for the deployed service.
- `GET /readyz`
  Readiness signal, including database reachability.

Detailed auth and scope behavior lives in `docs/remote-mcp-auth.md`.

## Supported Tools

Initial public tools:

- `list_tasks`
- `search_tasks`
- `get_task`
- `create_task`
- `update_task`
- `complete_task`
- `move_task_to_project`
- `list_projects`
- `create_project`
- `update_project`
- `delete_project`
- `archive_project`

`tools/list` only returns tools allowed by the current token scopes.

## Auth and Scope Model

- browser-based account linking reuses the app's existing user auth
- connector tokens are MCP-scoped bearer tokens, not app session tokens
- supported scopes:
  - `tasks.read`
  - `tasks.write`
  - `projects.read`
  - `projects.write`
- write tools are denied unless the token carries the matching write scope
- no MCP path trusts caller-provided user IDs for authorization

## Protocol Shape

- `/mcp` supports both:
  - `GET` for SSE-style connector transport
  - `POST` for stateless Streamable HTTP JSON-RPC
- implemented MCP methods:
  - `initialize`
  - `ping`
  - `tools/list`
  - `tools/call`
  - `notifications/initialized`

## Error Shape

Protocol-level failures return JSON-RPC errors with structured `error.data`.

Tool-level failures return:

- `result.isError = true`
- `result.structuredContent.error` with machine-usable details

Stable auth and authorization codes include:

- `MCP_UNAUTHENTICATED`
- `MCP_INVALID_TOKEN`
- `MCP_AUTH_EXPIRED`
- `MCP_INVALID_SESSION`
- `MCP_INSUFFICIENT_SCOPE`
- `RESOURCE_NOT_FOUND_OR_FORBIDDEN`

## Observability and Safety

The public MCP layer adds:

- request IDs
- user-scoped tool execution
- structured auth and scope-denial logs
- latency logging for `/mcp` calls
- body-size limits and HTTP timeouts
- rate limiting on public OAuth and discovery endpoints

The delegated internal agent execution still emits its own action trace with `surface: "mcp"`.

## Idempotency

First-pass idempotency is implemented for `create_task` via an optional `idempotencyKey` tool argument.

Current behavior:

- same key + same input => replay the original success response
- same key + different input => structured conflict error

Current limitation:

- idempotency state is still process-local and in-memory
- `delete_project` unassigns tasks by default unless `moveTasksToProjectId` is supplied
- project archiving is metadata-only in this pass; archived projects remain listable

## Deployment and Connector Validation

Deployment and beta-verification runbooks live in:

- `docs/ops/railway-remote-mcp-deploy.md`
- `docs/ops/connector-smoke-checklist.md`

Those docs also record what remains manual from this sandboxed environment.

## Current Limitations

- no refresh-token flow yet for assistant clients
- no persisted audit store or token revocation list yet
- idempotency is only implemented for `create_task`
- the public deployment and real ChatGPT/Claude connector validation must be completed from a networked environment with Railway access
