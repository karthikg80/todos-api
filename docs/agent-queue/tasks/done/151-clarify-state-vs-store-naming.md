# TASK 151: clarify-state-vs-store-naming

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-151-clarify-state-vs-store-naming
base: master

## Intent

Resolve the confusing `state.js` / `store.js` naming so any future developer can immediately understand the role of each file without reading the code.

## Background

Two files have names that suggest they do similar things, but they are completely different concerns:

- `client/utils/state.js` — IIFE script tag (non-module). Wraps localStorage session persistence (auth token, refresh token, user object) and exposes `window.AppState = { AUTH_STATE, loadStoredSession, persistSession, clearSession }`. **Auth/session concern only.**
- `client/modules/store.js` — ES6 module. Exports `{ state, hooks }` — the shared runtime UI state object (todos, filters, drawer state, plan state, etc.). **Runtime UI state concern only.**

These are already architecturally clean. The task is purely to make the naming reflect that distinction.

## Scope

1. Rename `client/utils/state.js` → `client/utils/authSession.js`
2. Update `client/index.html` script tag: `src="/utils/state.js"` → `src="/utils/authSession.js"`
3. Update any references in `client/app.js` comments that mention `utils/state.js`
4. Add a one-line comment at the top of each file reinforcing its role:
   - `authSession.js`: `// Auth session persistence — localStorage read/write for token, refreshToken, user. Exposes window.AppState.`
   - `store.js`: `// Runtime UI state module — exports { state, hooks }. All domain modules import from here. Do not import from authSession.js.`
5. Update `docs/memory/brief/BRIEF.md` — "Open Tech Debt" section: mark this item resolved
6. Update `docs/next-enhancements.md` — mark resolved

## Out of Scope

- Any logic changes
- Renaming `store.js` — it is already well-named
- Changes to `window.AppState` API or any auth flow behavior
- Moving files between directories

## Files Allowed

- `client/utils/state.js` (rename to `authSession.js`)
- `client/index.html`
- `client/app.js`
- `client/modules/store.js` (comment addition only)
- `docs/memory/brief/BRIEF.md`
- `docs/next-enhancements.md`

## Acceptance Criteria

- [x] `client/utils/authSession.js` exists; `client/utils/state.js` is deleted
- [x] `client/index.html` loads `authSession.js` correctly
- [ ] App loads without console errors (window.AppState is available) — blocked by sandboxed `listen EPERM`
- [x] Each file has a clarifying top comment
- [x] `npm run lint:html` passes
- [ ] `npm run test:unit` passes — blocked by sandboxed `listen EPERM`
- [ ] `CI=1 npm run test:ui:fast` passes — blocked by sandboxed `listen EPERM`

## Constraints

- Pure rename + comment only — no logic changes of any kind
- `window.AppState` interface must remain unchanged
- tsc --noEmit must pass (TypeScript files may reference authSession indirectly through globals)

## MIC-Lite

### Motivation

The `state.js` name causes ambiguity: new developers and agents alike may assume it is the same kind of state store as `store.js`, leading to incorrect import choices or confusion about what owns what. Clarifying now prevents recurring confusion as M-series work extends the codebase.

### Impact

- No behavior change
- One index.html script src path changes
- Any future docs or agent prompts referencing `state.js` need updating

### Checkpoints

- [ ] App loads in browser with no 404 for authSession.js — blocked by sandboxed `listen EPERM`
- [ ] Login/logout flow works (session persistence intact) — blocked by sandboxed `listen EPERM`
- [ ] All test suites pass — sandbox blocked for server-backed suites

## Scope Escalation Triggers

## Scope Escalation Triggers

If any of these occur, set status to BLOCKED and request re-approval:

- Change touches >6 files
- Any auth behavior changes
- Any logic changes required to make the rename work

## Deliverable

- PR URL: https://github.com/karthikg80/todos-api/pull/194
- Commit SHA(s): 708bde0d251b7c357b9826699a4ecc0f903eb2b2
- Files changed:
  - `client/utils/authSession.js` (renamed from `client/utils/state.js`)
  - `client/index.html`
  - `client/app.js`
  - `client/modules/store.js`
  - `docs/memory/brief/BRIEF.md`
  - `docs/next-enhancements.md`
  - `docs/agent-queue/tasks/yellow/151-clarify-state-vs-store-naming.md`
- PASS/FAIL matrix:
  - `npx tsc --noEmit` — PASS
  - `npm run format:check` — PASS
  - `npm run lint:html` — PASS
  - `npm run lint:css` — PASS
  - `npm run test:unit` — BLOCKED (`listen EPERM` in sandbox)
  - `CI=1 npm run test:ui:fast` — BLOCKED (`listen EPERM` in sandbox)

## Outcome

- Renamed the auth-session persistence script from `state.js` to `authSession.js` without changing the `window.AppState` surface.
- Updated the HTML script tag plus the two `app.js` comments so the auth-session helper no longer reads like the runtime UI store.
- Added the clarifying `authSession.js` and `store.js` header comments and marked the old naming overlap as resolved in the brief and roadmap docs.
- Pushed branch `codex/task-151-clarify-state-vs-store-naming` and opened PR #194.
