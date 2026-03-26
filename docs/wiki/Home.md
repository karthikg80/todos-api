# Todos Wiki Home

This page is a wiki-ready summary of the current product feature set. It is kept in the main repo so it can be copied into the GitHub wiki if wiki support is enabled later.

## Product Summary

Todos is a planning-focused task workspace with:

- a static frontend app for daily task management
- an Express + Prisma backend
- AI-assisted planning and review surfaces
- an internal agent API
- a public MCP connector layer for assistants

## Main User-Facing Features

- Home dashboard with focus tiles, today's plan, upcoming work, and rescue mode
- task management with projects, headings, subtasks, tags, dates, recurrence, waiting state, dependencies, notes, and richer workflow fields
- quick entry with natural-language due-date parsing
- weekly review and project planning flows
- AI suggestions during task creation, in the task drawer, and in planning/home workflows
- inbox capture and triage
- feedback submission plus admin review workflows
- email, social, and phone-based auth options

## Main Machine-Facing Features

- `/agent` for machine-usable task, project, planning, inbox, and control-plane actions
- `/mcp` for assistant connectors with scoped tools
- OAuth linking and discovery endpoints under `/oauth` and `/.well-known/*`

## Important Current Limitations

- planning is stronger than full calendar scheduling/timeboxing
- some advanced backend capabilities are surfaced more clearly to agents than to end users
- assistant-session management exists, but the polished in-app experience is still improving

## Related Docs

- [Product Overview](../product-overview.md)
- [Assistant MCP](../assistant-mcp.md)
- [Planner Runtime](../planner-runtime.md)
