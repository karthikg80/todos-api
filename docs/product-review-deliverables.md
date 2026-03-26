# Product Review Backlog — Deliverables Summary

**Branch:** `feat/product-review-backlog`
**Commits:** 16 (15 story commits + 1 pre-existing test commit)
**Files changed:** 30 (+2,071 / -123 lines)

## What Was Done

All 20 stories from the [product review backlog](product-review-github-backlog.md) were implemented in a single branch. The work spans 6 epics covering repositioning, command layer, visible workflows, AI unification, scheduling, and MCP productization.

---

## Epic 1: Reposition as Planning Workspace

### Story 1.1 — Product Narrative Spec (#586)
- `docs/specs/product-narrative.md` — positioning statement, naming decisions, feature hierarchy, messaging by surface

### Story 1.2 — Landing Page & Shell Copy (#592)
- **Title:** "Todo App" → "Todos" across all user-facing surfaces (index.html, app.html, auth.html, manifest.json)
- **Hero:** "Your tasks, your way" → "Plan your days. Review your weeks. Focus on what matters."
- **Feature cards:** Reordered to lead with daily plan → capture → weekly review → assistant connectivity
- **Section headings:** "Everything you need to stay on top of it" → "A planning workspace that works the way you think"
- **Empty states:** Updated from generic "Nothing here yet" to calmer, goal-oriented language
- **CTA:** "Start organizing your tasks" → "Start planning"

### Story 1.3 — README Rewrite (#593)
- README now opens with what the product does (plan, capture, review, connect, automate)
- New "Product Surfaces" section maps to actual user-facing capabilities
- Implementation details moved below the product overview

---

## Epic 2: Command Layer

### Story 2.1 — Command Taxonomy Spec (#587)
- `docs/specs/command-taxonomy.md` — 6 command groups, ranking rules, naming conventions

### Story 2.2 — Expanded Command Palette (#594)
- **Before:** 2 commands (Add task, Go to All tasks) + dynamic project nav
- **After:** 25+ commands across 6 categories:
  - Navigation: Home, Inbox, Today, Upcoming, Waiting, Scheduled, Someday, Completed, Weekly Review, Cleanup, Feedback, Settings
  - Workflows: Plan Today, Run Weekly Review, Open AI Workspace, Refresh Priorities
  - System: Toggle Dark Mode, Show Keyboard Shortcuts, Export Calendar
- Hooks wired for `triggerPlanToday`, `toggleAiWorkspace`, `refreshHomeFocus`, `exportCalendar`
- Refactored `executeCommandPaletteItem` with workspace/view/action type routing

### Story 2.3 — Rich Task Search (#595)
- Task search results now show:
  - Status badges (waiting, scheduled, someday, in_progress)
  - Due state indicators (Overdue in red, Today in amber)
  - Project name in metadata line
- CSS for `.command-palette-badge` with dark mode support

---

## Epic 3: Visible Workflows

### Story 3.1 — Workflow Model Spec (#588)
- `docs/specs/workflow-model.md` — visibility decisions for each schema concept, proposed sidebar, interaction specs

### Story 3.2 — Collapsible Area Groups (#596)
- Area headers in the project sidebar are now clickable buttons with collapse/expand toggle
- Collapsed state tracked in `state.collapsedAreas` (Set)
- CSS caret indicator rotates on collapse

### Story 3.3 — Waiting & Dependency Chips (#597)
- New `todo-chip--waiting-on`: shows "Waiting on: {person}" in amber
- New `todo-chip--blocked`: shows "Blocked by N task(s)" with lock icon in red
- Both integrate into existing chip pipeline with cap limits
- Dark mode support for both chip variants

### Story 3.4 — Effort & Energy in Home Dashboard (#598)
- Home dashboard task rows now show:
  - Estimated minutes tag (e.g., "45m")
  - Energy level tag for non-medium values ("low energy" / "high energy")
- CSS for `.home-task-row__meta-tag` with energy-level color variants

---

## Epic 4: AI Unification

