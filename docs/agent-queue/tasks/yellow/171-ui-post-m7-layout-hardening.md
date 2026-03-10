# TASK 171: ui-post-m7-layout-hardening

type: Yellow
status: PENDING_REVIEW
mode: fix
builder: codex
reviewer: claude
branch: codex/ui-post-m7-layout-hardening
pr: (not yet created)
sha: 39ddebe

## Problem
After the M7 calm polish pass, a final layout hardening sweep was needed to catch
any remaining spacing/sizing inconsistencies and extend overflow + CTA test coverage.

## What Changed
- `public/styles.css`: layout hardening and calm polish invariants (+103 lines)
- `tests/ui/layout-overflow.spec.ts`: extended with additional viewport/overflow
  cases (+37 lines)
- `tests/ui/topbar-cta-invariants.spec.ts`: extended with additional CTA cases
  (+10 lines)

## Files Changed (3)
- public/styles.css
- tests/ui/layout-overflow.spec.ts
- tests/ui/topbar-cta-invariants.spec.ts

## Note
Post-M7 cleanup. Depends on Task 170 (M7 inputs/buttons calm) and Task 168
(overflow hardening) for the test files it extends.

## Verification
(to be confirmed on review/merge)

## Outcome
(to be filled after merge)
