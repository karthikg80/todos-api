"""
Delivery backends for job reports.

The active backend is selected by the DELIVERY_MODE env var:
  "log"   — structured JSON to stdout (default, always safe)
  "email" — SMTP plaintext summary
  "slack" — Slack Incoming Webhook JSON payload

All backends fall back to "log" on misconfiguration so no report is silently
dropped.
"""
from __future__ import annotations

import json
import logging
import smtplib
from email.mime.text import MIMEText
from typing import Any

import httpx

logger = logging.getLogger(__name__)


# ── Log delivery ──────────────────────────────────────────────────────────────


def _deliver_log(report: dict[str, Any]) -> None:
    logger.info("=== JOB REPORT [%s/%s] ===", report.get("type"), report.get("period"))
    logger.info("%s", json.dumps(report, indent=2, default=str))


# ── Email delivery ────────────────────────────────────────────────────────────


def _build_email_body(report: dict[str, Any]) -> str:
    job_type = report.get("type", "unknown").upper()
    period = report.get("period", "")
    applied = report.get("appliedActions", [])
    skipped = report.get("skippedActions", [])
    errors = report.get("errors", [])

    lines = [
        f"Todo Agent Runner — {job_type} report for {period}",
        "",
        f"Generated at: {report.get('generatedAt', '')}",
        f"Dry-run:      {report.get('dryRun', False)}",
        f"Auto-apply:   {report.get('autoApply', False)}",
        "",
    ]

    if job_type == "DAILY":
        lines += [
            f"Recommended tasks:            {len(report.get('recommendedTasks', []))}",
            f"Waiting tasks:                {report.get('waitingTaskCount', 0)}",
            f"Projects missing next action: {report.get('projectsMissingNextAction', 0)}",
            "",
        ]
    elif job_type == "WEEKLY":
        summary = report.get("summary", {})
        lines += [
            f"Total tasks:     {summary.get('totalTasks', '?')}",
            f"Active projects: {summary.get('activeProjects', '?')}",
            f"Waiting tasks:   {summary.get('waitingTasks', '?')}",
            f"Stale items:     {summary.get('staleItems', '?')}",
            "",
            "Findings:",
            *[f"  • {f.get('message', f)}" for f in report.get("findings", [])],
            "",
        ]

    lines += [
        f"Applied actions ({len(applied)}):",
        *[f"  ✓ {a.get('type')} — {a.get('projectId') or a.get('taskId', '')}" for a in applied],
        "",
        f"Skipped actions ({len(skipped)}):",
        *[
            f"  – {s.get('type')} ({s.get('reason', '')})"
            for s in skipped
        ],
        "",
        f"Errors ({len(errors)}):",
        *[f"  ✗ {e.get('type')}: {e.get('error', '')}" for e in errors],
    ]
    return "\n".join(lines)


def _deliver_email(report: dict[str, Any]) -> None:
    from config import EMAIL_TO, SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER

    if not all([EMAIL_TO, SMTP_HOST, SMTP_FROM]):
        logger.warning("Email delivery misconfigured — falling back to log delivery")
        _deliver_log(report)
        return

    job_type = report.get("type", "unknown").upper()
    period = report.get("period", "")
    subject = f"[Todo Agent] {job_type} report — {period}"
    body = _build_email_body(report)

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = EMAIL_TO

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [EMAIL_TO], msg.as_string())
        logger.info("Email report sent to %s", EMAIL_TO)
    except Exception as exc:
        logger.error("Failed to send email report: %s — falling back to log", exc)
        _deliver_log(report)


# ── Slack delivery ────────────────────────────────────────────────────────────


def _deliver_slack(report: dict[str, Any]) -> None:
    from config import SLACK_WEBHOOK_URL

    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL not configured — falling back to log delivery")
        _deliver_log(report)
        return

    job_type = report.get("type", "unknown").upper()
    period = report.get("period", "")
    applied = report.get("appliedActions", [])
    errors = report.get("errors", [])

    icon = ":white_check_mark:" if not errors else ":warning:"
    text = (
        f"{icon} *Todo Agent — {job_type} {period}*\n"
        f"Applied: {len(applied)}  |  Errors: {len(errors)}"
    )

    payload = {"text": text, "unfurl_links": False}

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(SLACK_WEBHOOK_URL, json=payload)
            response.raise_for_status()
        logger.info("Slack report delivered")
    except Exception as exc:
        logger.error("Failed to deliver Slack report: %s — falling back to log", exc)
        _deliver_log(report)


# ── Public entry point ────────────────────────────────────────────────────────


def deliver_report(report: dict[str, Any]) -> None:
    """Send a job report via the configured delivery backend."""
    from config import DELIVERY_MODE

    mode = (DELIVERY_MODE or "log").lower()

    if mode == "email":
        _deliver_email(report)
    elif mode == "slack":
        _deliver_slack(report)
    else:
        _deliver_log(report)
