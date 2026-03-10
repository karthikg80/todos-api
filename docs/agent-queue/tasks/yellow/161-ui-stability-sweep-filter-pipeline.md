# TASK 161: ui-stability-sweep-filter-pipeline

type: Yellow
status: PENDING_REVIEW
mode: test + fix
builder: codex
reviewer: claude
branch: codex/ui-stability-sweep-filter-pipeline
pr: (not yet created)
sha: 88475e4

## Problem
The filter pipeline (filterTodos → applyFiltersAndRender) lacked regression test
coverage. A targeted sweep was needed to verify the pipeline is stable and catch
any latent bugs before further UI work lands on top.

## What Changed
- Added `tests/ui/filter-pipeline-regression.spec.ts` (491 lines) covering the
  canonical filter pipeline end-to-end
- Minor fixes to `public/app.js` (34 line delta) to address latent issues
  found during the sweep

## Files Changed (2)
- public/app.js
- tests/ui/filter-pipeline-regression.spec.ts (new)

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
