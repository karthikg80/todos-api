"""Ambiguous holdout cases for gate analytics.

These cases are near tier boundaries to test whether hard gating
creates false conservatism (suppressing legitimate advanced/power unlocks).

Run these to validate that gates don't overcorrect on ambiguous users.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

from families.feature_exposure import FeatureExposureFamily


# ── Ambiguous Holdout Cases ────────────────────────────────────────────────

AMBIGUOUS_HOLDOUT_CASES = [
    # Near intermediate/advanced boundary
    {
        "case_id": "holdout-ambiguous-001",
        "user_context": {
            "days_active": 40,
            "tasks_created": 100,
            "projects_created": 3,
            "due_dates_used": 60,
            "recurring_tasks_used": 3,
            "planning_sessions": 5,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "40 days active, uses recurring tasks occasionally (3 times). Has daily_plan but no advanced features. Should be intermediate.",
    },
    {
        "case_id": "holdout-ambiguous-002",
        "user_context": {
            "days_active": 50,
            "tasks_created": 150,
            "projects_created": 5,
            "due_dates_used": 100,
            "recurring_tasks_used": 8,
            "planning_sessions": 10,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "50 days active, uses recurring tasks repeatedly (8 times), has dependencies. Should be advanced.",
    },
    # Near advanced/power boundary
    {
        "case_id": "holdout-ambiguous-003",
        "user_context": {
            "days_active": 80,
            "tasks_created": 400,
            "projects_created": 12,
            "due_dates_used": 300,
            "recurring_tasks_used": 20,
            "planning_sessions": 30,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "weekly_planning", "custom_views"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "80 days active, heavy usage, but NO automation rules, bulk edits, or power features. Should be advanced, not power.",
    },
    {
        "case_id": "holdout-ambiguous-004",
        "user_context": {
            "days_active": 100,
            "tasks_created": 600,
            "projects_created": 18,
            "due_dates_used": 500,
            "recurring_tasks_used": 40,
            "planning_sessions": 50,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "100 days active, uses automation_rules and bulk_edits. But no agentic_planning, dependency_graph, or custom_automations. Borderline advanced/power.",
    },
    {
        "case_id": "holdout-ambiguous-005",
        "user_context": {
            "days_active": 150,
            "tasks_created": 1000,
            "projects_created": 25,
            "due_dates_used": 800,
            "recurring_tasks_used": 60,
            "planning_sessions": 80,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "power",
        "notes": "150 days active, uses agentic_planning and dependency_graph. Should be power.",
    },
    # High activity but low capability (should be intermediate, not advanced)
    {
        "case_id": "holdout-ambiguous-006",
        "user_context": {
            "days_active": 60,
            "tasks_created": 300,
            "projects_created": 2,
            "due_dates_used": 200,
            "recurring_tasks_used": 1,
            "planning_sessions": 2,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "60 days active, high task volume (300), but only uses core + projects. Low capability depth. Should be intermediate, not advanced.",
    },
    # Low activity but high capability (should be advanced, not intermediate)
    {
        "case_id": "holdout-ambiguous-007",
        "user_context": {
            "days_active": 20,
            "tasks_created": 30,
            "projects_created": 3,
            "due_dates_used": 20,
            "recurring_tasks_used": 5,
            "planning_sessions": 3,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies", "goals"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "Only 20 days active, low volume, but uses advanced features (dependencies, goals). Should be advanced despite low activity.",
    },
]


async def run_ambiguous_holdout() -> dict[str, Any]:
    """Run ambiguous holdout cases through hard gating."""
    family = FeatureExposureFamily()
    family.reset_gate_stats()
    
    feature_catalog = {
        "core": ["quick_add", "task_list", "basic_search", "due_dates"],
        "intermediate": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities"],
        "advanced": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
        "power": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
    }
    
    results = {}
    for case_data in AMBIGUOUS_HOLDOUT_CASES:
        case_id = case_data["case_id"]
        expected_segment = case_data["expected_segment"]
        
        fe_input = {
            "user_context": {
                **case_data["user_context"],
                "_expected_segment_for_false_conservatism": expected_segment,
            },
            "feature_catalog": feature_catalog,
        }
        
        fe_case = type('Case', (), {
            'id': case_id,
            'input': fe_input,
            'expected': {'expected_user_segment': expected_segment},
            'metadata': type('Meta', (), {'slices': ['ambiguous-holdout'], 'difficulty': type('Diff', (), {'value': 'hard'})()}),
            'split': 'holdout',
        })()
        
        fe_output = await family.run_case(fe_case)
        fe_result = family.grade_case(fe_case, fe_output)
        
        actual_segment = fe_output.get("user_segment", "unknown") if fe_output else "unknown"
        is_correct = actual_segment == expected_segment
        false_conservatism = fe_output.get("false_conservatism", False) if fe_output else False
        
        results[case_id] = {
            "expected_segment": expected_segment,
            "actual_segment": actual_segment,
            "correct": is_correct,
            "false_conservatism": false_conservatism,
            "gating_override": fe_output.get("gating_override") if fe_output else None,
            "confidence": fe_output.get("confidence", 0) if fe_output else 0,
            "activity_level": fe_output.get("activity_level", "unknown") if fe_output else "unknown",
            "capability_level": fe_output.get("capability_level", "unknown") if fe_output else "unknown",
            "automation_signals": fe_output.get("automation_signals", []) if fe_output else [],
            "score": fe_result.score,
            "notes": case_data.get("notes", ""),
        }
        
        status = "✅" if is_correct else "❌"
        fc_marker = " [FALSE CONSERVATISM]" if false_conservatism else ""
        print(f"{status} {case_id}: expected={expected_segment}, actual={actual_segment}{fc_marker}")
        if fe_output and fe_output.get("gating_override"):
            print(f"   Gating: {fe_output['gating_override']}")
    
    # Gate hit report
    gate_report = family.get_gate_hit_report()
    
    # Summary
    total = len(results)
    correct = sum(1 for r in results.values() if r["correct"])
    false_conservatism_count = sum(1 for r in results.values() if r["false_conservatism"])
    
    print(f"\n{'='*60}")
    print(f"AMBIGUOUS HOLDOUT SUMMARY")
    print(f"{'='*60}")
    print(f"Total cases: {total}")
    print(f"Correct: {correct}/{total} ({correct/total:.1%})")
    print(f"False conservatism: {false_conservatism_count}/{total} ({false_conservatism_count/total:.1%})")
    
    print(f"\nGate hit report:")
    print(f"  Total cases: {gate_report['total_cases']}")
    print(f"  False conservatism rate: {gate_report.get('false_conservatism_rate', 0):.1%}")
    for gate_name, info in sorted(gate_report.get("gates", {}).items(), key=lambda x: x[1]["hits"], reverse=True):
        print(f"  {gate_name}: {info['hits']} ({info['percentage']})")
    
    return {
        "results": results,
        "gate_report": gate_report,
        "summary": {
            "total": total,
            "correct": correct,
            "accuracy": correct / total if total > 0 else 0,
            "false_conservatism_count": false_conservatism_count,
            "false_conservatism_rate": false_conservatism_count / total if total > 0 else 0,
        },
    }


async def main():
    results = await run_ambiguous_holdout()
    
    # Save results
    output_dir = Path(__file__).parent / "results" / "holdout"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"ambiguous-holdout-{run_id}.json"
    
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: {output_path}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
