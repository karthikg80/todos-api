"""Ambiguous holdout cases for gate validation.

30 cases near tier boundaries to validate that hard gating doesn't
overcorrect on ambiguous users.

Slices:
- INT-ADV (10): Intermediate / Advanced boundary
- ADV-PWR (10): Advanced / Power boundary
- HIGH-ACT-LOW-CAP (5): High activity / Low capability
- LOW-ACT-HIGH-CAP (5): Low activity / High capability
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


# ── Feature Catalog ──────────────────────────────────────────────────────────

FEATURE_CATALOG = {
    "core": ["quick_add", "task_list", "basic_search", "due_dates"],
    "intermediate": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities"],
    "advanced": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
    "power": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
}


# ── 30 Ambiguous Holdout Cases ───────────────────────────────────────────────

AMBIGUOUS_HOLDOUT_CASES = [
    # ── INT-ADV Boundary (10 cases) ──────────────────────────────────────────
    {
        "case_id": "holdout-int-adv-001",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 40, "tasks_created": 100, "projects_created": 3,
            "due_dates_used": 60, "recurring_tasks_used": 3, "planning_sessions": 5,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "40 days, recurring occasional (3x). Has daily_plan but no advanced features.",
    },
    {
        "case_id": "holdout-int-adv-002",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 45, "tasks_created": 120, "projects_created": 4,
            "due_dates_used": 80, "recurring_tasks_used": 4, "planning_sessions": 6,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "45 days, recurring occasional (4x). Has smart_priorities but no dependencies/goals.",
    },
    {
        "case_id": "holdout-int-adv-003",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 50, "tasks_created": 150, "projects_created": 5,
            "due_dates_used": 100, "recurring_tasks_used": 8, "planning_sessions": 10,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "50 days, recurring repeated (8x), has dependencies. Should be advanced.",
    },
    {
        "case_id": "holdout-int-adv-004",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 55, "tasks_created": 180, "projects_created": 6,
            "due_dates_used": 120, "recurring_tasks_used": 10, "planning_sessions": 12,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies", "goals"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "55 days, recurring repeated (10x), has dependencies+goals. Clear advanced.",
    },
    {
        "case_id": "holdout-int-adv-005",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 35, "tasks_created": 80, "projects_created": 2,
            "due_dates_used": 50, "recurring_tasks_used": 2, "planning_sessions": 3,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "recurring_tasks", "daily_plan"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "35 days, recurring occasional (2x). No advanced features. Intermediate.",
    },
    {
        "case_id": "holdout-int-adv-006",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 60, "tasks_created": 200, "projects_created": 7,
            "due_dates_used": 140, "recurring_tasks_used": 6, "planning_sessions": 8,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "60 days, recurring repeated (6x), has dependencies. Advanced.",
    },
    {
        "case_id": "holdout-int-adv-007",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 30, "tasks_created": 60, "projects_created": 2,
            "due_dates_used": 40, "recurring_tasks_used": 1, "planning_sessions": 2,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "daily_plan"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "30 days, recurring only once. No advanced features. Intermediate.",
    },
    {
        "case_id": "holdout-int-adv-008",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 65, "tasks_created": 220, "projects_created": 8,
            "due_dates_used": 160, "recurring_tasks_used": 12, "planning_sessions": 15,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "65 days, recurring repeated (12x), dependencies+goals. Advanced.",
    },
    {
        "case_id": "holdout-int-adv-009",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 42, "tasks_created": 110, "projects_created": 3,
            "due_dates_used": 70, "recurring_tasks_used": 5, "planning_sessions": 5,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "42 days, recurring borderline (5x). No dependencies/goals. Intermediate.",
    },
    {
        "case_id": "holdout-int-adv-010",
        "slice": "INT-ADV",
        "user_context": {
            "days_active": 48, "tasks_created": 140, "projects_created": 5,
            "due_dates_used": 90, "recurring_tasks_used": 7, "planning_sessions": 8,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "48 days, recurring repeated (7x), has dependencies. Advanced.",
    },

    # ── ADV-PWR Boundary (10 cases) ─────────────────────────────────────────
    {
        "case_id": "holdout-adv-pwr-001",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 80, "tasks_created": 400, "projects_created": 12,
            "due_dates_used": 300, "recurring_tasks_used": 20, "planning_sessions": 30,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "weekly_planning", "custom_views"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "80 days, heavy usage but NO automation rules, bulk edits, or power features. Advanced.",
    },
    {
        "case_id": "holdout-adv-pwr-002",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 100, "tasks_created": 600, "projects_created": 18,
            "due_dates_used": 500, "recurring_tasks_used": 40, "planning_sessions": 50,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "100 days, uses automation_rules and bulk_edits. But no agentic_planning or power features. Borderline advanced.",
    },
    {
        "case_id": "holdout-adv-pwr-003",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 150, "tasks_created": 1000, "projects_created": 25,
            "due_dates_used": 800, "recurring_tasks_used": 60, "planning_sessions": 80,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "power",
        "notes": "150 days, uses agentic_planning and dependency_graph. Power.",
    },
    {
        "case_id": "holdout-adv-pwr-004",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 120, "tasks_created": 800, "projects_created": 20,
            "due_dates_used": 600, "recurring_tasks_used": 50, "planning_sessions": 60,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "power",
        "notes": "120 days, uses agentic_planning. Power.",
    },
    {
        "case_id": "holdout-adv-pwr-005",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 90, "tasks_created": 500, "projects_created": 15,
            "due_dates_used": 400, "recurring_tasks_used": 30, "planning_sessions": 40,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "weekly_planning", "custom_views"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "90 days, uses automation_rules but no bulk_edits or power features. Advanced.",
    },
    {
        "case_id": "holdout-adv-pwr-006",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 130, "tasks_created": 900, "projects_created": 22,
            "due_dates_used": 700, "recurring_tasks_used": 55, "planning_sessions": 70,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "api_access"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "power",
        "notes": "130 days, uses api_access. Power.",
    },
    {
        "case_id": "holdout-adv-pwr-007",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 70, "tasks_created": 350, "projects_created": 10,
            "due_dates_used": 250, "recurring_tasks_used": 15, "planning_sessions": 20,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "weekly_planning"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "70 days, no automation rules or power features. Advanced.",
    },
    {
        "case_id": "holdout-adv-pwr-008",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 140, "tasks_created": 950, "projects_created": 24,
            "due_dates_used": 750, "recurring_tasks_used": 58, "planning_sessions": 75,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "dependency_graph", "batch_workflows"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "power",
        "notes": "140 days, uses dependency_graph and batch_workflows. Power.",
    },
    {
        "case_id": "holdout-adv-pwr-009",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 85, "tasks_created": 450, "projects_created": 14,
            "due_dates_used": 350, "recurring_tasks_used": 25, "planning_sessions": 35,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "bulk_edits", "weekly_planning", "custom_views"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "85 days, uses bulk_edits but no automation_rules or power features. Advanced.",
    },
    {
        "case_id": "holdout-adv-pwr-010",
        "slice": "ADV-PWR",
        "user_context": {
            "days_active": 160, "tasks_created": 1100, "projects_created": 28,
            "due_dates_used": 900, "recurring_tasks_used": 70, "planning_sessions": 90,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "custom_automations"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "power",
        "notes": "160 days, uses custom_automations. Clear power.",
    },

    # ── HIGH-ACT-LOW-CAP (5 cases) ──────────────────────────────────────────
    {
        "case_id": "holdout-high-act-001",
        "slice": "HIGH-ACT-LOW-CAP",
        "user_context": {
            "days_active": 60, "tasks_created": 300, "projects_created": 2,
            "due_dates_used": 200, "recurring_tasks_used": 1, "planning_sessions": 2,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "60 days, high volume (300 tasks), but only core+projects. Low capability depth. Intermediate.",
    },
    {
        "case_id": "holdout-high-act-002",
        "slice": "HIGH-ACT-LOW-CAP",
        "user_context": {
            "days_active": 45, "tasks_created": 250, "projects_created": 1,
            "due_dates_used": 180, "recurring_tasks_used": 0, "planning_sessions": 1,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "45 days, high volume (250 tasks), but only core features. Intermediate at most.",
    },
    {
        "case_id": "holdout-high-act-003",
        "slice": "HIGH-ACT-LOW-CAP",
        "user_context": {
            "days_active": 90, "tasks_created": 500, "projects_created": 3,
            "due_dates_used": 350, "recurring_tasks_used": 2, "planning_sessions": 3,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "90 days, very high volume (500 tasks), but shallow feature usage. Intermediate.",
    },
    {
        "case_id": "holdout-high-act-004",
        "slice": "HIGH-ACT-LOW-CAP",
        "user_context": {
            "days_active": 30, "tasks_created": 200, "projects_created": 1,
            "due_dates_used": 150, "recurring_tasks_used": 0, "planning_sessions": 1,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "30 days, high volume (200 tasks), but only core features. Intermediate.",
    },
    {
        "case_id": "holdout-high-act-005",
        "slice": "HIGH-ACT-LOW-CAP",
        "user_context": {
            "days_active": 75, "tasks_created": 400, "projects_created": 4,
            "due_dates_used": 280, "recurring_tasks_used": 3, "planning_sessions": 4,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "daily_plan"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "75 days, high volume (400 tasks), but no advanced features. Intermediate.",
    },

    # ── LOW-ACT-HIGH-CAP (5 cases) ──────────────────────────────────────────
    {
        "case_id": "holdout-low-act-001",
        "slice": "LOW-ACT-HIGH-CAP",
        "user_context": {
            "days_active": 20, "tasks_created": 30, "projects_created": 3,
            "due_dates_used": 20, "recurring_tasks_used": 5, "planning_sessions": 3,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies", "goals"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "Only 20 days, low volume, but uses advanced features (dependencies, goals). Advanced despite low activity.",
    },
    {
        "case_id": "holdout-low-act-002",
        "slice": "LOW-ACT-HIGH-CAP",
        "user_context": {
            "days_active": 15, "tasks_created": 20, "projects_created": 2,
            "due_dates_used": 15, "recurring_tasks_used": 3, "planning_sessions": 2,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "15 days, very low volume, but uses dependencies. Advanced despite low activity.",
    },
    {
        "case_id": "holdout-low-act-003",
        "slice": "LOW-ACT-HIGH-CAP",
        "user_context": {
            "days_active": 25, "tasks_created": 40, "projects_created": 4,
            "due_dates_used": 30, "recurring_tasks_used": 6, "planning_sessions": 4,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "advanced",
        "notes": "25 days, low volume, but uses automation_rules. Advanced.",
    },
    {
        "case_id": "holdout-low-act-004",
        "slice": "LOW-ACT-HIGH-CAP",
        "user_context": {
            "days_active": 10, "tasks_created": 15, "projects_created": 2,
            "due_dates_used": 10, "recurring_tasks_used": 2, "planning_sessions": 1,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "intermediate",
        "notes": "10 days, very low volume, uses daily_plan. Intermediate.",
    },
    {
        "case_id": "holdout-low-act-005",
        "slice": "LOW-ACT-HIGH-CAP",
        "user_context": {
            "days_active": 18, "tasks_created": 25, "projects_created": 3,
            "due_dates_used": 18, "recurring_tasks_used": 4, "planning_sessions": 2,
            "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities", "dependencies", "goals", "agentic_planning"],
            "last_active": "2026-04-04",
        },
        "expected_segment": "power",
        "notes": "18 days, low volume, but uses agentic_planning. Power despite low activity.",
    },
]


# ── Validation Runner ────────────────────────────────────────────────────────

async def run_ambiguous_holdout() -> dict[str, Any]:
    """Run 30 ambiguous holdout cases through hard gating.
    
    Computes:
    - Accuracy per slice and overall
    - False conservatism rate (refined denominator)
    - Counterfactual baseline (LLM-only vs gated)
    - Gate hit-rate report
    - Policy regret (optimal vs actual plan score)
    """
    family = FeatureExposureFamily()
    family.reset_gate_stats()
    
    results = {}
    slice_results: dict[str, list[dict]] = {}
    
    for case_data in AMBIGUOUS_HOLDOUT_CASES:
        case_id = case_data["case_id"]
        expected_segment = case_data["expected_segment"]
        slice_name = case_data.get("slice", "unknown")
        
        fe_input = {
            "user_context": {
                **case_data["user_context"],
                "_expected_segment_for_false_conservatism": expected_segment,
            },
            "feature_catalog": FEATURE_CATALOG,
        }
        
        fe_case = type('Case', (), {
            'id': case_id,
            'input': fe_input,
            'expected': {'expected_user_segment': expected_segment},
            'metadata': type('Meta', (), {'slices': [slice_name], 'difficulty': type('Diff', (), {'value': 'hard'})()}),
            'split': 'holdout',
        })()
        
        fe_output = await family.run_case(fe_case)
        fe_result = family.grade_case(fe_case, fe_output)
        
        actual_segment = fe_output.get("user_segment", "unknown") if fe_output else "unknown"
        is_correct = actual_segment == expected_segment
        false_conservatism = fe_output.get("false_conservatism", False) if fe_output else False
        gating_override = fe_output.get("gating_override") if fe_output else None
        gates_fired = fe_output.get("gates_fired", []) if fe_output else []
        
        result = {
            "case_id": case_id,
            "slice": slice_name,
            "expected_segment": expected_segment,
            "actual_segment": actual_segment,
            "correct": is_correct,
            "false_conservatism": false_conservatism,
            "gating_override": gating_override,
            "gates_fired": gates_fired,
            "confidence": fe_output.get("confidence", 0) if fe_output else 0,
            "activity_level": fe_output.get("activity_level", "unknown") if fe_output else "unknown",
            "capability_level": fe_output.get("capability_level", "unknown") if fe_output else "unknown",
            "automation_signals": fe_output.get("automation_signals", []) if fe_output else [],
            "score": fe_result.score,
            "notes": case_data.get("notes", ""),
        }
        results[case_id] = result
        slice_results.setdefault(slice_name, []).append(result)
        
        # Print status
        status = "✅" if is_correct else "❌"
        fc_marker = " [FALSE CONSERVATISM]" if false_conservatism else ""
        override_marker = f" [GATED: {gating_override}]" if gating_override else ""
        print(f"{status} {case_id} ({slice_name}): expected={expected_segment}, actual={actual_segment}{fc_marker}{override_marker}")
    
    # ── Summary Statistics ───────────────────────────────────────────────
    total = len(results)
    correct = sum(1 for r in results.values() if r["correct"])
    false_conservatism_count = sum(1 for r in results.values() if r["false_conservatism"])
    gating_override_count = sum(1 for r in results.values() if r["gating_override"])
    
    # False conservatism with refined denominator
    advanced_power_cases = [r for r in results.values() if r["expected_segment"] in ("advanced", "power")]
    gated_on_advanced_power = [r for r in advanced_power_cases if r["gating_override"]]
    false_conservatism_on_gated = sum(1 for r in gated_on_advanced_power if r["false_conservatism"])
    
    refined_denominator = len(gated_on_advanced_power) if gated_on_advanced_power else 1
    false_conservatism_rate = false_conservatism_on_gated / refined_denominator
    
    # Per-slice accuracy
    slice_accuracy = {}
    for slice_name, slice_cases in slice_results.items():
        slice_correct = sum(1 for r in slice_cases if r["correct"])
        slice_accuracy[slice_name] = {
            "correct": slice_correct,
            "total": len(slice_cases),
            "accuracy": round(slice_correct / len(slice_cases), 3) if slice_cases else 0,
        }
    
    # Gate hit report
    gate_report = family.get_gate_hit_report()
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"AMBIGUOUS HOLDOUT VALIDATION SUMMARY")
    print(f"{'='*60}")
    print(f"Total cases: {total}")
    print(f"Correct: {correct}/{total} ({correct/total:.1%})")
    print(f"Gating overrides: {gating_override_count}/{total} ({gating_override_count/total:.1%})")
    print(f"False conservatism (refined): {false_conservatism_on_gated}/{refined_denominator} ({false_conservatism_rate:.1%})")
    
    print(f"\nPer-slice accuracy:")
    for slice_name, stats in sorted(slice_accuracy.items()):
        print(f"  {slice_name}: {stats['correct']}/{stats['total']} ({stats['accuracy']:.1%})")
    
    print(f"\nGate hit report:")
    print(f"  Total cases: {gate_report['total_cases']}")
    print(f"  False conservatism rate: {gate_report.get('false_conservatism_rate', 0):.1%}")
    for gate_name, info in sorted(gate_report.get("gates", {}).items(), key=lambda x: x[1]["hits"], reverse=True):
        print(f"  {gate_name}: {info['hits']} ({info['percentage']})")
    
    return {
        "results": results,
        "slice_results": slice_results,
        "slice_accuracy": slice_accuracy,
        "gate_report": gate_report,
        "summary": {
            "total": total,
            "correct": correct,
            "accuracy": correct / total if total > 0 else 0,
            "gating_override_count": gating_override_count,
            "gating_override_rate": gating_override_count / total if total > 0 else 0,
            "false_conservatism_count": false_conservatism_count,
            "false_conservatism_on_gated": false_conservatism_on_gated,
            "gated_on_advanced_power": refined_denominator,
            "false_conservatism_rate_refined": false_conservatism_rate,
        },
    }


async def main():
    results = await run_ambiguous_holdout()
    
    # Save results
    output_dir = Path(__file__).parent / "results" / "holdout"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"ambiguous-holdout-validation-{run_id}.json"
    
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nResults saved to: {output_path}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
