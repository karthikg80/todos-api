# TASK 168: ui-m4-overflow-hardening

type: Yellow
status: PENDING_REVIEW
mode: fix
builder: codex
reviewer: claude
branch: codex/ui-m4-pr6a-overflow-hardening
pr: (not yet created)
sha: 129f4b6

## Problem
The todos panel was susceptible to horizontal overflow in edge cases (long task
titles, narrow viewports, certain filter combinations). This caused layout breakage
with no test coverage to catch regressions.

## What Changed
- `public/styles.css`: overflow containment rules for todos panel (+28 lines)
- `tests/ui/layout-overflow.spec.ts` (new, 204 lines): horizontal overflow
  regression coverage for todos panel at various viewport widths

## Files Changed (2)
- public/styles.css
- tests/ui/layout-overflow.spec.ts (new)

## Note
PR6a of M4. Pairs with PR6d (ellipsis fixes, Task 169).

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
