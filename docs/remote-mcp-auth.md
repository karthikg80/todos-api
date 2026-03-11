# Remote MCP Auth

This doc covers the current public account-linking, authentication, and scope model for the remote MCP server.

## Current Linking Model

The remote MCP surface now exposes a browser-based OAuth-style PKCE flow over standard public endpoints. It reuses the app's existing user auth and JWT primitives instead of introducing a second identity system.

Public flow:

1. The connector discovers metadata from:
   - `GET /.well-known/oauth-protected-resource`
   - `GET /.well-known/oauth-authorization-server`
2. The connector registers a public PKCE client at `POST /oauth/register`.
3. The user is sent to `GET /oauth/authorize`.
4. The user signs in with their existing Todos account and approves scopes.
5. The connector exchanges the authorization code at `POST /oauth/token`.
6. The connector calls `GET /mcp` or `POST /mcp` with `Authorization: Bearer <mcp-token>`.

Local development still supports the older direct mint shortcut at `POST /auth/mcp/token`, but that is not the production connector path.

## Public Auth Endpoints

### `GET /.well-known/oauth-protected-resource`

Protected-resource metadata for MCP clients.

Returns:

- `resource`
- `authorization_servers`
- `bearer_methods_supported`
- `scopes_supported`

### `GET /.well-known/oauth-authorization-server`

Authorization server metadata for remote connectors.

Returns:

- `issuer`
- `authorization_endpoint`
- `token_endpoint`
- `registration_endpoint`
- `response_types_supported`
- `grant_types_supported`
- `token_endpoint_auth_methods_supported`
- `code_challenge_methods_supported`
- `scopes_supported`

### `POST /oauth/register`

Dynamic client registration for public PKCE clients.

Input:

- `redirect_uris`
- `client_name` (optional)
- `grant_types` (`authorization_code`, or `authorization_code` plus `refresh_token` for connector compatibility)
- `response_types` (`code` only)
- `token_endpoint_auth_method` (`none` only)

Response:

- `client_id`
- `client_id_issued_at`
- `redirect_uris`
- `grant_types`
- `response_types`
- `token_endpoint_auth_method`
- `client_name` (if provided)

### `GET /oauth/authorize`

Browser-based sign-in and consent page.

Query parameters:

- `client_id`
- `redirect_uri`
- `response_type=code`
- `scope` (optional; defaults to `tasks.read projects.read`)
- `state` (optional)
- `code_challenge`
- `code_challenge_method=S256`

Behavior:

- if the temporary link session cookie is missing, the server renders a login page
- once the user signs in, the server renders a consent page
- approval redirects back to the connector callback with `code` and `state`

### `POST /oauth/token`

Exchanges an authorization code for an MCP bearer token.

Form input:

- `grant_type=authorization_code`
- `code`
- `client_id`
- `redirect_uri`
- `code_verifier`

Response:

- `access_token`
- `token_type`
- `expires_in`
- `expires_at`
- `scope`

### `POST /auth/mcp/token`

Local development shortcut only.

This bypasses the public authorization-code flow and mints an MCP token directly from a signed-in app user session. Keep it for local verification, not provider-facing account linking.

## MCP Request Authentication

Every remote MCP request must include:

- `Authorization: Bearer <mcp-access-token>`

The server then:

1. verifies token signature and expiry
2. validates token type is `mcp`
3. resolves the token to a concrete app user via `getUserById`
4. enforces scopes before tool execution
5. denies the request if the linked user is no longer valid

No MCP tool trusts a client-provided user ID.

## Supported Scopes

Initial assistant-facing scopes:

- `tasks.read`
- `tasks.write`
- `projects.read`
- `projects.write`

The older `read` / `write` aliases are still accepted by validation and expanded to explicit scopes, but new connector setup should use the explicit names above.

## Tool to Scope Mapping

| Tool             | Read only | Required scopes  |
| ---------------- | --------- | ---------------- |
| `list_tasks`     | Yes       | `tasks.read`     |
| `search_tasks`   | Yes       | `tasks.read`     |
| `get_task`       | Yes       | `tasks.read`     |
| `create_task`    | No        | `tasks.write`    |
| `update_task`    | No        | `tasks.write`    |
| `complete_task`  | No        | `tasks.write`    |
| `move_task_to_project` | No  | `tasks.write`    |
| `list_projects`  | Yes       | `projects.read`  |
| `create_project` | No        | `projects.write` |
| `update_project` | No        | `projects.write` |
| `delete_project` | No        | `projects.write` |
| `archive_project` | No       | `projects.write` |

`tools/list` only returns tools the token is allowed to use.

## Auth-Related Errors

Auth and authorization failures return stable machine-usable fields:

- `code`
- `message`
- `retryable`
- `hint` when the next step is clear

Important auth codes:

- `MCP_UNAUTHENTICATED`
- `MCP_INVALID_AUTHORIZATION`
- `MCP_INVALID_TOKEN`
- `MCP_AUTH_EXPIRED`
- `MCP_INVALID_SESSION`
- `MCP_INSUFFICIENT_SCOPE`
- `MCP_INVALID_CLIENT`
- `MCP_REDIRECT_URI_MISMATCH`
- `MCP_AUTH_CODE_INVALID`
- `MCP_AUTH_CODE_EXPIRED`
- `MCP_AUTH_CODE_ALREADY_USED`
- `MCP_INVALID_CODE_VERIFIER`
- `RESOURCE_NOT_FOUND_OR_FORBIDDEN`

GET `/mcp` also returns a `WWW-Authenticate` challenge that points remote clients at `/.well-known/oauth-protected-resource`.

## Audit / Traceability

The public MCP layer logs lightweight structured events for:

- OAuth client registration success/failure
- authorize page views and failures
- login success/failure during connector linking
- code approval / denial
- token exchange success/failure
- MCP auth success/failure
- scope denials
- tool calls with request ID, tool name, user ID, and latency

This remains log-based only.

## Connector Expectations

First-pass compatibility target:

- public HTTPS base URL
- OAuth protected-resource and authorization-server metadata
- public PKCE client registration
- browser-based user sign-in and consent
- `GET /mcp` SSE transport
- `POST /mcp` Streamable HTTP JSON-RPC

Current limitation:

- client registration accepts `refresh_token` metadata for compatibility, but the server does not issue refresh tokens yet, so reconnect or relink is still required once the MCP access token expires

## Local Development

Typical local public-flow test:

1. Start the app locally with `BASE_URL=http://localhost:3000`.
2. Register a public client with `POST /oauth/register`.
3. Visit the generated `GET /oauth/authorize` URL in a browser.
4. Sign in with a real app user and approve scopes.
5. Exchange the returned code at `POST /oauth/token`.
6. Use the bearer token on `/mcp`.

For direct local shortcuts only, `POST /auth/mcp/token` still mints a scoped token from a signed-in app session.

Detailed deployment and smoke steps live in:

- `docs/ops/railway-remote-mcp-deploy.md`
- `docs/ops/connector-smoke-checklist.md`

## Current Limitations

- authorization codes and idempotency state are process-local
- MCP tokens are JWTs and are not individually revocable yet
- no refresh tokens or token rotation yet
- no persisted audit store yet
- real public deployment and connector validation must be completed from a networked environment with Railway and provider access
