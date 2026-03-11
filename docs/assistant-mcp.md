# Assistant MCP

Thin remote MCP layer for connecting registered todos app users from ChatGPT-, Claude-, or similar assistant clients.

## Architecture

- `/agent` remains the internal task-oriented capability surface.
- `/mcp` is a thin remote MCP adapter over that internal layer.
- `/mcp` does not duplicate todo or project business rules. It delegates tool execution to the shared internal agent executor, which still uses the existing server-side todo and project services.

## Auth Model

The remote MCP surface now expects a user-linked bearer token minted through the app-authenticated OAuth-style linking flow:

1. The user signs in through the normal app auth flow and gets a standard app access token.
2. The signed-in app starts assistant linking with `POST /auth/mcp/oauth/authorize`.
3. The assistant exchanges the short-lived authorization code at `POST /auth/mcp/oauth/token`.
4. The assistant calls `POST /mcp` with `Authorization: Bearer <accessToken>`.

Detailed auth flow, scope mapping, and local development notes live in `docs/remote-mcp-auth.md`.

For local development only, `POST /auth/mcp/token` still exists as a direct token mint shortcut behind normal app auth.

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

Tool discovery happens through standard MCP `tools/list`, and each listed tool includes explicit auth metadata for required scopes and error expectations.

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

Auth and scope failures use stable codes such as:

- `MCP_UNAUTHENTICATED`
- `MCP_INVALID_TOKEN`
- `MCP_AUTH_EXPIRED`
- `MCP_INVALID_SESSION`
- `MCP_INSUFFICIENT_SCOPE`
- `RESOURCE_NOT_FOUND_OR_FORBIDDEN`

## Auditability

Assistant-triggered MCP calls emit lightweight structured logs with:

- request ID
- user ID
- assistant identity
- granted scopes
- auth outcome
- MCP method
- tool name
- outcome / error code

The delegated internal agent execution also logs its own action trace with `surface: "mcp"`.

## Idempotency

First-pass idempotency remains implemented for MCP `create_task` via an optional `idempotencyKey` argument.

Current behavior:

- same key + same input => replay the original success response
- same key + different input => structured conflict error

Current limitation:

- idempotency storage is still process-local and in-memory

## Limitations / Follow-Up

- the OAuth-style linking flow is JSON API based and does not yet expose provider-facing discovery or consent UI
- access tokens do not yet have refresh-token rotation for assistant clients
- idempotency is only implemented for `create_task`
- auditability is log-based only; there is no persisted audit store yet
- add SSE support only if a concrete MCP client requires it
