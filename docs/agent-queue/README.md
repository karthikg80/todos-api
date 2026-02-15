# Agent Queue

Queue items live in `docs/agent-queue/tasks/` as markdown files.

## Task Directories

| Directory       | Purpose                              |
|-----------------|--------------------------------------|
| `tasks/green/`  | Small, local changes (fast path)     |
| `tasks/yellow/` | Bounded, single-module changes       |
| `tasks/red/`    | Cross-module or high-risk changes    |
| `tasks/done/`   | Completed tasks (moved after DONE)   |

**Source-of-truth rule:** If the task file's `type:` header and its folder location disagree, the folder classification takes precedence.

## Templates

- `TEMPLATE.md` — Original simple template (still valid for quick tasks).
- `TEMPLATE_V2.md` — Classified template with Green/Yellow/Red support, MIC-lite, and scope escalation.

## Quick Usage

1. Copy the appropriate template into `tasks/green/`, `tasks/yellow/`, or `tasks/red/`.
2. Fill required fields (at minimum: Intent, Acceptance Criteria).
3. Set `status: READY`.
4. Run:
   - `scripts/dual-agent-runner.sh next`
   - `scripts/dual-agent-runner.sh handoff-builder <task-file>`
   - `scripts/dual-agent-runner.sh set-status <task-file> REVIEW`
   - `scripts/dual-agent-runner.sh handoff-reviewer <task-file>`
5. Move completed tasks to `tasks/done/`.

## Supported Statuses

`READY` → `RUNNING` → `REVIEW` → `FIX` → `REVIEW` → `MERGE` → `DONE`

Any state → `BLOCKED` (with reason + owner). See scope escalation in `DUAL_AGENT_PROTOCOL.md`.
