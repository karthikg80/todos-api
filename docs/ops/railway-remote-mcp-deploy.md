# Railway Remote MCP Deploy

Lean runbook for deploying the public remote MCP surface on Railway.

## Purpose

Deploy the existing Todos API and public MCP routes to a stable HTTPS origin so ChatGPT- and Claude-style assistants can connect through the same service.

This repo already targets Railway. The MCP deployment rides on the main app service rather than creating a second service.

## Public Endpoint Shape

Set `BASE_URL` to the final public HTTPS origin, for example:

- `https://<service>.up.railway.app`
- `https://api.todos.example.com`

Public MCP URLs at that origin:

- `${BASE_URL}/mcp`
- `${BASE_URL}/.well-known/oauth-protected-resource`
- `${BASE_URL}/.well-known/oauth-authorization-server`
- `${BASE_URL}/oauth/register`
- `${BASE_URL}/oauth/authorize`
- `${BASE_URL}/oauth/token`
- `${BASE_URL}/healthz`
- `${BASE_URL}/readyz`

## Required Environment

Minimum production variables:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`
- `BASE_URL`

Recommended runtime hardening:

- `REQUEST_BODY_LIMIT=256kb`
- `FORM_BODY_LIMIT=64kb`
- `REQUEST_TIMEOUT_MS=30000`
- `HEADERS_TIMEOUT_MS=35000`
- `KEEP_ALIVE_TIMEOUT_MS=5000`
- `MCP_OAUTH_SESSION_COOKIE_NAME=mcp_link_session`
- `MCP_OAUTH_SESSION_MAX_AGE_MS=900000`

If email flows stay enabled in production, also set:

- `EMAIL_FEATURES_ENABLED=true`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Railway Setup

1. Link or create the Railway project for this repo.
2. Set the production environment variables above.
3. Confirm the service start command stays `npm start`.
4. Confirm the service has a public domain.
5. Point `BASE_URL` at that public HTTPS domain.
6. After deployment, check:
   - `GET /healthz`
   - `GET /readyz`
   - `GET /.well-known/oauth-authorization-server`
   - unauthenticated `GET /mcp` returns `401` plus `WWW-Authenticate`

## Runtime Safeguards in This Branch

This branch adds first-pass production hardening:

- request body limits for JSON and form bodies
- HTTP request, header, and keep-alive timeouts
- rate limiting for public OAuth and discovery endpoints
- health and readiness endpoints
- safe structured logging without dumping bearer tokens
- request ID and latency logging for MCP calls

## Manual Deploy Verification

After Railway deploys successfully:

```bash
curl -i "${BASE_URL}/healthz"
curl -i "${BASE_URL}/readyz"
curl -i "${BASE_URL}/.well-known/oauth-protected-resource"
curl -i "${BASE_URL}/.well-known/oauth-authorization-server"
curl -i "${BASE_URL}/mcp"
```

Expected:

- `/healthz` => `200`
- `/readyz` => `200` after database connectivity is ready
- `.well-known` endpoints => `200` JSON
- `/mcp` without auth => `401` with `WWW-Authenticate` pointing at the protected-resource metadata

## Blockers From This Sandbox

Actual Railway deployment could not be completed here.

Commands attempted:

```bash
railway status
```

Result:

```text
No linked project found. Run railway link to connect to a project
```

```bash
railway whoami
```

Result:

```text
Failed to fetch: error sending request for url (https://backboard.railway.com/graphql/v2)

Caused by:
    0: error sending request for url (https://backboard.railway.com/graphql/v2)
    1: client error (Connect)
    2: dns error: failed to lookup address information: nodename nor servname provided, or not known
    3: failed to lookup address information: nodename nor servname provided, or not known
```

Because this environment has no Railway network path and no linked project, the remaining deployment step is manual from a networked machine or CI environment with Railway access.
