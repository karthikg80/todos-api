# TASK 167: ui-m4-list-header-polish

type: Yellow
status: PENDING_REVIEW
mode: feature
builder: codex
reviewer: claude
branch: codex/ui-m4-pr5-list-header-polish
pr: (not yet created)
sha: e0e26f9

## Problem
The sticky list header needed polish and correct rail/list coordination. The header
should stay visible on scroll and correctly reflect the active view/project context.
No test coverage existed for this behavior.

## What Changed
- `public/app.js`: list header + rail coordination logic (+52 lines)
- `public/index.html`: list header markup additions (+9 lines)
- `public/styles.css`: sticky list header styles (+36 lines)
- `tests/ui/list-header.spec.ts` (new, 348 lines): sticky header behavior,
  rail/list coordination, view context reflection

## Files Changed (4)
- public/app.js
- public/index.html
- public/styles.css
- tests/ui/list-header.spec.ts (new)

## Note
PR5 of the M4 series. Depends on PR4 (Task 166).

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
