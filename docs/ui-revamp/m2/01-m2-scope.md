# M2 Scope

## Goal
Redesign Todo row presentation and editing surface to improve scanability and reduce inline clutter, while preserving all existing behavior and backend contracts.

## In Scope
- Todo row redesign in Todos list:
  - consistent row structure (state -> content -> metadata -> actions)
  - calmer visual density and spacing
  - reduced always-visible action noise
- Details drawer/sheet:
  - desktop right-side drawer
  - mobile bottom sheet/full-screen panel
  - edit/view flow moved from inline-heavy row + edit modal into drawer
- Minimal action consolidation:
  - keep 1-2 always-visible row actions
  - move rare actions to kebab/overflow affordance

## Out of Scope
- AI workspace flow/layout changes
- bulk action behavior changes
- filter behavior changes
- data model or API schema changes
- new backend endpoints
- routing/framework migration

## No Behavior Change
M2 must preserve current behavior and capabilities:
- All fields currently editable remain editable.
- Save/update semantics remain unchanged.
- Existing keyboard workflows continue to work.
- Existing delegated event model and full `renderTodos()` re-render approach remain in place.
