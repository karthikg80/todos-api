# ADR-004: Domain-oriented backend structure

## Status

Accepted

## Context

The backend has 49 service files in a flat `src/services/` directory and a 3,362-line `agentExecutor.ts` that dispatches 98 actions. While the service layer uses interfaces (`ITodoService`, `IProjectService`, etc.), the physical structure doesn't reflect domain boundaries.

Current layout:
```
src/services/     ← 49 files, flat (todo + AI + agent + MCP + analytics + feedback mixed)
src/agent/        ← 2 files (agentExecutor.ts is 3,362 lines)
src/mcp/          ← 5 files
src/routes/       ← 14 routers
```

## Decision

Organize backend code into domain-oriented directories under `src/domains/`:

```
src/domains/
├── core/         ← todos, projects, users (CRUD, the "product")
├── assistant/    ← AI suggestions, critique, planning (LLM-powered features)
├── agent/        ← automation runs, actions, audits (autonomous execution)
└── mcp/          ← MCP protocol, OAuth, tool catalog (assistant integration)
```

Shared infrastructure goes under `src/infra/`:
```
src/infra/
├── db/           ← Prisma client
├── logging/      ← Structured logger
├── metrics/      ← Metrics collection
└── config/       ← Environment configuration
```

## Rules

1. Route handlers delegate to domain services — no business logic in routes
2. Domains do not import from each other directly; cross-domain calls go through interfaces or the agent executor
3. The agent executor is decomposed into domain-scoped action handlers
4. `src/routes/` and `src/middleware/` remain as-is (routes are a thin HTTP layer)

## Consequences

- Physical structure reflects product domains
- New features have an obvious landing zone
- `agentExecutor.ts` shrinks from 3,362 lines to a thin dispatcher (~500 lines)
- File moves are mechanical and low-risk (one domain at a time)
- Test files move alongside their source files
