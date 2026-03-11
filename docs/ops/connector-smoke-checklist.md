# Connector Smoke Checklist

Focused manual smoke plan for validating the deployed public MCP surface with ChatGPT and Claude.

## Scope

Use this after a public HTTPS deployment is live.

Assumptions:

- `BASE_URL` points at the deployed public HTTPS origin
- the user already has a real Todos account
- the deployed service passes `GET /healthz` and `GET /readyz`

## Shared Preconditions

Before testing either connector:

1. Confirm public metadata is reachable:
   - `GET ${BASE_URL}/.well-known/oauth-protected-resource`
   - `GET ${BASE_URL}/.well-known/oauth-authorization-server`
2. Confirm unauthenticated MCP access is denied cleanly:
   - `GET ${BASE_URL}/mcp` returns `401`
   - `WWW-Authenticate` points at the protected-resource metadata
3. Confirm the account you will use has at least one project and one todo for read tests.

## ChatGPT Manual Smoke

1. In the ChatGPT connector flow, add the remote MCP server using:
   - `${BASE_URL}/mcp`
2. Start the connector auth flow.
3. Complete the browser sign-in on `${BASE_URL}/oauth/authorize`.
4. Approve requested scopes.
5. Confirm the connector shows the expected tool list:
   - `list_tasks`
   - `search_tasks`
   - `get_task`
   - `create_task`
   - `update_task`
   - `complete_task`
   - `list_projects`
   - `create_project`
6. Run one read action:
   - `list_tasks` or `list_projects`
7. Run one write action:
   - `create_task` with a distinct title such as `Connector smoke <date>`
8. Confirm the new task appears in the Todos app UI for the same user.
9. Disconnect and reconnect once to confirm the auth flow still succeeds.

## Claude Manual Smoke

1. In the Claude connector flow, add the remote MCP server using:
   - `${BASE_URL}/mcp`
2. Start the auth flow and complete sign-in on `${BASE_URL}/oauth/authorize`.
3. Approve requested scopes.
4. Confirm tool discovery succeeds.
5. Run one read action:
   - `search_tasks` or `get_task`
6. Run one write action:
   - `complete_task` on a task owned by the signed-in user
7. Confirm the mutation is reflected in the Todos app UI.
8. Reconnect once to confirm the auth flow still works.

## Failure-Mode Checks

Validate these manually or with curl after deploy:

- expired or invalid token => structured auth failure
- read-only token cannot call write tools
- task and project reads stay scoped to the authenticated user
- cross-user task IDs return `RESOURCE_NOT_FOUND_OR_FORBIDDEN`

## Suggested Curl Checks

Metadata:

```bash
curl -i "${BASE_URL}/.well-known/oauth-authorization-server"
curl -i "${BASE_URL}/.well-known/oauth-protected-resource"
curl -i "${BASE_URL}/mcp"
```

Dynamic client registration:

```bash
curl -i "${BASE_URL}/oauth/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "redirect_uris": ["https://example.com/callback"],
    "client_name": "Manual Smoke",
    "grant_types": ["authorization_code"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none"
  }'
```

## Record Results

Capture at minimum:

- deployed `BASE_URL`
- ChatGPT connect result: pass/fail
- Claude connect result: pass/fail
- read flow result: pass/fail
- write flow result: pass/fail
- reconnect result: pass/fail
- auth failure behavior: pass/fail
- scope denial behavior: pass/fail
- relevant request IDs from logs for any failures

## Blocker In This Sandbox

Real connector validation could not be completed from this environment because external network access to GitHub and Railway is blocked, which also prevents completing a live public deployment.

Relevant commands attempted here:

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
gh issue list --search "Make the repo agent-accessible" --state open
```

Both returned:

```text
error connecting to api.github.com
check your internet connection or https://githubstatus.com
```

That means real ChatGPT and Claude connector checks still need to be run manually against the deployed Railway endpoint from a networked environment.
