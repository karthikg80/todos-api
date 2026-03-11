# Assistant MCP

Thin remote MCP layer for connecting registered todos app users from ChatGPT-, Claude-, or similar assistant clients.

## Architecture

- `/agent` remains the internal task-oriented capability surface.
- `/mcp` is a thin remote MCP adapter over that internal layer.
- `/mcp` does not duplicate todo or project business rules. It delegates tool execution to the shared internal agent executor, which still uses the existing server-side todo and project services.

## Auth Model

This first pass uses app-minted bearer tokens rather than OAuth.

1. The user signs in through the normal app auth flow and gets a standard app access token.
2. The user calls `POST /auth/mcp/token` with that app token.
3. The server returns a scoped MCP token.
4. The assistant client uses that MCP token as `Authorization: Bearer <token>` when calling `/mcp`.

Current limitation:

- MCP tokens are minted manually through the API.
- There is no OAuth discovery, consent screen, or token refresh flow for assistant clients yet.

## Scopes

Supported scopes are intentionally simple:

- `read`
- `write`

Rules:

- `read` allows read-only tools.
- `write` allows mutating tools.
- write tokens are normalized to include `read` as well.

## Supported Tools

Initial tools:

- `list_tasks`
- `search_tasks`
- `get_task`
- `create_task`
- `update_task`
- `complete_task`
- `list_projects`
- `create_project`

Tool discovery happens through standard MCP `tools/list`.

## Protocol Shape

- Endpoint: `POST /mcp`
- Transport style: stateless Streamable HTTP with JSON responses
- Implemented methods:
  - `initialize`
  - `ping`
  - `tools/list`
  - `tools/call`
  - `notifications/initialized`

This first pass does not implement SSE streaming over `GET /mcp`.

## Errors

Protocol-level failures return JSON-RPC errors with structured `error.data`.

Tool-level failures return:

- `result.isError = true`
- `result.structuredContent` carrying structured machine-usable error details

The structured error shape includes stable codes, human-readable messages, retryability, and hints when the next step is clear.

## Auditability

Assistant-triggered MCP calls emit lightweight structured logs with:

- request ID
- user ID
- assistant identity
- scopes
- MCP method
- tool name
- outcome / error code

The delegated internal agent execution also logs its own action trace with `surface: "mcp"`.

## Idempotency

First-pass idempotency is implemented for MCP `create_task` via an optional `idempotencyKey` argument.

Current behavior:

- same key + same input => replay the original success response
- same key + different input => structured conflict error

Current limitation:

- idempotency storage is still process-local and in-memory

## Limitations / Follow-Up

- add OAuth-based MCP auth for production-ready assistant connection flows
- extend idempotency beyond `create_task` if assistant retry behavior needs it
- decide whether `/mcp` should support SSE streaming once a concrete client requires it
- add persisted audit storage if log-only tracing stops being enough
