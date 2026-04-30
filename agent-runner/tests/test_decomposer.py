from __future__ import annotations

from typing import Any

from jobs import decomposer


class FakeClient:
    def __init__(self, *, suggestions: list[dict[str, Any]]) -> None:
        self.suggestions = suggestions
        self.read_calls: list[tuple[str, dict[str, Any]]] = []
        self.write_calls: list[tuple[str, dict[str, Any], str | None]] = []

    def read(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        self.read_calls.append((action, params))
        if action == "list_projects_without_next_action":
            return {"data": {"projects": [{"id": "project-1", "name": "Inbox Zero"}]}}
        if action == "analyze_project_health":
            return {"data": {"health": {"status": "at_risk"}}}
        if action == "suggest_next_actions":
            return {"data": {"suggestions": self.suggestions}}
        raise AssertionError(f"unexpected read action: {action}")

    def write(
        self,
        action: str,
        params: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        self.write_calls.append((action, params, idempotency_key))
        if action != "ensure_next_action":
            raise AssertionError(f"unexpected write action: {action}")
        return {"data": {"task": {"id": "task-1", "title": "Draft next action"}}}


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
        raise AssertionError("decomposer tests should not fail")


class FakeAuditStore:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []

    def record(self, *args: Any, **kwargs: Any) -> None:
        self.records.append({"args": args, "kwargs": kwargs})


def test_run_decomposer_skips_projects_without_suggestions(monkeypatch) -> None:
    client = FakeClient(suggestions=[])
    state_store = FakeStateStore()
    audit_store = FakeAuditStore()
    delivered_reports: list[dict[str, Any]] = []

    monkeypatch.setattr(decomposer.config, "DRY_RUN", False)
    monkeypatch.setattr(decomposer.config, "AUTO_APPLY", True)
    monkeypatch.setattr(decomposer, "deliver_report", delivered_reports.append)

    outcome = decomposer.run_decomposer_for_user(
        client=client,
        user_id="user-12345678",
        timezone="America/New_York",
        state_store=state_store,
        audit_store=audit_store,
    )

    assert outcome == "success"
    assert client.write_calls == []
    assert state_store.completed is not None
    assert state_store.completed[2] == {
        "stuckProjectCount": 1,
        "analyzedCount": 1,
        "appliedCount": 0,
        "skippedCount": 1,
        "errorCount": 0,
    }
    assert delivered_reports[0]["skipped"] == [{"projectId": "project-1", "reason": "no_suggestions"}]


def test_run_decomposer_applies_next_action_when_suggestions_exist(monkeypatch) -> None:
    client = FakeClient(
        suggestions=[{"title": "Draft agenda", "confidence": 0.9, "type": "next_action"}]
    )
    state_store = FakeStateStore()
    audit_store = FakeAuditStore()
    delivered_reports: list[dict[str, Any]] = []

    monkeypatch.setattr(decomposer.config, "DRY_RUN", False)
    monkeypatch.setattr(decomposer.config, "AUTO_APPLY", True)
    monkeypatch.setattr(decomposer.config, "MAX_WRITE_ACTIONS_PER_RUN", 1)
    monkeypatch.setattr(decomposer, "deliver_report", delivered_reports.append)

    outcome = decomposer.run_decomposer_for_user(
        client=client,
        user_id="user-12345678",
        timezone="America/New_York",
        state_store=state_store,
        audit_store=audit_store,
    )

    assert outcome == "success"
    assert client.write_calls == [
        (
            "ensure_next_action",
            {"projectId": "project-1", "mode": "apply"},
            client.write_calls[0][2],
        )
    ]
    assert client.write_calls[0][2] is not None
    assert delivered_reports[0]["applied"] == [
        {
            "type": "ensure_next_action",
            "projectId": "project-1",
            "projectName": "Inbox Zero",
        }
    ]
    assert delivered_reports[0]["analyses"][0]["appliedAction"] == "ensure_next_action"
