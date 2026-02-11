# Changelog

## Unreleased (2026-02-11 UTC)

### AI
- PR #39 (merged): Added editable AI plan draft review with per-task selection and editing before apply.
- PR #39 (merged): Improved AI plan apply safety with in-flight locking, empty-selection guard, partial-failure handling, and retry for suggestion status sync.
- PR #40 (merged): Added brain dump flow (`Brain dump -> Draft tasks`) using existing `/ai/plan-from-goal` and reusing the editable draft review/apply workflow.
- PR #41 (pending merge): Added feature-flagged enhanced Task Critic panel scaffolding (structured sections, reusable actions) with default OFF behavior.

### UI/UX
- PR #39 (merged): Added clearer AI draft controls (select all/none, reset to AI draft, apply selected, dismiss) and accessibility improvements in touched surfaces.
- PR #40 (merged): Added AI workspace controls for brain-dump drafting with validation and in-flight button state handling.
- PR #41 (pending merge): Added enhanced critic panel shell with score summary, improvements section, feedback input, apply/dismiss actions, and collapsed "Future insights" section.
  - Feature flag default: OFF.
  - Enable via query param: `?enhancedCritic=1` (or `?enhancedCritic=true`).
  - Enable via localStorage: `localStorage.setItem('feature.enhancedTaskCritic', '1')` (or `'true'`) and reload.

### Export/Integrations
- PR #42 (pending merge): Added client-side `.ics` export for currently filtered due-dated todos.
- PR #42 (pending merge): Export generates `todos-YYYY-MM-DD.ics` and includes `VCALENDAR` + `VEVENT` entries with all-day due-date events.

### Tests/Quality
- PR #39 (merged): Added UI coverage for editable plan draft apply semantics and failure handling.
- PR #40 (merged): Added UI coverage for brain dump drafting flow.
- PR #41 (pending merge): Added UI coverage for Task Critic feature-flag OFF/ON rendering and apply/dismiss behavior (`tests/ui/ai-critic-panel.spec.ts`).
- PR #42 (pending merge): Added UI coverage for ICS export disabled state, filtered inclusion, and generated calendar content (`tests/ui/ics-export.spec.ts`).

## Notes for Testers
- PR #39: Generate an AI plan, edit fields, unselect at least one task, apply, and confirm only selected edited tasks are created.
- PR #40: Enter free-form text in Brain dump, draft tasks, edit in the shared draft panel, and apply to verify end-to-end reuse of the existing plan flow.
- PR #41 (flagged): Validate legacy critic UI with flag OFF, then enable flag and confirm enhanced panel sections and existing apply/dismiss behavior.
- PR #42: Apply search/project/date filters, click Export `.ics`, and verify exported events match only visible due-dated todos.
