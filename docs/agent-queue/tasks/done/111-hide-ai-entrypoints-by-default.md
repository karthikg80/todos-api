# TASK 111: hide-ai-entrypoints-by-default

type: Yellow
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: codex/task-111-hide-ai-entrypoints-by-default
base: master

## Intent *
Hide AI assistant surfaces and AI-facing call-to-action controls by default so users only see AI UI after explicit opt-in actions.

## Scope
- Update frontend behavior so these are hidden by default on todos view load:
  - AI workspace panel shell/header
  - prominent AI action buttons that advertise assistant features
  - task drawer full AI suggestions list when no lint issue is present
- Preserve lint-first behavior for on-create and drawer flows:
  - show lint chip only when deterministic lint rule fires
  - only reveal full AI panel after explicit user action (Fix/Review or equivalent opt-in action)
- Remove automatic today-plan suggestion fetch/render on first panel open unless explicitly user-triggered.
- Keep debug/dev override behavior (`ai_debug=1`) for developer visibility.

## Out of Scope
- Backend endpoint contract changes.
- Prisma schema changes.
- New dependencies.
- AI model/provider prompt changes.

## Files Allowed
- public/app.js
- public/index.html
- public/styles.css
- tests/ui/**

## Acceptance Criteria *
- [x] Loading the todos view does not show AI assistant panel shell or AI CTA controls by default.
- [x] On-create surface shows no AI UI by default unless lint triggers; when lint triggers, only lint chip appears.
- [x] Task drawer does not show full AI suggestions by default; only lint chip appears when applicable.
- [x] Full AI suggestions panel is shown only after explicit user action.
- [x] Today plan does not auto-fetch suggestions on first open/load.
- [x] `ai_debug=1` continues to expose AI panels for debugging.
- [x] Required checks pass: `npx tsc --noEmit`, `npm run format:check`, `npm run lint:html`, `npm run lint:css`, `npm run test:unit`, `CI=1 npm run test:ui:fast`.

## Constraints
- Preserve event delegation architecture (no direct listeners on dynamic children).
- Preserve `filterTodos()` and `setSelectedProjectKey(...)` behavior.
- Keep telemetry emission paths intact for explicit AI interactions.

## MIC-Lite (Yellow/Red)

### Motivation
Current UX still exposes AI controls by default, which conflicts with the intended lint-first, opt-in assistant behavior and creates perceived interface noise.

### Impact
Frontend behavior changes are user-visible; risk is accidentally hiding legitimate explicit AI entry paths.

### Checkpoints
- [x] Verify no AI shell/button appears on initial todos view load.
- [x] Verify lint chip still appears for vague titles and still opens full panel on Fix/Review.
- [x] Verify explicit actions still reach existing `/ai/*` endpoints successfully.

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed
- PASS/FAIL matrix

## Outcome *
Implemented hidden-by-default AI entry points by introducing explicit AI workspace visibility state (`todos:ai-visible`, default hidden; debug override still forces visible), hiding the AI workspace shell and critique CTA on load, and preserving lint-first behavior for on-create and task drawer flows. Task drawer no longer falls through to full panel on clean titles; full panel is shown after explicit lint actions. Today plan no longer auto-fetches suggestions when entering Today view. Updated fast-suite tests to lock these behaviors and keep existing AI flows reachable through explicit/debug paths.
