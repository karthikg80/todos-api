# TASK 166: ui-m4-topbar-cleanup-projects-rail

type: Yellow
status: PENDING_REVIEW
mode: feature
builder: codex
reviewer: claude
branch: codex/ui-m4-pr4-topbar-cleanup
pr: (not yet created)
sha: 34bc7c2

## Problem
The top bar had residual projects-rail coordination issues after the M1 restructure.
The projects button and rail toggle needed cleanup to work correctly together, and
the interaction had no test coverage.

## What Changed
- `public/app.js`: projects rail / top bar coordination logic (+81 lines)
- `public/index.html`: markup cleanup for projects button area (-8 line delta)
- `public/styles.css`: projects rail top bar styles (+26 lines)
- `tests/ui/topbar-projects.spec.ts` (new, 283 lines): top bar + projects rail
  interaction coverage

## Files Changed (4)
- public/app.js
- public/index.html
- public/styles.css
- tests/ui/topbar-projects.spec.ts (new)

## Note
This is PR4 of the M4 series. Pairs with PR5 (list header polish, Task 167).

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
