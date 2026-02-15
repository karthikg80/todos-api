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

---

*To add a rule: append it under the appropriate heading with a one-line rationale.*
