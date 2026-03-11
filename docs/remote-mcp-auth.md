# Remote MCP Auth

This doc covers the current account-linking, authentication, and scope model for the remote MCP server.

## What "Account Linking" Means Here

At this stage, assistant linking is an OAuth-style PKCE handshake over JSON API endpoints. It reuses the app's existing user auth and JWT primitives instead of introducing a second identity system.

The current flow is:

1. User signs in to the app and gets a normal app access token.
2. The signed-in app calls `POST /auth/mcp/oauth/authorize`.
3. The server binds a short-lived authorization code to:
   - the authenticated user
   - requested scopes
   - assistant/client identity
   - redirect URI
   - PKCE code challenge
4. The assistant exchanges that code at `POST /auth/mcp/oauth/token`.
5. The assistant receives a scoped MCP access token and uses it on `POST /mcp`.

This is intentionally thin. It is meant to be compatible with a future browser redirect / OIDC onboarding path, not to be a fully polished provider integration on its own.

## Endpoints

### `POST /auth/mcp/oauth/authorize`

Starts assistant linking for a signed-in app user.

Auth:

- required
- expects the normal app bearer token, not an MCP token

Input:

- `clientId`
- `redirectUri`
- `scopes`
- `assistantName` (optional)
- `state` (optional)
- `codeChallenge`
- `codeChallengeMethod` = `S256`

Response:

- `authorizationCode`
- `expiresAt`
- `redirectUri`
- `scopes`
- `assistantName` (if provided)
- `state` (if provided)
- `tokenEndpoint`

### `POST /auth/mcp/oauth/token`

Exchanges an authorization code for an MCP access token.

Input:

- `grantType` = `authorization_code`
- `code`
- `clientId`
- `redirectUri`
- `codeVerifier`

Response:

- `accessToken`
- `tokenType`
- `expiresAt`
- `expiresIn`
- `scope`
- `scopes`
- `assistantName` (if present)
- `clientId` (if present)

### `POST /auth/mcp/token`

Local development shortcut only.

This bypasses the authorization-code exchange and mints an MCP token directly from a signed-in app user session. It should not be the preferred path for production assistant connectors.

## MCP Request Authentication

Every `POST /mcp` request must include:

- `Authorization: Bearer <mcp-access-token>`

The server then:

1. verifies token signature and expiry
2. checks token type is `mcp`
3. validates granted scopes
4. resolves the token to a concrete app user with `getUserById`
5. denies the request if the user session is no longer valid

No MCP tool trusts a client-provided user ID.

## Supported Scopes

Initial assistant-facing scopes:

- `tasks.read`
- `tasks.write`
- `projects.read`
- `projects.write`

The legacy `read` / `write` aliases are still accepted by the validation layer and expand to the explicit scopes above, but new docs and tooling should use the explicit scope names.

## Tool to Scope Mapping

| Tool             | Read only | Required scopes   |
| ---------------- | --------- | ----------------- |
| `list_tasks`     | Yes       | `tasks.read`      |
| `search_tasks`   | Yes       | `tasks.read`      |
| `get_task`       | Yes       | `tasks.read`      |
| `create_task`    | No        | `tasks.write`     |
| `update_task`    | No        | `tasks.write`     |
| `complete_task`  | No        | `tasks.write`     |
| `list_projects`  | Yes       | `projects.read`   |
| `create_project` | No        | `projects.write`  |

`tools/list` only returns tools that the current token is allowed to use.

## Auth-Related Errors

Auth and authorization failures return structured machine-usable errors with:

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
- `MCP_LINK_UNAUTHENTICATED`
- `MCP_LINK_INVALID_TOKEN`
- `MCP_LINK_AUTH_EXPIRED`
- `MCP_AUTH_CODE_INVALID`
- `MCP_AUTH_CODE_EXPIRED`
- `MCP_INVALID_CODE_VERIFIER`
- `RESOURCE_NOT_FOUND_OR_FORBIDDEN`

For resource lookups, the server intentionally avoids trusting caller identity claims beyond the bearer token and user resolution step. The todo/project services still enforce user scoping.

## Audit / Traceability

The server logs lightweight structured events for:

- assistant link authorization success/failure
- token exchange success/failure
- MCP auth success/failure
- scope denials
- tool calls with user ID, request ID, and tool name

This is currently log-based traceability only.

## Local Development

Typical local flow:

1. Sign in through `/auth/login` or the app UI and get a normal app token.
2. Call `POST /auth/mcp/oauth/authorize` with:
   - app bearer token
   - desired scopes
   - `clientId`
   - `redirectUri`
   - PKCE `codeChallenge`
3. Exchange the returned `authorizationCode` at `POST /auth/mcp/oauth/token`.
4. Use the returned MCP access token against `POST /mcp`.

For quick manual testing only, `POST /auth/mcp/token` still mints a scoped token directly from the signed-in app user session.

## Current Limitations

- no provider-facing OAuth discovery document yet
- no redirect/callback UI yet
- no assistant refresh-token flow yet
- authorization codes are in-memory and process-local
- MCP access tokens are JWTs and are not yet individually revocable
- audit data is not persisted outside logs

## Follow-Up Direction

- add provider-ready OAuth/OIDC discovery and consent UX when a specific assistant integration is ready
- decide whether assistant refresh tokens should reuse or extend the app refresh-token model
- persist link/session state if per-token revocation becomes necessary
- broaden scopes only when more tools exist and concrete separation is needed
