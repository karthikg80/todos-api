from __future__ import annotations

from typing import Any

from jobs import watchdog


class FakeClient:
    def __init__(self, *, cooldown_active: bool = False) -> None:
        self.cooldown_active = cooldown_active
        self.read_calls: list[tuple[str, dict[str, Any]]] = []
        self.write_calls: list[tuple[str, dict[str, Any], str | None]] = []

    def read(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        self.read_calls.append((action, params))
        if action == "find_stale_items":
            return {
                "data": {
                    "items": [
                        {
                            "id": "stale-1",
                            "title": "Stale task",
                            "daysSinceUpdate": 21,
                        }
                    ]
                }
            }
        if action == "list_waiting_on":
            return {
                "data": {
                    "tasks": [
                        {
                            "id": "waiting-1",
                            "title": "Follow up with vendor",
                        }
                    ]
                }
            }
        if action == "list_projects_without_next_action":
            return {
                "data": {
                    "projects": [
                        {
                            "id": "project-1",
                            "name": "Inbox Zero",
                        }
                    ]
                }
            }
        raise AssertionError(f"unexpected read action: {action}")

    def write(
        self,
        action: str,
        params: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        self.write_calls.append((action, params, idempotency_key))
        if action != "create_follow_up_for_waiting_task":
            raise AssertionError(f"unexpected write action: {action}")
        if self.cooldown_active:
            return {"data": {"skipped": True}}
        return {"data": {"task": {"id": "follow-up-1", "title": "Ping vendor"}}}


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
        raise AssertionError("watchdog tests should not fail")


class FakeAuditStore:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []

    def record(self, *args: Any, **kwargs: Any) -> None:
        self.records.append({"args": args, "kwargs": kwargs})


def test_run_watchdog_for_user_smoke_dry_run(monkeypatch) -> None:
    client = FakeClient()
    state_store = FakeStateStore()
    audit_store = FakeAuditStore()
    delivered_reports: list[dict[str, Any]] = []

    monkeypatch.setattr(watchdog.config, "DRY_RUN", True)
    monkeypatch.setattr(watchdog.config, "AUTO_APPLY", True)
    monkeypatch.setattr(watchdog.config, "STALE_THRESHOLD_DAYS", 14)
    monkeypatch.setattr(watchdog.config, "WAITING_FOLLOW_UP_DAYS", 7)
    monkeypatch.setattr(watchdog, "deliver_report", delivered_reports.append)

    outcome = watchdog.run_watchdog_for_user(
        client=client,
        user_id="user-12345678",
        timezone="America/New_York",
        state_store=state_store,
        audit_store=audit_store,
    )

    assert outcome == "success"
    assert [call[0] for call in client.read_calls] == [
        "find_stale_items",
        "list_waiting_on",
        "list_projects_without_next_action",
    ]
    assert client.write_calls == []
    assert state_store.completed is not None
    assert state_store.completed[2] == {
        "findingCount": 3,
        "staleTaskCount": 1,
        "waitingTaskCount": 1,
        "projectsMissingNextAction": 1,
        "appliedCount": 0,
        "skippedCount": 1,
        "errorCount": 0,
    }
    assert delivered_reports[0]["skipped"] == [{"taskId": "waiting-1", "reason": "dry_run"}]


def test_run_watchdog_marks_cooldown_active_as_skipped(monkeypatch) -> None:
    client = FakeClient(cooldown_active=True)
    state_store = FakeStateStore()
    audit_store = FakeAuditStore()
    delivered_reports: list[dict[str, Any]] = []

    monkeypatch.setattr(watchdog.config, "DRY_RUN", False)
    monkeypatch.setattr(watchdog.config, "AUTO_APPLY", True)
    monkeypatch.setattr(watchdog.config, "MAX_WRITE_ACTIONS_PER_RUN", 1)
    monkeypatch.setattr(watchdog.config, "STALE_THRESHOLD_DAYS", 14)
    monkeypatch.setattr(watchdog.config, "WAITING_FOLLOW_UP_DAYS", 7)
    monkeypatch.setattr(watchdog, "deliver_report", delivered_reports.append)

    outcome = watchdog.run_watchdog_for_user(
        client=client,
        user_id="user-12345678",
        timezone="America/New_York",
        state_store=state_store,
        audit_store=audit_store,
    )

    assert outcome == "success"
    assert client.write_calls == [
        (
            "create_follow_up_for_waiting_task",
            {"taskId": "waiting-1", "mode": "apply", "cooldownDays": 7},
            client.write_calls[0][2],
        )
    ]
    assert client.write_calls[0][2] is not None
    assert delivered_reports[0]["applied"] == []
    assert delivered_reports[0]["skipped"] == [{"taskId": "waiting-1", "reason": "cooldown_active"}]

