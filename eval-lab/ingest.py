"""Production failure ingestion pipeline.

Accepts failure reports from production (support tickets, error logs, user complaints),
converts them to eval case format, and queues them for review.

Usage:
    python ingest.py --source support_ticket --file ticket.json
    python ingest.py --source error_log --file errors.jsonl
    python ingest.py --list  # List queued cases for review
    python ingest.py --approve case-001 --family structured_extraction
    python ingest.py --reject case-001 --reason "not reproducible"
"""
from __future__ import annotations

import argparse
import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ── Ingestion Data Models ────────────────────────────────────────────────────

@dataclass
class FailureReport:
    """A failure report from production."""
    source: str  # "support_ticket", "error_log", "user_complaint"
    source_text: str  # The raw text describing the failure
    expected_output: Optional[dict[str, Any]] = None
    actual_output: Optional[dict[str, Any]] = None
    failure_type: str = "unknown"
    severity: str = "medium"  # "low", "medium", "high", "critical"
    affected_users: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)
    reported_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class IngestedCase:
    """A failure report converted to eval case format."""
    case_id: str
    family: str  # Suggested family (heuristic)
    input_data: dict[str, Any]
    expected_data: dict[str, Any]
    source: str
    severity: str
    affected_users: int
    status: str = "queued"  # "queued", "approved", "rejected"
    review_notes: str = ""
    ingested_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Ingestion Pipeline ───────────────────────────────────────────────────────

