# ADR-007: iOS and Python contract sync mechanism

## Status

Accepted (2026-04-19)

Implements [Epic 1 / Story 1.3](../engineering-backlog.md). Follows [ADR-006](006-transport-contract-source-of-truth.md), which set the higher-level direction (transport defined by Zod schemas; iOS and Python hand-maintained with documented sync paths).

## Context

ADR-006 committed to hand-maintained iOS DTOs and Python typed wrappers rather than introducing code generators for those surfaces. It did not specify _how_ those hand-maintained layers stay in sync with the transport contract. This ADR fills that gap.

### Verified current state

**iOS (`ios/TodosApp/TodosApp/Core/Models/`):**

- `TodoDTO.swift`, `ProjectDTO.swift`, `SubtaskDTO.swift`, `HeadingDTO.swift`, `UserDTO.swift`, `AuthModels.swift`, `Enums.swift` — seven hand-maintained files decoding JSON responses via `ISO8601DateFormatter` into Swift structs.
- CI runs `swift build` in the `cross-client-sync` job on `macos-latest` when shared contracts change (`.github/workflows/ci.yml` L347–377). There is no property-level drift check — a Swift struct missing a field the backend returns compiles fine and only fails at decode time.

**Python (`agent-runner/`):**

- `mcp_client.py` is a generic action dispatcher: `client.read(action, params)` and `client.write(action, params)` return `dict[str, Any]`. No typed response shapes anywhere.
- Inventory of actions actually consumed across `agent-runner/jobs/*.py`:
  - Reads (4): `analyze_project_health`, `suggest_next_actions`, `list_projects_without_next_action`, `plan_today`
  - Writes (6): `triage_inbox`, `generate_morning_brief`, `project_health_intervention`, `run_data_retention`, `send_task_reminder`, `create_task`
  - Non-agent: `post_api("/insights/compute", ...)` from `jobs/insights.py`

These are the surfaces that need a sync mechanism.

## Decision

### iOS: hand-maintained DTOs + automated CI drift check

**Mechanism:** A new script at `scripts/check-ios-dto-drift.mjs` runs in CI and compares the top-level property names of each Swift DTO struct against the OpenAPI spec's schema definitions for the equivalent type.

- **Swift parsing:** regex-based, scanning `ios/TodosApp/TodosApp/Core/Models/*.swift` for `struct <Name>DTO` / `struct <Name>` blocks and their `let <name>:` / `var <name>:` property declarations. A full Swift parser is out of scope; property-name-level drift catches the failure mode that matters (new or renamed wire fields).
- **OpenAPI source:** the spec currently lives in `src/swagger.ts` (hand-written). Story 1.2 will replace that with a generator over Zod schemas. Until the generator lands, the drift check runs in **warning mode** (non-fatal) because `src/swagger.ts` is itself known to drift from the runtime and would produce false positives. It flips to **failing mode** the moment Story 1.2 lands a generated OpenAPI JSON that the runtime validates against.
- **CI wiring:** extend the existing `cross-client-sync` job (already runs on `macos-latest` for `swift build`). Add the drift check after the Swift build step. Update the job's path filter so it also triggers on `ios/TodosApp/TodosApp/Core/Models/**` and (post-1.2) `src/transport/**`.

**What this does not catch (accepted):**

- **Optionality mismatches** (e.g., backend-required vs Swift optional). Property names are sufficient to catch the failure modes that routinely bite us; typed optionality drift is rarer and is better caught by runtime decode tests.
- **Nested type drift** (e.g., an enum value added on the server). This is caught by `swift build` when the enum type changes in `Enums.swift` via the standard shared-contract path; the drift check doesn't replicate it.

### Python (agent-runner): typed facade over the action dispatcher

**Mechanism:** a new `agent-runner/agent_api_types.py` (or equivalent) with plain `@dataclass` request and response types for each consumed action.

