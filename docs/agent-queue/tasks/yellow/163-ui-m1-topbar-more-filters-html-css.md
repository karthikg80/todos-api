# TASK 163: ui-m1-topbar-more-filters-html-css

type: Yellow
status: PENDING_REVIEW
mode: feature
builder: codex
reviewer: claude
branch: codex/ui-m1-pr1-topbar-more-filters
pr: (not yet created)
sha: 94401af (includes 2 commits: HTML/CSS + selector updates)

## Problem
The top bar lacked a "More filters" disclosure panel. Filter controls (date range,
priority, tag) were either absent or buried. The top bar layout needed restructuring
to accommodate an expandable panel without breaking existing smoke tests.

## What Changed
- `public/index.html`: restructured top bar markup to include More filters button
  and collapsible panel (121 line delta, 68 deletions — significant restructure)
- `public/styles.css`: added More filters panel styles and top bar layout
  adjustments (141 line additions)
- `tests/ui/app-smoke.spec.ts`: selector updates for new top bar structure (+17)
- `tests/ui/ics-export.spec.ts`: selector updates for new top bar structure (+17)

## Files Changed (4)
- public/index.html
- public/styles.css
- tests/ui/app-smoke.spec.ts
- tests/ui/ics-export.spec.ts

## Note
This is PR1 of 3 for the M1 More filters feature. PR2 wires the toggle behavior
(Task 164), PR3 adds dedicated tests (Task 165).

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
