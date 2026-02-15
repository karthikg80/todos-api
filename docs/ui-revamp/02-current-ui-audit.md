# Current UI Audit

## Architecture Context (Current)
- Single-page app with 3 main views toggled by nav tabs:
  - Todos (`#todosView`)
  - Profile (`#profileView`)
  - Admin (`#adminView`)
- Markup relies on inline `data-on*` attributes and global delegated handlers.
- Large portions of Todos/Admin/AI UI are built with `innerHTML` in `public/app.js`.
- CSS mixes root variables with many hardcoded colors and inline styles in HTML/JS templates.

## Visible UI Inventory by View

## Todos View: Current visible zones and controls
1. Status message zone (`#todosMessage`)
2. Search bar (`#searchInput`)
3. Filter toolbar:
- Project select (`#categoryFilter`)
- Date pills (All, Today, Upcoming, Next Month, Someday)
- Clear button
- Export `.ics` button + helper text
4. Bulk actions toolbar (conditional, but visually loud when shown):
- Select all checkbox
- Complete selected
- Delete selected
- Selected count
5. Quick-entry form:
- Title input
- Project select
- Project maintenance buttons (`+ Project`, `+ Subproject`, `Rename Project`)
- Due date input
- Priority selector
- `Critique Draft (AI)` button
- `Add Todo` button
- Expandable notes input
6. AI workspace panel (always visible):
- Goal input + date + Generate Plan
- Brain dump textarea + draft actions
- Critique panel output
- Plan panel output
- Insights/history details section
7. Todo list area (`#todosContent`) rendered by `renderTodos()`:
- Group headers by category
- Row with selection checkbox, drag handle, complete checkbox
- Title + description + metadata pills
- Inline actions (`Edit`, move project select)
- Notes toggle, subtask list, AI breakdown button, Delete
8. Edit modal (`#editTodoModal`)

## Profile View: Current visible zones and controls
1. Status message zone (`#profileMessage`)
2. Verification banner (conditional)
3. Account information section
4. Update profile form
5. Admin provisioning section (conditional)

## Admin View: Current visible zones and controls
1. Status message zone (`#adminMessage`)
2. User management heading
3. Users table (dynamic rows with role and delete actions)

## Global UI surfaces
- Header with emoji app title, theme toggle, user bar, badges, logout
- Nav tabs
- Floating keyboard shortcuts FAB + overlay
- Undo toast

## Always-Visible but Rare Controls to Move Behind "More"

## High-priority candidates (Todos)
- `Export .ics` (keep accessible, move into More actions/menu)
- Project maintenance (`+ Project`, `+ Subproject`, `Rename Project`)
- AI critique trigger in quick-entry row
- Brain dump workflow controls
- AI insights/history details block

## Conditional but high-visual-weight candidates
- Bulk actions toolbar style can be toned down and integrated as contextual strip in list header.

## Keep visible by default
- Search
- One project filter
- One date scope control (compact)
- Primary CTA (`Add task`)

## Pain Points
1. Busy header and stacked toolbars
- Search, filters, pills, export, bulk actions, quick-entry, and AI all compete in top viewport.

2. Mixed control semantics
- Inputs, pills, utility buttons, and destructive actions coexist with similar visual weight.

3. AI competes with core task workflow
- AI workspace appears before list content and consumes attention by default.

4. Inconsistent styling system
- Token variables exist but many hardcoded colors remain in CSS/inline styles.
- Multiple radius/shadow/button styles create visual noise.

5. Metadata density inside each task row
- Priority/project/date pills + action controls + AI + notes + subtasks all in one row raise scanning cost.

6. Profile/Admin are functional but dense/utility-looking
- Could benefit from same calmer hierarchy and spacing system.
