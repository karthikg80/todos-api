"""
HTTP client for the todos-api agent endpoint.

Calls POST /agent/read/<action> and POST /agent/write/<action> with
Bearer auth, optional idempotency key, and structured error mapping.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


class AgentApiError(Exception):
    """Raised when the agent API returns ok=false or a non-2xx status."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        retryable: bool = False,
        hint: str = "",
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable
        self.hint = hint
        super().__init__(f"[{status_code}] {code}: {message}")


class AgentClient:
    """Thin synchronous wrapper around the agent REST API."""

    def __init__(
        self,
        base_url: str,
        token: str,
        timeout: float = 60.0,
        actor_name: str = "todo-agent-runner",
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._timeout = timeout
        self._actor_name = actor_name

    # ── Private ───────────────────────────────────────────────────────────────

    def _headers(self, idempotency_key: Optional[str] = None) -> dict[str, str]:
        headers: dict[str, str] = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
            "X-Agent-Name": self._actor_name,
            "X-Agent-Request-Id": str(uuid.uuid4()),
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return headers

    def _post(
        self,
        path: str,
        body: dict[str, Any],
        idempotency_key: Optional[str] = None,
    ) -> dict[str, Any]:
        url = f"{self._base_url}/agent/{path}"
        headers = self._headers(idempotency_key)

        logger.debug("→ POST %s body=%s", url, body)

        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.post(url, json=body, headers=headers)
        except httpx.TimeoutException as exc:
            raise AgentApiError(
                status_code=0,
                code="TIMEOUT",
                message=f"Request timed out after {self._timeout}s",
                retryable=True,
            ) from exc
        except httpx.RequestError as exc:
            raise AgentApiError(
                status_code=0,
                code="NETWORK_ERROR",
                message=str(exc),
                retryable=True,
            ) from exc

        logger.debug("← %d %s", response.status_code, url)

        try:
            data: dict[str, Any] = response.json()
        except Exception as exc:
            raise AgentApiError(
                status_code=response.status_code,
                code="INVALID_RESPONSE",
                message="Server returned non-JSON response",
                retryable=False,
            ) from exc

        if not data.get("ok"):
            error = data.get("error") or {}
            raise AgentApiError(
                status_code=response.status_code,
                code=error.get("code", "UNKNOWN_ERROR"),
                message=error.get("message", "Unknown error"),
                retryable=bool(error.get("retryable", False)),
                hint=error.get("hint", ""),
            )

        return data

    # ── Public ────────────────────────────────────────────────────────────────

    @classmethod
    def from_enrollment_token(
        cls,
        base_url: str,
        refresh_token: str,
        timeout: float = 60.0,
    ) -> "AgentClient":
        """
        Exchange an enrollment refresh token for a short-lived access JWT
        and return an authenticated client.

        The server rotates the refresh token on every exchange — the new token
        is stored back in agent_enrollments so the next run reads it from the DB.
        """
        url = f"{base_url.rstrip('/')}/api/agent-enrollment/exchange"
        try:
            with httpx.Client(timeout=timeout) as http:
                response = http.post(
                    url,
                    json={"refreshToken": refresh_token},
                    headers={"Content-Type": "application/json"},
                )
        except httpx.RequestError as exc:
            raise AgentApiError(0, "NETWORK_ERROR", str(exc), retryable=True) from exc

        try:
            data = response.json()
        except Exception as exc:
            raise AgentApiError(
                response.status_code, "INVALID_RESPONSE", "Non-JSON exchange response"
            ) from exc

        if response.status_code != 200 or not data.get("accessToken"):
            msg = data.get("error") or "Token exchange failed"
            raise AgentApiError(response.status_code, "TOKEN_EXCHANGE_FAILED", msg, retryable=False)

        token: str = data["accessToken"]
        logger.debug("Token exchange successful (expires_in=%ss)", data.get("expiresIn"))
        return cls(base_url=base_url, token=token, timeout=timeout)

    def read(
        self,
        action: str,
        params: Optional[dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict[str, Any]:
        """Call a read-only agent action."""
        return self._post(f"read/{action}", params or {}, idempotency_key)

    def write(
        self,
        action: str,
        params: Optional[dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict[str, Any]:
        """Call a mutating agent action."""
        return self._post(f"write/{action}", params or {}, idempotency_key)
