# Next UI Enhancements Roadmap

## Current Baseline
- The todos view already includes an AI Goal Planner card with `Generate Plan`, a plan preview panel, and `Add Plan Tasks` / `Dismiss` actions.
- A Task Critic panel already exists for draft task quality scoring and suggestion apply/dismiss flows.
- Core editing uses a custom modal overlay (`editTodoModal`) with imperative open/close behavior.
- Rendering is imperative and stateful in `public/app.js` via global in-memory state + `render*` functions, with delegated `data-on*` event handlers.
- API interactions are centralized through `apiClient` for authenticated calls (auth header injection, 401 refresh retry, timeout helpers), while some auth endpoints still use direct `fetch`.

## Milestone M1: AI Plan Review UX + Safety Polish
Outcome: Users can safely review, edit, and selectively apply AI-generated tasks before creating todos, with low-risk UX/accessibility polish aligned to existing patterns.

### Priority Tasks
1. [M] Replace the current read-only AI plan list with editable draft rows (include checkbox, editable title/description, optional due date/project/priority).
2. [M] Add plan-level controls: `Select all`, `Select none`, `Reset draft`, `Apply selected`, `Dismiss`.
3. [M] Add apply guards: prevent submit when nothing selected, show contextual warning via existing `showMessage` path.
4. [S] Add loading/disabled states for Generate, Apply, and Dismiss buttons to prevent duplicate requests.
5. [M] Preserve and submit feedback reason on accept/reject exactly once per suggestion status update.
6. [S] Add optimistic draft validation (title required, max lengths mirrored from existing task constraints).
7. [S] Add low-risk accessibility polish in existing UI primitives: `aria-live` for status messages and improved modal semantics (`role`, `aria-modal`, focus target on open).
8. [S] Keep current AI usage summary refresh behavior after plan apply/dismiss and rate-limit handling.
9. [M] Ensure draft state is fully cleared on logout/view resets to avoid stale suggestion leakage.

### Acceptance Criteria
- Users can deselect tasks, edit fields, and apply only selected rows.
- Applied todos reflect edited draft values, not raw AI output.
- Empty selection cannot be applied and shows a clear message.
- Generate/apply controls are disabled while requests are in flight.
- Existing plan generation, todos rendering, and filters keep working.
- No visible style drift from existing card/button patterns.

### Risks & Mitigations
- AI correctness risk: users may apply poor suggestions. Mitigation: default to review-first editable draft and explicit apply step.
- Spend/rate-limit risk: repeated clicks can multiply calls. Mitigation: in-flight lock + disabled controls + clear error on 429.
- Accessibility regressions: custom modal/panels may remain hard to navigate. Mitigation: low-risk semantic additions only (no large refactor).
- UI regressions due to `innerHTML` rerenders. Mitigation: keep changes localized to AI plan panel renderer and reuse existing helpers.

### Out of Scope
- Backend endpoint or contract changes.
- New frontend frameworks/state libraries.
- Full modal/dialog system rewrite.

## Milestone M2: Task Critic Evolution (Feature-Flagged)
Outcome: Task Critic becomes a structured, extensible workflow under a front-end feature flag while preserving existing backend contract and default behavior.

### Priority Tasks
1. [S] Add a front-end feature flag constant for enhanced critic UI (default off).
2. [M] Refactor critic rendering into a structured panel with stable sections (score, rationale, suggestion, actions, feedback).
3. [M] Add granular apply actions (apply title only, apply notes only, apply both) while preserving current default apply path.
4. [S] Add quick feedback reason chips + optional free-text field reuse.
5. [M] Add stale-response guard so only the most recent critique response can update the panel.
6. [S] Add lightweight loading state for `Critique Draft (AI)` button.
7. [S] Keep suggestion status updates and insights refresh behavior unchanged.
8. [M] Add internal scaffolding area for future critique insights (collapsed/disabled, no new API usage).

### Acceptance Criteria
- Feature flag OFF: current critic UX and behavior remain unchanged.
- Feature flag ON: new critic panel appears and uses existing `/ai/task-critic` response shape.
- Suggestion accept/reject status updates still happen and refresh insights/usage.
- No regressions to add-todo flow.

### Risks & Mitigations
- Behavior drift under dual-mode UI. Mitigation: strict default-off flag and shared action handlers.
- Overcomplicated UI may slow quick entry. Mitigation: keep enhanced panel collapsible and action-focused.
- Accessibility gaps in new interactive controls. Mitigation: use button/label patterns already present in app and preserve keyboard access.
- Regression risk from duplicated logic. Mitigation: centralize critique apply/dismiss helpers before adding new affordances.

### Out of Scope
- Any backend schema/API changes.
- Model/provider tuning and prompt engineering changes.
- Multi-step critique history explorer.

## Milestone M3: Planning Intelligence - Calendar Export (.ics)
Outcome: Users can export due-dated tasks from the current filtered view into a calendar `.ics` file for external planning without backend changes.

### Priority Tasks
1. [S] Add an `Export .ics` action in todos toolbar near filters/date view controls.
2. [M] Export only currently filtered todos (`filterTodosList`) that have `dueDate` values.
3. [M] Generate ICS content client-side in `app.js` (no API call), including title, description/notes fallback, due datetime, UID, and timestamp.
4. [S] Add empty-state guard: if no due-dated tasks are visible, show warning message and skip download.
5. [S] Add lightweight button busy/disabled state while generating download blob.
6. [M] Name file predictably (for example: `todos-<date-view>-<YYYYMMDD>.ics`).
7. [S] Keep timezone handling explicit and consistent (export date-times in UTC).
8. [S] Add concise help text in UI explaining export scope: "exports currently visible due-dated tasks".

### Acceptance Criteria
- Clicking export downloads a valid `.ics` file.
- Export respects active search/project/date filters.
- Todos without due dates are excluded.
- Empty filtered result shows warning instead of empty file.
- Existing todo CRUD/filtering behavior remains unchanged.

### Risks & Mitigations
- Calendar compatibility differences. Mitigation: emit RFC-friendly minimal VEVENT fields and UTC timestamps.
- User confusion on export scope. Mitigation: inline copy that export uses current filters.
- Regressions in filter logic reuse. Mitigation: call existing `filterTodosList` and avoid forked filtering paths.
- Accessibility of new control. Mitigation: use existing button classes and standard focusable controls.

### Out of Scope
- Server-side calendar sync or subscriptions.
- Recurring rule generation and recurrence editors.
- Two-way import from calendar providers.
