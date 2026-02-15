# Architecture Invariants

Rules that protect the structural integrity of this codebase.
Agents must follow these regardless of task type or urgency.

## Frontend (public/)

- **Single-file SPA.** All client logic lives in `public/app.js`. No modules, no bundler.
- **Event delegation.** Listeners attach to container elements, never to dynamic children.
- **Filter pipeline.** `#categoryFilter` + `filterTodos()` is the single entry point for all filtering. Do not create parallel filter paths.
- **Project selection.** Always use `setSelectedProjectKey(...)`. No direct DOM or state mutation for project switching.
- **DOM-ready contract.** `#todosView.active` + `#todosContent` visible + no `.loading` children = ready. Tests use `waitForTodosViewIdle()`.

## Backend (src/)

- **Prisma is the only data access layer.** No raw SQL.
- **Schema changes require explicit task approval.** Never modify `prisma/schema.prisma` as a side effect.

## Testing

- **Fast suite is the CI gate.** `test:ui:fast` excludes `@visual` tests.
- **Snapshots are Linux-only.** Generate via Docker Playwright container, never from macOS.
- **Never weaken a test to pass CI.** Fix the code, not the assertion.

## Dependencies

- **No new npm packages without justification.** State the reason in the task or PR.
- **No CI workflow changes** (`.github/workflows/`) unless the task explicitly requires it.

## Intent, Not Syntax

These rules describe *what must be true*, not *how to achieve it*.
Any agent (Codex, Claude, future tools) should interpret them in their own tooling context.
