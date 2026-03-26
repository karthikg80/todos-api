# MCP Product Surface and Scope Model

> Story 6.1 — #591
> Status: Approved spec

## How the Product Explains Assistant Connectivity

### User-Facing Language

**Don't say**: "MCP server", "tool catalog", "OAuth scopes", "protocol".

**Do say**: "Connect your AI assistant", "assistant sessions", "permissions".

### The Pitch (settings page copy)
> Connect Claude, ChatGPT, or any compatible AI assistant to manage your tasks conversationally. Ask what's due, capture ideas, run your weekly review, or plan your day — all from your assistant.

### The Mental Model
```
Your tasks live here → You connect an assistant → The assistant can read and act on your tasks
```

Three things users need to understand:
1. **What the assistant can do** (permissions/scopes)
2. **Which assistants are connected** (sessions)
3. **How to connect** (setup)

## Supported Use Cases

### Tier 1 — Spotlight Workflows (quickstart-worthy)
These are the workflows that make MCP worth connecting:

| Workflow | Description | Tools Used |
|----------|-------------|------------|
| **"What should I work on?"** | Ask for today's priorities | `list_today`, `decide_next_work`, `prewarm_home_focus` |
| **"Capture this"** | Quick task capture from conversation | `capture_inbox_item`, `create_task` |
| **"Plan my day"** | Generate a time-boxed plan | `plan_today`, `get_availability_windows`, `get_day_context` |
| **"Run my weekly review"** | Structured review with findings | `weekly_review`, `weekly_review_summary` |
| **"What's stale?"** | Find forgotten tasks | `find_stale_items`, `list_stale_tasks` |
| **"Break this down"** | Decompose a complex task | `break_down_task`, `plan_project` |

### Tier 2 — Power User Workflows
| Workflow | Tools Used |
|----------|------------|
| Triage inbox batch | `list_inbox_items`, `triage_inbox`, `promote_inbox_item` |
| Project health check | `analyze_project_health`, `review_projects` |
| Dependency analysis | `analyze_work_graph` |
| Task quality audit | `analyze_task_quality`, `find_duplicate_tasks` |
| Configure automation | `get_agent_config`, `update_agent_config` |

### Tier 3 — CRUD (available but not spotlighted)
Basic read/write operations on tasks, projects, subtasks. These work but aren't the reason to connect.

## Scope Model (Permissions)

### Current Scopes
- `tasks.read` — Read all task data
- `tasks.write` — Create, modify, delete tasks
- `projects.read` — Read project data
- `projects.write` — Create, modify, delete projects

### Recommended Scope Presets

| Preset | Scopes | Use Case |
|--------|--------|----------|
| **Full access** | All four | Primary assistant (Claude, ChatGPT) |
| **Read-only** | `tasks.read`, `projects.read` | Dashboard, reporting, read-only integrations |
| **Capture only** | `tasks.read`, `tasks.write` | Quick-capture shortcuts, voice assistants |

Presets are UI sugar — the underlying scopes remain the same. Users can always customize.

## Sessions Management (Story 6.2 input)

### What a Session Shows
| Field | Description |
|-------|-------------|
| **Assistant name** | Client identifier (e.g., "Claude Desktop", "ChatGPT") |
| **Connected at** | When the session was created |
| **Last active** | Last tool invocation timestamp |
| **Permissions** | Scope preset or custom scope list |
| **Status** | Active, expired, revoked |

### Actions
- **Revoke** — Immediately invalidate the session token.
- **Revoke all** — Invalidate all sessions at once.
- **View activity** — Show recent tool invocations (from audit log).

### UI Location
Settings → Assistant Connections (new section, below profile).

## Tool Catalog Review

### Current State: 78 tools
The tool catalog is comprehensive but flat. An assistant client sees 78 tools with no grouping or priority signal.

### Recommendations

1. **Add tool descriptions that reference workflows, not internals.**
   - Before: "List tasks with optional filters"
   - After: "See your tasks — filter by project, status, due date, or search by keyword"

2. **Mark spotlight tools** in tool metadata so assistant clients can prioritize them in tool selection.

3. **Consider composite tools** for common multi-step workflows:
   - `quick_capture_and_triage` — capture + auto-triage in one call
   - `morning_briefing` — prewarm_home_focus + plan_today + list_today in one response

   These reduce round-trips and improve assistant reliability. Ship as additions, not replacements.

4. **Do NOT remove or rename existing tools.** Backward compatibility is critical — connected assistants may have cached tool schemas.

## What This Changes

1. A new "Assistant Connections" section appears in settings.
2. Tool descriptions are rewritten for assistant-client readability.
3. Quickstart docs cover the 6 spotlight workflows.
4. Scope presets simplify the connection flow.

## What Does NOT Change

- OAuth flow mechanics (existing implementation is solid).
- Tool signatures and parameters.
- Scope enforcement logic.
- Audit logging.
