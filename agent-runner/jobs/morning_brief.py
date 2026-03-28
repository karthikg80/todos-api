"""
Morning brief job — generates a personalized narrative brief for each user.

Runs after the daily plan job. Chains plan data + insights + soul profile
to produce a 2-4 sentence narrative.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pytz

from mcp_client import AgentApiError, AgentClient
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "morning_brief"


def run_morning_brief_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    *args: Any,
    **kwargs: Any,
) -> str:
    """
    Generate a morning brief for a single user.
    Returns outcome: 'success' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = now.strftime("%Y-%m-%d")

    logger.info(
        "morning_brief user=%s period=%s tz=%s",
        user_id[:8],
        period_key,
        timezone,
    )

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info(
            "morning_brief already completed user=%s period=%s",
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

        result = client.write("generate_morning_brief", {})
        data = result.get("data", {})

        client.write(
            "complete_job_run",
            {
                "jobName": JOB_NAME,
                "periodKey": period_key,
                "metadata": {
                    "taskCount": data.get("taskCount"),
                    "deterministic": data.get("deterministic"),
                    "timezone": timezone,
                },
            },
        )
        state_store.mark_completed(JOB_NAME, period_key, user_id)
        logger.info(
            "morning_brief user=%s period=%s deterministic=%s",
            user_id[:8],
            period_key,
            data.get("deterministic"),
        )
        return "success"

    except Exception as exc:
        logger.exception("morning_brief failed user=%s: %s", user_id[:8], exc)
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
