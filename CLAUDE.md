# Project: todos-api

Full-stack todo application with Express/Prisma backend and vanilla JS frontend.

## Project Structure

- **Frontend:** Static HTML/CSS/JS in `public/` (no build step, no framework).
  - `public/app.js` — all client-side logic (vanilla JS, event delegation model).
  - `public/styles.css` — all styles.
  - `public/index.html` — single-page app shell.
- **Backend:** Express + Prisma + PostgreSQL in `src/`.
- **Tests:**
  - Unit: `src/*.test.ts` — Jest, run with `npm run test:unit`.
  - Integration: `src/*.integration.test.ts` — Jest + supertest, requires Postgres.
  - UI: `tests/ui/*.spec.ts` — Playwright (Chromium desktop + mobile).

## Environment

- Node 22 via nvm: commands must use `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && <command>'`.
- gh CLI: `/opt/homebrew/Cellar/gh/2.86.0/bin/gh`.
- Docker: `/usr/local/bin/docker`.
- Git worktrees for feature branches live under `/private/tmp/todos-api-*`.

## UI Architecture Constraints

These are load-bearing patterns. Do not change them.

- **Event delegation:** `public/app.js` uses delegated event listeners on container elements. Do not attach listeners directly to dynamic child elements.
- **Filter pipeline:** `#categoryFilter` + `filterTodos()` is the canonical filter path. All project/category/status filtering routes through it.
- **Project selection:** Use `setSelectedProjectKey(...)` for all project selection entry points. Do not bypass it.
- **DOM-ready signal:** After auth/navigation, wait for `#todosView.active` + `#todosContent` visible + no `.loading` children. See `waitForTodosViewIdle()` in `tests/ui/helpers/todos-view.ts`.

## Verification Checks

After any change, run all applicable checks. All must pass before committing.

```bash
npx tsc --noEmit
npm run format:check
npm run lint:html
npm run lint:css
npm run test:unit
CI=1 npm run test:ui:fast
```

## CI Gates (required to pass on every PR)

- **unit** — typecheck + format + audit + unit tests.
- **integration** — Prisma migrations + integration tests (Postgres service).
- **ui-quality** — CSS lint + HTML validation + link crawl + fast UI tests.
- **Railway** — preview deploy.

## UI Test Rules

- **Fast suite (`test:ui:fast`)** is the required CI gate. Excludes `@visual`-tagged tests.
- **Full suite (`test:ui`)** includes visual snapshot tests. Run only when snapshots are affected.
- Any test using `toHaveScreenshot()` MUST include `@visual` in the test title.
- Use `openTodosViewWithStorageState()` or `bootstrapTodosContext()` from `tests/ui/helpers/todos-view.ts` for auth setup. Do not write registration/login flows inline in specs.
- Use deterministic DOM-ready waits (`waitForTodosViewIdle()`). Never use `page.waitForTimeout()` or sleep-based waits.
- Never delete or weaken existing tests to make CI pass.

## Snapshot Rules

- CI runs on `ubuntu-latest`. Screenshots generated on macOS will NOT match.
- `maxDiffPixelRatio: 0.05` in Playwright config. Mobile snapshots diverge more than desktop.
- Do not update snapshot PNGs unless visually intentional. Note why in the commit message.
- To generate Linux-compatible baselines:
  ```bash
  /usr/local/bin/docker run --rm -v "$(pwd)":/work -w /work \
    mcr.microsoft.com/playwright:v1.58.2 \
    /bin/bash -c "npm ci && npx playwright test <spec> --update-snapshots"
  ```

## PR Workflow

- Always check `mergeStateStatus` and `mergeable` before merging.
- Prefer squash merge with `--delete-branch`.
- When rebasing causes snapshot drift, regenerate in Docker, amend, force-push-with-lease.
- `--delete-branch` may fail if a local worktree uses the branch (remote still gets deleted).

## Commit Conventions

- Use conventional commits: `feat(ui):`, `fix(api):`, `test(ui):`, `ci:`, `docs:`.
- One logical change per commit. Split if the change spans unrelated areas.
- Only commit files you intentionally changed. Do not stage unrelated files.

## Boundaries

- Do not modify files outside the scope of the current task.
- Do not change CI workflow files (`.github/workflows/`) unless explicitly required.
- Do not add new npm dependencies without justification.
- Do not modify `prisma/schema.prisma` unless schema changes are explicitly required.
- If a check fails for reasons unrelated to the current change, note it rather than fixing unrelated code.
