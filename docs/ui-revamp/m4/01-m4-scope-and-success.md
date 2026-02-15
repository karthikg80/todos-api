# M4 Scope and Success Criteria

## Objective
Make projects first-class through a calm, collapsible left rail that reduces top-bar density and improves project switching speed without changing backend behavior or filtering semantics.

## In Scope
- New left rail information architecture for project navigation.
- Rail interactions for select/create/rename/delete project flows (no `prompt()` UX).
- Active project highlighting and counts computed from already-loaded todos.
- Desktop collapse/expand behavior and mobile sheet behavior.
- Accessibility and keyboard flows for rail navigation.
- Small, mergeable PR plan and test strategy.

## Out of Scope
- Backend/API changes.
- New frameworks/libraries.
- AI workflow changes.
- Drawer feature changes.
- Drag/bulk logic changes.
- Filter semantic changes (only UI wiring to existing filter path).

## Measurable Success Criteria
- Top bar project controls reduced to 0 always-visible project controls.
- Project switching remains 1 interaction from rail item click/Enter.
- Rail interaction target size: minimum 36px row height and keyboard focus ring visible.
- Project selection reuses current filter path (`categoryFilter` semantics unchanged).
- Project CRUD flows avoid blocking browser prompts and use in-app surfaces.
- No regression in existing smoke paths (`more filters`, drawer, AI, bulk, drag).

## Calmness Metrics (UI)
- Fewer concurrent controls near search/add actions.
- One dominant navigation focus for projects (left rail) instead of mixed controls.
- Consistent active-state treatment (single highlight style for selected project).
- Subtle separators and low-contrast borders (token-driven).
