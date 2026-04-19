# ADR-006: Transport contract source of truth

## Status

Accepted (2026-04-19)

Implements [Epic 1 / Story 1.1](../engineering-backlog.md) from the repo-grounded engineering backlog.

## Context

The repo currently maintains the same API shape in five places, with real
drift between them:

| Surface             | File                                        | Date shape                                                       | Source                                                        |
| ------------------- | ------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Backend domain      | `src/types.ts`                              | `Date` objects (e.g. `createdAt: Date` at line 85)               | Canonical for backend business logic                          |
| OpenAPI description | `src/swagger.ts`                            | ISO strings                                                      | Hand-written declarative spec; 507 lines; not route-annotated |
| Web transport       | `client-react/src/types/index.ts`           | `string \| null` (e.g. `completedAt?: string \| null` at line 8) | Hand-maintained, duplicated                                   |
| iOS DTOs            | `ios/TodosApp/TodosApp/Core/Models/*.swift` | Decoded to `Date` via ISO8601 formatters                         | Hand-maintained                                               |
| Python client       | `agent-runner/mcp_client.py`                | Dict access, mostly untyped                                      | No types at all                                               |

This causes three concrete problems:

1. **Transport vs domain conflation.** `src/types.ts` is described as "the
   source of truth for all API types" across `AGENTS.md`, multiple `SKILL.md`
   files, and `client-react/AGENTS.md`, but it uses `Date` objects that never
   cross the wire. Clients cannot consume `src/types.ts` verbatim; they
   re-declare transport shapes with string dates.
2. **OpenAPI is decorative, not generated.** `src/swagger.ts` is hand-written
   and can silently drift from real responses. Nothing in the runtime
   validates that routes conform to it.
3. **No defined sync path for iOS or Python.** When backend types change, iOS
   and Python updates are implicit follow-ups done manually. Cross-client
   drift is caught only when a reviewer remembers or when a decoder fails at
   runtime.

Baseline observability (logs, request IDs, route latency) and health probes
already exist — this ADR does not re-open those. It defines how transport
contracts are expressed and kept in sync, nothing more.

## Decision

### Source of truth

**Transport DTOs are defined by Zod schemas in a new `src/transport/`
directory. TypeScript transport types are inferred from those schemas via
`z.infer`. The OpenAPI spec is generated from the same schemas and replaces
the hand-written `src/swagger.ts`.**

- `src/types.ts` remains canonical for **backend domain types** (internal
  shapes used by services and Prisma adapters). It keeps `Date` objects,
  computed fields, and internal unions. It is not a client-facing contract.
- `src/transport/` (new, added in Story 1.2) holds Zod schemas for every
  endpoint's request/response payloads. Inferred types (`z.infer<typeof
