from __future__ import annotations

import sys
from types import ModuleType, SimpleNamespace
from typing import Any, Callable

import pytest

import main


class FakeAuditStore:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        self.schema_ensured = False

    def ensure_schema(self) -> None:
        self.schema_ensured = True


class FakeJobRunState:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        self.schema_ensured = False

    def ensure_schema(self) -> None:
        self.schema_ensured = True


class FakeEnrollmentStore:
    instances: list["FakeEnrollmentStore"] = []
    enrollments: list[Any] = []

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        self.recorded_outcomes: list[tuple[str, str, str | None]] = []
        FakeEnrollmentStore.instances.append(self)

    def get_active_enrollments(self) -> list[Any]:
        return list(FakeEnrollmentStore.enrollments)

    def record_run_outcome(
        self,
        user_id: str,
        status: str,
        error: str | None = None,
    ) -> None:
        self.recorded_outcomes.append((user_id, status, error))


def install_main_dependencies(
    monkeypatch,
    *,
    run_for_user: Callable[..., str],
    enrollments: list[Any],
    token_exchange_error_message: str | None = None,
) -> type[Exception]:
    FakeEnrollmentStore.instances.clear()
    FakeEnrollmentStore.enrollments = enrollments

    config_module = ModuleType("config")
    config_module.AGENT_BASE_URL = "https://api.example.com"
    config_module.DATABASE_URL = "postgresql://example"
    config_module.DRY_RUN = False
    config_module.AUTO_APPLY = False
    config_module.HTTP_TIMEOUT_SECONDS = 12

    mcp_client_module = ModuleType("mcp_client")

    class FakeAgentApiError(Exception):
        pass

    class FakeAgentClient:
        calls: list[tuple[str, str, int]] = []

        @classmethod
        def from_enrollment_token(
            cls,
            *,
            base_url: str,
            refresh_token: str,
            timeout: int,
        ) -> str:
            cls.calls.append((base_url, refresh_token, timeout))
            if token_exchange_error_message is not None:
                raise FakeAgentApiError(token_exchange_error_message)
            return "client-token"

    mcp_client_module.AgentApiError = FakeAgentApiError
    mcp_client_module.AgentClient = FakeAgentClient

    audit_store_module = ModuleType("storage.audit_store")
    audit_store_module.AuditStore = FakeAuditStore

    enrollment_store_module = ModuleType("storage.enrollment_store")
    enrollment_store_module.EnrollmentStore = FakeEnrollmentStore

    state_store_module = ModuleType("storage.state_store")
    state_store_module.JobRunState = FakeJobRunState

    jobs_daily_module = ModuleType("jobs.daily")
    jobs_daily_module.run_daily_for_user = run_for_user

    monkeypatch.setitem(sys.modules, "config", config_module)
    monkeypatch.setitem(sys.modules, "mcp_client", mcp_client_module)
    monkeypatch.setitem(sys.modules, "storage.audit_store", audit_store_module)
    monkeypatch.setitem(sys.modules, "storage.enrollment_store", enrollment_store_module)
    monkeypatch.setitem(sys.modules, "storage.state_store", state_store_module)
    monkeypatch.setitem(sys.modules, "jobs.daily", jobs_daily_module)

    return FakeAgentApiError


def test_main_exits_with_usage_for_invalid_command(monkeypatch, capsys) -> None:
    monkeypatch.setattr(sys, "argv", ["main.py", "bogus"])

    with pytest.raises(SystemExit) as exc:
        main.main()

    assert exc.value.code == 1
    assert "Usage: python main.py" in capsys.readouterr().out


def test_main_dispatches_daily_command_for_eligible_enrollment(monkeypatch) -> None:
    run_calls: list[tuple[Any, str, str, Any, Any]] = []

    def fake_run_for_user(client, user_id, timezone, state_store, audit_store) -> str:
        run_calls.append((client, user_id, timezone, state_store, audit_store))
        return "success"

    install_main_dependencies(
        monkeypatch,
        run_for_user=fake_run_for_user,
        enrollments=[
            SimpleNamespace(
                user_id="user-12345678",
                refresh_token="refresh-1",
                timezone="America/New_York",
                daily_enabled=True,
                weekly_enabled=False,
            )
        ],
    )
    monkeypatch.setattr(sys, "argv", ["main.py", "daily"])

    main.main()

    assert len(run_calls) == 1
    assert run_calls[0][0] == "client-token"
    assert run_calls[0][1:] and run_calls[0][1] == "user-12345678"
    assert FakeEnrollmentStore.instances[0].recorded_outcomes == [
        ("user-12345678", "success", None)
    ]


def test_main_exits_non_zero_when_every_token_exchange_fails(monkeypatch) -> None:
    def fake_run_for_user(*args: Any, **kwargs: Any) -> str:
        raise AssertionError("run_for_user should not be called when token exchange fails")

    install_main_dependencies(
        monkeypatch,
        run_for_user=fake_run_for_user,
        enrollments=[
            SimpleNamespace(
                user_id="user-12345678",
                refresh_token="refresh-1",
                timezone="America/New_York",
                daily_enabled=True,
                weekly_enabled=False,
            )
        ],
        token_exchange_error_message="token exchange failed",
    )
    monkeypatch.setattr(sys, "argv", ["main.py", "daily"])

    with pytest.raises(SystemExit) as exc:
        main.main()

    assert exc.value.code == 1
    assert FakeEnrollmentStore.instances[0].recorded_outcomes == [
        ("user-12345678", "error", "token exchange failed")
    ]
