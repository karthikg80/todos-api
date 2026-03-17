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
        rec_count = evaluation.get("recommendedCount", 0)
        for metric_type, value in [
            ("planner.acceptance_rate", evaluation.get("acceptanceRate", 0)),
            ("planner.exclusion_regret", evaluation.get("exclusionRegret", 0)),
            ("planner.budget_fit", evaluation.get("budgetFitScore", 0)),
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
                            "recommendedCount": rec_count,
                        },
                    },
                )
            except AgentApiError as metric_err:
                logger.warning(
                    "evaluator_daily: failed to record %s: %s",
                    metric_type,
                    metric_err,
                )

        # 4. Generate learning recommendations from evaluator config suggestions
        config_recs = evaluation.get("configRecommendations", [])
        learning_rec_ids: list[str] = []
        for rec in config_recs:
            try:
                lr_resp = client.call(
                    "record_learning_recommendation",
                    {
                        "type": "score_weight"
                        if rec.get("target", "").startswith("plannerWeight")
                        else "config_change",
                        "target": rec["target"],
                        "currentValue": rec["currentValue"],
                        "suggestedValue": rec["suggestedValue"],
                        "confidence": rec["confidence"],
                        "why": rec["why"],
                        "evidence": rec.get("evidence"),
                    },
                )
                rec_id = lr_resp["data"]["recommendation"]["id"]
                learning_rec_ids.append(rec_id)
                logger.info(
                    "evaluator_daily: recorded learning rec %s for target=%s confidence=%.2f",
                    rec_id,
                    rec["target"],
                    rec["confidence"],
                )
            except AgentApiError as lr_err:
                logger.warning(
                    "evaluator_daily: failed to record learning rec for %s: %s",
                    rec.get("target"),
                    lr_err,
                )

        # 5. Complete the run
        client.call(
            "complete_job_run",
            {
                "jobName": JOB_NAME,
                "periodKey": period_key,
                "metadata": {
                    "date": yesterday,
                    "acceptanceRate": evaluation.get("acceptanceRate"),
                    "exclusionRegret": evaluation.get("exclusionRegret"),
                    "budgetFitScore": evaluation.get("budgetFitScore"),
                    "configRecommendationCount": len(config_recs),
                    "learningRecordingCount": len(learning_rec_ids),
                },
            },
        )
        return {
            "ok": True,
            "date": yesterday,
            "evaluation": evaluation,
            "learningRecIds": learning_rec_ids,
        }

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
