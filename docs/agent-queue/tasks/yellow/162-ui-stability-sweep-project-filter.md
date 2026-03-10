# TASK 162: ui-stability-sweep-project-filter

type: Yellow
status: PENDING_REVIEW
mode: test + fix
builder: codex
reviewer: claude
branch: codex/ui-stability-sweep-project-filter
pr: (not yet created)
sha: 8c3e1c1

## Problem
Project filter/header sync had no regression coverage. When a project is selected
the list header and filter state must stay in sync — this was untested and had at
least one latent bug.

## What Changed
- Fixed project filter/header sync bug in `public/app.js` (119 line delta with
  54 deletions — meaningful logic correction)
- Added `tests/ui/project-filter-regression.spec.ts` (626 lines) covering
  project selection, header sync, and filter state transitions

## Files Changed (2)
- public/app.js
- tests/ui/project-filter-regression.spec.ts (new)

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
