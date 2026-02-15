# Details Drawer / Sheet Spec

## Placement
- Desktop (>= 1024px): right-side drawer, fixed width (target 380-440px).
- Tablet/mobile (< 1024px): bottom sheet that can expand to full-screen panel for editing comfort.

## Header
- Task title context (readable label or editable title field depending on mode).
- Close button (always visible, top-right).
- Optional save state text (`Saved`, `Saving...`, `Error`) using existing message primitives.

## Sections

### Essentials (always visible)
- Title
- Completed toggle
- Due date
- Project
- Priority

### Details (collapsed by default)
- Description
- Notes
- Category (if distinct from project in current model)
- Subtasks list/edit (reuse existing supported subtask behavior)
- Danger zone: Delete action

## Progressive Disclosure
- `Details` section is a collapsible block, collapsed on open.
- Essentials stays short and fast for common edits.

## Open/Close + Focus Behavior
- Opening drawer:
  - sets selected todo state
  - renders drawer open
  - focuses title input in drawer
- Closing drawer via close button or `Escape`:
  - closes drawer/sheet
  - restores focus to originating row trigger element

## Coexistence Constraints
- AI workspace remains unchanged in M2.
- Drawer must coexist with current section layout without hiding critical top-level navigation.
