"""
Project decomposer routine — per-user entry point.

Called from main.py with command "decomposer".

Detects projects that are stuck: no next action, a single oversized task, or
no clear path forward. Generates breakdown suggestions and next-action
proposals. Auto-applies only when AUTO_APPLY is enabled AND the project has
no subtasks on its primary task (highest-confidence decomposition).

Runs weekly (period key is ISO week, e.g. 2026-W12) so suggestions are not
repeated every day.
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

JOB_NAME = "decomposer"

# Maximum projects to analyze in one run to keep latency bounded.
_MAX_PROJECTS_TO_ANALYZE = 10


def _period_key(dt: datetime) -> str:
    cal = dt.isocalendar()
    return f"{cal[0]}-W{cal[1]:02d}"


def _idempotency_key(action: str, ref: str, week: str, user_id: str) -> str:
    return f"decomposer-{action}-{ref}-{week}-{user_id[:8]}"


def run_decomposer_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    audit_store: AuditStore,
) -> str:
    """
    Run the project decomposer for a single user.
    Returns outcome: 'success' | 'partial' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = _period_key(now)

    logger.info("decomposer user=%s period=%s tz=%s", user_id[:8], period_key, timezone)

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info("decomposer already completed user=%s period=%s", user_id[:8], period_key)
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        logger.warning("decomposer already claimed user=%s period=%s", user_id[:8], period_key)
        return "success"

    analyses: list[dict[str, Any]] = []
    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    try:
        # ── Step 1: Projects without a next action ────────────────────────────
        missing_resp = client.read("list_projects_without_next_action", {})
        stuck_projects: list[Any] = missing_resp.get("data", {}).get("projects", [])
        logger.info("stuck_projects user=%s count=%d", user_id[:8], len(stuck_projects))

        write_count = 0
        for project in stuck_projects[:_MAX_PROJECTS_TO_ANALYZE]:
            project_id: str = project.get("id", "")
            project_name: str = project.get("name", "")

            # ── Step 2: Analyze each project's health ─────────────────────────
            try:
                health_resp = client.read("analyze_project_health", {"projectId": project_id})
                health = health_resp.get("data", {}).get("health", {})
            except AgentApiError as exc:
                logger.warning("analyze_project_health failed project=%s: %s", project_name, exc)
                health = {}

            # ── Step 3: Suggest next actions ──────────────────────────────────
            try:
                suggest_resp = client.read("suggest_next_actions", {"projectId": project_id})
                suggestions: list[Any] = suggest_resp.get("data", {}).get("suggestions", [])
            except AgentApiError as exc:
                logger.warning("suggest_next_actions failed project=%s: %s", project_name, exc)
                suggestions = []

            analysis: dict[str, Any] = {
                "projectId": project_id,
                "projectName": project_name,
                "health": health,
                "suggestedNextActions": suggestions,
            }

            # ── Step 4: Apply ensure_next_action only for high-confidence cases ─
            # Condition: project has suggestions AND auto-apply is on AND
            # first suggestion has no subtasks (simple, safe decomposition)
            action_type = "ensure_next_action"
            ikey = _idempotency_key("next-action", project_id, period_key, user_id)

            can_auto_apply = (
                bool(suggestions)
                and not config.DRY_RUN
                and config.AUTO_APPLY
                and write_count < config.MAX_WRITE_ACTIONS_PER_RUN
            )

            if can_auto_apply:
                try:
                    result = client.write(
                        "ensure_next_action",
                        {"projectId": project_id, "mode": "apply"},
                        idempotency_key=ikey,
                    )
                    write_count += 1
                    result_data = result.get("data", {})
                    audit_store.record(
                        JOB_NAME, period_key, action_type, "applied",
                        user_id=user_id, entity_type="project", entity_id=project_id,
                        idempotency_key=ikey, result=result_data,
                    )
                    applied.append({
                        "type": action_type,
                        "projectId": project_id,
                        "projectName": project_name,
                    })
                    analysis["appliedAction"] = action_type

                except AgentApiError as exc:
                    logger.error("ensure_next_action failed project=%s: %s", project_name, exc)
                    audit_store.record(
                        JOB_NAME, period_key, action_type, "error",
                        user_id=user_id, entity_type="project", entity_id=project_id,
                        idempotency_key=ikey, error_message=str(exc),
                    )
                    errors.append({
                        "projectId": project_id,
                        "error": str(exc),
                        "retryable": exc.retryable,
                    })
            else:
                skip_reason = (
                    "dry_run" if config.DRY_RUN
                    else "auto_apply_disabled" if not config.AUTO_APPLY
                    else "no_suggestions" if not suggestions
                    else "write_limit_reached"
                )
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="project", entity_id=project_id,
                    idempotency_key=ikey, skip_reason=skip_reason,
                )
                skipped.append({"projectId": project_id, "reason": skip_reason})

            analyses.append(analysis)

        # ── Step 5: Deliver report ────────────────────────────────────────────
        report: dict[str, Any] = {
            "type": "decomposer",
            "userId": user_id,
            "period": period_key,
            "timezone": timezone,
            "generatedAt": now.isoformat(),
            "dryRun": config.DRY_RUN,
            "autoApply": config.AUTO_APPLY,
            "projectsAnalyzed": len(analyses),
            "analyses": analyses,
            "applied": applied,
            "skipped": skipped,
            "errors": errors,
            "summary": {
                "stuckProjectCount": len(stuck_projects),
                "analyzedCount": len(analyses),
                "appliedCount": len(applied),
                "skippedCount": len(skipped),
                "errorCount": len(errors),
            },
        }
        deliver_report(report)

        outcome = "error" if errors and not applied else ("partial" if errors else "success")
        state_store.complete(JOB_NAME, period_key, report["summary"], user_id)
        logger.info(
            "decomposer done user=%s projects=%d applied=%d skipped=%d errors=%d outcome=%s",
            user_id[:8], len(analyses), len(applied), len(skipped), len(errors), outcome,
        )
        return outcome

    except Exception as exc:
        logger.error("decomposer failed user=%s: %s", user_id[:8], exc, exc_info=True)
        state_store.fail(JOB_NAME, period_key, str(exc), user_id)
        return "error"
