import { scanArchitectureInvariants } from "./harness/harness-checks.mjs";

const result = await scanArchitectureInvariants();

for (const warning of result.warnings) {
  console.warn(`warning [${warning.code}] ${warning.message}`);
}

if (result.errors.length > 0) {
  console.error("Architecture invariant check failed:");
  for (const error of result.errors) {
    console.error(`- [${error.code}] ${error.message}`);
    const detailList =
      error.matches ?? error.actions ?? error.files ?? error.rows;
    if (Array.isArray(detailList)) {
      for (const item of detailList) {
        console.error(`  ${item}`);
      }
    }
    if (error.details) {
      console.error(`  ${JSON.stringify(error.details)}`);
    }
  }
  process.exit(1);
}

console.log("Architecture invariant guard passed.");
