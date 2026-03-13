const { runSuites } = require("./shared/runner");
const agentSuite = require("./agent/suite");
const decisionAssistSuite = require("./decision-assist/suite");
const mcpSuite = require("./mcp/suite");
const plannerSuite = require("./planner/suite");

const suiteMap = new Map([
  ["agent", agentSuite],
  ["decision-assist", decisionAssistSuite],
  ["mcp", mcpSuite],
  ["planner", plannerSuite],
]);

async function main() {
  const requested = process.argv[2];
  if (!requested || (requested !== "all" && !suiteMap.has(requested))) {
    console.error(
      "Usage: node evals/run-suite.js <agent|decision-assist|mcp|planner|all>",
    );
    process.exit(1);
  }

  const suites =
    requested === "all" ? Array.from(suiteMap.values()) : [suiteMap.get(requested)];
  const summary = await runSuites(suites);

  const failed = summary.totals.failedTrials;
  const output = {
    suites: summary.suites,
    totals: summary.totals,
  };
  console.info(JSON.stringify(output, null, 2));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
