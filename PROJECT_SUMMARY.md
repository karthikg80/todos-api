# Todos API — Project Summary

## Status

Active and production-oriented. The repository is a multi-client monorepo sharing one Express/Prisma/PostgreSQL backend.

## Surfaces

- **Backend API** — Express + TypeScript + Prisma in `src/`. Route modules in `src/routes/`, business logic in `src/services/` and `src/domains/`. Prisma-backed persistence against PostgreSQL (see `prisma/schema.prisma`).
- **Web client** — Vite + React + TypeScript in `client-react/`. Separate `package.json`, consumes the REST API. See `.claude/skills/react-client/SKILL.md`.
- **iOS app** — SwiftUI (iOS 17+) in `ios/TodosApp/`. Zero third-party dependencies, actor-based networking (`APIClient`, `SessionCoordinator`), Keychain-backed token storage. See `.claude/skills/ios-app/SKILL.md`.
- **CLI (`td`)** — Commander.js-based TypeScript CLI in `cli/` + `src/cli/`. Distributed as an npm `bin` entry.
- **Agent runner** — Python 3 worker in `agent-runner/`. Deployed on Railway cron. Hosts scheduled job modules (daily planning, weekly review, inbox triage, decomposer, evaluators, watchdog, project health, retention, and others — see `agent-runner/jobs/`).
- **Remote MCP surface** — OAuth-gated Model Context Protocol endpoint (at `/mcp/*`) for ChatGPT/Claude connector integrations.

The legacy vanilla JS web client previously in `client/` has been removed. See `docs/reference/vanilla-client-archive.md` for historical context.

## Shared Contract

- `src/types.ts` is canonical for **backend domain types** (internal shapes used by services).
- Transport DTOs are a separate concern — see [ADR-006](docs/adr/006-transport-contract-source-of-truth.md) for the domain-vs-transport split and the per-client sync path.
- CI runs `swift build` and React `tsc --noEmit` when `src/types.ts` or `src/validation/constants.ts` change.

## Testing

- **Unit** — `npm run test:unit` (Jest, `jest.unit.config.js`)
- **Integration** — `npm run test:integration` (Jest, real Postgres via Docker Compose)
- **MCP** — `npm run test:mcp` (MCP-surface tests)
- **UI regression** — `CI=1 npm run test:ui:fast` (Playwright, 4-way sharded in CI)
- **React** — `cd client-react && npm test` (Vitest)
- **iOS** — `cd ios/TodosApp && swift test` (XCTest, macOS SPM build)
- **AI evals** — `npm run eval:all` (custom evaluator under `evals/` + `eval-lab/`)

Coverage ratchet enforced via `npm run test:coverage:check` and `.coverage-baseline.json`.

## Day-to-day verification checks

```bash
npx tsc --noEmit
npm run format:check
npm run test:unit
CI=1 npm run test:ui:fast
```

See [CLAUDE.md](CLAUDE.md) for the full verification matrix, worktree workflow, and husky hook behavior.

## Operational

- Deployment: Railway (NIXPACKS builder). `/readyz` serves as the platform health probe.
- Release cadence: daily fast-forward release-train workflow (`.github/workflows/release-train.yml`) on weekdays; manual staging/UAT promotion.
- Observability: structured JSON logs, request-ID middleware, route-latency logging, optional Sentry (backend + React) gated on `SENTRY_DSN`.
- Local Postgres: `npm run docker:up` + `npm run db:setup`.

## Docs

- [README.md](README.md) — setup, scripts, endpoints, directory map.
- [CLAUDE.md](CLAUDE.md) — developer workflow and verification matrix.
- [CONTRIBUTING.md](CONTRIBUTING.md) — single entry point that links the rest.
- [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md) — deeper architecture reference (some sub-sections still describe the removed vanilla client and are marked historical).
- [docs/adr/](docs/adr/) — numbered Architecture Decision Records.
- [docs/engineering-backlog.md](docs/engineering-backlog.md) — repo-grounded engineering backlog.
