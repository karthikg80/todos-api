# Visible Workflow Model

> Story 3.1 — #588
> Status: Approved spec

## Problem

The schema supports areas, goals, dependencies, recurrence, waiting, review cadence, effort, energy, and emotional state — but most of that is invisible. Users fill in fields without seeing how they feed planning.

## Design Decisions

### Concept Visibility Matrix

| Concept | Current State | Decision | Rationale |
|---------|--------------|----------|-----------|
| **Waiting** | Status enum + filtered view | **First-class nav item + follow-up actions** | Waiting is a daily workflow, not just a filter |
| **Scheduled** | Status enum + filtered view | **First-class nav item** | Users with scheduling habits need quick access |
| **Someday** | Status enum + filtered view | **First-class nav item** | Parking lot for low-urgency items |
| **Dependencies** | `dependsOnTaskIds` array, no UI | **Drawer visualization + blocked badge in lists** | Users can't see what's blocked or why |
| **Goals** | `goalId` FK, no UI affordance | **Project detail + area grouping** | Goals give meaning to projects, but shouldn't be a top nav |
| **Areas** | `areaId` FK, project sidebar groups | **Sidebar grouping with collapsible headers** | Areas organize the sidebar, not a standalone view |
| **Effort** | `estimateMinutes` + `effortScore` | **Visible in day plan + drawer summary** | Effort drives plan-to-timebox; users should see why |
| **Energy** | `energy` enum on tasks | **Tag in list rows + filter option** | Low-energy tasks should be findable when tired |
| **Recurrence** | Full RRULE support, badge in drawer | **Badge in list rows + next-occurrence in drawer** | Recurring tasks are invisible until they're overdue |
| **Emotional state** | `emotionalState` field | **Keep hidden** | Internal AI signal, not a user workflow |

### Navigation Changes

**Current sidebar:**
```
Home | Inbox | Today | Upcoming | All | Projects...
```

**Proposed sidebar:**
```
Home
Inbox
---
Today
Upcoming
Scheduled
Someday
Waiting
---
All Tasks
Completed
---
Projects (grouped by area)
  Area: Work
    Project A
    Project B
  Area: Personal
    Project C
  Uncategorized
    Project D
---
Weekly Review
Cleanup
```

### Interaction Specifications

#### Waiting Tasks
- List view shows `waitingOn` value as a subtitle ("Waiting on: Sarah").
- Each waiting task has a **"Follow up"** action → creates a follow-up task linked to the original.
- Each waiting task has a **"Resolve"** action → moves to next/in_progress with cleared waiting fields.
- Badge count in sidebar nav item.

#### Dependencies
- Drawer shows a "Depends on" section listing blocking tasks with status.
- Drawer shows a "Blocks" section listing downstream tasks.
- In list views, blocked tasks show a lock icon + "Blocked by {task title}" subtitle.
- Completing a blocking task surfaces a toast: "{N} tasks unblocked."

#### Goals & Areas
- Project creation/edit form includes an Area dropdown and optional Goal link.
- Sidebar groups projects under area headers (collapsible).
- Project detail page shows the goal it serves (if set), with progress context.
- Goals are not a standalone nav item — they surface through projects.

#### Effort & Energy in Planning
- Day plan cards show estimated minutes and energy level.
- "Why this task?" explanation references effort fit + energy match.
- Home dashboard top-focus includes energy match indicator when day context has energy set.

#### Recurrence in Lists
- Recurring tasks show a small repeat icon + interval label ("Weekly", "Every 3 days") in list rows.
- Drawer shows full recurrence detail + next occurrence date.
- Completing a recurring task auto-creates the next instance (existing behavior, now visible).

## Interactions Between Views

| View | Uses These Concepts |
|------|-------------------|
| **Home** | Top focus (effort, energy, dependencies), due soon, daily plan (effort, energy), stale |
| **Today** | Due date, scheduled date, effort, energy, recurrence |
| **Upcoming** | Due date, scheduled date, recurrence |
| **Weekly Review** | Stale, waiting, missing next actions, areas, goals (project health) |
| **Project detail** | Area, goal, dependencies, next actions, headings |
| **Drawer** | All fields — dependencies, waiting, effort, energy, recurrence, area, goal |

## What This Does NOT Change

- No new database fields required.
- No changes to MCP tool signatures.
- Existing filter logic stays canonical (`filterTodos()` pipeline).
- Home dashboard tile structure unchanged (tiles gain richer explanations, not new tiles).
