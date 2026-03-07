# TASK 114: todos-shell-density-tighten

type: Green
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: codex/task-114-todos-shell-density-tighten
base: master

## Intent
Tighten the Todos shell density: reduce vertical padding in the top bar, list header, and quick-entry/property panel so the first todo row appears higher and the shell feels calmer.

## Out of Scope
- JS behavior changes
- Backend/API changes
- Test modifications

## Files Allowed
- public/styles.css

## Acceptance Criteria
- [x] First todo row starts visibly higher without clipping
- [x] Shell feels calmer with tighter vertical rhythm

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/134
- Commit SHA(s): 8138065
- Files changed: public/styles.css
- PASS/FAIL matrix: tsc PASS, format PASS, lint PASS, test:unit PASS, test:ui:fast PASS

## Outcome
Backfill. Merged as PR #134. CSS-only density pass tightening todos shell vertical rhythm.