TodoDto>`) are the canonical transport types.
- Backend request validation and response serialization go through the same
  Zod schemas at the route boundary. This closes the gap between "the spec"
  and "what the runtime actually does".
- OpenAPI is produced by `@asteasolutions/zod-to-openapi` (or an equivalent
  pure-output library) at build time. `src/swagger.ts` becomes a
  thin invocation of the generator.

### Date and time handling

**All transport DTOs use ISO 8601 strings** (`z.string().datetime({ offset:
true })` in Zod) for date/time fields. No `Date` instances, Prisma objects,
or server-local formats cross the wire.

- Domain types in `src/types.ts` keep `Date` where useful for internal logic.
- Mapping happens in a thin `src/transport/mappers.ts` (or adjacent to each
  service) where domain shapes convert to and from DTO shapes.
- Clients parse ISO strings to their platform's datetime type (React:
  `new Date(...)` on demand; iOS: `ISO8601DateFormatter`; Python:
  `datetime.fromisoformat`).

### What each client consumes

| Client                    | What it consumes                                                                                 | Sync guarantee                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Backend routes**        | Zod schemas directly                                                                             | Runtime validation — cannot drift                                                                  |
| **React (client-react)**  | `z.infer`-inferred TS types via path alias `@transport/*` into the root `src/transport/`         | Typecheck fails on drift                                                                           |
| **iOS (TodosApp)**        | Hand-maintained Swift DTOs, mirrored to the generated OpenAPI spec                               | CI contract-drift check compares Swift struct field names against the OpenAPI JSON (see Story 1.3) |
| **Python (agent-runner)** | Hand-written typed dataclass wrappers in `mcp_client.py` for the 2–3 endpoints it actually calls | Manual sync with a documented review checklist (see Story 1.3)                                     |

No code generator is introduced for iOS or Python in this phase. Generators
add meaningful toolchain weight and the repo has not yet felt enough drift
pain to justify them. Story 1.3 will reassess after Story 1.2 lands.

### Why Zod, not OpenAPI-first

Considered alternatives:

| Option                                                                                 | Pros                                                                                                                                                                                          | Cons                                                                                                                                               | Verdict                                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **A. Keep `src/types.ts` + hand-written `swagger.ts`; just document separation.**      | Zero migration cost.                                                                                                                                                                          | Drift keeps happening; OpenAPI stays decorative; no backend validation win.                                                                        | Rejected — does not meet Story 1.1 goal.                                                        |
| **B. OpenAPI-first with generators for every client.**                                 | Industry-standard; each client gets native generated code.                                                                                                                                    | Heavy multi-generator toolchain; iOS and Python code-gen requires CI investment; migrates all clients at once.                                     | Rejected for now — too much blast radius for Story 1.1. Revisit in Story 1.3 if drift persists. |
| **C. Zod schemas as source; OpenAPI generated from them; manual sync for iOS/Python.** | Single source covers both static (inferred types) and runtime (validation); OpenAPI stays honest because it is generated; incremental React migration; iOS/Python opt in when pain justifies. | Introduces one new dependency family (`zod`, `@asteasolutions/zod-to-openapi`); requires a migration pass on existing `src/validation/` over time. | **Selected.**                                                                                   |
| **D. Plain TypeScript transport types in a shared package; no runtime validation.**    | Minimal toolchain.                                                                                                                                                                            | Loses the runtime-validation benefit; OpenAPI still has to be synced manually.                                                                     | Rejected — transport without validation is still a drift vector.                                |

## Migration steps

These map directly to the downstream stories in the backlog. Story 1.1 does
**not** execute any of them — it only names them.

### Story 1.2 — React consumes generated or shared transport types

1. Add `zod` and `@asteasolutions/zod-to-openapi` to the backend workspace.
2. Introduce `src/transport/` with one schemas file per resource (start with
   `todo.ts`, `project.ts`, `user.ts`).
3. Wire Zod validation into the three affected routers first
   (`preferencesRouter`, `adaptationRouter`, `agentActivityRouter` — these
   overlap with Story 4.1's extraction work).
4. Delete overlapping types from `client-react/src/types/index.ts`. Replace
   them with `import type { TodoDto } from "@transport/todo"` via a
   `tsconfig` path alias that resolves to root `src/transport/`.
5. Replace `src/swagger.ts` internals with a generator invocation that
   walks the Zod schemas.

### Story 1.3 — iOS and Python sync path

1. **iOS:** keep hand-maintained DTOs. Add a CI job that parses the generated
   OpenAPI JSON and compares top-level field names of `TodoDTO`,
   `ProjectDTO`, `UserDTO` against the spec. Fail the job on mismatch. Re-
   evaluate `swift-openapi-generator` adoption once two or more drift
   incidents happen in a quarter.
2. **Python:** keep dict-based consumption in `mcp_client.py`. Add a small
   typed wrapper layer (plain `dataclass`, no generator) for the specific
   read/write actions `agent-runner` calls. Document "when backend DTOs
   change, update the matching Python dataclass" as part of the
   cross-client checklist in the PR template.

### Explicit non-goals

- **Not** migrating `src/validation/` to Zod wholesale. That layer currently
  does boundary validation in its own style; it can be converted endpoint by
  endpoint as Zod schemas are added, or left in place if the duplication
  stays small. A separate ADR can reopen this once evidence accrues.
- **Not** introducing a code generator for iOS or Python.
- **Not** rewriting `src/types.ts`. The domain layer is unchanged; it just
  stops being described as the client-facing contract.
- **Not** changing on-the-wire payloads. DTOs should match what the backend
  currently returns; this ADR is about representation, not protocol.

## Consequences

### Positive

- OpenAPI spec stays honest because it is generated from the same schemas the
  runtime uses.
- Transport types are validated at the boundary, not just statically typed.
- The canonical-source confusion across five docs gets resolved by a single
  pointer: "domain in `src/types.ts`, transport in `src/transport/`".
- Story 4.1's router extraction and this migration can move together — new
  services naturally consume Zod schemas as they are extracted.

### Negative / accepted costs

- One new dependency cluster in the backend (`zod`, `@asteasolutions/zod-to-openapi`).
  Both are widely maintained and size-appropriate.
- Temporary duplication while `src/validation/` and `src/transport/` coexist.
  Acceptable if the coexistence window is measured in sprints, not quarters.
- iOS and Python continue to hand-sync. This is explicit; Story 1.3 monitors
  the drift rate and revisits generators if it crosses a threshold.

### Risks mitigated by doing nothing in this ADR

- No behavior change. No wire-format change. No new runtime dependencies in
  this PR — this ADR is a docs change only. All risk sits in Stories 1.2 and
  1.3 where implementation lands.

## References

- `docs/engineering-backlog.md` — Epic 1, Stories 1.1 / 1.2 / 1.3
- `src/types.ts` (backend domain types)
- `src/swagger.ts` (hand-written OpenAPI, to be replaced by generation in
  Story 1.2)
- `client-react/src/types/index.ts` (transport types to be replaced in Story
  1.2)
- `ios/TodosApp/TodosApp/Core/Models/TodoDTO.swift` (hand-maintained DTO;
  target for Story 1.3 CI drift check)
- `agent-runner/mcp_client.py` (dict-based consumer; target for Story 1.3
  typed wrappers)
