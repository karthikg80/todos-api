# Screen Specs (Wireframe Level)

## Visibility Legend
- `[Default]` visible on load
- `[More]` behind drawer/collapsible/menu
- `[Contextual]` appears after selection/state

## 1) Todos Default Screen

```text
+--------------------------------------------------------------------------------+
| My Tasks (42 open)                                            [Add Task]        |
+--------------------------------------------------------------------------------+
| [Search.................] [Project v] [All|Today|Upcoming] [More filters v]    |
+--------------------------------------------------------------------------------+
| [AI Assistant >]                                                            [ ] |
| (collapsed by default)                                                         |
+--------------------------------------------------------------------------------+
| (optional contextual strip when selected)                                      |
| [Contextual] 3 selected  [Complete] [Delete] [Clear selection]                |
+--------------------------------------------------------------------------------+
| Project A                                                                      |
| [ ] [ ] Task title                                             [Edit] [More v] |
|     short description                                                         |
|     Priority chip  Due date  Project                                          |
|-------------------------------------------------------------------------------|
| Project B ...                                                                  |
+--------------------------------------------------------------------------------+
```

Default visible:
- Title, count
- Primary CTA
- Search, project filter, compact date scope
- More filters trigger
- List

Hidden by default:
- Export, project maintenance, advanced filter controls
- AI details/history

## 2) More Filters Drawer / Collapsible

```text
+---------------------- More Filters -------------------------------------------+
| [x] Include completed                                                         |
| [ ] Show someday                                                              |
| Date range: [start] [end]                                                     |
|------------------------------------------------------------------------------|
| Utilities                                                                      |
| [Export .ics]  [Create project]  [Create subproject]  [Rename project]       |
|------------------------------------------------------------------------------|
| [Reset filters]                                                     [Apply]   |
+--------------------------------------------------------------------------------+
```

## 3) Todo Details Drawer (Progressive Disclosure)

```text
+--------------------------- Task Details --------------------------------------+
| Title [.........................................................]             |
| Status [Open v]   Project [Project A v]   Due [datetime]                     |
| Priority [Low|Med|High]                                                       |
|------------------------------------------------------------------------------|
| Essentials [Default open]                                                     |
| - core fields only                                                            |
|------------------------------------------------------------------------------|
| Details [More] v                                                              |
| - Description textarea                                                        |
| - Notes textarea                                                              |
| - Subtasks list editor                                                        |
|------------------------------------------------------------------------------|
| AI Assist [More] v                                                            |
| - Critique draft                                                              |
| - Break into subtasks                                                         |
|------------------------------------------------------------------------------|
|                                              [Save] [Cancel]                  |
+--------------------------------------------------------------------------------+
```

Default visible in drawer:
- Essentials only

Hidden in drawer:
- Details section
- AI assist section

## 4) AI Panel (Collapsed vs Expanded)

Collapsed:
```text
[AI Assistant >]  Plan tasks from a goal or brain dump
```

Expanded:
```text
+-------------------------- AI Assistant ---------------------------------------+
| Goal [...................................] Target date [....] [Generate plan]|
|------------------------------------------------------------------------------|
| Brain dump [textarea.......................................................]   |
| [Draft tasks] [Clear]                                                        |
|------------------------------------------------------------------------------|
| Insights & history [More] v                                                  |
| - usage summary                                                               |
| - performance insights                                                        |
| - recent suggestions                                                          |
+--------------------------------------------------------------------------------+
```

Default behavior:
- Collapsed on initial Todos load.
- Persist user-expanded state per session/local preference.

## 5) Empty / Loading / Error States

Empty:
```text
No tasks yet
Start by adding your first task.
[Add Task]
```

Loading:
```text
Spinner + "Loading tasks..."
Keep chrome visible so page does not jump.
```

Error:
```text
Inline status region near top controls:
"Could not load tasks. [Retry]"
```

State rules:
- Maintain existing `aria-live` message behavior.
- Keep one clear action per state (`Add Task`, `Retry`).
