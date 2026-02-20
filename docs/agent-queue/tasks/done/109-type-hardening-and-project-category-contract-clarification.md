# TASK 109: type-hardening-and-project-category-contract-clarification

type: Yellow
status: READY
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-109-type-hardening-and-project-category-contract-clarification
base: master

## Intent *
Reduce weak typing (`any`) in core backend paths and formalize the project/category contract to prepare for cleaner domain boundaries.

## Scope
- Replace high-impact `any` usage in validation, todo persistence mapping, and AI suggestion store mapping with explicit types/guards.
- Clarify and document canonical source for project identity (`projectId` vs legacy `category`) and synchronization rules.
- Add tests for typed parsing and mapping behavior.

## Out of Scope
- Immediate removal of legacy `category` column.
- Prisma schema migration in this task.
- New dependencies.

## Files Allowed
- src/validation.ts
- src/prismaTodoService.ts
- src/aiSuggestionStore.ts
- src/types.ts
- src/**/*.test.ts
- docs/**

## Acceptance Criteria *
- [ ] `any` usage is reduced/eliminated in identified core paths via explicit typing or safe parsing.
- [ ] Mapping behavior for project/category remains backward-compatible and covered by tests.
- [ ] Contract documentation clearly states canonical field and transition policy.
- [ ] Required checks pass: `npx tsc --noEmit`, `npm run format:check`, `npm run test:unit`, `CI=1 npm run test:ui:fast`.

## Constraints
- Do not alter persisted data model in this task.
- Do not introduce breaking response shape changes.

## MIC-Lite (Yellow/Red)

### Motivation
Weak typing and dual-field semantics increase bug risk and make further refactors slower and less safe.

### Impact
Improves maintainability and correctness confidence; low-to-moderate risk of accidental strictness changes.

### Checkpoints
- [ ] Replace typing incrementally with tests protecting behavior.
- [ ] Confirm no endpoint contract drift after typing changes.
- [ ] Validate project/category behavior in existing tests.

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
(filled after completion: what actually happened vs. intent)
