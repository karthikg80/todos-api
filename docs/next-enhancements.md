# Next UI Enhancements Roadmap

## Shipped

- **M1: AI Plan Review UX** — Editable draft rows, select/deselect, apply guards, loading states (PR #39)
- **M2: Task Critic Evolution** — Feature-flagged structured panel, granular apply, stale-response guard (PR #41, enhanced PR #89)
- **M3: Calendar Export (.ics)** — Client-side ICS export for filtered due-dated todos (PR #42)
- **Task 113: Sidebar density polish** — Done, merged

## Up Next

No tasks currently queued. Candidates for next sprint:

- ~~`state.js` vs `store.js` overlap~~ resolved in Task 151 (renamed to authSession.js)
- API rate limiting resolved in Task 152 (extracted to rateLimitMiddleware.ts)
- Component framework migration spike — was deferred (Task 143 original numbering); requires explicit human ADR decision before any work begins
