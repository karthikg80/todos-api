# M4 Test Plan

## New UI Specs
- `tests/ui/projects-rail.spec.ts` (new): core rail interactions.
- `tests/ui/app-smoke.spec.ts` (extend): regression sanity for top-level flow with rail present.

## Cases to Cover
1. Rail render basics:
- Shows `All tasks` and project list entries with counts.
- Active project row reflects current filter.

2. Project selection:
- Click/Enter on project row updates list using existing filter semantics.
- Switching back to `All tasks` restores full visible list.

3. Create project flow:
- Open create UI, submit valid name, new row appears, no prompt dialog used.
- Duplicate/invalid names show message and do not create.

4. Rename/delete via overflow:
- Overflow menu opens/closes via click, outside click, Escape.
- Rename updates label and keeps selection stable.
- Delete requires confirm and updates rail/list consistently.

5. Responsive behavior:
- Desktop collapse/expand toggles classes and preserves selected project.
- Mobile sheet opens/closes, focus restoration works, body scroll lock applied.

## Selector Guidance
- Prefer IDs and `data-project-key` selectors.
- Avoid style-coupled or text-fragile selectors where stable IDs exist.

## Anti-Flake Rules
- Use `expect(...).toBeVisible()/toHaveAttribute()/toHaveCount()`.
- Use `expect.poll` for async API-backed transitions.
- No fixed sleeps.
