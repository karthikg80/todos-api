"""
Aging watchdog routine — per-user entry point.

Called from main.py with command "watchdog".

Detects silent decay: stale tasks, waiting items past their follow-up window,
and projects with vague or missing next actions. Creates follow-ups for
overdue waiting items when AUTO_APPLY is enabled; emits suggestions for
everything else. Conservative by design — prefer reporting over writing.

Period key is daily (e.g. 2026-03-17) matching the daily runner.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pytz

import config
from delivery.log import deliver_report
from mcp_client import AgentApiError, AgentClient
from storage.audit_store import AuditStore
from storage.state_store import JobRunState

logger = logging.getLogger(__name__)

JOB_NAME = "watchdog"


def _idempotency_key(action: str, ref: str, period: str, user_id: str) -> str:
    return f"watchdog-{action}-{ref}-{period}-{user_id[:8]}"


def run_watchdog_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    audit_store: AuditStore,
) -> str:
    """
    Run the aging watchdog for a single user.
    Returns outcome: 'success' | 'partial' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = now.strftime("%Y-%m-%d")

    logger.info("watchdog user=%s period=%s tz=%s", user_id[:8], period_key, timezone)

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info("watchdog already completed user=%s period=%s", user_id[:8], period_key)
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        logger.warning("watchdog already claimed user=%s period=%s", user_id[:8], period_key)
        return "success"

    findings: list[dict[str, Any]] = []
    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    try:
        # ── Step 1: Stale tasks ───────────────────────────────────────────────
        stale_resp = client.read("find_stale_items", {
            "staleDays": config.STALE_THRESHOLD_DAYS,
        })
        stale_items: list[Any] = stale_resp.get("data", {}).get("items", [])
        logger.info("stale_items user=%s count=%d", user_id[:8], len(stale_items))

        for item in stale_items:
            findings.append({
                "type": "stale_task",
                "taskId": item.get("id"),
                "title": item.get("title"),
                "daysSinceUpdate": item.get("daysSinceUpdate"),
                "suggestion": "review_or_archive",
            })

        # ── Step 2: Waiting tasks — check for overdue follow-ups ─────────────
        waiting_resp = client.read("list_waiting_on", {})
        waiting_tasks: list[Any] = waiting_resp.get("data", {}).get("tasks", [])
        logger.info("waiting_tasks user=%s count=%d", user_id[:8], len(waiting_tasks))

        write_count = 0
        for task in waiting_tasks:
            if write_count >= config.MAX_WRITE_ACTIONS_PER_RUN:
                logger.warning("MAX_WRITE_ACTIONS_PER_RUN reached user=%s", user_id[:8])
                break

            task_id: str = task.get("id", "")
            task_title: str = task.get("title", "")
            action_type = "follow_up_waiting_task"
            ikey = _idempotency_key("followup", task_id, period_key, user_id)

            findings.append({
                "type": "waiting_task",
                "taskId": task_id,
                "title": task_title,
                "suggestion": "create_follow_up",
            })

            if config.DRY_RUN:
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="task", entity_id=task_id,
                    idempotency_key=ikey, skip_reason="dry_run",
                )
                skipped.append({"taskId": task_id, "reason": "dry_run"})
                continue

            if not config.AUTO_APPLY:
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="task", entity_id=task_id,
                    idempotency_key=ikey, skip_reason="auto_apply_disabled",
                )
                skipped.append({"taskId": task_id, "reason": "auto_apply_disabled"})
                continue

            try:
                result = client.write(
                    "create_follow_up_for_waiting_task",
                    {
                        "taskId": task_id,
                        "mode": "apply",
                        "cooldownDays": config.WAITING_FOLLOW_UP_DAYS,
                    },
                    idempotency_key=ikey,
                )
                write_count += 1
                result_data = result.get("data", {})

                if result_data.get("skipped"):
                    # Cooldown still active — the server enforced deduplication
                    audit_store.record(
                        JOB_NAME, period_key, action_type, "skipped",
                        user_id=user_id, entity_type="task", entity_id=task_id,
                        idempotency_key=ikey, skip_reason="cooldown_active",
                        result=result_data,
                    )
                    skipped.append({"taskId": task_id, "reason": "cooldown_active"})
                else:
                    audit_store.record(
                        JOB_NAME, period_key, action_type, "applied",
                        user_id=user_id, entity_type="task", entity_id=task_id,
                        idempotency_key=ikey, result=result_data,
                    )
                    applied.append({
                        "type": action_type,
                        "taskId": task_id,
                        "taskTitle": task_title,
                        "followUpTask": result_data.get("task"),
                    })

            except AgentApiError as exc:
                logger.error("create_follow_up failed task=%s: %s", task_id[:8], exc)
                audit_store.record(
                    JOB_NAME, period_key, action_type, "error",
                    user_id=user_id, entity_type="task", entity_id=task_id,
                    idempotency_key=ikey, error_message=str(exc),
                )
                errors.append({"taskId": task_id, "error": str(exc), "retryable": exc.retryable})

        # ── Step 3: Projects without next action ─────────────────────────────
        missing_resp = client.read("list_projects_without_next_action", {})
        missing_projects: list[Any] = missing_resp.get("data", {}).get("projects", [])
        logger.info("projects_missing_next_action user=%s count=%d", user_id[:8], len(missing_projects))

        for project in missing_projects:
            findings.append({
                "type": "project_missing_next_action",
                "projectId": project.get("id"),
                "projectName": project.get("name"),
                "suggestion": "add_next_action_or_decompose",
            })

        # ── Step 4: Deliver report ────────────────────────────────────────────
        report: dict[str, Any] = {
            "type": "watchdog",
            "userId": user_id,
            "period": period_key,
            "timezone": timezone,
            "generatedAt": now.isoformat(),
            "dryRun": config.DRY_RUN,
            "autoApply": config.AUTO_APPLY,
            "staleThresholdDays": config.STALE_THRESHOLD_DAYS,
            "waitingFollowUpDays": config.WAITING_FOLLOW_UP_DAYS,
            "findings": findings,
            "applied": applied,
            "skipped": skipped,
            "errors": errors,
            "summary": {
                "findingCount": len(findings),
                "staleTaskCount": len(stale_items),
                "waitingTaskCount": len(waiting_tasks),
                "projectsMissingNextAction": len(missing_projects),
                "appliedCount": len(applied),
                "skippedCount": len(skipped),
                "errorCount": len(errors),
            },
        }
        deliver_report(report)

        outcome = "error" if errors and not applied else ("partial" if errors else "success")
        state_store.complete(JOB_NAME, period_key, report["summary"], user_id)
        logger.info(
            "watchdog done user=%s findings=%d applied=%d skipped=%d errors=%d outcome=%s",
            user_id[:8], len(findings), len(applied), len(skipped), len(errors), outcome,
        )
        return outcome

    except Exception as exc:
        logger.error("watchdog failed user=%s: %s", user_id[:8], exc, exc_info=True)
        state_store.fail(JOB_NAME, period_key, str(exc), user_id)
        return "error"
