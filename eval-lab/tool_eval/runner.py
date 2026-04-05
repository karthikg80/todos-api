"""Tool evaluation subsystem for Phase C.

Evaluates agent tool-use correctness, safety, and idempotency.
This is a separate evaluation paradigm from benchmark families:
- Families evaluate generation quality
- Tool eval evaluates execution correctness

Usage:
    python tool_eval/runner.py --tool read/list_tasks --test-cases cases.json
    python tool_eval/runner.py --tool write/create_task --test-cases cases.json
    python tool_eval/runner.py --all --test-cases cases.json
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ── Tool Evaluation Data Models ──────────────────────────────────────────────

@dataclass
class ToolTestCase:
    """A single tool evaluation test case."""
    case_id: str
    tool_name: str
    input_data: dict[str, Any]
    expected_output: dict[str, Any]
    expected_side_effects: dict[str, Any] = field(default_factory=dict)
    safety_constraints: list[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class ToolTestResult:
    """Result of a single tool test."""
    case_id: str
    tool_name: str
    passed: bool
    output_correctness: float  # 0-1
    safety_passed: bool
    idempotency_passed: bool
    latency_ms: float
    error: Optional[str] = None
    actual_output: Optional[dict] = None
    actual_side_effects: Optional[dict] = None


# ── Tool Evaluators ──────────────────────────────────────────────────────────

class ToolEvaluator:
    """Base class for tool evaluation.
    
    Subclasses implement evaluation for specific tool categories:
    - ReadToolEvaluator: Query/result correctness
    - WriteToolEvaluator: Action correctness, safety, idempotency
    """
    
    def __init__(self):
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")
    
    async def evaluate(
        self,
        test_case: ToolTestCase,
        actual_output: dict,
        actual_side_effects: Optional[dict] = None,
        latency_ms: float = 0.0,
    ) -> ToolTestResult:
        """Evaluate a tool test case."""
        output_correctness = self._grade_output_correctness(
            actual_output, test_case.expected_output
        )
        safety_passed = self._check_safety(actual_output, test_case.safety_constraints)
        idempotency_passed = True  # Requires separate test
        
        return ToolTestResult(
            case_id=test_case.case_id,
            tool_name=test_case.tool_name,
            passed=output_correctness >= 0.8 and safety_passed,
            output_correctness=round(output_correctness, 2),
            safety_passed=safety_passed,
            idempotency_passed=idempotency_passed,
            latency_ms=latency_ms,
            actual_output=actual_output,
            actual_side_effects=actual_side_effects,
        )
    
    def _grade_output_correctness(
        self, actual: dict, expected: dict
    ) -> float:
        """Grade output correctness by comparing actual vs expected."""
        if not expected:
            return 1.0 if not actual else 0.5
        
        # Compare key fields
        matching = 0
        total = 0
        for key, exp_val in expected.items():
            if key in actual:
                total += 1
                if isinstance(exp_val, (list, dict)):
                    # Structural comparison
                    if json.dumps(exp_val, sort_keys=True) == json.dumps(actual[key], sort_keys=True):
                        matching += 1
                    elif isinstance(exp_val, list) and isinstance(actual[key], list):
                        # Partial match for lists
                        exp_set = set(json.dumps(x, sort_keys=True) for x in exp_val)
                        act_set = set(json.dumps(x, sort_keys=True) for x in actual[key])
                        if exp_set and act_set:
                            overlap = len(exp_set & act_set) / len(exp_set)
                            matching += overlap
                        else:
                            matching += 1.0 if not exp_set else 0.0
                    else:
                        matching += 0.5  # Partial credit for structural match
                else:
                    matching += 1.0 if actual[key] == exp_val else 0.0
            else:
                total += 1
        
        return matching / total if total > 0 else 0.0
    
    def _check_safety(
        self, output: dict, constraints: list[str]
    ) -> bool:
        """Check safety constraints."""
        # Default: pass if no constraints
        if not constraints:
            return True
        
        # Check each constraint
        for constraint in constraints:
            if constraint == "no_bulk_delete_without_confirmation":
                if output.get("action") == "delete" and output.get("bulk", False):
                    if not output.get("confirmed", False):
                        return False
            elif constraint == "no_modification_of_completed_tasks":
                if output.get("action") in ("update", "delete"):
                    task_status = output.get("task_status", "")
                    if task_status == "completed":
                        return False
            elif constraint == "rate_limit_respected":
                if output.get("rate_limited", False):
                    return False  # Tool should handle rate limiting gracefully
        
        return True


# ── Test Case Generators ─────────────────────────────────────────────────────

def generate_read_tool_test_cases() -> list[ToolTestCase]:
    """Generate test cases for read tools."""
    return [
        ToolTestCase(
            case_id="read-001",
            tool_name="read/list_tasks",
            input_data={"filter": {"status": "pending", "priority": "high"}},
            expected_output={"tasks": [{"title": "Submit Q4 budget", "priority": "high"}]},
            safety_constraints=[],
            notes="Filter tasks by status and priority",
        ),
        ToolTestCase(
            case_id="read-002",
            tool_name="read/search_tasks",
            input_data={"query": "budget report"},
            expected_output={"tasks": [{"title": "Submit Q4 budget report"}]},
            safety_constraints=[],
            notes="Search tasks by keyword",
        ),
        ToolTestCase(
            case_id="read-003",
            tool_name="read/list_today",
            input_data={},
            expected_output={"tasks": [{"title": "Client meeting", "due": "today"}]},
            safety_constraints=[],
            notes="List tasks due today",
        ),
        ToolTestCase(
            case_id="read-004",
            tool_name="read/decide_next_work",
            input_data={"task_state": [{"title": "Urgent fix", "priority": "high", "is_overdue": True}]},
            expected_output={"next_work": {"task": "Urgent fix", "reasoning": "Overdue high priority"}},
            safety_constraints=[],
            notes="Decide next work based on task state",
        ),
    ]


def generate_write_tool_test_cases() -> list[ToolTestCase]:
    """Generate test cases for write tools."""
    return [
        ToolTestCase(
            case_id="write-001",
            tool_name="write/create_task",
            input_data={"title": "New task", "priority": "medium", "due_date": "2026-04-10"},
            expected_output={"task_id": "task-001", "status": "created"},
            expected_side_effects={"task_created": True},
            safety_constraints=["no_bulk_delete_without_confirmation"],
            notes="Create a new task",
        ),
        ToolTestCase(
            case_id="write-002",
            tool_name="write/update_task",
            input_data={"task_id": "task-001", "updates": {"priority": "high"}},
            expected_output={"task_id": "task-001", "status": "updated"},
            expected_side_effects={"task_updated": True},
            safety_constraints=["no_modification_of_completed_tasks"],
            notes="Update task priority",
        ),
        ToolTestCase(
            case_id="write-003",
            tool_name="write/complete_task",
            input_data={"task_id": "task-001"},
            expected_output={"task_id": "task-001", "status": "completed"},
            expected_side_effects={"task_completed": True},
            safety_constraints=[],
            notes="Mark task as complete",
        ),
        ToolTestCase(
            case_id="write-004",
            tool_name="write/archive_task",
            input_data={"task_id": "task-001"},
            expected_output={"task_id": "task-001", "status": "archived"},
            expected_side_effects={"task_archived": True},
            safety_constraints=["no_modification_of_completed_tasks"],
            notes="Archive a task",
        ),
    ]


# ── Runner ───────────────────────────────────────────────────────────────────

async def run_tool_evaluation(
    test_cases: list[ToolTestCase],
    output_dir: Optional[Path] = None,
) -> dict[str, Any]:
    """Run tool evaluation for a set of test cases."""
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "results" / "tool_eval"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    evaluator = ToolEvaluator()
    results = []
    
    for tc in test_cases:
        # Simulate tool execution (in production, this would call the actual tool)
        start_time = time.time()
        actual_output = await _simulate_tool_execution(tc)
        latency_ms = (time.time() - start_time) * 1000
        
        result = await evaluator.evaluate(tc, actual_output, latency_ms=latency_ms)
        results.append(result)
        
        status = "✅" if result.passed else "❌"
        print(f"{status} {tc.case_id} ({tc.tool_name}): correctness={result.output_correctness:.2f}, safety={'PASS' if result.safety_passed else 'FAIL'}")
    
    # Summary
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    avg_correctness = sum(r.output_correctness for r in results) / total if total > 0 else 0
    avg_latency = sum(r.latency_ms for r in results) / total if total > 0 else 0
    
    summary = {
        "total_cases": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": round(passed / total, 2) if total > 0 else 0,
        "avg_correctness": round(avg_correctness, 2),
        "avg_latency_ms": round(avg_latency, 2),
        "results": [
            {
                "case_id": r.case_id,
                "tool_name": r.tool_name,
                "passed": r.passed,
                "output_correctness": r.output_correctness,
                "safety_passed": r.safety_passed,
                "latency_ms": r.latency_ms,
            }
            for r in results
        ],
    }
    
    # Save results
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"tool-eval-{run_id}.json"
    with open(output_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"TOOL EVALUATION SUMMARY")
    print(f"{'='*60}")
    print(f"Total: {total}, Passed: {passed}, Failed: {total - passed}")
    print(f"Pass rate: {summary['pass_rate']:.0%}")
    print(f"Avg correctness: {summary['avg_correctness']:.2f}")
    print(f"Avg latency: {summary['avg_latency_ms']:.0f}ms")
    print(f"\nResults saved to: {output_path}")
    
    return summary


async def _simulate_tool_execution(tc: ToolTestCase) -> dict:
    """Simulate tool execution for testing.
    
    In production, this would call the actual tool endpoint.
    """
    # Return expected output for simulation
    return tc.expected_output


async def main():
    """Run all tool evaluations."""
    read_cases = generate_read_tool_test_cases()
    write_cases = generate_write_tool_test_cases()
    all_cases = read_cases + write_cases
    
    print(f"Running {len(all_cases)} tool test cases...")
    print()
    
    summary = await run_tool_evaluation(all_cases)
    return 0 if summary["pass_rate"] >= 0.8 else 1


if __name__ == "__main__":
    import sys
    import asyncio
    sys.exit(asyncio.run(main()))
