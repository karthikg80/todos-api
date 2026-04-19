from __future__ import annotations

from typing import Any

from jobs import daily


class FakeClient:
    def __init__(self) -> None:
        self.read_calls: list[tuple[str, dict[str, Any]]] = []
        self.write_calls: list[tuple[str, dict[str, Any], str | None]] = []

    def read(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        self.read_calls.append((action, params))
        if action == "plan_today":
            return {"data": {"plan": {"recommendedTasks": [{"id": "task-1"}]}}}
        if action == "list_waiting_on":
            return {"data": {"tasks": [{"id": "waiting-1"}]}}
        if action == "list_projects_without_next_action":
            return {"data": {"projects": [{"id": "project-1", "name": "Inbox Zero"}]}}
        raise AssertionError(f"unexpected read action: {action}")

    def write(
        self,
        action: str,
        params: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        self.write_calls.append((action, params, idempotency_key))
        raise AssertionError("daily dry-run smoke test should not issue write calls")


class FakeStateStore:
    def __init__(self) -> None:
        self.completed: tuple[str, str, dict[str, Any], str] | None = None

    def is_completed(self, job_name: str, period_key: str, user_id: str) -> bool:
        return False

    def try_claim(self, job_name: str, period_key: str, user_id: str) -> bool:
        return True

    def complete(
        self,
        job_name: str,
        period_key: str,
        summary: dict[str, Any],
        user_id: str,
    ) -> None:
        self.completed = (job_name, period_key, summary, user_id)

    def fail(self, job_name: str, period_key: str, error: str, user_id: str) -> None:
        raise AssertionError("daily dry-run smoke test should not fail")


class FakeAuditStore:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []

    def record(self, *args: Any, **kwargs: Any) -> None:
        self.records.append({"args": args, "kwargs": kwargs})


def test_run_daily_for_user_smoke_dry_run(monkeypatch) -> None:
    client = FakeClient()
    state_store = FakeStateStore()
    audit_store = FakeAuditStore()
    delivered_reports: list[dict[str, Any]] = []

    monkeypatch.setattr(daily.config, "DRY_RUN", True)
    monkeypatch.setattr(daily.config, "AUTO_APPLY", True)
    monkeypatch.setattr(daily.config, "MAX_WRITE_ACTIONS_PER_RUN", 1)
    monkeypatch.setattr(daily, "deliver_report", delivered_reports.append)

    outcome = daily.run_daily_for_user(
        client=client,
        user_id="user-12345678",
        timezone="America/New_York",
        state_store=state_store,
        audit_store=audit_store,
    )

    assert outcome == "success"
    assert [call[0] for call in client.read_calls] == [
        "plan_today",
        "list_waiting_on",
        "list_projects_without_next_action",
    ]
    assert client.write_calls == []
    assert state_store.completed is not None
    assert state_store.completed[2] == {
        "appliedCount": 0,
        "skippedCount": 1,
        "errorCount": 0,
    }
    assert delivered_reports[0]["projectsMissingNextAction"] == 1
    assert delivered_reports[0]["skippedActions"] == [
        {
            "type": "create_next_action",
            "projectId": "project-1",
            "reason": "dry_run",
        }
    ]
