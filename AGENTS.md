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

Work entirely inside the worktree directory for the duration of the task.

## Project Structure

- **Frontend:** Static HTML/CSS/JS in `public/` (no build step, no framework).
  - `public/app.js` — all client-side logic (vanilla JS, event delegation model).
  - `public/styles.css` — all styles.
  - `public/index.html` — single-page app shell.
- **Backend:** Express + Prisma + PostgreSQL in `src/`.
- **Tests:**
  - Unit: `src/*.test.ts` (Jest).
  - Integration: `src/*.integration.test.ts` (Jest + supertest).
  - UI: `tests/ui/*.spec.ts` (Playwright).

## UI Architecture Constraints

These are load-bearing patterns. Do not change them.

- **Event delegation:** `public/app.js` uses delegated event listeners on container elements. Do not attach listeners directly to dynamic child elements.
- **Filter pipeline:** `#categoryFilter` + `filterTodos()` is the canonical filter path. All project/category/status filtering routes through it.
- **Project selection:** Use `setSelectedProjectKey(...)` for all project selection entry points. Do not bypass it.
- **DOM-ready signal:** After auth/navigation, wait for `#todosView.active` + `#todosContent` visible + no `.loading` children. See `waitForTodosViewIdle()` in `tests/ui/helpers/todos-view.ts`.

## Test Requirements

### After any change, run these checks (all must pass):

```bash
npx tsc --noEmit
npm run format:check
npm run lint:html
npm run lint:css
npm run test:unit
CI=1 npm run test:ui:fast
```

### UI test rules

- **Fast suite (`test:ui:fast`)** is the required CI gate. It excludes `@visual`-tagged tests.
- **Full suite (`test:ui`)** includes visual snapshot tests. Run only when snapshots are affected.
- Any test using `toHaveScreenshot()` MUST include `@visual` in the test title.
- Use `openTodosViewWithStorageState()` or `bootstrapTodosContext()` from `tests/ui/helpers/todos-view.ts` for auth setup. Do not write registration/login flows inline.
- Use deterministic DOM-ready waits (see `waitForTodosViewIdle()`). Never use `page.waitForTimeout()` or sleep-based waits.
- Never delete or weaken existing tests to make CI pass.

### Snapshot rules

- CI runs on `ubuntu-latest`. Screenshots generated on macOS will NOT match.
- Do not update snapshot PNGs unless visually intentional. Note why in the commit message.
- If snapshots need updating, use Docker:
  ```bash
  docker run --rm -v "$(pwd)":/work -w /work \
    mcr.microsoft.com/playwright:v1.58.2 \
    /bin/bash -c "npm ci && npx playwright test <spec> --update-snapshots"
  ```

## Commit and Handoff

### Commit scope

- Only commit files you intentionally changed. Do not commit unrelated files.
- Use conventional commit messages: `feat(ui):`, `fix(api):`, `test(ui):`, `ci:`, `docs:`.
- One logical change per commit. Split if the change spans unrelated areas.

### Push and handoff

After all checks pass:

```bash
git push -u origin "$BRANCH_NAME"
```

Provide a handoff summary with:

- Branch name and head SHA.
- Files changed (list each file).
- What was implemented (bullet points).
- Verification results (which checks passed/failed).
- PR creation URL: `https://github.com/karthikg80/todos-api/pull/new/<branch-name>`

## Boundaries

- Do not modify files outside the scope of your task.
- Do not change CI workflow files (`.github/workflows/`) unless the task explicitly requires it.
- Do not add new npm dependencies without stating why in the handoff.
- Do not modify `prisma/schema.prisma` unless the task explicitly requires schema changes.
- If a check fails for reasons unrelated to your change, note it in the handoff rather than trying to fix unrelated code.
