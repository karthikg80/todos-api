import fs from "fs";
import path from "path";

import {
  AGENT_JOB_ACTIVITY_POLICIES,
  getFailureNarrationForJob,
  looksUserActionable,
} from "./activityPolicy";

function discoverRunnerJobNames(): string[] {
  const jobsDir = path.resolve(__dirname, "../../../../agent-runner/jobs");
  const entries = fs.readdirSync(jobsDir);

  return entries
    .filter((entry) => entry.endsWith(".py") && entry !== "__init__.py")
    .map((entry) => fs.readFileSync(path.join(jobsDir, entry), "utf8"))
    .map((content) => content.match(/JOB_NAME\s*=\s*"([^"]+)"/)?.[1] ?? null)
    .filter((jobName): jobName is string => Boolean(jobName))
    .sort();
}

describe("agent job activity policy", () => {
  it("defines explicit entries for the current scheduled jobs", () => {
    const runnerJobNames = discoverRunnerJobNames();
    const missingPolicies = runnerJobNames.filter(
      (jobName) => !(jobName in AGENT_JOB_ACTIVITY_POLICIES),
    );

    expect(missingPolicies).toEqual([]);
  });

  it("surfaces actionable failures for user-visible promise jobs", () => {
    expect(
      getFailureNarrationForJob("morning_brief", "Calendar access expired"),
    ).toBe("Morning brief could not be generated: Calendar access expired");
  });

  it("hides non-actionable failures for internal jobs", () => {
    expect(
      getFailureNarrationForJob(
        "evaluator_daily",
        "Timeout while fetching agenda context",
      ),
    ).toBeNull();
  });

  it("falls back to surfacing actionable failures for unmapped jobs", () => {
    expect(
      getFailureNarrationForJob(
        "some_future_job",
        "Missing credentials for downstream provider",
      ),
    ).toBe(
      "some_future_job failed: Missing credentials for downstream provider",
    );
  });

  it("recognizes intervention-oriented auth and permission failures", () => {
    expect(looksUserActionable("Calendar access expired")).toBe(true);
    expect(looksUserActionable("Forbidden: reconnect provider")).toBe(true);
    expect(looksUserActionable("Timeout while fetching agenda context")).toBe(
      false,
    );
  });
});
