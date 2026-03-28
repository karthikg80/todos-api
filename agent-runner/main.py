#!/usr/bin/env python3
"""
Todo Agent Runner — Railway worker service for autonomous productivity routines.

Usage:
    python main.py daily       # Daily planning: plan_today + ensure_next_action
    python main.py weekly      # Weekly review: weekly_review + safe apply
    python main.py inbox       # Inbox triage: classify + apply capture items
    python main.py watchdog    # Aging watchdog: stale tasks + waiting follow-ups
    python main.py decomposer  # Project decomposer: stuck projects + next actions
    python main.py prewarm     # Home AI prewarm: generate/reuse Home focus snapshot

For each enrolled user the runner:
  1. Reads their enrollment row (refresh token + settings) from Postgres.
  2. Calls /api/agent-enrollment/exchange to get a short-lived access JWT.
     The server rotates the refresh token on every exchange.
  3. Runs the job with that user-scoped client.
  4. Records the outcome back to agent_enrollments.last_run_*.

Environment variables:
    AGENT_BASE_URL              — Base URL of the todos-api service (required)
    DATABASE_URL                — Shared Postgres URL (required)
    AUTO_APPLY                  — true to apply safe allowlisted actions (default false)
    DRY_RUN                     — true to skip all writes (default false)
    DELIVERY_MODE               — log | email | slack (default log)
    MAX_AUTO_TRIAGE_CONFIDENCE  — inbox auto-apply confidence threshold (default 0.9)
    STALE_THRESHOLD_DAYS        — watchdog stale task threshold in days (default 14)
    WAITING_FOLLOW_UP_DAYS      — watchdog follow-up cooldown in days (default 7)
"""
import logging
import os
import sys

_log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)

COMMANDS = ("daily", "weekly", "inbox", "watchdog", "decomposer", "prewarm", "evaluator_daily", "evaluator_weekly", "reminder", "retention", "morning_brief", "project_health")
USAGE = f"Usage: python main.py <{'|'.join(COMMANDS)}>"


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1].lower() not in COMMANDS:
        print(USAGE)
        sys.exit(1)

    command = sys.argv[1].lower()

    import config
    from mcp_client import AgentApiError, AgentClient
    from storage.audit_store import AuditStore
    from storage.enrollment_store import EnrollmentStore
    from storage.state_store import JobRunState

    logger.info(
        "agent-runner starting command=%s base_url=%s dry_run=%s auto_apply=%s",
        command, config.AGENT_BASE_URL, config.DRY_RUN, config.AUTO_APPLY,
    )

    enrollment_store = EnrollmentStore(config.DATABASE_URL)
    state_store = JobRunState(config.DATABASE_URL)
    audit_store = AuditStore(config.DATABASE_URL)

    state_store.ensure_schema()
    audit_store.ensure_schema()

    enrollments = enrollment_store.get_active_enrollments()
    logger.info("found %d active enrollment(s)", len(enrollments))

    if not enrollments:
        logger.info("no enrolled users — nothing to do")
        return

    # Import the runner and filter eligible enrollments per command.
    if command == "daily":
        from jobs.daily import run_daily_for_user as run_for_user
        eligible = [e for e in enrollments if e.daily_enabled]
    elif command == "weekly":
        from jobs.weekly import run_weekly_for_user as run_for_user
        eligible = [e for e in enrollments if e.weekly_enabled]
    elif command == "inbox":
        from jobs.inbox import run_inbox_for_user as run_for_user
        eligible = [e for e in enrollments if e.daily_enabled]  # same gate as daily
    elif command == "watchdog":
        from jobs.watchdog import run_watchdog_for_user as run_for_user
        eligible = [e for e in enrollments if e.daily_enabled]
    elif command == "decomposer":
        from jobs.decomposer import run_decomposer_for_user as run_for_user
        eligible = [e for e in enrollments if e.weekly_enabled]  # same gate as weekly
    elif command == "prewarm":
        from jobs.prewarm import run_prewarm_for_user as run_for_user
        eligible = [e for e in enrollments if e.daily_enabled]
    elif command == "evaluator_daily":
        from jobs.evaluator_daily import run_evaluator_daily_for_user as run_for_user
        eligible = [e for e in enrollments if e.daily_enabled]
    elif command == "evaluator_weekly":
        from jobs.evaluator_weekly import run_evaluator_weekly_for_user as run_for_user
        eligible = [e for e in enrollments if e.weekly_enabled]
    elif command == "reminder":
        from jobs.reminder import run_reminder_for_user as run_for_user
        eligible = [e for e in enrollments if e.daily_enabled]
    elif command == "retention":
        from jobs.retention import run_retention_for_user as run_for_user
        eligible = [e for e in enrollments if e.weekly_enabled]
    elif command == "morning_brief":
        from jobs.morning_brief import run_morning_brief_for_user as run_for_user
        eligible = [e for e in enrollments if e.daily_enabled]
    else:  # project_health
        from jobs.project_health import run_project_health_for_user as run_for_user
        eligible = [e for e in enrollments if e.weekly_enabled]

    logger.info("%d user(s) eligible for %s", len(eligible), command)

    total_ok = 0
    total_err = 0

    for enrollment in eligible:
        user_id = enrollment.user_id
        timezone = enrollment.timezone

        # Exchange the stored refresh token for a fresh 15-min access JWT.
        try:
            client = AgentClient.from_enrollment_token(
                base_url=config.AGENT_BASE_URL,
                refresh_token=enrollment.refresh_token,
                timeout=config.HTTP_TIMEOUT_SECONDS,
            )
        except AgentApiError as exc:
            logger.error("token exchange failed user=%s: %s", user_id[:8], exc)
            enrollment_store.record_run_outcome(user_id, "error", str(exc))
            total_err += 1
            continue

        outcome = run_for_user(client, user_id, timezone, state_store, audit_store)

        enrollment_store.record_run_outcome(
            user_id,
            outcome,
            None if outcome != "error" else f"{command} job failed",
        )

        if outcome == "error":
            total_err += 1
        else:
            total_ok += 1

    logger.info(
        "agent-runner finished command=%s ok=%d err=%d",
        command, total_ok, total_err,
    )

    # Exit non-zero if every user failed — Railway can alert on this.
    if total_err > 0 and total_ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
