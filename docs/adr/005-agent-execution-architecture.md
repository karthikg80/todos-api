# ADR-005: Agent execution architecture

## Status

Accepted (2026-03-21)

## Context

Agent execution currently has two modes:

### Scheduled (async) — Python agent-runner/
- 7 job types: daily, weekly, inbox, watchdog, decomposer, evaluator_daily, evaluator_weekly
- Deployed on Railway as a cron service
- Enrollment-based auth (refresh token exchange for short-lived JWT)
- Calls Node API via HTTP, persists results to AgentJobRun table
- Supports dry-run, auto-apply policies, delivery modes (log/email/slack)

### On-demand (sync) — Express agentRouter
- User-triggered actions (plan today, break down project, etc.) execute synchronously
- `agentExecutor.ts` (3,362 lines) dispatches 98 actions in the Express request handler
- Long-running LLM calls block the event loop during execution

### Problem
The on-demand sync path blocks Express during LLM calls, contending with CRUD traffic.

## Options

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A** | Keep Python worker for scheduled; add BullMQ for on-demand | Preserves working infra; clear separation | Two runtimes, two deploy targets, shared DB |
| **B** | Port Python worker to Node.js + BullMQ | Single runtime, single codebase | Migration effort, must replicate 7 job types |
| **C** | Extend Python worker for on-demand | Minimal new infra | Needs always-on process (not cron), adds latency |
| **D** | Keep current sync + optimize | Least disruption | Doesn't solve event loop contention |

## Recommendation

**Option A** (keep Python + add BullMQ for on-demand) is recommended because:

1. The Python worker is production-proven with 7 job types and Railway deployment
2. On-demand and scheduled workloads have different characteristics (latency vs. throughput)
3. BullMQ adds on-demand async execution without disrupting scheduled jobs
4. Migration to Option B can happen later if dual-runtime becomes a burden

## Prerequisites

- Redis availability for BullMQ (verify Railway Redis add-on compatibility)
- `AgentRunLifecycle` state machine (done in #395)
- Domain barrel exports (done in #393/#394)

## Implementation plan

1. Add BullMQ dependency + Redis connection config
2. Create `src/workers/agentWorker.ts` — BullMQ worker for on-demand jobs
3. Update `POST /agent/runs` to enqueue and return 202
4. Add `GET /agent/runs/:id` status endpoint
5. Client polling UI for run status

## Decision

Option A accepted. Keep Python worker for scheduled jobs; add BullMQ for on-demand user-triggered agent execution. Issues #397, #398, #399 are now unblocked.
