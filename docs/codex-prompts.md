# Codex Implementation Prompts

## M1 - AI Draft Review UI + Apply Integration
```text
Implement M1 incrementally (planning-safe, no frameworks): upgrade the existing AI plan panel so users can edit/select tasks before apply.

Work style:
- Keep changes small and split into 2-3 commits.
- Reuse existing patterns: `data-on*` declarative handlers, in-memory draft state in `public/app.js`, existing `showMessage/hideMessage`, existing `apiCall/parseApiBody`.

Files to touch:
- public/app.js
- public/styles.css
- public/index.html (only if a container tweak is needed)

Exact UI behaviors and states:
1. In `aiPlanPanel`, render each AI task as a draft row with:
   - include checkbox (checked by default)
   - editable title (required)
   - editable description
   - editable due date
   - editable project/category select (reuse existing project option helpers)
   - editable priority select
2. Add panel actions:
   - Select all
   - Select none
   - Reset draft
   - Apply selected tasks
   - Dismiss
3. Keep feedback reason input; submit it on accept/reject.
4. Apply flow:
   - block if no tasks selected
   - block rows with empty title and show actionable error
   - apply only selected rows
   - on success show count created and clear panel state
5. Button state handling:
   - disable Generate/Apply/Dismiss during in-flight requests
   - prevent duplicate submissions
6. Keep existing 429 usage handling and AI insights refresh behavior.
7. Low-risk accessibility polish:
   - ensure status message region is announced (aria-live)
   - add minimal modal semantics for the existing edit modal (no full refactor)

Acceptance criteria:
- Users can edit/select tasks and only selected tasks are created.
- Empty selection or invalid rows cannot be applied.
- Plan panel clears on apply or dismiss.
- No regressions in todo add/edit/filter/bulk actions.
- Visual style stays consistent with current cards/buttons.

Verification steps:
Manual:
- Generate plan -> uncheck some rows -> edit remaining -> apply -> confirm created todos match edits.
- Try apply with zero selected -> confirm warning and no API apply call.
- Click Apply rapidly -> confirm single request path.
- Dismiss suggestion -> panel clears and usage/history refresh.

Scripts (use only if available):
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```

## M1b (Optional) - Brain Dump -> Shared Draft Review
```text
Implement M1b as an optional extension after M1: add a brain-dump input that reuses the same editable draft review panel.

Work style:
- One focused commit if possible.
- Reuse existing patterns only: `data-on*`, `showMessage`, `apiCall`, existing plan panel renderer/state.

Files to touch:
- public/index.html
- public/app.js
- public/styles.css

Exact UI behaviors and states:
1. Add a multiline "Brain dump" textarea in AI workspace with a button: "Draft Tasks from Brain Dump".
2. Validate non-empty input; show existing error message style when empty.
3. On submit, call existing `/ai/plan-from-goal` endpoint by mapping brain-dump text to the existing `goal` payload field (no backend changes).
4. Reuse existing target date input if filled.
5. Feed response into the same editable draft state/panel from M1 (no duplicate renderer).
6. Add loading/disabled state for the brain-dump button.
7. Keep existing goal-based "Generate Plan" flow unchanged.

Acceptance criteria:
- Brain dump creates editable draft tasks in the same review panel.
- Empty brain dump is blocked with clear feedback.
- Existing goal planner flow still works unchanged.
- UI remains consistent with current AI workspace styling.

Verification steps:
Manual:
- Submit valid brain dump -> edit rows -> apply selected -> verify todos created.
- Submit empty brain dump -> verify validation message.
- Trigger rapid clicks -> verify only one request in flight.

Scripts:
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```

## M2 - Task Critic Feature-Flag Scaffold
```text
Implement M2 scaffold only: evolve Task Critic UI behind a front-end feature flag, keeping backend contract unchanged.

Work style:
- Keep default behavior untouched when flag is off.
- Reuse existing critique API and status update functions.

Files to touch:
- public/app.js
- public/styles.css
- public/index.html (only if a dedicated mount element is needed)

Exact UI behaviors and states:
1. Add a front-end flag constant (default false), e.g. `ENABLE_ENHANCED_TASK_CRITIC`.
2. Flag OFF:
   - current critic flow remains exactly as-is.
3. Flag ON:
   - render a structured critic card with sections:
     - quality score
     - suggested title/description
     - suggestions list
     - feedback reason controls (chips + optional text)
     - actions: Apply title only / Apply description only / Apply both / Dismiss
     - collapsed "Future insights" placeholder section (non-functional scaffold)
4. Add loading state for `Critique Draft (AI)` action and stale response guard (ignore out-of-date responses).
5. Preserve existing suggestion status updates and downstream refresh (`loadAiSuggestions`, `loadAiUsage`, `loadAiInsights`, `loadAiFeedbackSummary`).

Acceptance criteria:
- Flag OFF path is unchanged.
- Flag ON path is fully functional with current API responses.
- Apply/dismiss continue to update suggestion status correctly.
- No regression to todo draft entry and add flow.

Verification steps:
Manual:
- Test with flag OFF and ON.
- Generate critique, apply each action variant, and confirm draft fields update correctly.
- Dismiss critique and confirm panel clears + history/usage refresh.

Scripts:
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```

## M3 - Calendar Export (.ics) from Filtered Todos
```text
Implement M3: add a client-side `.ics` calendar export for the currently visible (filtered) due-dated todos.

Work style:
- No backend changes.
- Keep implementation local to current todo view and filtering functions.
- Keep commits small (UI control + generator + verification polish).

Files to touch:
- public/index.html
- public/app.js
- public/styles.css

Exact UI behaviors and states:
1. Add an `Export .ics` button near the filter/date-view controls in todos view.
2. Export scope is exactly: current `filterTodosList(todos)` result with `dueDate` present.
3. On click:
   - if no due-dated visible tasks: show warning message and do not download.
   - else generate `.ics` text client-side and trigger file download.
4. ICS event fields per task should include:
   - UID (stable enough per export)
   - DTSTAMP
   - DTSTART (UTC)
   - SUMMARY (task title)
   - DESCRIPTION (description or notes fallback)
5. Add lightweight button busy/disabled state during generation.
6. Add a short helper text: export uses current filters and includes only tasks with due dates.

Reuse existing patterns:
- Call `filterTodosList` rather than duplicating filter logic.
- Use `showMessage` for success/warning/error messages.
- Keep handlers attached via `data-onclick` and existing declarative binding.

Acceptance criteria:
- Valid `.ics` file downloads when due-dated visible tasks exist.
- Export respects project/search/date filters.
- Undated tasks are excluded.
- Empty export path shows warning and no file download.
- Existing todo features are unaffected.

Verification steps:
Manual:
- Export with mixed tasks (dated + undated) and verify only dated tasks in calendar.
- Apply a filter and export again; verify only visible filtered tasks are present.
- Export with no due dates in view; verify warning.

Scripts:
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```
