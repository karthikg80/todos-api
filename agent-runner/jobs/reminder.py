"""
Task reminder job — sends daily email digests for due/overdue tasks.

Runs hourly via Railway cron. Gates on each user's local time
(6:30–7:30 AM window) so reminders arrive at ~7 AM regardless of timezone.
Idempotent per user per local calendar day via period_key.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pytz

from mcp_client import AgentApiError, AgentClient
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "task_reminder"
REMINDER_HOUR_START = 6
REMINDER_MINUTE_START = 30
REMINDER_HOUR_END = 8


def run_reminder_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    *args: Any,
    **kwargs: Any,
) -> str:
    """
    Send a task reminder email if the user's local time is in the 7 AM window.
    Returns outcome: 'success' | 'skipped' | 'error'
    """
    tz = pytz.timezone(timezone)
    local_now = datetime.now(tz)
    local_hour = local_now.hour
    local_minute = local_now.minute

    # Gate: only send between 6:30 AM and 7:59 AM local time
    if local_hour < REMINDER_HOUR_START or local_hour >= REMINDER_HOUR_END:
        return "skipped"
    if local_hour == REMINDER_HOUR_START and local_minute < REMINDER_MINUTE_START:
        return "skipped"

    period_key = local_now.strftime("%Y-%m-%d")

    logger.info(
        "reminder user=%s period=%s local=%02d:%02d tz=%s",
        user_id[:8],
        period_key,
        local_hour,
        local_minute,
        timezone,
    )

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info(
            "reminder already sent user=%s period=%s",
            user_id[:8],
            period_key,
        )
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        logger.warning(
            "reminder already claimed user=%s period=%s",
            user_id[:8],
            period_key,
        )
        return "success"

    try:
        client.write(
            "claim_job_run",
            {"jobName": JOB_NAME, "periodKey": period_key},
        )

        result = client.write("send_task_reminder", {})
        sent = result.get("data", {}).get("sent", 0)

        client.write(
            "complete_job_run",
            {
                "jobName": JOB_NAME,
                "periodKey": period_key,
                "metadata": {
                    "sent": sent,
                    "localHour": local_hour,
                    "timezone": timezone,
                },
            },
        )
        state_store.mark_completed(JOB_NAME, period_key, user_id)
        logger.info(
            "reminder sent user=%s period=%s tasks=%d",
            user_id[:8],
            period_key,
            sent,
        )
        return "success"

    except Exception as exc:
        logger.exception("reminder failed user=%s: %s", user_id[:8], exc)
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
