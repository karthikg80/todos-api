# Codex Implementation Prompts (M0-M4)

Use one prompt per PR. Keep each PR focused and independently verifiable.

## Prompt 1: M0 Tokens and Typography Foundation
```
Implement milestone M0 in /Users/karthikgurumoorthy/dev/todos-api.

Goal:
Create a tokenized, calm visual foundation without changing layout structure or behavior.

Exact files to edit:
- /Users/karthikgurumoorthy/dev/todos-api/public/styles.css
- /Users/karthikgurumoorthy/dev/todos-api/public/index.html
- /Users/karthikgurumoorthy/dev/todos-api/public/app.js

Exact behavior requirements:
- Introduce semantic CSS variables for surfaces/text/borders/accent/spacing/radius/shadow/typography.
- Replace obvious hardcoded color/radius/shadow values with token usage.
- Keep existing DOM structure and feature behavior unchanged.
- Keep dark mode functioning via token overrides.

Constraints:
- No framework/library changes.
- Reuse current section-based view model and delegated data-on* handlers.
- Do not rewrite rendering architecture; preserve innerHTML rendering patterns.

Verification commands:
- npm run build
- npm run format:check
- npm run lint:css
- npm run lint:html
- npm run test:unit
- npm run test:ui
```

## Prompt 2: M1 Todos Header Declutter and More Filters
```
Implement milestone M1 in /Users/karthikgurumoorthy/dev/todos-api.

Goal:
Rework Todos top controls into calm default hierarchy with progressive disclosure.

Exact files to edit:
- /Users/karthikgurumoorthy/dev/todos-api/public/index.html
- /Users/karthikgurumoorthy/dev/todos-api/public/styles.css
- /Users/karthikgurumoorthy/dev/todos-api/public/app.js
- /Users/karthikgurumoorthy/dev/todos-api/tests/ui (only affected spec files)

Exact behavior requirements:
- Default visible controls: search, project filter, compact date scope, primary Add action.
- Add a "More filters" disclosure panel.
- Move rare controls (export .ics, project maintenance actions, extra utilities) into disclosure.
- Keep filter logic and existing handler functions operational.

Constraints:
- No framework/library changes.
- Keep data-on* delegated events.
- Reuse existing filter functions (setDateView, clearFilters, filterTodos) where possible.

Verification commands:
- npm run build
- npm run format:check
- npm run lint:css
- npm run lint:html
- npm run test:unit
- npm run test:ui
```

## Prompt 3: M2 List Row Redesign and Metadata Alignment
```
Implement milestone M2 in /Users/karthikgurumoorthy/dev/todos-api.

Goal:
Redesign todo rows for a calmer SaaS scan pattern while keeping functionality intact.

Exact files to edit:
- /Users/karthikgurumoorthy/dev/todos-api/public/app.js
- /Users/karthikgurumoorthy/dev/todos-api/public/styles.css
- /Users/karthikgurumoorthy/dev/todos-api/tests/ui (only affected spec files)

Exact behavior requirements:
- Update renderTodos() row template to consistent slots:
  1) selection/completion
  2) title/description
  3) metadata line
  4) actions
- Reduce visual competition from metadata pills and delete action.
- Preserve drag/drop, bulk select, complete toggle, edit, delete, notes/subtasks availability.

Constraints:
- No framework/library changes.
- Keep innerHTML rendering approach in renderTodos().
- Keep existing event handler names and data-on* wiring.

Verification commands:
- npm run build
- npm run format:check
- npm run lint:css
- npm run test:unit
- npm run test:ui
```

## Prompt 4: M3 Details Drawer and Edit Flow Cleanup
```
Implement milestone M3 in /Users/karthikgurumoorthy/dev/todos-api.

Goal:
Replace edit clutter with a dedicated details surface using progressive disclosure.

Exact files to edit:
- /Users/karthikgurumoorthy/dev/todos-api/public/index.html
- /Users/karthikgurumoorthy/dev/todos-api/public/styles.css
- /Users/karthikgurumoorthy/dev/todos-api/public/app.js
- /Users/karthikgurumoorthy/dev/todos-api/tests/ui (only affected spec files)

Exact behavior requirements:
- Introduce drawer-first edit UI (modal fallback allowed for narrow screens).
- Essentials section visible by default (title/status/project/due/priority).
- Details section collapsible for description/notes/subtasks.
- Keep save/cancel behavior and existing API update logic.
- Preserve accessibility semantics (dialog role or equivalent, focus management).

Constraints:
- No framework/library changes.
- Reuse openEditTodoModal/closeEditTodoModal/saveEditedTodo flow where possible.
- Keep delegated events and avoid architectural rewrites.

Verification commands:
- npm run build
- npm run format:check
- npm run lint:css
- npm run lint:html
- npm run test:unit
- npm run test:ui
```

## Prompt 5: M4 AI Workspace Dock and Collapse
```
Implement milestone M4 in /Users/karthikgurumoorthy/dev/todos-api.

Goal:
Make AI workspace available but non-competing by default.

Exact files to edit:
- /Users/karthikgurumoorthy/dev/todos-api/public/index.html
- /Users/karthikgurumoorthy/dev/todos-api/public/styles.css
- /Users/karthikgurumoorthy/dev/todos-api/public/app.js
- /Users/karthikgurumoorthy/dev/todos-api/tests/ui (only affected spec files)

Exact behavior requirements:
- AI panel is dockable/collapsible and collapsed on initial Todos load.
- Expanded panel keeps existing goal planner + brain dump flows.
- AI insights/history remain available behind nested disclosure.
- Preserve existing AI loading/render functions and API calls.

Constraints:
- No framework/library changes.
- Keep section-based view + innerHTML render patterns.
- Reuse current renderAi* functions and data-on* event model.

Verification commands:
- npm run build
- npm run format:check
- npm run lint:css
- npm run test:unit
- npm run test:ui
```