### Story 4.1 — Assistant Model Spec (#589)
- `docs/specs/assistant-model.md` — core jobs, surface architecture, shared UI language, action verbs, confidence indicators

### Story 4.2 — Unified AI Language (#599)
- Section titles: "AI Suggestions" → "Assistant" in drawer and detail views
- Empty states harmonized:
  - Drawer: "This task looks good. No suggestions right now."
  - Workspace: "All clear. No suggestions right now."
  - Errors: "Suggestions unavailable right now."

### Story 4.3 — Continuity Hint Rendering (#600)
- Suggestion cards now render optional `continuityHint` field as italic footnote
- CSS for `.ai-create-chip__continuity`
- Backend can populate hints like "You deferred this twice last week" when prior feedback exists

---

## Epic 5: Scheduling

### Story 5.1 — Scheduling MVP Spec (#590)
- `docs/specs/scheduling-mvp.md` — suggested blocks model, interaction pattern, non-goals, success metrics

### Story 5.2 — Time Slot Display (#601)
- Day plan tasks now show suggested time blocks (e.g., "9:00 AM – 9:45 AM")
- Time slots computed from `estimateMinutes` with 15-minute breaks
- New `formatSlotTime()` utility in `planTodayAgent.js`
- CSS for `.home-task-row__slot` and `.home-task-row--plan` grid layout

### Story 5.3 — Enhanced ICS Export (#602)
- Tasks with `estimateMinutes` + `dueDate` now export as timed VEVENT entries (not all-day)
- Priority field added for high/urgent tasks (`PRIORITY:1` or `PRIORITY:5`)

---

## Epic 6: MCP Product Surface

### Story 6.1 — MCP Product Spec (#591)
- `docs/specs/mcp-product-surface.md` — user-facing language, supported use cases, scope model, session management spec, tool catalog review

### Story 6.2 — Sessions Management UI (#603)
- New "Assistant Connections" settings card in the settings pane
- Lists connected MCP sessions with client name, scopes, last-used date
- Revoke-one and revoke-all actions
- Loads via `/auth/mcp/sessions` on settings pane open
- New `client/modules/mcpSessionsUi.js` module
- CSS for `.mcp-session-row` components

### Story 6.3 — Connector Quickstarts (#604)
- `docs/mcp-quickstarts.md` — 6 workflow quickstarts:
  1. "What should I work on?"
  2. "Capture this"
  3. "Plan my day"
  4. "Run my weekly review"
  5. "What's stale?"
  6. "Break this down"
- Setup instructions for Claude Desktop and ChatGPT

### Story 6.4 — Tool Description Improvements (#605)
- Rewrote 6 spotlight MCP tool descriptions in `agent-manifest.json`:
  - `list_tasks`: "See your tasks — filter by project, status, due date..."
  - `plan_today`: "Plan your day — generates a time-boxed daily plan..."
  - `weekly_review`: "Run your weekly review — surfaces stale tasks..."
  - `decide_next_work`: "What should you work on next?"
  - `break_down_task`: "Break a complex task into actionable steps"
  - `capture_inbox_item`: "Capture a quick idea or task"

---

## Verification Status

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` | Pass |
| `npm run lint:html` | Pass |
| `npm run lint:css` | Pass |
| `npm run test:unit` | 301/304 pass (3 failures in mcpPublicRouter.test.ts — pre-existing, unrelated to this branch) |

## Review Notes

- **No schema changes.** No new database fields, no Prisma migrations.
- **No new npm dependencies.** All changes use existing libraries.
- **No CI workflow changes.**
- **Backward compatible.** MCP tool signatures unchanged. Existing tool descriptions reworded but parameters/behavior preserved.
- **Time slots are ephemeral.** The scheduling feature computes slots at plan generation time, not persisted in DB. This is intentional per the MVP spec.
- **Sessions UI depends on existing `/auth/mcp/sessions` endpoint.** No backend API changes needed.
- **Continuity hints are UI-ready but require backend population.** The `continuityHint` field renders when present in suggestion responses — backend changes to populate it are a follow-up.