- **No runtime validation.** Types are documentation + statically checkable when Story 2.1 lands `mypy` in CI. Adopting `pydantic` or `msgspec` would solve validation but adds toolchain cost disproportionate to the 10-action surface.
- **Typed facade pattern** rather than a rewrite of `mcp_client.py`. New methods on `AgentClient` (or a thin subclass) take a dataclass and return a parsed dataclass, delegating to the existing `self.read(action, params)` / `self.write(action, params)` under the hood. Call sites in `agent-runner/jobs/*.py` migrate incrementally — the generic dispatcher remains available for one-off or experimental actions.
- **Scope:** type the 10 actions above and the `/insights/compute` helper. Everything else stays dict-based until its volume grows.

### What's manual vs automated

| Surface                 | Authoring                  | Drift detection                                                                                         |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| React (Story 1.2)       | Generated from Zod         | Runtime validation (Zod at route boundary) + typecheck on inferred types                                |
| iOS                     | Manual DTO files           | Automated `scripts/check-ios-dto-drift.mjs` in `cross-client-sync` (warning-only pre-1.2, failing post) |
| Python (`agent-runner`) | Manual `@dataclass` facade | `mypy` at author time (once Story 2.1 lands); PR-template checklist for cross-client-affecting changes  |

### PR template update

Add a "Shared contract" subsection to `.github/pull_request_template.md` so reviewers ask the right question when a transport schema changes. See the diff in this PR.

### Triggers to revisit

- **iOS → `swift-openapi-generator`:** adopt if (a) two or more drift incidents occur in a quarter despite the CI check, or (b) `swift-openapi-generator` matures enough that the toolchain cost of adding a Swift codegen step into CI becomes negligible.
- **Python → `pydantic` / `msgspec`:** adopt if `agent-runner` starts consuming more than ~15 actions, or if runtime validation of agent responses becomes important for debugging.

## Implementation phasing

This ADR is the decision artifact. Code lands in separate PRs:

1. **Phase B — iOS drift check.** Can ship in warning-only mode before Story 1.2; flips to failing mode once the generated OpenAPI JSON is in place.
2. **Phase C — Python typed facade.** Add `agent-runner/agent_api_types.py`, migrate one representative job (probably `daily.py`) to the typed facade as a template, and document the sync checklist.

Neither phase is blocked on the other.

## Non-goals (explicit)

- Not adopting `swift-openapi-generator`.
- Not adopting `pydantic` or `msgspec`.
- Not moving `agent-runner` off the action-dispatcher `mcp_client.py` structure.
- Not changing any on-the-wire payloads.
- Not implementing the drift check or typed facade in this PR — that's Phase B and Phase C.

## Consequences

### Positive

- iOS drift becomes visible at CI time rather than at runtime decode failure.
- Python job code reads with typed call sites even though the transport layer remains dict-based.
- Both sync paths are explicit, documented, and have named upgrade triggers.

### Negative / accepted costs

- Regex-based Swift parsing is approximate. The check catches the property-name failure mode, not every possible drift. Accepted because the alternatives (full Swift parser dependency or `swift-openapi-generator`) cost more than they save at the current drift rate.
- The typed facade and the generic dispatcher coexist in `agent-runner`. Acceptable if the coexistence window is measured in sprints; revisit if it persists past mid-2026.
- Pre-Story-1.2 the drift check can warn-only, which is weaker than failing. This is a feature, not a bug — a failing check against a known-stale hand-written spec would produce noise rather than signal.

## References

- [ADR-006](006-transport-contract-source-of-truth.md) — transport contract source of truth
- `ios/TodosApp/TodosApp/Core/Models/*.swift` — hand-maintained Swift DTOs
- `agent-runner/mcp_client.py` — action dispatcher
- `agent-runner/jobs/*.py` — action consumers (10 distinct actions + one direct API path)
- `.github/workflows/ci.yml` — `cross-client-sync` job (L347–377)
- `.github/pull_request_template.md` — updated with shared-contract checklist in this PR
