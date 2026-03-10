# TASK 164: ui-m1-more-filters-wiring

type: Yellow
status: PENDING_REVIEW
mode: feature
builder: codex
reviewer: claude
branch: codex/ui-m1-pr2-more-filters-wiring
pr: (not yet created)
sha: 02e15d2

## Problem
The More filters panel markup (Task 163) needed JS wiring: toggle open/close,
accessible focus management on open, and Escape key dismissal.

## What Changed
- `public/app.js`: wired More filters toggle with accessible focus handling and
  Escape dismissal (75 line addition — pure new behavior)

## Files Changed (1)
- public/app.js

## Dependencies
Requires Task 163 (HTML/CSS) to be merged first.

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
