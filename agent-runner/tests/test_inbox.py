from __future__ import annotations

from typing import Any

from jobs import inbox


class FakeClient:
    def __init__(self) -> None:
        self.write_calls: list[tuple[str, dict[str, Any], str | None]] = []

    def write(
        self,
        action: str,
        params: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        self.write_calls.append((action, params, idempotency_key))
        if action == "triage_inbox":
            return {
                "data": {
                    "triaged": [
                        {
                            "id": "capture-1",
                            "confidence": 0.4,
                            "suggestedAction": "create_task",
                        }
                    ],
                    "totalProcessed": 1,
                }
            }
        raise AssertionError("low-confidence inbox smoke test should not apply writes")


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
        raise AssertionError("inbox low-confidence smoke test should not fail")


class FakeAuditStore:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []

    def record(self, *args: Any, **kwargs: Any) -> None:
        self.records.append({"args": args, "kwargs": kwargs})


def test_run_inbox_for_user_smoke_low_confidence(monkeypatch) -> None:
    client = FakeClient()
    state_store = FakeStateStore()
    audit_store = FakeAuditStore()
    delivered_reports: list[dict[str, Any]] = []

    monkeypatch.setattr(inbox.config, "DRY_RUN", False)
    monkeypatch.setattr(inbox.config, "AUTO_APPLY", True)
    monkeypatch.setattr(inbox.config, "MAX_AUTO_TRIAGE_CONFIDENCE", 0.9)
    monkeypatch.setattr(inbox, "deliver_report", delivered_reports.append)

    outcome = inbox.run_inbox_for_user(
        client=client,
        user_id="user-12345678",
        timezone="America/New_York",
        state_store=state_store,
        audit_store=audit_store,
    )

    assert outcome == "success"
    assert client.write_calls == [("triage_inbox", {"mode": "suggest", "limit": 50}, None)]
    assert state_store.completed is not None
    assert state_store.completed[2] == {
        "appliedCount": 0,
        "suggestedCount": 1,
        "skippedCount": 0,
        "errorCount": 0,
    }
    assert delivered_reports[0]["suggested"] == [
        {
            "itemId": "capture-1",
            "confidence": 0.4,
            "suggestedAction": "create_task",
            "reason": "low_confidence",
        }
    ]
