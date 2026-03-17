"""
Inbox triage routine — per-user entry point.

Called from main.py once per enrolled user with command "inbox".

Fetches pending capture items, classifies them, and applies high-confidence
ones automatically. Low-confidence items land in the inbox with a
`needs_review` tag and are never auto-applied.

Period key is hourly (e.g. 2026-03-17T14) so the job can safely run multiple
times per day without duplicate processing.
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

JOB_NAME = "inbox_triage"

# Action types that are safe to auto-apply from the inbox agent.
_INBOX_SAFE_ACTIONS: frozenset[str] = frozenset(
    ["create_task", "create_project", "triage_capture_item"]
)


def _period_key(dt: datetime) -> str:
    """Hourly period key so duplicate runs within the same hour are skipped."""
    return dt.strftime("%Y-%m-%dT%H")


def _idempotency_key(action: str, ref: str, period: str, user_id: str) -> str:
    return f"inbox-{action}-{ref}-{period}-{user_id[:8]}"


def run_inbox_for_user(
    client: AgentClient,
    user_id: str,
    timezone: str,
    state_store: JobRunState,
    audit_store: AuditStore,
) -> str:
    """
    Run the inbox triage routine for a single user.
    Returns outcome: 'success' | 'partial' | 'error'
    """
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)
    period_key = _period_key(now)

    logger.info("inbox user=%s period=%s tz=%s", user_id[:8], period_key, timezone)

    if state_store.is_completed(JOB_NAME, period_key, user_id):
        logger.info("inbox already completed user=%s period=%s", user_id[:8], period_key)
        return "success"

    if not state_store.try_claim(JOB_NAME, period_key, user_id):
        logger.warning("inbox already claimed user=%s period=%s", user_id[:8], period_key)
        return "success"

    applied: list[dict[str, Any]] = []
    suggested: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    try:
        # ── Step 1: Fetch pending capture items (suggest mode = no writes yet) ──
        inbox_resp = client.write("triage_inbox", {"mode": "suggest", "limit": 50})
        inbox_data = inbox_resp.get("data", {})
        items: list[Any] = inbox_data.get("triaged", [])
        total_items: int = inbox_data.get("totalProcessed", 0)

        logger.info("triage_inbox user=%s items=%d total=%d", user_id[:8], len(items), total_items)

        # ── Step 2: Process each item ─────────────────────────────────────────
        write_count = 0
        for item in items:
            if write_count >= config.MAX_WRITE_ACTIONS_PER_RUN:
                logger.warning("MAX_WRITE_ACTIONS_PER_RUN reached user=%s", user_id[:8])
                break

            item_id: str = item.get("id", "")
            confidence: float = float(item.get("confidence", 0.0))
            action_type: str = item.get("suggestedAction", "create_task")
            ikey = _idempotency_key("triage", item_id, period_key, user_id)

            # Low-confidence: suggest only — never auto-apply
            if confidence < config.MAX_AUTO_TRIAGE_CONFIDENCE:
                logger.info(
                    "inbox suggest-only item=%s confidence=%.2f user=%s",
                    item_id[:8], confidence, user_id[:8],
                )
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="capture_item", entity_id=item_id,
                    idempotency_key=ikey,
                    skip_reason=f"low_confidence:{confidence:.2f}",
                )
                suggested.append({
                    "itemId": item_id,
                    "confidence": confidence,
                    "suggestedAction": action_type,
                    "reason": "low_confidence",
                })
                continue

            if config.DRY_RUN:
                logger.info("[DRY_RUN] would triage item=%s confidence=%.2f user=%s", item_id[:8], confidence, user_id[:8])
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="capture_item", entity_id=item_id,
                    idempotency_key=ikey, skip_reason="dry_run",
                )
                skipped.append({"itemId": item_id, "reason": "dry_run"})
                continue

            if not config.AUTO_APPLY:
                audit_store.record(
                    JOB_NAME, period_key, action_type, "skipped",
                    user_id=user_id, entity_type="capture_item", entity_id=item_id,
                    idempotency_key=ikey, skip_reason="auto_apply_disabled",
                )
                skipped.append({"itemId": item_id, "reason": "auto_apply_disabled"})
                continue

            # High-confidence + AUTO_APPLY: apply the classification
            try:
                result = client.write(
                    "triage_capture_item",
                    {"captureItemId": item_id, "mode": "apply"},
                    idempotency_key=ikey,
                )
                write_count += 1
                result_data = result.get("data", {})
                audit_store.record(
                    JOB_NAME, period_key, action_type, "applied",
                    user_id=user_id, entity_type="capture_item", entity_id=item_id,
                    idempotency_key=ikey, result=result_data,
                )
                applied.append({
                    "itemId": item_id,
                    "confidence": confidence,
                    "action": action_type,
                    "result": result_data,
                })

            except AgentApiError as exc:
                logger.error("triage_capture_item failed item=%s: %s", item_id[:8], exc)
                audit_store.record(
                    JOB_NAME, period_key, action_type, "error",
                    user_id=user_id, entity_type="capture_item", entity_id=item_id,
                    idempotency_key=ikey, error_message=str(exc),
                )
                errors.append({
                    "itemId": item_id,
                    "error": str(exc),
                    "retryable": exc.retryable,
                })

        # ── Step 3: Deliver report ────────────────────────────────────────────
        report: dict[str, Any] = {
            "type": "inbox",
            "userId": user_id,
            "period": period_key,
            "timezone": timezone,
            "generatedAt": now.isoformat(),
            "dryRun": config.DRY_RUN,
            "autoApply": config.AUTO_APPLY,
            "totalFetched": total_items,
            "applied": applied,
            "suggested": suggested,
            "skipped": skipped,
            "errors": errors,
            "summary": {
                "appliedCount": len(applied),
                "suggestedCount": len(suggested),
                "skippedCount": len(skipped),
                "errorCount": len(errors),
            },
        }
        deliver_report(report)

        outcome = "error" if errors and not applied else ("partial" if errors else "success")
        state_store.complete(JOB_NAME, period_key, report["summary"], user_id)
        logger.info(
            "inbox done user=%s applied=%d suggested=%d skipped=%d errors=%d outcome=%s",
            user_id[:8], len(applied), len(suggested), len(skipped), len(errors), outcome,
        )
        return outcome

    except Exception as exc:
        logger.error("inbox failed user=%s: %s", user_id[:8], exc, exc_info=True)
        state_store.fail(JOB_NAME, period_key, str(exc), user_id)
        return "error"
