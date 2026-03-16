"""
Weekly review routine — per-user entry point.

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

JOB_NAME = "weekly_review"


def _period_key(dt: datetime) -> str:
    cal = dt.isocalendar()
    return f"{cal[0]}-W{cal[1]:02d}"


def _idempotency_key(action: str, ref: str, week: str, user_id: str) -> str:
    return f"weekly-{action}-{ref}-{week}-{user_id[:8]}"


def run_weekly_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    audit_store: AuditStore,
) -> str:
    """
    Run the weekly review routine for a single user.
    Returns outcome: 'success' | 'partial' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = _period_key(now)

    logger.info("weekly user=%s period=%s tz=%s", user_id[:8], period_key, timezone)

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info("weekly already completed user=%s period=%s", user_id[:8], period_key)
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        logger.warning("weekly already claimed user=%s period=%s", user_id[:8], period_key)
        return "success"

    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    try:
        # ── Step 1: Weekly review (suggest mode) ─────────────────────────────
        review_resp = client.write("weekly_review", {"mode": "suggest", "includeArchived": False})
        review = review_resp.get("data", {}).get("review", {})
        findings: list[Any] = review.get("findings", [])
        recommended_actions: list[Any] = review.get("recommendedActions", [])
        summary: dict[str, Any] = review.get("summary", {})

        logger.info(
            "weekly_review user=%s findings=%d actions=%d",
            user_id[:8], len(findings), len(recommended_actions),
        )

        # ── Step 2: Process allowlisted actions ──────────────────────────────
        write_count = 0
        for action in recommended_actions:
            if write_count >= config.MAX_WRITE_ACTIONS_PER_RUN:
                logger.warning("MAX_WRITE_ACTIONS_PER_RUN reached for user=%s", user_id[:8])
                break

            action_type: str = action.get("type", "")
            project_id: str | None = action.get("projectId")
            task_id: str | None = action.get("taskId")
            ref = project_id or task_id or "unknown"
            entity_type = "project" if project_id else "task"
            entity_id = project_id or task_id
            ikey = _idempotency_key(action_type.replace("_", "-"), ref, period_key, user_id)

            if not is_safe_to_apply(action_type):
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type=entity_type, entity_id=entity_id,
                    skip_reason="not_in_allowlist",
                )
                skipped.append({"type": action_type, "ref": ref, "reason": "not_in_allowlist"})
                continue

            if config.DRY_RUN:
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type=entity_type, entity_id=entity_id,
                    idempotency_key=ikey, skip_reason="dry_run",
                )
                skipped.append({"type": action_type, "ref": ref, "reason": "dry_run"})
                continue

            if not config.AUTO_APPLY:
                logger.info("[SUGGEST] user=%s action=%s ref=%s", user_id[:8], action_type, ref)
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type=entity_type, entity_id=entity_id,
                    idempotency_key=ikey, skip_reason="auto_apply_disabled",
                )
                skipped.append({"type": action_type, "ref": ref, "reason": "auto_apply_disabled"})
                continue

            try:
                result = _apply_safe_action(client, action_type, action, ikey)
                write_count += 1
                audit_store.record(
                    JOB_NAME, period_key, action_type, "applied",
                    user_id=user_id, entity_type=entity_type, entity_id=entity_id,
                    idempotency_key=ikey, payload=action,
                    result=result.get("data") if result else None,
                )
                applied.append({
                    "type": action_type,
                    **({"projectId": project_id} if project_id else {}),
                    **({"taskId": task_id} if task_id else {}),
                })

            except AgentApiError as exc:
                logger.error("action failed user=%s type=%s: %s", user_id[:8], action_type, exc)
                audit_store.record(
                    JOB_NAME, period_key, action_type, "error",
                    user_id=user_id, entity_type=entity_type, entity_id=entity_id,
                    idempotency_key=ikey, payload=action, error_message=str(exc),
                )
                errors.append({"type": action_type, "ref": ref, "error": str(exc), "retryable": exc.retryable})

        # ── Step 3: Deliver report ───────────────────────────────────────────
        report: dict[str, Any] = {
            "type": "weekly",
            "userId": user_id,
            "period": period_key,
            "timezone": timezone,
            "generatedAt": now.isoformat(),
            "dryRun": config.DRY_RUN,
            "autoApply": config.AUTO_APPLY,
            "summary": summary,
            "findings": findings,
            "recommendedActionCount": len(recommended_actions),
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
            "findingCount": len(findings),
        }, user_id)
        logger.info(
            "weekly done user=%s applied=%d skipped=%d errors=%d outcome=%s",
            user_id[:8], len(applied), len(skipped), len(errors), outcome,
        )
        return outcome

    except Exception as exc:
        logger.error("weekly failed user=%s: %s", user_id[:8], exc, exc_info=True)
        state_store.fail(JOB_NAME, period_key, str(exc), user_id)
        return "error"


# ── Action dispatch ───────────────────────────────────────────────────────────

def _apply_safe_action(
    client: AgentClient,
    action_type: str,
    action: dict[str, Any],
    idempotency_key: str,
) -> dict[str, Any]:
    if action_type == "create_next_action":
        project_id = action.get("projectId")
        if not project_id:
            raise AgentApiError(400, "MISSING_PROJECT_ID", "create_next_action missing projectId")
        return client.write(
            "ensure_next_action",
            {"projectId": project_id, "mode": "apply"},
            idempotency_key=idempotency_key,
        )

    if action_type == "follow_up_waiting_task":
        task_id = action.get("taskId")
        if not task_id:
            raise AgentApiError(400, "MISSING_TASK_ID", "follow_up_waiting_task missing taskId")
        payload: dict[str, Any] = {
            "title": action.get("title") or "Follow up on waiting task",
            "status": "next",
            "priority": action.get("priority", "medium"),
            "source": "automation",
            "createdByPrompt": "Created automatically by weekly review follow-up routine",
        }
        if action.get("projectId"):
            payload["projectId"] = action["projectId"]
        return client.write("create_task", payload, idempotency_key=idempotency_key)

    raise AgentApiError(400, "UNKNOWN_SAFE_ACTION", f"No handler for safe action: {action_type!r}")
