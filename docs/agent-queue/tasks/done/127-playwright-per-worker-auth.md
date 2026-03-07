# TASK 127: playwright-per-worker-auth

type: Green
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: codex/task-127-playwright-per-worker-auth
base: master

## Intent
Parallelize Playwright test workers by creating per-worker auth state files, reducing total UI test suite runtime.

## Files Allowed
- tests/ui/

## Acceptance Criteria
- [x] Change implemented per intent
- [x] Verification checks pass

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/150
- Commit SHA(s): 324b54b
- Files changed: tests/ui/
- PASS/FAIL matrix: tsc PASS, format PASS, lint PASS, test:unit PASS, test:ui:fast PASS

## Outcome
Backfill. Merged as PR #150. Per-worker auth state cuts Playwright run time.
