# Command Taxonomy

> Story 2.1 — #587
> Status: Approved spec

## Design Principles

1. **Every workspace reachable by name.** If it's in the sidebar, it's in the palette.
2. **Workflow triggers, not just navigation.** "Run weekly review" is a command, not just "Go to weekly review."
3. **Verbs first.** Commands start with an action: Go, Create, Run, Open, Toggle, Set.
4. **Consistent grouping.** Commands are grouped by intent, not by feature area.
5. **Fuzzy-friendly naming.** Names chosen so partial typing ("rev", "plan", "home") lands on the right command.

## Command Groups

### 1. Navigation Commands

| Command | Action | Shortcut (optional) |
|---------|--------|---------------------|
| Go to Home | Switch to home dashboard | `G then H` |
| Go to Inbox | Switch to inbox view | `G then I` |
| Go to Today | Switch to today view | `G then T` |
| Go to Upcoming | Switch to upcoming view | `G then U` |
| Go to All Tasks | Switch to all-tasks view | `G then A` |
| Go to Unsorted | Switch to unsorted view | |
| Go to Someday | Switch to someday view | |
| Go to Waiting | Switch to waiting view | |
| Go to Scheduled | Switch to scheduled view | |
| Go to Completed | Switch to completed view | |
| Go to Weekly Review | Switch to weekly review view | `G then W` |
| Go to Feedback | Switch to feedback view | |
| Go to Settings | Open settings/profile | |
| Go to Project: {name} | Switch to specific project (dynamic) | |

### 2. Task Actions

| Command | Action |
|---------|--------|
| Create Task | Open quick-entry composer | `C` |
| Create Task in {project} | Open composer with project pre-selected (dynamic) |
| Search Tasks | Focus search in command palette | `/` |

### 3. Project Actions

| Command | Action |
|---------|--------|
| Create Project | Open project creation flow |
| Open Project: {name} | Navigate to project (alias for Go to Project) |

### 4. Planning Actions

| Command | Action |
|---------|--------|
| Plan Today | Generate AI day plan |
| Refresh Priorities | Re-run home focus prewarm |
| Set Day Context | Open day context selector (travel, sprint, rescue, etc.) |
| Open AI Workspace | Toggle AI workspace panel |

### 5. Review Actions

| Command | Action |
|---------|--------|
| Run Weekly Review | Trigger weekly review in suggest mode |
| Show Stale Tasks | Navigate to cleanup view |
| Show Waiting Tasks | Navigate to waiting view |

### 6. System Actions

| Command | Action |
|---------|--------|
| Toggle Dark Mode | Switch theme |
| Toggle Sidebar | Collapse/expand sidebar |
| Export Calendar | Export current view as ICS |
| Open Command Palette | (Self-referential, always available) | `Cmd+K` |

## Ranking Rules

1. **Exact prefix match** ranks highest (typing "home" → "Go to Home" first).
2. **Navigation commands** rank above actions when query is ambiguous.
3. **Recently used commands** get a recency boost (last 5 commands).
4. **Dynamic project commands** rank below static commands at equal match quality.
5. **Task search results** appear in a separate section below commands.

## Search Result Enhancements (Story 2.3)

Task search results include:
- **Title** (highlighted match)
- **Status badge** (next, waiting, scheduled, someday)
- **Project name** (if assigned)
- **Due state** (overdue, today, upcoming, or none)
- **Quick actions**: Enter to open drawer, Shift+Enter to complete (if safe)

## Implementation Notes

- All commands registered in a central `COMMAND_REGISTRY` array.
- Dynamic commands (projects) generated at palette open time.
- Command palette search applies to both command labels and task titles in one pass.
- Keyboard shortcuts (G then H, etc.) use a two-key chord system outside the palette.
