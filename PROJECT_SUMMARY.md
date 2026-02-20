# Todos API - Project Summary

## Status

Active and production-oriented. The repository contains:

- An Express + TypeScript backend with Prisma/PostgreSQL persistence.
- A static frontend (`public/`) that consumes the API.
- Auth, project management, todo CRUD/reordering, and AI-assist flows.
- Unit, integration, and Playwright UI test suites.

## Current Architecture Snapshot

- `src/server.ts` boots the API; `src/app.ts` composes middleware and routes.
- Route modules live in `src/routes/` (`auth`, `todos`, `projects`, `ai`, `users`, `admin`).
- Persistence is Prisma-backed (`src/prismaTodoService.ts`, `src/projectService.ts`) with interfaces in `src/interfaces/`.
- A deterministic in-memory todo service exists for focused unit flows (`src/todoService.ts`).
- Data model is defined in `prisma/schema.prisma` and includes `User`, `RefreshToken`, `Project`, `Todo`, `Subtask`, and AI suggestion tables.
- Frontend UI is framework-free (`public/index.html`, `public/app.js`, `public/styles.css`).

## Testing Snapshot

The test footprint is no longer the original small in-memory-only set. Current coverage includes:

- Unit tests (`npm run test:unit`)
- Integration API tests (`npm run test:integration`)
- UI regression tests with Playwright (`npm run test:ui:fast` and `npm run test:ui`)

For exact test counts, use current command output instead of fixed numbers in docs.

## Operational Checks Used in Practice

- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `npm run test:unit`
- `CI=1 npm run test:ui:fast`

## Notes

- AI provider integration is optional and controlled via environment flags.
- The codebase uses explicit docs/task protocols under `docs/agent-queue/` for planning and delivery.
