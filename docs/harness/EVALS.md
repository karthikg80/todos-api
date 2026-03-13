# Evals

Current harness direction for evals in this repo.

## Purpose

Evals are capability and regression checks for agent-facing behavior that sit
alongside the normal unit, integration, and UI suites.

They are not meant to replace the existing test stack. The harness should use
the existing stack as the substrate and add eval runners where they provide a
clearer signal about agent quality, planner quality, MCP behavior, or output
contract drift.

## First-pass principles

- keep the harness script-first and repo-native
- prefer code-based graders first
- isolate each trial from the next
- separate regression suites from capability suites
- emit machine-readable artifacts

## Existing building blocks already in the repo

- contract fixtures and validation tests under `src/`
- planner tests and deterministic planners under `src/services/planner/`
- MCP and agent route coverage under `src/mcpRouter.test.ts`,
  `src/mcpPublicRouter.test.ts`, and `src/agentRouter.test.ts`
- deterministic UI readiness helpers under `tests/ui/helpers/todos-view.ts`
- decision-assist telemetry under `src/services/decisionAssistTelemetry.ts`

## Eval artifact expectations

The harness should eventually emit artifacts under `artifacts/evals/`, such as:

- machine-readable result summaries
- per-trial traces or transcripts
- screenshots when a UI flow is part of grading
- structured failure reasons

The first committed runner now writes:

- `artifacts/evals/decision-assist/<timestamp>/`
- `artifacts/evals/planner/<timestamp>/`
- `artifacts/evals/<suite>/latest.json`

and exposes:

- `npm run eval:agent`
- `npm run eval:decision-assist`
- `npm run eval:mcp`
- `npm run eval:planner`
- `npm run eval:all`

The runner executes against the current compiled `dist/` output after
`npx tsc` so eval behavior matches the server/runtime path without introducing a
separate ts-node-only harness path.

## Planned suite split

- decision-assist evals
- planner evals
- agent evals
- MCP evals
- UI smoke evals where a browser-grade artifact is valuable

## Grading guidance

Use code-based graders first:

- final DB state
- HTTP/API response shape
- tool-call sequence
- forbidden-action checks
- telemetry emission
- UI assertions

LLM-judge grading can be added later only for areas where deterministic grading
cannot reasonably capture quality, such as rationale quality or prioritization
quality.

## Current first-pass suites

Decision-assist:

- regression cases for valid and invalid contract fixtures
- capability checks for today-plan output shape and telemetry emission

Planner:

- regression cases for suggest-mode planning, existing next-action reuse, and
  weekly-review findings
- capability checks for apply-mode task creation and deterministic next-work
  ranking

Agent:

- regression cases for manifest discoverability and read-envelope behavior
- capability checks for idempotent writes and planner-backed agent flows

MCP:

- regression cases for auth challenge and scope-denial behavior
- capability checks for public OAuth-to-tools-list flow and idempotent write
  replay
