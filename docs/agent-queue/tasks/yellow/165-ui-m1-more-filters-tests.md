# TASK 165: ui-m1-more-filters-tests

type: Yellow
status: PENDING_REVIEW
mode: test
builder: codex
reviewer: claude
branch: codex/ui-m1-pr3-more-filters-tests
pr: (not yet created)
sha: ee8ffa6

## Problem
The More filters disclosure behavior (Tasks 163 + 164) needed dedicated Playwright
coverage: panel opens/closes, focus is trapped correctly, Escape dismisses,
relocated controls are reachable.

## What Changed
- `tests/ui/more-filters.spec.ts` (new, 258 lines): covers More filters disclosure
  behavior, relocated filter controls, accessibility invariants

## Files Changed (1)
- tests/ui/more-filters.spec.ts (new)

## Dependencies
Requires Tasks 163 and 164 to be merged first.

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
