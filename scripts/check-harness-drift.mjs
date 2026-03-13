import { scanHarnessDrift } from "./harness/harness-checks.mjs";

const result = await scanHarnessDrift();

for (const warning of result.warnings) {
  console.warn(`warning [${warning.code}] ${warning.message}`);
}

if (result.errors.length > 0) {
  console.error("Harness drift check failed:");
  for (const error of result.errors) {
    console.error(`- [${error.code}] ${error.message}`);
    const extras = error.matches || error.actions || error.files || error.rows;
    if (Array.isArray(extras)) {
      for (const entry of extras) {
        console.error(`  ${entry}`);
      }
    }
  }
  process.exit(1);
}

console.log("Harness drift check passed.");
