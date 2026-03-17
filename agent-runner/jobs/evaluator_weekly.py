"""
Weekly evaluator job — evaluates automation quality and system health trends.

Called from main.py once per enrolled user. Runs weekly (Railway cron 0 3 * * 1).
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

from mcp_client import AgentApiError, AgentClient
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "evaluator_weekly"


def _iso_week_period_key() -> str:
    """Return the ISO week key for the previous week, e.g. '2026-W10'."""
    today = date.today()
    # isocalendar() returns (year, week, weekday)
    iso = today.isocalendar()
    # Target last week
    prev = today.fromisocalendar(iso[0], iso[1] - 1 if iso[1] > 1 else 52, 1)
    prev_iso = prev.isocalendar()
    return f"{prev_iso[0]}-W{str(prev_iso[1]).zfill(2)}"


def run_evaluator_weekly_for_user(
    client: AgentClient,
    user_id: str,
    *args: Any,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Evaluate last week's automation quality and emit system health metrics.

    Steps:
      1. Claim the weekly evaluator job run (idempotent by ISO week).
      2. Call evaluate_weekly_system for last week (weekOffset=-1).
      3. Emit automation.followup.usefulness_rate metric.
      4. Complete the run.
    """
    period_key = _iso_week_period_key()
    state = JobRunState()

    # 1. Claim
    try:
        run = client.call(
            "claim_job_run",
            {"jobName": JOB_NAME, "periodKey": period_key},
        )
        run_id = run["data"]["run"]["id"]
        state.set_run_id(run_id)
        logger.info(
            "evaluator_weekly claimed run %s for %s", run_id, period_key
        )
    except AgentApiError as e:
        if "already claimed" in str(e).lower() or e.status_code == 409:
            logger.info(
                "evaluator_weekly already ran for %s, skipping", period_key
            )
            return {"skipped": True, "week": period_key}
        raise

    try:
        # 2. Evaluate last week
        eval_resp = client.call(
            "evaluate_weekly_system",
            {"weekOffset": -1},
        )
        evaluation = eval_resp["data"]["evaluation"]
        logger.info(
            "evaluator_weekly %s: automationSuccess=%.2f followupUsefulness=%.2f stale=%d",
            period_key,
            evaluation.get("automationSuccessRate", 0),
            evaluation.get("followupUsefulnessRate", 0),
            evaluation.get("staleTaskCount", 0),
        )

        # 3. Emit health snapshot metrics
        snapshot_metrics = [
            (
                "automation.followup.usefulness_rate",
                evaluation.get("followupUsefulnessRate", 0),
            ),
            ("system.stale_task.count", evaluation.get("staleTaskCount", 0)),
            (
                "system.waiting_task.count",
                evaluation.get("waitingTaskCount", 0),
            ),
            (
                "system.inbox_backlog.count",
                evaluation.get("inboxBacklogCount", 0),
            ),
        ]
        for metric_type, value in snapshot_metrics:
            try:
                client.call(
                    "record_metric",
                    {
                        "jobName": JOB_NAME,
                        "periodKey": period_key,
                        "metricType": metric_type,
                        "value": value,
                        "metadata": {"week": evaluation.get("week")},
                    },
                )
            except AgentApiError as metric_err:
                logger.warning(
                    "evaluator_weekly: failed to record %s: %s",
                    metric_type,
                    metric_err,
                )

        # 4. Complete
        client.call(
            "complete_job_run",
            {
                "jobName": JOB_NAME,
                "periodKey": period_key,
                "metadata": {
                    "week": evaluation.get("week"),
                    "automationSuccessRate": evaluation.get(
                        "automationSuccessRate"
                    ),
                    "configRecommendationCount": len(
                        evaluation.get("configRecommendations", [])
                    ),
                },
            },
        )
        return {"ok": True, "week": period_key, "evaluation": evaluation}

    except Exception as exc:
        logger.exception("evaluator_weekly failed for %s: %s", period_key, exc)
        try:
            client.call(
                "fail_job_run",
                {
                    "jobName": JOB_NAME,
                    "periodKey": period_key,
                    "errorMessage": str(exc)[:500],
                },
            )
        except AgentApiError:
            pass
        raise
