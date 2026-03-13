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
