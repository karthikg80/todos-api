/** Canonical metric type names for the learning loop.
 *
 * Naming convention: <namespace>.<entity>.<event_or_measure>
 *
 * Decision events   — emitted when the system recommends or creates something
 * Outcome events    — emitted when reality happens afterward
 * System snapshots  — emitted by evaluator jobs as periodic health measures
 */

export const CANONICAL_METRIC_TYPES = [
  // ── Decision events ────────────────────────────────────────────────────────
  "planner.recommend_task",
  "planner.exclude_task",
  "planner.plan.budget_minutes",
  "review.action.applied",
  "review.action.rejected",
  "automation.followup.created",
  "automation.next_action.created",
  "automation.home_focus.generated",
  "automation.home_focus.reused",
  "automation.home_focus.snapshot_age_hours",

  // ── Outcome events ─────────────────────────────────────────────────────────
  "task.completed_after_recommendation",
  "task.completed_without_recommendation",
  "task.deferred_after_recommendation",
  "task.archived_auto_created",
  "automation.followup.completed_7d",
  "automation.next_action.completed_7d",

  // ── System health snapshots (emitted by evaluator jobs) ────────────────────
  "system.stale_task.count",
  "system.waiting_task.count",
  "system.inbox_backlog.count",
  "system.projects_without_next_action.count",
  "planner.acceptance_rate",
  "planner.exclusion_regret",
  "automation.followup.usefulness_rate",
  "automation.dead_letter.count",
  "agent.job_success_rate",
] as const;

export type CanonicalMetricType = (typeof CANONICAL_METRIC_TYPES)[number];

export function isCanonicalMetricType(
  value: string,
): value is CanonicalMetricType {
  return (CANONICAL_METRIC_TYPES as readonly string[]).includes(value);
}
