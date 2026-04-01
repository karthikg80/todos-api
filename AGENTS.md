# Codex Agent Instructions

## Workspace Setup (REQUIRED)

Always create a git worktree for your task. Never work in the main checkout.

```bash
BRANCH_NAME="codex/<short-feature-name>"
WORKTREE_DIR="/private/tmp/todos-api-<short-feature-name>"
git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" master
cd "$WORKTREE_DIR"
npm ci
```

One PR = one branch = one worktree. Never reuse a worktree for a new task.

A Husky pre-commit hook blocks commits on `master` and detached `HEAD`. A commit-msg hook enforces conventional commit format. These hooks activate automatically after `npm ci`.

## Project Structure

- **Backend:** Express + Prisma + PostgreSQL in `src/`. Routes in `src/routes/`, services in `src/services/`.
- **Web Client (vanilla):** Static HTML/CSS/JS in `client/` — see `client/AGENTS.md`
- **Web Client (React):** Vite + React + TypeScript in `client-react/` — see `client-react/AGENTS.md`
- **iOS App:** SwiftUI (iOS 17+) in `ios/TodosApp/` — see `ios/AGENTS.md`
- **CLI:** `td` CLI tool in `src/cli/` (TypeScript, Commander.js).
- **Agent Runner:** Python worker in `agent-runner/` — Railway cron deployment.
- **Tests:** Unit (`src/*.test.ts`), Integration (`src/*.integration.test.ts`), UI (`tests/ui/*.spec.ts`)

### Shared contract

`src/types.ts` is the canonical source of truth for all API types and enums. When this file changes, all clients (vanilla JS, React, iOS DTOs) must stay in sync. Mention cross-client impact in the PR description. CI will automatically verify that iOS compiles (`swift build`) and React typechecks (`tsc --noEmit`) when `src/types.ts` or `src/validation/constants.ts` change.

## Clean Code + Architecture (REQUIRED)

- **Keep orchestrators thin.** `client/app.js`, `src/routes/`, and entrypoints should coordinate, not accumulate logic.
- **Put behavior in the right home.** Frontend → `client/features/` or `client/modules/`. Backend → services, not route handlers.
- **Prefer the canonical path.** Extend existing flows instead of introducing parallel paths.
- **Do not widen legacy seams casually.** Extract cohesive logic into modules instead of growing large files.

## Verification Checks

After any change, run all applicable checks. All must pass before committing.

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

- All verification checks pass
- Coverage ratchet passes: `npm run test:coverage:check` (coverage must not drop below baseline)
- Changes are on a feature branch (never master), merged via PR
- PR description mentions cross-client impact if `src/types.ts` changed
- No unrelated files staged
- Conventional commit: `feat(ui):`, `fix(api):`, `test(ui):`, `ci:`, `docs:`

## Commit and Handoff

After all checks pass:

```bash
git push -u origin "$BRANCH_NAME"
```

Provide a handoff summary with: branch name + HEAD SHA, files changed, what was implemented, architecture notes, verification results, and PR creation URL.

## Boundaries

- Do not modify files outside the scope of your task.
- Do not change CI workflow files (`.github/workflows/`) unless the task explicitly requires it.
- Do not add new npm dependencies without stating why in the handoff.
- Do not modify `prisma/schema.prisma` unless the task explicitly requires schema changes.
- If a check fails for reasons unrelated to your change, note it in the handoff rather than fixing unrelated code.
- Git pathspec exclude syntax: use `:(exclude)path/` not `:!path/` to avoid bash history expansion.
