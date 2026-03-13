# Evals

Repo-native eval suites live here. They run as deterministic harness checks on
top of the existing services, contracts, and route logic.

Current suites:

- `decision-assist`: output-contract and telemetry evals for decision-assist
  surfaces
- `planner`: deterministic planner behavior evals for suggest/apply flows

Commands:

- `npm run eval:decision-assist`
- `npm run eval:planner`
- `npm run eval:all`

Artifacts are written under `artifacts/evals/` with a timestamped run
directory and a `latest.json` summary per suite.
