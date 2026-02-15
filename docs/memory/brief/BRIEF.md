# Brief — Current Project Context

Target: ≤2 pages. When this grows beyond 2 pages, compact:
extract new rules → Canon, archive old sections → Archive, reset Brief.

## What This Project Is

Full-stack todo application. Express + Prisma + PostgreSQL backend, vanilla JS frontend (single-page app, no framework, no bundler). Deployed on Railway.

## Current State

- UI revamp completed through milestones M1, M2, M4 (M3 skipped).
- AI workspace feature in progress (calm mode / collapsed shell).
- Dual-agent workflow (Codex builder / Claude reviewer) operational.
- v2 operating model being integrated (Green/Yellow/Red classification).

## Active Architecture Patterns

- Event delegation on container elements (never on dynamic children).
- `filterTodos()` is the single filter entry point.
- `setSelectedProjectKey()` is the only project selection API.
- `waitForTodosViewIdle()` for DOM-ready detection in tests.

## Key Risks

- Snapshot drift between macOS (local) and Linux (CI).
- Port 4173 conflicts from interrupted test runs.
- Spec file leakage across branches without worktree isolation.

## Recent Decisions

- (append decisions here as they happen)

---

*Last updated: session start*
