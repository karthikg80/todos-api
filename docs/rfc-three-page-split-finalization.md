# RFC: Finalize 3-Page Frontend Split and Retire Legacy Single-Shell Architecture

## Status

Proposed

## Owner

Frontend / Full-stack team

## Summary

The application has been successfully refactored from a monolithic single-shell index.html model into a 3-page structure:

- `/` → landing page
- `/auth` → authentication page
- `/app` → authenticated workspace

The new structure is functional and already in place. Remaining work is completion work: retire the legacy shell, align auth callbacks and reset flows, strengthen page-level route enforcement, update tests, and remove compatibility-only code.

This RFC proposes making the 3-page model the only supported top-level frontend architecture.

## Motivation

The prior architecture used one HTML shell to host:

- marketing landing content
- authentication flows
- authenticated app workspace

Those concerns were separated through CSS and JS view toggles. That approach increased coupling, enlarged the DOM and CSS surface area for every route, and made initialization logic harder to reason about.

The 3-page split improves:

- separation of concerns
- route clarity
- page-specific asset loading
- maintainability
- future modularization inside the authenticated app

The target architecture is already present. What remains is retirement of the compatibility layer and alignment of surrounding flows.

## Goals

- Make the 3-page architecture the sole supported top-level frontend structure.
- Retire the legacy single-shell index.html path.
- Align OAuth and password-reset flows to the new page model.
- Strengthen /app page-level enforcement with server-visible auth state.
- Reduce compatibility-only JS and CSS.
- Update tests and service worker behavior to reflect the new routes.
- Preserve the current internal /app subview model for now.

## Non-Goals

- Splitting the authenticated app into multiple top-level HTML pages.
- Rewriting the frontend in a framework.
- Changing backend API contracts except where needed for auth-flow correctness and page gating.
- Performing a broad feature-module rewrite inside the workspace.
- Optimizing the app.html JS graph as part of this RFC.

## Current State

### Completed

**Phase 1 — CSS split**
`client/styles.css` was split into:

- `client/styles/base.css`
- `client/styles/landing.css`
- `client/styles/auth.css`
- `client/styles/app.css`

**Phase 2 — HTML split**
Three standalone pages were created under `client/public/`:

- `index.html` — landing/marketing
- `auth.html` — login/register/reset/phone flows
- `app.html` — authenticated workspace

**Phase 3 — Express routes**
Routes now serve:

- `GET /` → `public/index.html`
- `GET /auth` → `public/auth.html`
- `GET /app` → `public/app.html`
- `GET /app/{*path}` → `public/app.html`

**Phase 4/5 — JS compatibility cleanup**
`authUi.js` was updated to support both the old shell and the new pages using element-existence checks and null guards.

### Current Architectural Reality

The current `/app` route is **client-guarded only**.

`app.html` is served unconditionally by Express, and an inline script checks `localStorage.token` to redirect unauthenticated users. This means:

- any value in `localStorage.token` bypasses the page redirect
- full app HTML/CSS/JS is still delivered to unauthenticated users
- APIs remain protected by backend JWT validation, so no protected data is exposed
- the current issue is unnecessary asset delivery and weak top-level route enforcement, not API data leakage

This is acceptable as a transition state, but not the desired final state.

## Proposed Architecture

### Top-level routes

- `/` serves the landing page
- `/auth` serves identity flows only
- `/app` serves the authenticated workspace
- `/app/{*path}` continues to support SPA subroutes inside the workspace

### Page ownership

- **landing page**: public marketing surface
- **auth page**: identity flows, callbacks, reset handling, token persistence
- **app page**: authenticated workspace only

### Access control

Final direction:

- backend APIs remain JWT-protected
- `/app` gains server-enforced page gating using an HTTP-only signed cookie
- client redirects remain for UX, but are no longer the sole gate

### Server-visible auth bridge

To support server-side page gating without replacing JWT-based API auth, login will set an additional HTTP-only signed cookie alongside the JWT flow.

Properties of this approach:

- stateless
- no server-side session store required
- minimal bridge between localStorage-based auth and server-enforced page routing
- preserves current JWT-based API authorization model

The Express `/app` route will validate the signed cookie to determine whether to serve `app.html` or redirect to `/auth`.

## Decision

Adopt the 3-page architecture as the sole supported top-level frontend structure and retire the legacy single-shell compatibility layer.

## Detailed Plan

### Milestone 1 — Auth flow alignment and shell-retirement prerequisites

Before retiring the old shell, update all flows that still depend on it.

Required updates:

- OAuth callback must no longer target `/?auth=success...`
- password reset must no longer target `/?token=...`

Target behavior:

- OAuth callback lands on `/auth?auth=success&token=...&refreshToken=...`
- `auth.html` persists tokens/session state
- `auth.html` sets up the server-visible auth bridge as part of login completion
- `auth.html` redirects to `/app`
- password reset links target `/auth?resetToken=...`

This keeps all identity-entry behavior on the auth page, where it belongs.

### Milestone 2 — Legacy shell retirement

Retire legacy `client/index.html` from active routing and make `/` resolve only to `client/public/index.html`.

Acceptance criteria:

- no production route depends on the monolithic shell
- no OAuth or reset flow depends on legacy `/`
- landing/auth/app no longer coexist in a single HTML document anywhere in active routing

This is the main cleanup unlock.

