"""
Enrollment store — reads agent_enrollments and updates run outcomes.

The runner shares DATABASE_URL with the main server so it can read the
enrollment table directly. The refreshToken column holds the plaintext token
that the runner passes to /api/agent-enrollment/exchange to get a JWT.
After exchange the server rotates the token in-place; the runner always reads
the latest value from the DB at the start of each run.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class Enrollment:
    user_id: str
    refresh_token: str
    timezone: str
    daily_enabled: bool
    weekly_enabled: bool


class EnrollmentStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def get_active_enrollments(self) -> list[Enrollment]:
        """Return all active enrollments with their current refresh tokens."""
        conn = self._connect()
        if conn is None:
            return []
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT user_id, refresh_token, timezone,
                           daily_enabled, weekly_enabled
                    FROM   agent_enrollments
                    WHERE  active = true
                    ORDER  BY enrolled_at
                    """
                )
                rows = cur.fetchall()
            return [
                Enrollment(
                    user_id=r[0],
                    refresh_token=r[1],
                    timezone=r[2],
                    daily_enabled=r[3],
                    weekly_enabled=r[4],
                )
                for r in rows
            ]
        finally:
            conn.close()

    def record_run_outcome(
        self,
        user_id: str,
        status: str,  # success | partial | error
        error: Optional[str] = None,
    ) -> None:
        """Update last_run_at / last_run_status after a per-user job finishes."""
        conn = self._connect()
        if conn is None:
            return
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE agent_enrollments
                           SET last_run_at     = NOW(),
                               last_run_status = %s,
                               last_run_error  = %s,
                               updated_at      = NOW()
                         WHERE user_id = %s
                        """,
                        (status, error, user_id),
                    )
        except Exception as exc:
            logger.error("Failed to record run outcome for user %s: %s", user_id, exc)
        finally:
            conn.close()

    def _connect(self):
        try:
            import psycopg2

            return psycopg2.connect(self._database_url)
        except Exception as exc:
            logger.error("Failed to connect to Postgres: %s", exc)
            return None
