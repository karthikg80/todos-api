# Evals

Repo-native eval suites live here. They run as deterministic harness checks on
top of the existing services, contracts, and route logic.

Current suites:

- `agent`: structured evals for the internal `/agent` read/write surface
- `decision-assist`: output-contract and telemetry evals for decision-assist
  surfaces
- `mcp`: auth, scope, discovery, and representative write-flow evals for `/mcp`
  plus the frozen Phase 1 native-app golden prompts in
  `mcp/native-golden-prompts.json`
- `plugin`: Phase 2 six-tool/resource contract checks plus Today Plan direct,
  indirect, follow-up, write, negative, prompt-injection, fallback, and
  component-sequence fixtures in `plugin/today-plan-golden-prompts.json`
- `planner`: deterministic planner behavior evals for suggest/apply flows

Commands:

- `npm run eval:agent`
- `npm run eval:decision-assist`
- `npm run eval:mcp`
- `npm run eval:plugin`
- `npm run eval:planner`
- `npm run eval:all`

Artifacts are written under `artifacts/evals/` with a timestamped run
directory and a `latest.json` summary per suite.
