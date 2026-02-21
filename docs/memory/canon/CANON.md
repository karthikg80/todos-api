# Canon — Promoted Rules

Rules added here were learned through violations or near-misses.
They are permanent and override any conflicting guidance.

## How Rules Get Promoted

A rule enters Canon when:
1. An agent violates an invariant and the violation is caught in review.
2. A pattern causes repeated friction across multiple tasks.
3. A session learning proves universally applicable.

## Rules

### Testing
- Local `chromium-mobile` test failures are expected when baselines are Linux-generated. Do not "fix" these by updating macOS snapshots.
- Port 4173 conflicts occur after interrupted test runs. Kill with `lsof -ti:4173 | xargs kill -9` before retrying.

### Git
- Untracked spec files from other branches leak into Playwright test discovery. Use worktree isolation.
- Git pathspec exclude syntax: use `:(exclude)docs/` not `:!docs/` to avoid bash history expansion.

### Process
- Never weaken a test to make CI pass. Fix the code.
- Do not commit untracked `docs/` content unless the task explicitly allows it.
- When a UI/task PR changes navigation IA or persistent UX behavior, update `docs/memory/canon/CANON.md` + `docs/memory/brief/BRIEF.md` in the same PR (or immediate docs-only follow-up PR).

### UI Navigation & IA
- Sidebar is the single primary navigation surface in Todos mode; top tabs remain compatibility affordances only while tests still depend on them.
- Sidebar bottom contains the stable account entry point: `Settings`.
- `Profile` is presented as Settings content, not as a standalone sidebar nav item.
- Entering Settings must not collapse or remove the sidebar shell.
- Any `Profile` CTA must route through `switchView('settings')`; do not route to a standalone `profileView` as the primary account surface.
- In mobile layouts where the sidebar is hidden, keep a visible top-tab route to Settings to avoid trapping account/verification flows.

### Internal Categories
- `AI Plan` is an internal category and must never appear in user navigation surfaces (projects rail, category dropdown, create/edit project pickers).
- If persisted selection resolves to an internal category, client selection must fall back to `All tasks` (`setSelectedProjectKey("")` path).

---

*To add a rule: append it under the appropriate heading with a one-line rationale.*