class IngestionPipeline:
    """Manages production failure ingestion and review queue."""
    
    def __init__(self, queue_dir: Optional[Path] = None):
        self.queue_dir = queue_dir or Path(__file__).parent / "ingestion_queue"
        self.queue_dir.mkdir(parents=True, exist_ok=True)
    
    def ingest(self, report: FailureReport) -> IngestedCase:
        """Convert a failure report to eval case format and queue for review."""
        # Heuristic: suggest family based on source text keywords
        family = self._suggest_family(report.source_text)
        
        # Create eval case
        case = IngestedCase(
            case_id=f"ingest-{uuid.uuid4().hex[:8]}",
            family=family,
            input_data={"source_text": report.source_text, "source_type": report.source},
            expected_data={"expected_tasks": report.expected_output or []},
            source=report.source,
            severity=report.severity,
            affected_users=report.affected_users,
        )
        
        # Save to queue
        case_path = self.queue_dir / f"{case.case_id}.json"
        with open(case_path, "w") as f:
            json.dump({
                "case_id": case.case_id,
                "family": case.family,
                "input_data": case.input_data,
                "expected_data": case.expected_data,
                "source": case.source,
                "severity": case.severity,
                "affected_users": case.affected_users,
                "status": case.status,
                "review_notes": case.review_notes,
                "ingested_at": case.ingested_at,
            }, f, indent=2)
        
        return case
    
    def list_queue(self, status: Optional[str] = None) -> list[IngestedCase]:
        """List cases in the review queue."""
        cases = []
        for case_file in sorted(self.queue_dir.glob("*.json")):
            with open(case_file) as f:
                data = json.load(f)
            if status and data.get("status") != status:
                continue
            cases.append(IngestedCase(**data))
        return cases
    
    def approve(self, case_id: str, family: str, notes: str = "") -> bool:
        """Approve a case for inclusion in benchmark."""
        case_path = self.queue_dir / f"{case_id}.json"
        if not case_path.exists():
            return False
        
        with open(case_path) as f:
            data = json.load(f)
        
        data["status"] = "approved"
        data["family"] = family
        data["review_notes"] = notes
        
        with open(case_path, "w") as f:
            json.dump(data, f, indent=2)
        
        return True
    
    def reject(self, case_id: str, reason: str = "") -> bool:
        """Reject a case from the queue."""
        case_path = self.queue_dir / f"{case_id}.json"
        if not case_path.exists():
            return False
        
        with open(case_path) as f:
            data = json.load(f)
        
        data["status"] = "rejected"
        data["review_notes"] = reason
        
        with open(case_path, "w") as f:
            json.dump(data, f, indent=2)
        
        return True
    
    def get_approved_cases(self, family: str) -> list[dict[str, Any]]:
        """Get approved cases for a family, ready for benchmark inclusion."""
        cases = []
        for case_file in sorted(self.queue_dir.glob("*.json")):
            with open(case_file) as f:
                data = json.load(f)
            if data.get("status") == "approved" and data.get("family") == family:
                cases.append({
                    "input": data["input_data"],
                    "expected": data["expected_data"],
                    "metadata": {
                        "source": "production_derived",
                        "severity": data.get("severity", "medium"),
                        "affected_users": data.get("affected_users", 1),
                        "review_notes": data.get("review_notes", ""),
                    },
                })
        return cases
    
    def _suggest_family(self, source_text: str) -> str:
        """Heuristic: suggest family based on source text keywords."""
        text_lower = source_text.lower()
        
        if any(kw in text_lower for kw in ["extract", "task from", "note to task", "email task"]):
            return "structured_extraction"
        elif any(kw in text_lower for kw in ["plan", "goal", "decompose", "break down"]):
            return "plan_from_goal"
        elif any(kw in text_lower for kw in ["critic", "quality", "well-defined", "vague"]):
            return "task_critic"
        elif any(kw in text_lower for kw in ["rewrite", "improve", "clarify", "rephrase"]):
            return "task_rewriter"
        elif any(kw in text_lower for kw in ["prioritize", "rank", "order", "urgent"]):
            return "prioritization"
        elif any(kw in text_lower for kw in ["ask", "clarify", "question", "missing info"]):
            return "clarification_policy"
        else:
            return "structured_extraction"  # Default


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Production failure ingestion pipeline")
    subparsers = parser.add_subparsers(dest="command")
    
    # Ingest command
    ingest_parser = subparsers.add_parser("ingest")
    ingest_parser.add_argument("--source", required=True, help="Source type (support_ticket, error_log, user_complaint)")
    ingest_parser.add_argument("--file", required=True, help="Path to failure report JSON")
    ingest_parser.add_argument("--queue-dir", type=str, default=None, help="Queue directory")
    
    # List command
    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--status", type=str, default=None, help="Filter by status (queued, approved, rejected)")
    list_parser.add_argument("--queue-dir", type=str, default=None, help="Queue directory")
    
    # Approve command
    approve_parser = subparsers.add_parser("approve")
    approve_parser.add_argument("case_id", help="Case ID to approve")
    approve_parser.add_argument("--family", required=True, help="Target family")
    approve_parser.add_argument("--notes", type=str, default="", help="Review notes")
    approve_parser.add_argument("--queue-dir", type=str, default=None, help="Queue directory")
    
    # Reject command
    reject_parser = subparsers.add_parser("reject")
    reject_parser.add_argument("case_id", help="Case ID to reject")
    reject_parser.add_argument("--reason", type=str, default="", help="Rejection reason")
    reject_parser.add_argument("--queue-dir", type=str, default=None, help="Queue directory")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    queue_dir = Path(args.queue_dir) if args.queue_dir else None
    pipeline = IngestionPipeline(queue_dir)
    
    if args.command == "ingest":
        with open(args.file) as f:
            report_data = json.load(f)
        report = FailureReport(**report_data)
        case = pipeline.ingest(report)
        print(f"Ingested: {case.case_id} (family: {case.family}, severity: {case.severity})")
    
    elif args.command == "list":
        cases = pipeline.list_queue(status=args.status)
        if not cases:
            print("No cases in queue")
            return
        print(f"{'Case ID':<15} {'Family':<25} {'Status':<12} {'Severity':<10} {'Users':<6}")
        print("-" * 70)
        for case in cases:
            print(f"{case.case_id:<15} {case.family:<25} {case.status:<12} {case.severity:<10} {case.affected_users:<6}")
    
    elif args.command == "approve":
        success = pipeline.approve(args.case_id, args.family, args.notes)
        if success:
            print(f"Approved: {args.case_id} → {args.family}")
        else:
            print(f"Case not found: {args.case_id}")
    
    elif args.command == "reject":
        success = pipeline.reject(args.case_id, args.reason)
        if success:
            print(f"Rejected: {args.case_id}")
        else:
            print(f"Case not found: {args.case_id}")


if __name__ == "__main__":
    main()
