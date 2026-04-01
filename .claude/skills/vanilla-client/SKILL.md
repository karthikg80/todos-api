---
name: vanilla-client
description: Conventions for the vanilla JS web client in client/
---

# Vanilla JS Client Conventions

## Architecture Constraints

These are load-bearing patterns. Do not change them.

- **Event delegation:** `client/app.js` uses delegated event listeners on container elements. Do not attach listeners directly to dynamic child elements.
- **Filter pipeline:** `#categoryFilter` + `filterTodos()` is the canonical filter path. All project/category/status filtering routes through it.
- **Project selection:** Use `setSelectedProjectKey(...)` for all project selection entry points. Do not bypass it.
- **DOM-ready signal:** After auth/navigation, wait for `#todosView.active` + `#todosContent` visible + no `.loading` children. See `waitForTodosViewIdle()` in `tests/ui/helpers/todos-view.ts`.

## Dangerous Patterns

- **`getProjectsRailElements()` is a central factory with null-guards.** Removing any HTML element it references via `getElementById` silently breaks the entire project rail. Always remove the guard *before* removing the HTML element.
- **`data-onclick` global dispatcher:** Top-level functions are automatically on `window`. If a function needs explicit bridging, add `window.fnName = fnName` at the bottom of `app.js` (like `toggleTheme`).
- **Mobile vs desktop layout divergence:** Desktop header is hidden in todos view via `@media (min-width: 769px)`. The `.logout-btn` in `#userBar` is the mobile logout path. Tests use `getByRole("button", { name: "Logout" })` — keep `aria-label` values consistent with test expectations.

## File Organization

- `client/app.js` — orchestration only, keep it thin
- `client/features/` — feature-specific UI modules
- `client/modules/` — domain logic (todosService, projectsState, filterLogic)
- `client/utils/` — shared utilities (apiClient, eventBus, featureFlags)
- `client/styles.css` — all styles in one file
- `client/index.html` — single-page app shell
