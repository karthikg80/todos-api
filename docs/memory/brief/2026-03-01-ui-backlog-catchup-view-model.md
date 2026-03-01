# 2026-03-01 — UI Backlog Catch-up and View Model

## What changed

- Backfilled memory updates for the merged UI backlog after `2026-02-22`, especially PRs `#126` through `#146`.
- Captured the current Todos view model explicitly in `BRIEF.md`: `Home` launchpad, smart views, and project-selected views.
- Recorded the sidebar-first search/filter model and reduced-chrome direction as current product truth.
- Promoted the sidebar search/filter disclosure rules into Canon.

## Why

- Several merged UI PRs changed navigation IA, shell layout, and workspace behavior without keeping memory docs in sync.
- The brief needed to reflect the current source of truth on `master`, not just the earlier sidebar-density pass.

## Do not break

- Sidebar rail/sheet is the canonical location for search and search-adjacent filters in Todos mode.
- `Home` is the intentional launch surface with curated decision modules, not a generic analytics dashboard.
- Smart views should stay list-first; avoid reintroducing large persistent search or utility chrome in the main panel.
- Keep event delegation, `filterTodos()`, and `setSelectedProjectKey(...)` as the controlling UI contracts.
