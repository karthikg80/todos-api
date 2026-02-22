# 2026-02-22 — UI Sidebar Polish Density

## What changed

- Sidebar bottom nav now renders only `Settings` (removed redundant sidebar `Todos` entry) while keeping legacy top tabs available as subdued compatibility controls.
- Tightened sidebar spacing/section separation and flattened project row styling so the rail reads like a stable list, not large pills.
- Reduced Todos shell vertical padding (`#appMainScroll`, top bar, list header, quick-entry/property panel) so the first todo row appears higher.
- Preserved sticky list header readability (`align-items: center`) to avoid cropping/clipping feel.
- `AI Plan` remained hidden from projects rail and category selectors via existing internal-category filtering (`getAllProjects()` + `setSelectedProjectKey()` fallback to All tasks).

## Why

- UX goal: a calmer, denser, Notion-like navigation shell with clearer hierarchy and less wasted vertical space, without changing user flows or test hooks.

## Do not break

- Keep event delegation patterns in `public/app.js` (no direct listeners on dynamic rows).
- Keep `filterTodos()` as the canonical filter pipeline entry point.
- Keep `setSelectedProjectKey(...)` as the only project selection API and fallback path for filtered/invalid/internal categories.
- Do not rename/remove existing IDs/classes used by UI tests.
