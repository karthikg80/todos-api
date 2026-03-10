# TASK 170: ui-m7-inputs-buttons-calm

type: Yellow
status: PENDING_REVIEW
mode: feature
builder: codex
reviewer: claude
branch: codex/ui-m7-inputs-buttons-calm
pr: (not yet created)
sha: b661561

## Problem
Input fields and buttons across the UI had inconsistent visual weight, focus rings,
and hover states. The top bar CTA had no enforced invariants. A calm, systematic
treatment was needed to unify the input/button design language.

## What Changed
- `public/styles.css`: calm input/button system — consistent sizing, focus rings,
  hover states, disabled states (+184 lines); top bar CTA invariants enforced
- `tests/ui/topbar-cta-invariants.spec.ts` (new, 263 lines): verifies CTA
  button invariants (size, focus, hover, disabled) across surfaces

## Files Changed (2)
- public/styles.css
- tests/ui/topbar-cta-invariants.spec.ts (new)

## Note
M7 milestone. Followed by post-M7 layout hardening (Task 171).

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
