# New Information Architecture

## IA Goals
- Make Todos the clear primary workflow.
- Reduce above-the-fold complexity.
- Keep advanced capability fully available via disclosure.
- Preserve current section-based view model and delegated events.

## Todos: Proposed Layout

## 1) Top bar (always visible)
- Left: page title + lightweight count summary (`My Tasks`, `N active`)
- Right: one primary CTA (`Add task`)
- Optional tertiary icon buttons: theme, shortcuts

## 2) Minimal filters row (always visible)
- Search input
- Project filter select
- Date scope segmented control (compact)
- `More filters` trigger (button)

Default rule:
- Only high-frequency filters visible here.
- No export, project-maintenance, AI controls in default row.

## 3) More filters drawer/collapsible (default collapsed)
Contains advanced/rare controls:
- Clear filters
- Export `.ics`
- Project structure actions (`+ Project`, `+ Subproject`, `Rename`)
- Optional secondary date modes if not in primary segmented control

## 4) List area (primary canvas)
- Calm grouped list with consistent row anatomy:
  - Slot A: selection + completion
  - Slot B: title + optional short description
  - Slot C: metadata line (priority, due date, project)
  - Slot D: row actions (Edit, More)
- Bulk actions appear only when selection exists, as slim contextual strip pinned to list header.

## 5) Details drawer (preferred) or modal
- Edit flows move to right-side details drawer on desktop.
- Mobile fallback: modal sheet.
- Progressive disclosure in drawer:
  - Essentials (title, status, due date, project)
  - Details (description, notes, subtasks)
  - AI utilities (task-level) in nested expandable section

## 6) AI workspace panel
- Dockable/collapsible panel, default collapsed.
- Entry point from top bar or list utility rail (`AI assistant`).
- Expanded panel structure:
  - Goal planning (primary AI action)
  - Brain dump import (secondary)
  - Insights/history behind nested collapse

## Profile: Proposed Calm Structure
- Keep current sections but reduce visual density:
  - Account summary card
  - Profile edit card
  - Verification/admin provisioning as contextual notice cards
- Use uniform card spacing and subdued dividers.

## Admin: Proposed Calm Structure
- Retain table architecture but simplify controls:
  - Header row with title + optional search/filter
  - Actions moved into row "More" menu where possible
  - Status chips normalized to tokenized badges
- Emphasize readability and action safety (destructive actions less visually dominant).

## Mapping to Existing Architecture
- Keep current `switchView()` and tab model.
- Continue rendering list/table with `innerHTML`; introduce stable subcontainers for:
  - top controls
  - disclosure panels
  - primary list canvas
- Maintain delegated events (`data-on*`) for all new controls.
