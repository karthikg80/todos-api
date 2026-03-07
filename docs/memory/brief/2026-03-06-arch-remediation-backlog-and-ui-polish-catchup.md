# 2026-03-06 — Architecture Remediation Backlog + UI Polish Catch-up

## What changed

- Backfilled memory updates for merged UI PRs #147–#161 and current uncommitted work (collapsed sidebar rail).
- Captured the bottom action dock (PR #159) as a new persistent UI surface with its own z-index layer (55).
- Captured Lucide icon integration (PR #158) as the new nav icon system.
- Captured mobile layout regression fixes (PR #161) as the current mobile baseline.
- Captured icon-only collapsed sidebar rail (64px, tooltips on hover) as in-progress on master.
- Added Architecture Remediation Backlog section to BRIEF covering Tasks 140–146 created from formal architecture review.
- Backfilled 26 done task files (114–139) for PRs #134–#161 that were completed without corresponding task files.

## Why

- Codex missed updating memory docs for PRs #147–#161.
- A formal architecture review of app.js produced a prioritized remediation plan that needed to be captured as agent queue tasks and reflected in memory.

## Do not break

- Bottom action dock z-index (55) is intentional. DialogManager (Task 143) must account for it in stacking context.
- Collapsed sidebar rail state (64px icon-only) is a first-class interaction — do not treat it as a temporary CSS hack.
- Task 140 (ES6 module split) is a hard prerequisite for Tasks 141, 143, and 145. Do not start those until 140 is merged.
- Task 144 (server-side filtering) is safe to run in parallel with frontend tasks since it touches the backend layer independently.
