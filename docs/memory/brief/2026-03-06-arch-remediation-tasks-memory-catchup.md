# 2026-03-06 — Architecture Remediation Tasks and Memory Catch-up

## What changed

- Created backfill DONE tasks (114–128) for all PRs merged without task files: #122–#150 (shell refactor, sidebar-first IA, Home launchpad, project headings, memory compaction, Playwright parallelization).
- Created 15 new architecture remediation tasks (129–143) from formal architecture review, classified as Red/Yellow/Green per TEMPLATE_V2 protocol, assigned to the correct queue directories.
- Updated BRIEF.md: added Shell Chrome State section capturing dock, collapsed rail, Lucide icons, and Logout affordances from PRs #151–#161 (which Codex had not recorded). Corrected Architecture Remediation Backlog task numbers to 129–143.
- Updated CANON.md: promoted four Shell Chrome rules for dock z-index, collapsed rail Settings access, z-index ceiling for new fixed elements, and Lucide icon system consistency.

## Task queue state after this session

| Directory | New tasks |
|-----------|-----------|
| done/     | 114–128 (backfill) |
| red/      | 129 (module split), 133 (server-side filtering), 143 (framework spike) |
| yellow/   | 130 (state centralization), 131 (styled dialogs), 132 (overlay manager), 134 (pub-sub), 136 (template nodes), 137 (virtual scroll) |
| green/    | 135 (debounce), 138 (API service), 139 (error boundaries), 140 (toggle utilities), 141 (localStorage constants), 142 (CSS layers) |

## Do not break

- Task 129 (module split) is a hard prerequisite for Tasks 130, 132, 134, and 136 — do not allow these to start before 129 is merged.
- Task 133 (server-side filtering) is safe to parallelize with Task 132 (overlay manager) since they operate on separate layers.
- Task 143 (framework spike) requires explicit human ADR sign-off before any migration work begins.
- Canon shell chrome rules: dock z-index ceiling is 55; do not exceed without overlay manager update.
