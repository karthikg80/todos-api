# Planner Runtime

Concise architecture note for the planner layer that sits above the canonical
task/project services and below MCP, AI, and UI surfaces.

## Layering

Planner flows now route through one shared runtime:

- MCP tools / AI routes / UI routes
- `PlannerService`
- planner engines
- canonical `projectService` / `todoService`
- database

This keeps planning behavior reusable without creating a parallel
task/project business-logic stack.

## Current Engines

- `ProjectPlanningEngine`
  - builds project task plans
  - derives next actions
  - prevents duplicate next-action creation
- `ReviewEngine`
  - builds weekly-review summaries
  - generates findings and safe recommendations
  - powers project-health analysis
- `DecisionEngine`
  - ranks the best next tasks to work on
  - stays deterministic and read-only in the current runtime
- `WorkGraphEngine`
  - analyzes dependency state
  - classifies blocked vs unblocked work
  - returns critical-path and parallel-work views

## Current Tool Mapping

- `plan_project` -> `PlannerService.planProject()` -> `ProjectPlanningEngine`
- `ensure_next_action` -> `PlannerService.ensureNextAction()` -> `ProjectPlanningEngine`
- `weekly_review` -> `PlannerService.weeklyReview()` -> `ReviewEngine`
- `decide_next_work` -> `PlannerService.decideNextWork()` -> `DecisionEngine`
- `analyze_project_health` -> `PlannerService.analyzeProjectHealth()` -> `ReviewEngine`
- `analyze_work_graph` -> `PlannerService.analyzeWorkGraph()` -> `WorkGraphEngine`
- Home `home_focus` suggestion generation -> `AiPlannerService` ->
  `PlannerService.decideNextWork()` -> `DecisionEngine`

## Scope and Mutation Rules

- `plan_project`, `ensure_next_action`, and `weekly_review` are mode-aware:
  - `mode: "suggest"` is read-only
  - `mode: "apply"` creates safe follow-up work through the canonical task
    service
- `decide_next_work`, `analyze_project_health`, and `analyze_work_graph` are
  read-only analysis tools in the current runtime
- all reads and writes remain scoped to the authenticated user
- planner code never calls MCP tools recursively; it uses the underlying
  services directly

## Current Limitations

- planner reasoning is deterministic-first and explainable; it is not an LLM
  planning engine
- `weekly_review` apply mode only performs safe starter actions such as
  creating a next action
- planner and agent project matching are `projectId`-only now; any remaining
  `category` compatibility debt lives in the canonical task/project services,
  not inside the planner runtime
- Home keeps its deterministic client fallback when the planner-backed AI path
  abstains or fails; the reuse today is in backend focus suggestion generation,
  not a full dashboard rewrite
- broader UI surfaces can reuse this runtime later, but are not yet routed
  through it
