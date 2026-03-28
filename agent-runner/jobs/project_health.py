"""
Project health intervention job — auto-intervenes on unhealthy projects.

Runs weekly. Chains project health analysis → task breakdown → subtask creation.
The intervention action itself contains all safety logic (config gate, score
threshold, circuit breaker, write limit, audit trail).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pytz

from mcp_client import AgentApiError, AgentClient
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "project_health_intervention"


def run_project_health_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    *args: Any,
    **kwargs: Any,
) -> str:
    """
    Run project health intervention for a single user.
    Returns outcome: 'success' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    # Use ISO week as period key — weekly cadence
    period_key = f"{now.year}-W{now.isocalendar()[1]:02d}"

    logger.info(
        "project_health user=%s period=%s tz=%s",
        user_id[:8],
        period_key,
        timezone,
    )

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info(
            "project_health already completed user=%s period=%s",
            user_id[:8],
            period_key,
        )
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        return "success"

    try:
        client.write(
            "claim_job_run",
            {"jobName": JOB_NAME, "periodKey": period_key},
        )

        result = client.write("project_health_intervention", {})
        data = result.get("data", {})

        client.write(
            "complete_job_run",
            {
                "jobName": JOB_NAME,
                "periodKey": period_key,
                "metadata": {
                    "projectsAnalyzed": data.get("projectsAnalyzed"),
                    "criticalCount": data.get("criticalCount"),
                    "totalWriteActions": data.get("totalWriteActions"),
                    "interventionCount": len(data.get("interventions", [])),
                    "timezone": timezone,
                },
            },
        )
        state_store.mark_completed(JOB_NAME, period_key, user_id)
        logger.info(
            "project_health user=%s period=%s critical=%s writes=%s",
            user_id[:8],
            period_key,
            data.get("criticalCount"),
            data.get("totalWriteActions"),
        )
        return "success"

    except Exception as exc:
        logger.exception("project_health failed user=%s: %s", user_id[:8], exc)
        try:
            client.write(
                "fail_job_run",
                {
                    "jobName": JOB_NAME,
                    "periodKey": period_key,
                    "errorMessage": str(exc)[:500],
                },
            )
        except AgentApiError:
            pass
        return "error"
