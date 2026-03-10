# TASK 169: ui-m4-topbar-rail-ellipsis-fixes

type: Yellow
status: PENDING_REVIEW
mode: fix
builder: codex
reviewer: claude
branch: codex/ui-m4-pr6d-topbar-rail-ellipsis-fixes
pr: (not yet created)
sha: 4a50b93

## Problem
Top bar CTA buttons and rail nav labels were clipping rather than truncating with
ellipsis on narrow viewports. A hardening pass was needed to enforce correct
text-overflow behavior across both surfaces.

## What Changed
- `public/app.js`: minor fix for topbar/rail label clipping logic (+2/-1 lines)
- `public/styles.css`: text-overflow/ellipsis hardening for topbar and rail
  label elements (+50 lines)
- `tests/ui/topbar-no-cta-clipping.spec.ts` (new, 266 lines): verifies no
  clipping occurs on CTA buttons and rail labels at narrow widths

## Files Changed (3)
- public/app.js
- public/styles.css
- tests/ui/topbar-no-cta-clipping.spec.ts (new)

## Note
PR6d of M4. Pairs with PR6a (overflow hardening, Task 168).

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
