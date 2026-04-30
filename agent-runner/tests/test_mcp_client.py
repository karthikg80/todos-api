from __future__ import annotations

from typing import Any

import pytest

from mcp_client import AgentApiError, AgentClient


class FakeResponse:
    def __init__(self, status_code: int, payload: Any, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self) -> Any:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class FakeHttpClient:
    def __init__(self, responses: list[FakeResponse]) -> None:
        self.responses = responses
        self.calls: list[dict[str, Any]] = []

    def __enter__(self) -> "FakeHttpClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def post(self, url: str, json: Any = None, headers: dict[str, str] | None = None) -> FakeResponse:
        self.calls.append({"url": url, "json": json, "headers": headers})
        return self.responses.pop(0)


def test_from_enrollment_token_exchanges_refresh_token(monkeypatch) -> None:
    fake_client = FakeHttpClient(
        [FakeResponse(200, {"accessToken": "jwt-token", "expiresIn": 900})]
    )
    monkeypatch.setattr("mcp_client.httpx.Client", lambda **kwargs: fake_client)

    client = AgentClient.from_enrollment_token(
        base_url="https://api.example.com/",
        refresh_token="refresh-123",
        timeout=5.0,
        request_id="job-req-123",
    )

    assert isinstance(client, AgentClient)
    assert fake_client.calls == [
        {
            "url": "https://api.example.com/api/agent-enrollment/exchange",
            "json": {"refreshToken": "refresh-123"},
            "headers": {
                "Content-Type": "application/json",
                "X-Request-Id": "job-req-123",
                "X-Agent-Request-Id": "job-req-123",
            },
        }
    ]


def test_read_targets_agent_read_endpoint(monkeypatch) -> None:
    fake_client = FakeHttpClient(
        [FakeResponse(200, {"ok": True, "data": {"tasks": ["waiting-1"]}})]
    )
    monkeypatch.setattr("mcp_client.httpx.Client", lambda **kwargs: fake_client)

    client = AgentClient(base_url="https://api.example.com", token="token-123")
    response = client.read("list_waiting_on", {"limit": 5}, idempotency_key="ikey-1")

    assert response == {"ok": True, "data": {"tasks": ["waiting-1"]}}
    assert fake_client.calls[0]["url"] == "https://api.example.com/agent/read/list_waiting_on"
    assert fake_client.calls[0]["json"] == {"limit": 5}
    assert fake_client.calls[0]["headers"]["Authorization"] == "Bearer token-123"
    assert fake_client.calls[0]["headers"]["Idempotency-Key"] == "ikey-1"
    assert "X-Request-Id" in fake_client.calls[0]["headers"]
    assert (
        fake_client.calls[0]["headers"]["X-Agent-Request-Id"]
        == fake_client.calls[0]["headers"]["X-Request-Id"]
    )


def test_write_reuses_explicit_request_id_across_calls(monkeypatch) -> None:
    fake_client = FakeHttpClient(
        [
            FakeResponse(200, {"ok": True, "data": {"status": "ok"}}),
            FakeResponse(200, {"ok": True, "data": {"status": "ok"}}),
        ]
    )
    monkeypatch.setattr("mcp_client.httpx.Client", lambda **kwargs: fake_client)

    client = AgentClient(
        base_url="https://api.example.com",
        token="token-123",
        request_id="job-req-789",
    )

    client.write("ensure_next_action", {"projectId": "project-1"})
    client.write("weekly_review", {"dryRun": True})

    assert fake_client.calls[0]["headers"]["X-Request-Id"] == "job-req-789"
    assert fake_client.calls[1]["headers"]["X-Request-Id"] == "job-req-789"


def test_write_raises_on_structured_api_error(monkeypatch) -> None:
    fake_client = FakeHttpClient(
        [
            FakeResponse(
                400,
                {
                    "ok": False,
                    "error": {
                        "code": "BAD_INPUT",
                        "message": "bad request",
                        "retryable": False,
                    },
                },
            )
        ]
    )
    monkeypatch.setattr("mcp_client.httpx.Client", lambda **kwargs: fake_client)

    client = AgentClient(base_url="https://api.example.com", token="token-123")

    with pytest.raises(AgentApiError) as exc:
        client.write("ensure_next_action", {"projectId": "project-1"})

    assert exc.value.code == "BAD_INPUT"
    assert exc.value.message == "bad request"
    assert fake_client.calls[0]["url"] == "https://api.example.com/agent/write/ensure_next_action"
