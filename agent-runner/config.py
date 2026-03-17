"""
Configuration for the todo agent runner.
All values are read from environment variables at import time.
"""
import os

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Required environment variable {name!r} is not set")
    return value


def _optional(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name, str(default)).strip().lower()
    return raw in ("1", "true", "yes")


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


# ── Required ──────────────────────────────────────────────────────────────────
AGENT_BASE_URL: str = _require("AGENT_BASE_URL")

# Postgres URL — shared with the main server so the runner can read
# agent_enrollments and write job-run state + audit log.
DATABASE_URL: str = _require("DATABASE_URL")

# ── Optional ──────────────────────────────────────────────────────────────────

# IANA timezone for scheduling context (affects period_key labels + report ts).
TIMEZONE: str = _optional("TIMEZONE", "America/New_York")

# When True, safe allowlisted actions are executed; when False, suggest-only.
AUTO_APPLY: bool = _bool("AUTO_APPLY", False)

# When True, no writes are ever issued — safe for smoke-testing config.
DRY_RUN: bool = _bool("DRY_RUN", False)

# Delivery backend: "log" | "email" | "slack"
DELIVERY_MODE: str = _optional("DELIVERY_MODE", "log")

# Email delivery (used when DELIVERY_MODE=email; applied per-user from their preferences in future)
EMAIL_TO: str = _optional("EMAIL_TO")
SMTP_HOST: str = _optional("SMTP_HOST")
SMTP_PORT: int = _int("SMTP_PORT", 587)
SMTP_USER: str = _optional("SMTP_USER")
SMTP_PASS: str = _optional("SMTP_PASS")
SMTP_FROM: str = _optional("SMTP_FROM")

# Slack delivery (used when DELIVERY_MODE=slack)
SLACK_WEBHOOK_URL: str = _optional("SLACK_WEBHOOK_URL")

# HTTP timeout for calls to the agent API, in seconds.
HTTP_TIMEOUT_SECONDS: int = _int("HTTP_TIMEOUT_SECONDS", 60)

# Log level for the runner process.
LOG_LEVEL: str = _optional("LOG_LEVEL", "INFO").upper()

# Maximum number of write actions applied per job run (circuit-breaker).
MAX_WRITE_ACTIONS_PER_RUN: int = _int("MAX_WRITE_ACTIONS_PER_RUN", 20)

# Inbox agent: minimum confidence (0–1) required to auto-apply a triage suggestion.
# Items below this threshold are marked needs_review and never auto-applied.
MAX_AUTO_TRIAGE_CONFIDENCE: float = float(_optional("MAX_AUTO_TRIAGE_CONFIDENCE", "0.9"))

# Watchdog: tasks untouched for this many days are flagged as stale.
STALE_THRESHOLD_DAYS: int = _int("STALE_THRESHOLD_DAYS", 14)

# Watchdog: waiting tasks older than this many days without a follow-up trigger one.
WAITING_FOLLOW_UP_DAYS: int = _int("WAITING_FOLLOW_UP_DAYS", 7)
