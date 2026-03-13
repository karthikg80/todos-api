import { writeCleanupReport } from "./harness-checks.mjs";

const { reportDir, report } = await writeCleanupReport();

console.log(`Harness cleanup report written to ${reportDir}`);
console.log(
  JSON.stringify(
    {
      architectureErrors: report.architecture.errors.length,
      architectureWarnings: report.architecture.warnings.length,
      driftErrors: report.drift.errors.length,
      driftWarnings: report.drift.warnings.length,
    },
    null,
    2,
  ),
);
