# Codex Agent Instructions

## Workspace Setup (REQUIRED)

The **primary** checkout is only for owning `master` and approved maintenance (for example ff-only sync). **Feature work is compliant only** in a **linked worktree** on a **non-`master` task branch** — never commit or push features from the primary clone.

Preferred bootstrap (fetches base, creates `codex/<short-feature-name>` under `/private/tmp`, `npm ci` at root + `client-react`):

```bash
scripts/new-task-worktree.sh <short-feature-name>
cd /private/tmp/todos-api-<short-feature-name>
```

Manual equivalent:

```bash
BRANCH_NAME="codex/<short-feature-name>"
WORKTREE_DIR="/private/tmp/todos-api-<short-feature-name>"
git fetch origin
git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" origin/master
cd "$WORKTREE_DIR"
npm ci
npm --prefix client-react ci
```

One PR = one branch = one worktree. Never reuse a worktree for a new task.

Husky and helper scripts enforce the workflow:

- `scripts/validate-task-branch.sh` — requires a **linked worktree**, non-detached `HEAD`, and a branch other than `master`.
- `scripts/open-task-pr.sh` — runs validate, then `gh pr create` (pass through flags such as `--fill`); **prefer this** instead of calling `gh pr create` directly.
- `.husky/pre-commit` runs `validate-task-branch.sh` (blocks feature work from the primary checkout).
- `.husky/pre-push` blocks **any** `git push` from the **primary** checkout; push your task branch from the linked worktree.
- After a PR merges, fast-forward **primary** `master` with `scripts/sync-primary-master.sh` (primary clone only; pull-only, no push).

Hooks skip under `CI=true` or `GITHUB_ACTIONS=true`. **`TODOS_API_SKIP_WORKFLOW_GUARDS=1`** disables hook guards for **emergency, explicitly authorized maintenance only** — not a normal developer shortcut.

A `commit-msg` hook enforces conventional commit format. Hooks run after `npm ci` / `prepare`.

## Project Structure

- **Backend:** Express + Prisma + PostgreSQL in `src/`. Routes in `src/routes/`, services in `src/services/`.
- **Web Client:** Vite + React + TypeScript in `client-react/` — see `client-react/AGENTS.md`
- **iOS App:** SwiftUI (iOS 17+) in `ios/TodosApp/` — see `ios/AGENTS.md`
- **CLI:** `td` CLI tool in `src/cli/` (TypeScript, Commander.js).
- **Agent Runner:** Python worker in `agent-runner/` — Railway cron deployment.
- **Tests:** Unit (`src/*.test.ts`), Integration (`src/*.integration.test.ts`), UI (`tests/ui/*.spec.ts`)
- **Archived:** Legacy vanilla JS web client previously in `client/` (removed from the tree). See `docs/reference/vanilla-client-archive.md` for details.

### Shared contract

`src/types.ts` is the canonical source of truth for all API types and enums. When this file changes, all clients (React, iOS DTOs) must stay in sync. Mention cross-client impact in the PR description. CI will automatically verify that iOS compiles (`swift build`) and React typechecks (`tsc --noEmit`) when `src/types.ts` or `src/validation/constants.ts` change.

## Clean Code + Architecture (REQUIRED)

- **Keep orchestrators thin.** `src/routes/` and entrypoints should coordinate, not accumulate logic.
- **Put behavior in the right home.** Frontend → `client-react/src/components/` or `client-react/src/mobile/`. Backend → services, not route handlers.
- **Prefer the canonical path.** Extend existing flows instead of introducing parallel paths.

## Verification Checks

After any change, run all applicable checks. All must pass before committing.

```bash
npx tsc --noEmit
npm run format:check
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

After all checks pass (from the **linked worktree**):

```bash
git push -u origin "$BRANCH_NAME"
scripts/open-task-pr.sh
```

Provide a handoff summary with: branch name + HEAD SHA, files changed, what was implemented, architecture notes, verification results, and PR creation URL.

## Boundaries

- Do not modify files outside the scope of your task.
- Do not change CI workflow files (`.github/workflows/`) unless the task explicitly requires it.
- Do not add new npm dependencies without stating why in the handoff.
- Do not modify `prisma/schema.prisma` unless the task explicitly requires schema changes.
- If a check fails for reasons unrelated to your change, note it in the handoff rather than fixing unrelated code.
- Git pathspec exclude syntax: use `:(exclude)path/` not `:!path/` to avoid bash history expansion.
