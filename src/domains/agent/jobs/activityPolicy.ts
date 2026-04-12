export type FailureVisibility = "never" | "actionable_only" | "always";

export interface AgentJobActivityPolicy {
  jobName: string;
  userVisible: boolean;
  promiseLabel?: string;
  failureVisibility: FailureVisibility;
  failureNarration?: (
    errorMessage: string,
    metadata?: Record<string, unknown>,
  ) => string | null;
}

const USER_INTERVENTION_PATTERNS = [
  /expired/i,
  /unauthori[sz]ed/i,
  /forbidden/i,
  /permission/i,
  /access denied/i,
  /re-?auth/i,
  /reconnect/i,
  /missing credentials/i,
  /missing token/i,
];

function trimErrorDetail(errorMessage: string): string {
  const detail = errorMessage.trim().replace(/\s+/g, " ").slice(0, 220);
  return detail || "Unknown error";
}

function defaultFailureNarration(
  jobName: string,
  errorMessage: string,
  metadata?: Record<string, unknown>,
): string {
  const detail = trimErrorDetail(errorMessage);
  const count =
    typeof metadata?.reminderCount === "number"
      ? metadata.reminderCount
      : typeof metadata?.deliveryCount === "number"
        ? metadata.deliveryCount
        : null;

  if (jobName === "task_reminder" && count !== null) {
    return `${count} reminders were not sent: ${detail}`;
  }

  return `${jobName} failed: ${detail}`;
}

export const AGENT_JOB_ACTIVITY_POLICIES: Record<
  string,
  AgentJobActivityPolicy
> = {
  morning_brief: {
    jobName: "morning_brief",
    userVisible: true,
    promiseLabel: "deliver your morning brief",
    failureVisibility: "actionable_only",
    failureNarration: (errorMessage) =>
      `Morning brief could not be generated: ${trimErrorDetail(errorMessage)}`,
  },
  task_reminder: {
    jobName: "task_reminder",
    userVisible: true,
    promiseLabel: "send scheduled reminders",
    failureVisibility: "actionable_only",
    failureNarration: (errorMessage, metadata) =>
      defaultFailureNarration("task_reminder", errorMessage, metadata),
  },
  project_health_intervention: {
    jobName: "project_health_intervention",
    userVisible: true,
    promiseLabel: "review project health",
    failureVisibility: "actionable_only",
    failureNarration: (errorMessage) =>
      `Project health review did not complete: ${trimErrorDetail(errorMessage)}`,
  },
  daily_plan: {
    jobName: "daily_plan",
    userVisible: false,
    failureVisibility: "never",
  },
  weekly_review: {
    jobName: "weekly_review",
    userVisible: false,
    failureVisibility: "never",
  },
  decomposer: {
    jobName: "decomposer",
    userVisible: false,
    failureVisibility: "never",
  },
  inbox_triage: {
    jobName: "inbox_triage",
    userVisible: false,
    failureVisibility: "never",
  },
  compute_insights: {
    jobName: "compute_insights",
    userVisible: false,
    failureVisibility: "never",
  },
  home_focus_prewarm: {
    jobName: "home_focus_prewarm",
    userVisible: false,
    failureVisibility: "never",
  },
  data_retention: {
    jobName: "data_retention",
    userVisible: false,
    failureVisibility: "never",
  },
  evaluator_daily: {
    jobName: "evaluator_daily",
    userVisible: false,
    failureVisibility: "never",
  },
  evaluator_weekly: {
    jobName: "evaluator_weekly",
    userVisible: false,
    failureVisibility: "never",
  },
  watchdog: {
    jobName: "watchdog",
    userVisible: false,
    failureVisibility: "never",
  },
};

export function looksUserActionable(errorMessage: string): boolean {
  return USER_INTERVENTION_PATTERNS.some((pattern) =>
    pattern.test(errorMessage),
  );
}

export function getFailureNarrationForJob(
  jobName: string,
  errorMessage: string,
  metadata?: Record<string, unknown>,
): string | null {
  const policy = AGENT_JOB_ACTIVITY_POLICIES[jobName];

  if (!policy) {
    return looksUserActionable(errorMessage)
      ? defaultFailureNarration(jobName, errorMessage, metadata)
      : null;
  }

  switch (policy.failureVisibility) {
    case "never":
      return null;
    case "always":
      return (
        policy.failureNarration?.(errorMessage, metadata) ??
        defaultFailureNarration(jobName, errorMessage, metadata)
      );
    case "actionable_only":
      if (!looksUserActionable(errorMessage)) {
        return null;
      }
      return (
        policy.failureNarration?.(errorMessage, metadata) ??
        defaultFailureNarration(jobName, errorMessage, metadata)
      );
  }
}
