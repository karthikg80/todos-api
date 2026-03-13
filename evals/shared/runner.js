const fs = require("fs");
const path = require("path");

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function serializeError(error) {
  if (!(error instanceof Error)) {
    return {
      name: "Error",
      message: String(error),
    };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

async function runTrial(suite, trial, suiteDir) {
  const trialDir = path.join(
    suiteDir,
    "trials",
    `${String(trial.order).padStart(2, "0")}-${slugify(trial.id)}`,
  );
  ensureDir(trialDir);

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  try {
    const output = await trial.run({
      artifactDir: trialDir,
      writeJson: (name, value) => writeJson(path.join(trialDir, name), value),
    });
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedMs;
    writeJson(path.join(trialDir, "result.json"), output ?? {});

    return {
      id: trial.id,
      suite: suite.name,
      type: trial.type,
      description: trial.description,
      status: "passed",
      startedAt,
      completedAt,
      durationMs,
      artifactDir: path.relative(process.cwd(), trialDir),
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedMs;
    writeJson(path.join(trialDir, "error.json"), serializeError(error));

    return {
      id: trial.id,
      suite: suite.name,
      type: trial.type,
      description: trial.description,
      status: "failed",
      startedAt,
      completedAt,
      durationMs,
      artifactDir: path.relative(process.cwd(), trialDir),
      error: serializeError(error),
    };
  }
}

async function runSuite(suite) {
  const runId = nowStamp();
  const suiteDir = path.join(process.cwd(), "artifacts", "evals", suite.name, runId);
  ensureDir(suiteDir);

  const startedAt = new Date().toISOString();
  const trials = [];

  for (const [index, caseDef] of suite.trials.entries()) {
    trials.push(
      await runTrial(
        suite,
        {
          ...caseDef,
          order: index + 1,
        },
        suiteDir,
      ),
    );
  }

  const completedAt = new Date().toISOString();
  const summary = {
    suite: suite.name,
    description: suite.description,
    startedAt,
    completedAt,
    totals: {
      total: trials.length,
      passed: trials.filter((trial) => trial.status === "passed").length,
      failed: trials.filter((trial) => trial.status === "failed").length,
      regression: trials.filter((trial) => trial.type === "regression").length,
      capability: trials.filter((trial) => trial.type === "capability").length,
    },
    trials,
  };

  writeJson(path.join(suiteDir, "report.json"), summary);
  writeJson(
    path.join(process.cwd(), "artifacts", "evals", suite.name, "latest.json"),
    summary,
  );

  return {
    ...summary,
    runId,
    artifactDir: path.relative(process.cwd(), suiteDir),
  };
}

async function runSuites(suites) {
  const results = [];
  for (const suite of suites) {
    results.push(await runSuite(suite));
  }

  const summary = {
    startedAt: results[0]?.startedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
    suites: results.map((suite) => ({
      suite: suite.suite,
      totals: suite.totals,
      artifactDir: suite.artifactDir,
    })),
    totals: {
      totalSuites: results.length,
      totalTrials: results.reduce((sum, suite) => sum + suite.totals.total, 0),
      failedSuites: results.filter((suite) => suite.totals.failed > 0).length,
      failedTrials: results.reduce((sum, suite) => sum + suite.totals.failed, 0),
    },
  };

  if (results.length > 1) {
    const aggregateDir = path.join(
      process.cwd(),
      "artifacts",
      "evals",
      "all",
      nowStamp(),
    );
    ensureDir(aggregateDir);
    writeJson(path.join(aggregateDir, "report.json"), summary);
    writeJson(
      path.join(process.cwd(), "artifacts", "evals", "all", "latest.json"),
      summary,
    );
  }

  return summary;
}

module.exports = {
  runSuite,
  runSuites,
};
