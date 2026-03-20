"""
Home focus prewarm job — prepares a recent Home AI snapshot before the user opens the app.

Called from main.py once per enrolled user. Runs daily using the user's local date.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pytz

from mcp_client import AgentApiError, AgentClient

logger = logging.getLogger(__name__)

JOB_NAME = "home_focus_prewarm"
DEFAULT_FRESHNESS_HOURS = 18


def run_prewarm_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    *args: Any,
    **kwargs: Any,
) -> str:
    """
    Generate or reuse a fresh home_focus snapshot for a single user.
    Returns outcome: 'success' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = now.strftime("%Y-%m-%d")

    logger.info(
        "prewarm user=%s period=%s tz=%s", user_id[:8], period_key, timezone
    )

    try:
        claim_resp = client.write(
            "claim_job_run",
            {"jobName": JOB_NAME, "periodKey": period_key},
        )
        claimed = bool(claim_resp.get("data", {}).get("claimed"))
        if not claimed:
            logger.info(
                "prewarm already claimed/completed user=%s period=%s",
                user_id[:8],
                period_key,
            )
            return "success"

        prewarm_resp = client.write(
            "prewarm_home_focus",
            {
                "topN": 3,
                "freshnessHours": DEFAULT_FRESHNESS_HOURS,
                "timezone": timezone,
                "periodKey": period_key,
            },
        )
        prewarm = prewarm_resp.get("data", {}).get("prewarm", {})
        logger.info(
            "prewarm user=%s status=%s suggestionId=%s count=%s ageHours=%s",
            user_id[:8],
            prewarm.get("status"),
            prewarm.get("suggestionId"),
            prewarm.get("suggestionCount"),
            prewarm.get("ageHours"),
        )

        client.write(
            "complete_job_run",
            {
                "jobName": JOB_NAME,
                "periodKey": period_key,
                "metadata": {
                    "status": prewarm.get("status"),
                    "suggestionId": prewarm.get("suggestionId"),
                    "createdAt": prewarm.get("createdAt"),
                    "freshUntil": prewarm.get("freshUntil"),
                    "ageHours": prewarm.get("ageHours"),
                    "suggestionCount": prewarm.get("suggestionCount"),
                    "mustAbstain": prewarm.get("mustAbstain"),
                    "timezone": timezone,
                },
            },
        )
        return "success"

    except Exception as exc:
        logger.exception("prewarm failed user=%s: %s", user_id[:8], exc)
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
