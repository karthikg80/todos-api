---
name: playwright-testing
description: Playwright UI testing rules, snapshot management, and common pitfalls
---

# Playwright Testing

## Test Suites

- **Fast suite (`test:ui:fast`)** — required CI gate. Excludes `@visual`-tagged tests.
- **Full suite (`test:ui`)** — includes visual snapshot tests. Run only when snapshots are affected.

## Rules

- Any test using `toHaveScreenshot()` MUST include `@visual` in the test title.
- Use `openTodosViewWithStorageState()` or `bootstrapTodosContext()` from `tests/ui/helpers/todos-view.ts` for auth setup. Do not write registration/login flows inline in specs.
- Use deterministic DOM-ready waits (`waitForTodosViewIdle()`). Never use `page.waitForTimeout()` or sleep-based waits.
- Never delete or weaken existing tests to make CI pass.

## Common Pitfalls

- **Untracked spec files from other branches** leak into Playwright test discovery. Use worktree isolation to prevent this. If tests fail with unknown specs, check `git status` for untracked `.spec.ts` files.
- **Port 4173 conflicts** occur after interrupted test runs. Kill with: `lsof -ti:4173 | xargs kill -9`
- **Local macOS vs CI Linux snapshots** — screenshots generated on macOS will NOT match CI. `maxDiffPixelRatio: 0.05` in config. Mobile snapshots diverge more than desktop.

## Snapshot Management

- Do not update snapshot PNGs unless visually intentional. Note why in the commit message.
- To generate Linux-compatible baselines:
  ```bash
  /usr/local/bin/docker run --rm -v "$(pwd)":/work -w /work \
    mcr.microsoft.com/playwright:v1.58.2 \
    /bin/bash -c "npm ci && npx playwright test <spec> --update-snapshots"
  ```
- When rebasing causes snapshot drift, regenerate in Docker, amend, force-push-with-lease.
