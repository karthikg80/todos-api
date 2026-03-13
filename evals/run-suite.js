const { runSuites } = require("./shared/runner");
const decisionAssistSuite = require("./decision-assist/suite");
const plannerSuite = require("./planner/suite");

const suiteMap = new Map([
  ["decision-assist", decisionAssistSuite],
  ["planner", plannerSuite],
]);

async function main() {
  const requested = process.argv[2];
  if (!requested || (requested !== "all" && !suiteMap.has(requested))) {
    console.error(
      "Usage: node evals/run-suite.js <decision-assist|planner|all>",
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
