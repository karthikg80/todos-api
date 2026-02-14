# 07-roadmap-pr-breakdown.md

## PR Sequence

| PR  | Scope                                                  | Acceptance Criteria                                                                                                                                                                                           | Test Focus                                      |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| PR1 | Output contracts, validator harness, stub generator    | strict schema checks pass; per-suggestion reject + payload key stripping; require `contractVersion` + `suggestionId`; enforce surface-based `todoId` targeting; enforce past-date `requiresConfirmation` rule | unit tests for contracts and reject rules       |
| PR2 | Task critic panel UI in drawer using mocked JSON       | deterministic render of known types; 3-6 card cap; Apply/Dismiss controls                                                                                                                                     | UI smoke tests desktop/mobile                   |
| PR3 | Real `AiSuggestion` persistence + apply/dismiss        | suggestions saved as `pending`; status transitions on user actions; applied links written                                                                                                                     | integration tests for DB writes and transitions |
| PR4 | On-create assist chips + apply flow                    | chips appear post-title entry; per-chip apply updates todo fields safely                                                                                                                                      | component + integration tests                   |
| PR5 | Guardrails, undo, telemetry logging                    | undo available for each apply; guardrail blocks enforced; `requiresConfirmation` flows enforced; events logged at `suggestionId` granularity                                                                  | integration tests for undo/throttle/guardrails  |
| PR6 | Plan-from-goal MVP in Today view                       | preview plan with top N, checkboxes, selective apply, no auto-apply                                                                                                                                           | end-to-end flow tests                           |
| PR7 | Category/projectId mapping and migration-safe behavior | normalized-first read works; fallback preserved; no data corruption; project create only via `propose_create_project` + explicit confirmation                                                                 | migration safety + edge-case tests              |
| PR8 | Eval harness + golden regression set                   | stable quality checks across prompts/outputs; drift alerts actionable                                                                                                                                         | offline eval + CI regression gates              |

## Cross-PR Acceptance Rules

- No raw model text rendered in user UI.
- No apply without explicit user action.
- All applied changes are reversible.
- All AI output passes validator before render/apply.

## Top Risks and Mitigations

| Risk                             | Impact                  | Mitigation                                                       |
| -------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| Overconfident suggestions        | bad edits, trust loss   | confidence gating + abstain policy + undo metrics                |
| Category/project drift           | inconsistent metadata   | normalized-first strategy + explicit mapping rules + sync policy |
| Latency/cost                     | poor UX, budget overrun | bounded context payloads + caching + rate controls               |
| Trust erosion from inconsistency | feature abandonment     | deterministic UI phrasing + stable contracts + audits            |
| Prompt drift without eval        | regressions over time   | golden-set regression tests + release gates + periodic review    |

## Release Readiness Checklist

- Contract validator coverage complete.
- Telemetry dashboards for acceptance/undo/reject live, plus view rate, time-to-first-apply, abstain by surface, undo by type.
- Guardrail failures visible and non-fatal.
- Accessibility checks pass for keyboard and screen readers.
- Rollout plan includes feature flag and staged enablement.
