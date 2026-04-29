# Contributing

Welcome. This file is the single entry point for contributing to `todos-api`. It links out to the canonical docs rather than duplicating them.

## Quick links

- **Project overview:** [README.md](README.md)
- **Developer workflow (required reading):** [CLAUDE.md](CLAUDE.md)
- **Architecture:** [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md) and [docs/adr/](docs/adr/)
- **Ops runbooks:** [docs/ops/](docs/ops/)
- **UX principles:** [UX.md](UX.md)

## Workflow at a glance

1. **Branch via worktree.** Never commit on `master`. Use `scripts/new-task-worktree.sh` to bootstrap, or create a worktree manually on a non-`master` branch. The primary checkout is reserved for fast-forward sync of `master` only. Husky will block pushes from the primary checkout.
2. **Implement the change** — keep orchestrators thin (routes coordinate, services own behavior).
3. **Verify locally** — all of the following must pass before you push:
   ```bash
   npx tsc --noEmit
   npm run format:check
   npm run test:unit
   CI=1 npm run test:ui:fast
   ```
   If `src/types.ts` changes, also run `swift build` in `ios/TodosApp/` and the React build. See [CLAUDE.md](CLAUDE.md) for the full list.
4. **Commit with a conventional message.** Enforced by `.husky/commit-msg`. Format: `type(scope): subject` — e.g. `feat(ui):`, `fix(api):`, `test(ui):`, `docs:`, `ci:`.
5. **Open a PR** via `scripts/open-task-pr.sh` (wraps `gh pr create` with validation). The PR template lives at `.github/pull_request_template.md`.

## CI gates (all required)

- `unit` — typecheck + format + `npm audit --omit=dev` + unit tests
- `integration` — Prisma migrations + integration tests against real Postgres
- `ui-quality` — Playwright fast suite
- `Railway` — preview deploy
- `cross-client-sync` — runs when `src/types.ts` or `src/validation/constants.ts` change; compiles React + `swift build`

## Shared contract

`src/types.ts` is the source of truth for all API types and enums. A change there must keep all five clients in sync: Node backend, React, iOS, `td` CLI, and `agent-runner` (Python). When this file changes, PR reviewers will ask about cross-client impact — call it out explicitly in the PR description.

## Code style

- TypeScript strict mode. Do not introduce `any` or `@ts-ignore` without justification.
- No new npm dependencies without a note explaining why.
- iOS app is intentionally **zero third-party dependencies** — see [.claude/skills/ios-app/SKILL.md](.claude/skills/ios-app/SKILL.md).
- Prettier + the root `.stylelintrc.json` + `.htmlvalidate.json` run in CI.

## Security & hygiene

- Secrets go in `.env` (never committed). See [.env.example](.env.example) for the full list.
- `gitleaks` runs in CI on every PR.
- Dependabot groups updates weekly across npm, pip (`agent-runner/`), and GitHub Actions.

## Getting help

- Bugs / features: open an issue using the templates in [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/).
- Internal workflow rules and Claude Code conventions: [.claude/](.claude/) and [CLAUDE.md](CLAUDE.md).
