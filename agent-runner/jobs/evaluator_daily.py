"""
Daily evaluator job — evaluates yesterday's planner output vs actual completions.

Called from main.py once per enrolled user. Runs nightly (Railway cron 0 2 * * *).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from mcp_client import AgentApiError, AgentClient
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "evaluator_daily"


def run_evaluator_daily_for_user(
    client: AgentClient,
    user_id: str,
    *args: Any,
    target_date: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Evaluate yesterday's plan quality and emit learning metrics.

    Steps:
      1. Claim the daily evaluator job run (idempotent by date).
      2. Call evaluate_daily_plan for yesterday.
      3. Emit planner.acceptance_rate and planner.exclusion_regret metrics.
      4. Complete the run.
    """
    if target_date is None:
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime(
            "%Y-%m-%d"
        )
    else:
        yesterday = target_date

    period_key = yesterday
    state = JobRunState()

    # 1. Claim
    try:
        run = client.call(
            "claim_job_run",
            {"jobName": JOB_NAME, "periodKey": period_key},
        )
        run_id = run["data"]["run"]["id"]
        state.set_run_id(run_id)
        logger.info("evaluator_daily claimed run %s for %s", run_id, yesterday)
    except AgentApiError as e:
        if "already claimed" in str(e).lower() or e.status_code == 409:
            logger.info("evaluator_daily already ran for %s, skipping", yesterday)
            return {"skipped": True, "date": yesterday}
        raise

    try:
        # 2. Evaluate
        eval_resp = client.call(
            "evaluate_daily_plan",
            {"date": yesterday, "decisionRunId": run_id},
        )
        evaluation = eval_resp["data"]["evaluation"]
        logger.info(
            "evaluator_daily %s: acceptanceRate=%.2f exclusionRegret=%.2f budgetFit=%d",
            yesterday,
            evaluation.get("acceptanceRate", 0),
            evaluation.get("exclusionRegret", 0),
            evaluation.get("budgetFitScore", 0),
        )

        # 3. Emit derived metrics so the weekly evaluator can aggregate them
        for metric_type, value in [
            ("planner.acceptance_rate", evaluation.get("acceptanceRate", 0)),
            ("planner.exclusion_regret", evaluation.get("exclusionRegret", 0)),
        ]:
            try:
                client.call(
                    "record_metric",
                    {
                        "jobName": JOB_NAME,
                        "periodKey": period_key,
                        "metricType": metric_type,
                        "value": value,
                        "metadata": {
                            "date": yesterday,
                            "recommendedCount": evaluation.get(
                                "recommendedCount", 0
                            ),
                        },
                    },
                )
            except AgentApiError as metric_err:
                logger.warning(
                    "evaluator_daily: failed to record %s: %s",
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
                    "date": yesterday,
                    "acceptanceRate": evaluation.get("acceptanceRate"),
                    "exclusionRegret": evaluation.get("exclusionRegret"),
                    "configRecommendationCount": len(
                        evaluation.get("configRecommendations", [])
                    ),
                },
            },
        )
        return {"ok": True, "date": yesterday, "evaluation": evaluation}

    except Exception as exc:
        logger.exception("evaluator_daily failed for %s: %s", yesterday, exc)
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