### Milestone 3 — Route enforcement improvements

Strengthen `/app` ownership beyond localStorage redirects.

Implementation direction:

- on successful login, set an HTTP-only signed cookie alongside the existing JWT flow
- Express validates the signed cookie on `/app` and `/app/{*path}`
- unauthenticated requests redirect to `/auth`
- JWT-based backend API validation remains unchanged

Acceptance criteria:

- unauthenticated users do not receive the full authenticated workspace shell by default
- `/app` protection no longer depends solely on arbitrary localStorage values
- no session store is introduced

### Milestone 4 — Dead CSS/JS cleanup

After shell retirement and auth-flow updates:

- delete `client/styles.css`
- remove `showAppView` / `showAuthView`
- remove compatibility-only null-guard branches where safe
- remove obsolete selectors tied only to the old shell

Important note: `body.is-todos-view` cleanup should be split into two stages.

**Stage 4a — Stabilize without semantic change**
Set `class="is-todos-view"` statically on `app.html` `<body>` so existing selectors continue to work without JS timing dependence.

**Stage 4b — Optional CSS simplification**
Treat prefix removal from the 200+ `body.is-todos-view` selectors as a later CSS-only refactor, not part of shell retirement.

This keeps retirement low-risk and avoids combining architectural cleanup with broad selector surgery.

### Milestone 5 — Page-specific initializers

Introduce thin page-owned initializers:

- `landing.js`
- `auth-page.js`

This work is especially important for `auth.html`, because the current dependency graph still reflects the old shell model. Auth actions currently depend on logic historically loaded through broader app wiring, and should be made explicit and page-owned.

Acceptance criteria:

- `auth.html` has a clear standalone initializer for auth flows
- landing page behavior is isolated from app bootstrap code
- page initialization no longer relies on incidental global availability from the old app graph

### Milestone 6 — Test and service-worker alignment

After routes and assets stabilize:

- update UI/integration tests to navigate explicitly to `/`, `/auth`, and `/app`
- refresh service worker precache entries and route assumptions

## Routing and Product Decisions

### Authenticated users visiting /

They **remain on the landing page**.

Rationale:

- landing is marketing content, not merely a redirect shell
- authenticated users may still want to view or share it
- convenience should be handled with a visible "Go to app" affordance, not forced redirect

### Landing-page "Go to app" CTA

The landing page will expose a lightweight conditional "Go to app" CTA.

Implementation:

- use a minimal inline `localStorage.token` check to unhide a nav link or CTA
- no redirect
- no server call

If the local token is stale, the user will naturally flow through `/app` and then to `/auth` if server-side page gating fails.

### OAuth callback destination

OAuth callbacks **land on /auth, then redirect to /app**.

Rationale:

- callback handling is an identity concern
- token extraction and persistence belong to the auth page
- this preserves clean page ownership and keeps auth logic out of the app shell

### JS graph optimization for app.html

**Not part of this RFC.**

Rationale:

- the current 11 scripts + app.js graph is the correct payload for the workspace today
- future code-splitting inside app.js for AI/admin/lazy features is orthogonal to the 3-page split and should be treated separately

## Risks

### 1. Breaking OAuth by retiring the shell too early

If the old shell is retired before callback URLs are updated, login breaks.

Mitigation: auth-flow alignment is a prerequisite for shell retirement.

### 2. Hidden dependencies on shared DOM assumptions

Some modules may still assume auth and app DOM structures coexist.

Mitigation:

- verify boot path independently on each page
- add page-owned initializers before aggressive compatibility cleanup

### 3. Over-scoping CSS cleanup

Bulk-removing `body.is-todos-view` prefixes across 200+ selectors increases risk and is not required to complete the architecture transition.

Mitigation:

- keep static body class in `app.html`
- defer selector simplification to a later CSS-only cleanup

### 4. Route protection remains weak longer than intended

As long as `/app` is client-guarded only, unauthenticated users still download the workspace shell.

Mitigation: add server-enforced route ownership as an explicit milestone, not a future vague improvement.

## Alternatives Considered

### Keep the compatibility layer indefinitely

Rejected. It preserves unnecessary complexity and delays the benefits of the split.

### Redirect authenticated users from / to /app

Rejected. Landing remains useful as marketing content even for signed-in users.

### Land OAuth callbacks directly on /app

Rejected. That would push token-handling responsibilities into the app page and blur the auth/app boundary.

### Introduce a server session store for /app gating

Rejected. An HTTP-only signed cookie gives server-visible routing state with lower complexity and without changing the JWT-based API model.

## Success Metrics

The transition is complete when:

- `/`, `/auth`, and `/app` are the only active top-level page model
- OAuth and reset flows resolve through `/auth`
- no active route depends on the monolithic shell
- `/app` enforcement is backed by a signed HTTP-only cookie, not only localStorage
- dead shell-specific CSS/JS is removed
- landing shows a conditional "Go to app" CTA for locally authenticated users
- tests reflect explicit page ownership

## Open Questions

None for this phase.

## Recommendation

Proceed with completion work in this order:

1. align OAuth and reset flows
2. retire legacy shell routing
3. add signed-cookie page enforcement for /app
4. remove dead compatibility code
5. add thin page-specific initializers
6. update tests and service worker

This is not a new architecture project. It is the finalization step for an already successful architecture transition.
