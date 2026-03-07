# TASK 124: sidebar-first-layout

type: Red
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: codex/task-124-sidebar-first-layout
base: master

## Intent
Migrate search, filters, and utility nav actions into the sidebar left rail/sheet. Main panel loses persistent search chrome. Establishes sidebar-first IA.

## Files Allowed
- public/app.js
- public/styles.css
- public/index.html

## Acceptance Criteria
- [x] Change implemented per intent
- [x] Verification checks pass

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/145
- Commit SHA(s): e20012a
- Files changed: public/app.js, public/styles.css, public/index.html
- PASS/FAIL matrix: tsc PASS, format PASS, lint PASS, test:unit PASS, test:ui:fast PASS

## Outcome
Backfill. Merged as PR #145. Sidebar-first IA established: search and filters live in rail.
