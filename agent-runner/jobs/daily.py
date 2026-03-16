"""
Daily planning routine — per-user entry point.

Called from main.py once per enrolled user.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pytz

import config
from delivery.log import deliver_report
from mcp_client import AgentApiError, AgentClient
from policies import is_safe_to_apply
from storage.audit_store import AuditStore
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "daily_plan"


def _idempotency_key(action: str, ref: str, period: str, user_id: str) -> str:
    return f"daily-{action}-{ref}-{period}-{user_id[:8]}"


def run_daily_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    audit_store: AuditStore,
) -> str:
    """
    Run the daily planning routine for a single user.
    Returns outcome: 'success' | 'partial' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = now.strftime("%Y-%m-%d")

    logger.info("daily user=%s period=%s tz=%s", user_id[:8], period_key, timezone)

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info("daily already completed user=%s period=%s", user_id[:8], period_key)
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        logger.warning("daily already claimed user=%s period=%s", user_id[:8], period_key)
        return "success"

    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    try:
        # ── Step 1: Daily plan ───────────────────────────────────────────────
        plan_resp = client.read("plan_today", {
            "availableMinutes": 90,
            "energy": "medium",
            "context": ["computer", "phone"],
        })
        plan_data = plan_resp.get("data", {}).get("plan", {})
        recommended_tasks: list[Any] = plan_data.get("recommendedTasks", [])
        logger.info("plan_today user=%s tasks=%d", user_id[:8], len(recommended_tasks))

        # ── Step 2: Waiting tasks ────────────────────────────────────────────
        waiting_resp = client.read("list_waiting_on", {})
        waiting_tasks: list[Any] = waiting_resp.get("data", {}).get("tasks", [])

        # ── Step 3: Projects missing next actions ────────────────────────────
        missing_resp = client.read("list_projects_without_next_action", {})
        missing_projects: list[Any] = missing_resp.get("data", {}).get("projects", [])
        logger.info(
            "missing_next_action user=%s projects=%d", user_id[:8], len(missing_projects)
        )

        # ── Step 4: Optionally create missing next actions ───────────────────
        for project in missing_projects[: config.MAX_WRITE_ACTIONS_PER_RUN]:
            project_id: str = project.get("id", "")
            project_name: str = project.get("name", "unknown")
            action_type = "create_next_action"
            ikey = _idempotency_key("next-action", project_id, period_key, user_id)

            if not is_safe_to_apply(action_type):
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="project", entity_id=project_id,
                    skip_reason="not_in_allowlist",
                )
                skipped.append({"type": action_type, "projectId": project_id, "reason": "not_in_allowlist"})
                continue

            if config.DRY_RUN:
                logger.info("[DRY_RUN] would ensure_next_action project=%s user=%s", project_name, user_id[:8])
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="project", entity_id=project_id,
                    idempotency_key=ikey, skip_reason="dry_run",
                )
                skipped.append({"type": action_type, "projectId": project_id, "reason": "dry_run"})
                continue

            if not config.AUTO_APPLY:
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="project", entity_id=project_id,
                    idempotency_key=ikey, skip_reason="auto_apply_disabled",
                )
                skipped.append({"type": action_type, "projectId": project_id, "reason": "auto_apply_disabled"})
                continue

            try:
                result = client.write(
                    "ensure_next_action",
                    {"projectId": project_id, "mode": "apply"},
                    idempotency_key=ikey,
                )
                audit_store.record(
                    JOB_NAME, period_key, action_type, "applied",
                    user_id=user_id, entity_type="project", entity_id=project_id,
                    idempotency_key=ikey, result=result.get("data"),
                )
                applied.append({"type": action_type, "projectId": project_id, "projectName": project_name})

            except AgentApiError as exc:
                logger.error("ensure_next_action failed project=%s: %s", project_name, exc)
                audit_store.record(
                    JOB_NAME, period_key, action_type, "error",
                    user_id=user_id, entity_type="project", entity_id=project_id,
                    idempotency_key=ikey, error_message=str(exc),
                )
                errors.append({"type": action_type, "projectId": project_id, "error": str(exc), "retryable": exc.retryable})

        # ── Step 5: Deliver report ───────────────────────────────────────────
        report: dict[str, Any] = {
            "type": "daily",
            "userId": user_id,
            "period": period_key,
            "timezone": timezone,
            "generatedAt": now.isoformat(),
            "dryRun": config.DRY_RUN,
            "autoApply": config.AUTO_APPLY,
            "recommendedTasks": recommended_tasks[:10],
            "waitingTaskCount": len(waiting_tasks),
            "projectsMissingNextAction": len(missing_projects),
            "appliedActions": applied,
            "skippedActions": skipped,
            "errors": errors,
        }
        deliver_report(report)

        outcome = "error" if errors and not applied else ("partial" if errors else "success")
        state_store.complete(JOB_NAME, period_key, {
            "appliedCount": len(applied),
            "skippedCount": len(skipped),
            "errorCount": len(errors),
        }, user_id)
        logger.info(
            "daily done user=%s applied=%d skipped=%d errors=%d outcome=%s",
            user_id[:8], len(applied), len(skipped), len(errors), outcome,
        )
        return outcome

    except Exception as exc:
        logger.error("daily failed user=%s: %s", user_id[:8], exc, exc_info=True)
        state_store.fail(JOB_NAME, period_key, str(exc), user_id)
        return "error"
