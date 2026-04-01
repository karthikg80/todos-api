# Vanilla JS Client

Static HTML/CSS/JS — no build step, no framework.

## Architecture Constraints

These are load-bearing patterns. Do not change them.

- **Event delegation:** `app.js` uses delegated event listeners on container elements. Do not attach listeners directly to dynamic child elements.
- **Filter pipeline:** `#categoryFilter` + `filterTodos()` is the canonical filter path. All filtering routes through it.
- **Project selection:** Use `setSelectedProjectKey(...)` for all project selection. Do not bypass it.
- **DOM-ready signal:** Wait for `#todosView.active` + `#todosContent` visible + no `.loading` children.

## Dangerous Patterns

- **`getProjectsRailElements()`** is a central factory with null-guards. Removing any HTML element it references silently breaks the entire project rail. Remove the guard _before_ removing the HTML element.
- **`data-onclick` global dispatcher:** Top-level functions are on `window` automatically. Explicit bridging: `window.fnName = fnName` at the bottom of `app.js`.
- **Mobile vs desktop divergence:** Desktop header is hidden in todos view via `@media (min-width: 769px)`. The `.logout-btn` in `#userBar` is the mobile logout path. Keep `aria-label` values consistent with test expectations.

## File Organization

- `app.js` — orchestration only, keep it thin
- `features/` — feature-specific UI modules
- `modules/` — domain logic
- `utils/` — shared utilities (apiClient, eventBus)
- `styles.css` — all styles
- `index.html` — SPA shell
