# Architecture Invariants

Rules that protect the structural integrity of this codebase.
Agents must follow these regardless of task type or urgency.

## Frontend (client/)

- **Modular vanilla frontend.** `client/app.js` is the entrypoint, `client/modules/` holds domain modules, and `client/utils/` holds shared scripts. No bundler.
- **Thin entrypoint.** Keep `client/app.js` as orchestration glue. New UI behavior should land in the appropriate feature/module/platform file unless the entrypoint wiring itself is the change.
- **Event delegation.** Listeners attach to container elements, never to dynamic children.
- **Filter pipeline.** `#categoryFilter` + `filterTodos()` is the single entry point for all filtering. Do not create parallel filter paths.
- **Project selection.** Always use `setSelectedProjectKey(...)`. No direct DOM or state mutation for project switching.
- **DOM-ready contract.** `#todosView.active` + `#todosContent` visible + no `.loading` children = ready. Tests use `waitForTodosViewIdle()`.
- **Reuse canonical flows.** If a state transition, render path, or selector already exists, extend it instead of adding a second implementation path.

## Backend (src/)

- **Prisma is the only data access layer.** No raw SQL.
- **Thin HTTP layer.** Route handlers and middleware should parse/authorize/validate/dispatch. Do not add business logic to routes just because they are easy to reach.
- **Prefer domain-oriented placement for new code.** Use the relevant `src/domains/` area when there is a clear domain home. If you must touch a legacy `src/services/` file, avoid widening its scope and extract toward the owning domain when practical.
- **Respect domain boundaries.** Do not create new cross-domain shortcuts or backdoor imports just to ship faster. Prefer explicit composition points and existing interfaces.
- **Keep infrastructure generic.** `src/infra/` is for adapters, logging, metrics, config, and other reusable plumbing, not product-specific decision logic.
- **Schema changes require explicit task approval.** Never modify `prisma/schema.prisma` as a side effect.

## Testing

- **Fast suite is the CI gate.** `test:ui:fast` excludes `@visual` tests.
- **Snapshots are Linux-only.** Generate via Docker Playwright container, never from macOS.
- **Never weaken a test to pass CI.** Fix the code, not the assertion.

## Dependencies

- **No new npm packages without justification.** State the reason in the task or PR.
- **No CI workflow changes** (`.github/workflows/`) unless the task explicitly requires it.

## Change Discipline

- **Name the layer before editing.** Every meaningful change should have a clear answer to "why does this live here?"
- **Prefer extraction over accretion.** When a file is already acting like a grab bag, move cohesive logic into a better home instead of stacking on more responsibility.
- **Document boundary changes.** If a PR changes an architectural rule, update the relevant ADR or durable rule doc in the same PR.

## Intent, Not Syntax

These rules describe _what must be true_, not _how to achieve it_.
Any agent (Codex, Claude, future tools) should interpret them in their own tooling context.
