# Calm Modern SaaS UI Revamp: Vision and Principles

## Vision
Redesign the single-page app (Todos/Profile/Admin) into a calm, modern SaaS interface that emphasizes focus and clarity over feature density. The UI should feel quiet and predictable: strong typography rhythm, generous spacing, subtle surfaces, one accent color, and progressive disclosure for advanced actions.

The app should preserve the existing architecture:
- Section-based views (`#todosView`, `#profileView`, `#adminView`)
- Delegated event handlers (`data-onclick`, `data-onchange`, etc.)
- `innerHTML`-driven rendering for dynamic zones (todo list, AI panels, admin table)

## Success Metrics
1. Fewer always-visible controls in Todos header:
- Default visible controls reduced to: search, project filter, date scope, primary CTA.
- Advanced controls moved behind "More" surface.

2. Cleaner top hierarchy:
- One obvious primary action per major surface.
- Header no longer competes with gradient-heavy branding and dense toolbars.

3. Reduced panel competition:
- AI workspace no longer competes with task entry by default.
- AI history/insights remain available but collapsed until requested.

4. Visual consistency:
- Hardcoded one-off colors and inline visual styles replaced by token-driven classes.
- Radius, border, shadow, and spacing follow a finite scale.

5. Interaction calmness:
- Progressive disclosure used for rare controls (bulk actions, project maintenance, AI meta/history).
- Edit flow moved to dedicated details surface (drawer/modal), not inline clutter.

## Principles
### 1) Hierarchy first (type + spacing)
- Establish clear reading order: page title -> key filters -> list -> secondary utilities.
- Use spacing and typography instead of color blocks to indicate structure.
- Keep separators low contrast and consistent.

### 2) Progressive disclosure for advanced controls
- Keep common actions visible.
- Move low-frequency controls into "More filters", drawers, or collapsibles.
- Default to collapsed for power tools (AI planning/history and project maintenance actions).

### 3) Single primary action per surface
- Todos top surface: one primary CTA (`Add task`).
- Secondary actions become tertiary buttons, menu items, or inline row actions.
- Avoid multiple equally prominent buttons in one row.

### 4) Accessibility baseline
- Preserve current `aria-live` status regions and modal semantics.
- Ensure visible focus ring on all interactive elements.
- Maintain minimum hit area (44px target for primary tap surfaces where feasible).
- Ensure text/surface contrast and state cues are valid in both light and dark themes.
