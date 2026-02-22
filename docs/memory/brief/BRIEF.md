# Brief — Current Project Context

Target: <=2 pages. When this grows beyond 2 pages, compact:
extract new rules -> Canon, archive old sections -> Archive, reset Brief.

## What This Project Is

Full-stack todo application. Express + Prisma + PostgreSQL backend, vanilla JS frontend (single-page app, no framework, no bundler). Deployed on Railway.

## Current State

- Notion-style shell is active: pinned sidebar + pinned topbar, main pane scroll.
- Sidebar remains the primary navigation surface for workspace flows.
- Settings is available from the sidebar bottom (as the only pinned bottom item) and renders in the Todos shell.
- Profile controls (email verification + account updates) now render inside the Settings pane.
- AI internal category handling is hardened; `AI Plan` is hidden from nav/filter surfaces.
- Todos shell density is compacted (sidebar spacing, top bar, list header, and quick-entry properties) to start list content higher on common laptop viewports.

## Active Architecture Patterns

- Event delegation on container elements (never on dynamic children).
- `filterTodos()` is the single filter entry point.
- `setSelectedProjectKey()` is the only project selection API.
- `waitForTodosViewIdle()` for deterministic UI readiness in tests.

## Active Constraints

- Keep legacy top tabs as low-prominence compatibility affordances for Todos/Settings switching; do not remove until tests/user flows no longer depend on them.
- UI tests should target the Settings route trigger, not `profileView` activation as a required user path.
- Internal categories are data-visible under `All tasks` but excluded from navigation/selectors.

## Recent Decisions (2026-02-21)

- Settings is pinned to sidebar bottom as the stable account/settings entry point.
- Sidebar should not disappear when entering settings/profile-related workflows.
- `AI Plan` remains internal-only and must be excluded from projects/category UI surfaces.
- Memory compaction follow-up required because PRs #124-#128 shipped UX decisions without memory updates.

---

_Last updated: 2026-02-22_
