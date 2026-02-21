# Brief — Current Project Context

Target: <=2 pages. When this grows beyond 2 pages, compact:
extract new rules -> Canon, archive old sections -> Archive, reset Brief.

## What This Project Is

Full-stack todo application. Express + Prisma + PostgreSQL backend, vanilla JS frontend (single-page app, no framework, no bundler). Deployed on Railway.

## Current State

- Notion-style shell is active: pinned sidebar + pinned topbar, main pane scroll.
- Sidebar remains the primary navigation surface for workspace flows.
- Settings is available from the sidebar bottom and renders in the Todos shell.
- AI internal category handling is hardened; `AI Plan` is hidden from nav/filter surfaces.

## Active Architecture Patterns

- Event delegation on container elements (never on dynamic children).
- `filterTodos()` is the single filter entry point.
- `setSelectedProjectKey()` is the only project selection API.
- `waitForTodosViewIdle()` for deterministic UI readiness in tests.

## Active Constraints

- Keep legacy top tabs while Playwright depends on them.
- Do not break `Profile` test path until tests are migrated to Settings-only navigation.
- Internal categories are data-visible under `All tasks` but excluded from navigation/selectors.

## Recent Decisions (2026-02-21)

- Settings is pinned to sidebar bottom as the stable account/settings entry point.
- Sidebar should not disappear when entering settings/profile-related workflows.
- `AI Plan` remains internal-only and must be excluded from projects/category UI surfaces.
- Memory compaction follow-up required because PRs #124-#128 shipped UX decisions without memory updates.

---

*Last updated: 2026-02-21*
