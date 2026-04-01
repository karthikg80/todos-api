# Project: todos-api

Full-stack todo application — monorepo with multiple clients consuming a shared Express/Prisma backend.

## Project Structure

- **Backend:** Express + Prisma + PostgreSQL in `src/`. Routes in `src/routes/`, services in `src/services/`.
- **Web Client (vanilla):** Static HTML/CSS/JS in `client/` — see @.claude/skills/vanilla-client/SKILL.md
- **Web Client (React):** Vite + React + TypeScript in `client-react/` — see @.claude/skills/react-client/SKILL.md
- **iOS App:** SwiftUI (iOS 17+) in `ios/TodosApp/` — see @.claude/skills/ios-app/SKILL.md
- **CLI:** `td` CLI tool in `src/cli/` (TypeScript, Commander.js).
- **Agent Runner:** Python worker in `agent-runner/` — Railway cron deployment.
- **Tests:** Unit (`src/*.test.ts`), Integration (`src/*.integration.test.ts`), UI (`tests/ui/*.spec.ts` — see @.claude/skills/playwright-testing/SKILL.md)

### Shared contract

`src/types.ts` is the canonical source of truth for all API types and enums. When this file changes, all clients must stay in sync. Use the `cross-client-reviewer` subagent to verify.

## Environment

- Node 22 via nvm: commands must use `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && <command>'`.
- gh CLI: `/opt/homebrew/bin/gh`.
- Docker: `/usr/local/bin/docker`.
- Git worktrees for feature branches live under `/private/tmp/todos-api-*`.
- **Never commit directly to master.** Always create a worktree/feature branch first, do all work there, and merge via PR. This applies to all changes — including new directories, isolated features, and "quick" fixes.

## Clean Code + Architecture

- **Keep orchestrators thin.** `client/app.js`, `src/routes/`, and entrypoints should coordinate, not accumulate logic.
- **Put behavior in the right home.** Frontend → `client/features/` or `client/modules/`. Backend → services, not route handlers.
- **Prefer the canonical path.** Extend existing flows instead of introducing parallel paths.
- **Do not widen legacy seams casually.** Extract cohesive logic into modules instead of growing large files.

## Verification Checks

After any change, run all applicable checks. All must pass before committing. Typecheck, architecture check, and format check are also enforced by pre-commit hooks.

```bash
npx tsc --noEmit
npm run check:architecture
npm run format:check
npm run lint:html
npm run lint:css
npm run test:unit
CI=1 npm run test:ui:fast
```

**IMPORTANT: Do not skip `CI=1 npm run test:ui:fast`** — even for changes that seem backend-only. If port 4173 is in use: `lsof -ti:4173 | xargs kill -9`.

## Definition of Done

- All verification checks pass (typecheck, architecture, format, lint, unit, UI tests)
- Coverage ratchet passes: `npm run test:coverage:check` (coverage must not drop below baseline)
- Changes are on a feature branch (never master), merged via PR
- PR description mentions cross-client impact if `src/types.ts` changed
- No unrelated files staged
- Conventional commit message: `feat(ui):`, `fix(api):`, `test(ui):`, `ci:`, `docs:`
- For complex changes: use `code-reviewer` subagent before creating PR

## CI Gates (required to pass on every PR)

- **unit** — typecheck + format + audit + unit tests.
- **integration** — Prisma migrations + integration tests (Postgres service).
- **ui-quality** — CSS lint + HTML validation + link crawl + fast UI tests.
- **Railway** — preview deploy.

## PR Workflow

- Always check `mergeStateStatus` and `mergeable` before merging.
- Prefer squash merge with `--delete-branch`.
- `--delete-branch` may fail if a local worktree uses the branch (remote still gets deleted).

## Boundaries

- Do not modify files outside the scope of the current task.
- Do not change CI workflow files (`.github/workflows/`) unless explicitly required.
- Do not add new npm dependencies without justification.
- Do not modify `prisma/schema.prisma` unless schema changes are explicitly required.
- If a check fails for reasons unrelated to the current change, note it rather than fixing unrelated code.
- Git pathspec exclude syntax: use `:(exclude)path/` not `:!path/` to avoid bash history expansion.
