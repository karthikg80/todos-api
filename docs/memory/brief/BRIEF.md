# Brief — Current Project Context

Target: <=2 pages. When this grows beyond 2 pages, compact:
extract new rules -> Canon, archive old sections -> Archive, reset Brief.

## What This Project Is

Full-stack todo application. Express + Prisma + PostgreSQL backend, vanilla JS frontend (single-page app, no framework, no bundler). Deployed on Railway.

## Current State

- Sidebar-first Todos shell is active: the rail owns navigation, search, and utility disclosure on desktop, with a sheet variant on mobile.
- Settings is available from the sidebar bottom (as the only pinned bottom item) and renders inside the Todos shell; profile/account controls live there too.
- Home is now an explicit launch surface with curated modules (`Top Focus`, `Due Soon`, `Stale Risks`, `Quick Wins`, `Projects to Nudge`) and the primary desktop composer entry.
- Search no longer lives as a large persistent control in the main panel; search-adjacent filters/settings are disclosed from the sidebar when search is focused or active.
- Project headings (sections) are supported and project-selected lists group by heading when available.
- Redundant top chrome has been reduced: the top bar mainly serves the projects button when the rail is collapsed/hidden, while the main list header stays compact.
- AI internal category handling is hardened; `AI Plan` is hidden from nav/filter surfaces.

## Active Architecture Patterns

- Event delegation on container elements (never on dynamic children).
- `filterTodos()` is the single filter entry point.
- `setSelectedProjectKey()` is the only project selection API.
- `waitForTodosViewIdle()` for deterministic UI readiness in tests.

## Current View Model

- `Home / launchpad`: the only intentional dashboard-like landing surface. It helps the user choose where to enter work rather than acting like analytics.
- `Smart views`: `All tasks`, `Today`, `Upcoming`, `Completed`, and `Unsorted` are list-first views with a compact shared header; search/filter state is driven from the sidebar.
- `Project-selected views`: selecting a project keeps the sidebar as the context source and groups tasks by heading when sections exist. Current `master` still reuses the shared list header and compact focus panel here, so future quiet-workspace changes should treat that as existing behavior to intentionally replace, not as a new invariant.

## Active Constraints

- Keep legacy top tabs as low-prominence compatibility affordances for Todos/Settings switching; do not remove until tests/user flows no longer depend on them.
- UI tests should target the Settings route trigger, not `profileView` activation as a required user path.
- Internal categories are data-visible under `All tasks` but excluded from navigation/selectors.
- Keep search and search-adjacent filter disclosure in the sidebar rail/sheet; do not reintroduce persistent main-panel search chrome.
- Avoid duplicate primary create affordances on desktop; the Home hero/button path is the intended strong create entry.
- Prefer calm, restrained, editorial hierarchy over generic dashboard framing when extending the Todos shell.

## Recent Decisions (2026-02-22 to 2026-03-01)

- PRs `#126` and `#127` reworked quick-entry/tool hierarchy and CTA emphasis so the rail and composer feel lighter and more intentional.
- PRs `#128`, `#130`, `#132`, `#145`, and `#146` converged on a sidebar-first IA: navigation, search, filters, and utility actions should live in the rail/sheet with less repeated main-panel chrome.
- PR `#141` introduced project headings/sections, establishing projects as structured workspaces rather than flat category lists.
- PRs `#142`, `#143`, and `#144` introduced Home as a launchpad/dashboard surface with curated modules and made the composer entry consistent around that surface.
- The emerging product direction is a calmer, more spacious, more editorial workspace model: `Home` decides, smart views scan lists, and projects organize work. The implementation on `master` is partway through that transition, so not every older shared chrome pattern has been removed yet.

---

_Last updated: 2026-03-01_
