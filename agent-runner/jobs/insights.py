"""
Insights compute job — triggers daily insight computation for each enrolled user.

Called from main.py. Calls POST /insights/compute which is a read-heavy
operation that upserts computed insight rows for the user.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pytz

from mcp_client import AgentApiError, AgentClient
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "compute_insights"


def run_insights_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    *args: Any,
    **kwargs: Any,
) -> str:
    """
    Trigger insights computation for a single user.
    Returns outcome: 'success' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = now.strftime("%Y-%m-%d")

    logger.info(
        "insights user=%s period=%s tz=%s", user_id[:8], period_key, timezone
    )

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info(
            "insights already completed user=%s period=%s",
            user_id[:8],
            period_key,
        )
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        logger.warning(
            "insights already claimed user=%s period=%s",
            user_id[:8],
            period_key,
        )
        return "success"

    try:
        # Use the agent write endpoint to claim and complete the job run
        # via MCP, then call the insights compute via the REST endpoint.
        client.write(
            "claim_job_run",
            {"jobName": JOB_NAME, "periodKey": period_key},
        )

        # Call POST /insights/compute directly — it's an authenticated
        # endpoint that computes all insight types for the calling user.
        client.post_api("/insights/compute", {})

        client.write(
            "complete_job_run",
            {
                "jobName": JOB_NAME,
                "periodKey": period_key,
                "metadata": {"timezone": timezone},
            },
        )
        state_store.mark_completed(JOB_NAME, period_key, user_id)
        return "success"

    except Exception as exc:
        logger.exception("insights failed user=%s: %s", user_id[:8], exc)
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
