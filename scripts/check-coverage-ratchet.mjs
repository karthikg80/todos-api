#!/usr/bin/env node

/**
 * Coverage ratchet — prevents test coverage from regressing.
 *
 * Reads the coverage-summary.json produced by Jest and compares it against
 * the baseline stored in .coverage-baseline.json. Fails if any metric
 * (statements, branches, functions, lines) drops by more than the allowed
 * margin.
 *
 * Usage:
 *   1. Run tests with: npm run test:unit -- --coverage --coverageReporters=json-summary
 *   2. Run this script: node scripts/check-coverage-ratchet.mjs
 *   3. To update the baseline: node scripts/check-coverage-ratchet.mjs --update
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const BASELINE_PATH = join(root, ".coverage-baseline.json");
const SUMMARY_PATH = join(root, "coverage", "coverage-summary.json");
const ALLOWED_DROP = 0.5; // Allow 0.5% drop to account for refactoring

const isUpdate = process.argv.includes("--update");

if (!existsSync(SUMMARY_PATH)) {
  console.error(
    "No coverage-summary.json found. Run tests with --coverage --coverageReporters=json-summary first."
  );
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf-8"));
const current = {
  statements: summary.total.statements.pct,
  branches: summary.total.branches.pct,
  functions: summary.total.functions.pct,
  lines: summary.total.lines.pct,
};

if (isUpdate || !existsSync(BASELINE_PATH)) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n");
  console.log("Coverage baseline updated:");
  console.log(
    `  Statements: ${current.statements}% | Branches: ${current.branches}% | Functions: ${current.functions}% | Lines: ${current.lines}%`
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
const failures = [];

for (const metric of ["statements", "branches", "functions", "lines"]) {
  const drop = baseline[metric] - current[metric];
  if (drop > ALLOWED_DROP) {
    failures.push(
      `${metric}: ${current[metric]}% (was ${baseline[metric]}%, dropped ${drop.toFixed(2)}%)`
    );
  }
}

if (failures.length > 0) {
  console.error("Coverage regression detected:");
  for (const f of failures) {
    console.error(`  ✗ ${f}`);
  }
  console.error(
    "\nFix: add tests for new code or run `node scripts/check-coverage-ratchet.mjs --update` if the drop is intentional."
  );
  process.exit(1);
}

console.log("Coverage ratchet passed:");
for (const metric of ["statements", "branches", "functions", "lines"]) {
  const delta = current[metric] - baseline[metric];
  const sign = delta >= 0 ? "+" : "";
  console.log(
    `  ✓ ${metric}: ${current[metric]}% (baseline ${baseline[metric]}%, ${sign}${delta.toFixed(2)}%)`
  );
}
