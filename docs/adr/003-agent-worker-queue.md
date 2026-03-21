# ADR-003: Background worker model for agent execution

## Status

Proposed (pending evaluation in #396)

## Context

Agent execution currently has two modes:

1. **Scheduled (async):** The Python `agent-runner/` worker runs 7 job types on Railway cron. It reads enrollments from Postgres, exchanges refresh tokens for short-lived JWTs, calls the Node API, and persists results.

2. **On-demand (sync):** User-triggered agent actions (e.g., "plan my day", "break down this project") execute synchronously in Express request handlers via `agentExecutor.ts`. These can block the event loop during LLM calls.

The on-demand sync path is the problem: long-running AI calls contend with CRUD traffic on the same Express process.

## Options

| Option | Pros | Cons |
|--------|------|------|
| **A: Keep Python worker + add BullMQ for on-demand** | Preserves working scheduled infra; Node handles user-triggered runs | Two runtimes, two deployment targets |
| **B: Port Python worker to Node.js + BullMQ** | Single runtime, single codebase | Migration effort, must replicate 7 job types |
| **C: Extend Python worker for on-demand** | Minimal new infra | Requires always-on process (not cron), adds latency |

## Decision

**Deferred.** The choice depends on operational constraints (Railway plan, Redis availability, team comfort with Python vs. Node workers). An explicit evaluation (#396) must produce ADR-005 before implementation proceeds.

## Constraints

- Whatever is chosen, the Express process must not block on agent execution
- The `AgentJobRun` lifecycle model (queued → running → succeeded/failed) already exists in Prisma
- The Python agent-runner must continue working during any transition
- Run status must be queryable (`GET /agent/runs/:id`)

## Consequences

- Phase D of the architecture plan is blocked until this decision is made
- The `AgentRunService` abstraction (#395) can proceed independently
- Client polling UI (#399) can be built against the status API regardless of backend choice
