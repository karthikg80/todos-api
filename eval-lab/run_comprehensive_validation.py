"""Comprehensive validation runner for all milestones.

Implements Milestones 2, 3a, 3b, and 4 from the Hard Gating Validation Plan:

Milestone 2: Gate Distribution Analysis
- Pre-gate vs post-gate label tracking
- Score delta analysis
- Distribution-based alerts (max_gate_share > 2x median)
- raw_gate_firings vs unique_case_overrides

Milestone 3a: Behavioral Telemetry Baseline
- Counterfactual baseline (LLM-only vs gated)
- Policy regret computation
- Zero-denominator guard for safety_gain

Milestone 3b: Causal Comparison
- Compare gated vs ungated cohorts
- Safety gain and unlock loss computation
- Policy regret (optimal vs actual plan score)

Milestone 4: Operational Trustworthiness
- Feature exposure as Tier 1 routing authority
- Cross-family consistency uses gated segment
- Gate hit-rate report in portfolio output
- False conservatism rate tracked and alerted
- Near-miss unlock category tracked separately
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
from portfolio import load_family, aggregate_portfolio, compare_runs
from framework.hardening import CIRegressionGate, DEFAULT_GUARDRAILS


# ── Feature Catalog ──────────────────────────────────────────────────────────

FEATURE_CATALOG = {
    "core": ["quick_add", "task_list", "basic_search", "due_dates"],
    "intermediate": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities"],
    "advanced": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
    "power": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
}


# ── Ordinal Mappings ─────────────────────────────────────────────────────────

SEGMENT = {"beginner": 0, "intermediate": 1, "advanced": 2, "power": 3}
CAPABILITY = {"low": 0, "medium": 1, "high": 2}


# ── Milestone 2: Gate Distribution Analysis ──────────────────────────────────

def compute_gate_distribution(family: FeatureExposureFamily) -> dict[str, Any]:
    """Compute gate distribution analysis.
    
    Returns:
        Dict with raw_gate_firings, unique_case_overrides, distribution alerts.
    """
    gate_counts = family.GATE_HIT_COUNTS.copy()
    total_cases = family.GATE_TOTAL_CASES
    
    if total_cases == 0:
        return {"total_cases": 0, "total_overrides": 0, "gates": {}, "median_gate_share": 0, "max_gate_share": 0, "distribution_alert": False, "dominance_alert": False}
    
    # Separate false_conservatism from gate firings
    gate_only_counts = {k: v for k, v in gate_counts.items() if k != "false_conservatism"}
    
    # Distribution-based alert: max_gate_share > 2x median_gate_share
    gate_shares = []
    for gate_name, count in gate_only_counts.items():
        share = count / total_cases
        gate_shares.append((gate_name, share))
    
    if gate_shares:
        shares_only = [s for _, s in gate_shares]
        shares_only.sort()
        median_share = shares_only[len(shares_only) // 2] if shares_only else 0
        max_share = max(shares_only) if shares_only else 0
        
        distribution_alert = max_share > 2 * median_share if median_share > 0 else False
    else:
        distribution_alert = False
        median_share = 0
        max_share = 0
    
    gates = {}
    for gate_name, count in sorted(gate_only_counts.items(), key=lambda x: x[1], reverse=True):
        share = count / total_cases
        gates[gate_name] = {
            "raw_gate_firings": count,
            "share": round(share, 3),
            "percentage": f"{share:.1%}",
            "distribution_alert": share > 2 * median_share if median_share > 0 else False,
        }
    
    # Check if any single gate >40% of all overrides (only meaningful with >5 overrides)
    total_overrides = sum(gate_only_counts.values())
    dominance_alert = (
        total_overrides > 5
        and any(
            count / total_overrides > 0.4
            for count in gate_only_counts.values()
        )
    )
    
    return {
        "total_cases": total_cases,
        "total_overrides": total_overrides,
        "gates": gates,
        "median_gate_share": round(median_share, 3),
        "max_gate_share": round(max_share, 3),
        "distribution_alert": distribution_alert,
        "dominance_alert": dominance_alert,
    }


# ── Milestone 3a: Counterfactual Baseline ────────────────────────────────────

def compute_counterfactual_baseline(results: list[dict]) -> dict[str, Any]:
    """Compute LLM-only vs gated counterfactual baseline.
    
    For each case, compare:
    - LLM-only segment (before gating)
    - Gated segment (after gating)
    - Accuracy of each
    - Overexposure rate of each
    """
    llm_correct = 0
    gated_correct = 0
    llm_overexposure = 0
    gated_overexposure = 0
    total = len(results)
    
    for r in results:
        expected = r["expected_segment"]
        llm_segment = r.get("llm_segment", "unknown")
        gated_segment = r["actual_segment"]
        
        # Accuracy
        if llm_segment == expected:
            llm_correct += 1
        if gated_segment == expected:
            gated_correct += 1
        
        # Overexposure (upward error)
        try:
            expected_idx = SEGMENT.get(expected, 0)
            llm_idx = SEGMENT.get(llm_segment, 0)
            gated_idx = SEGMENT.get(gated_segment, 0)
            
            if llm_idx > expected_idx:
                llm_overexposure += 1
            if gated_idx > expected_idx:
                gated_overexposure += 1
        except (KeyError, TypeError):
            pass
    
    accuracy_llm_only = llm_correct / total if total > 0 else 0
    accuracy_gated = gated_correct / total if total > 0 else 0
    overexposure_llm_only = llm_overexposure / total if total > 0 else 0
    overexposure_gated = gated_overexposure / total if total > 0 else 0
    
    # Safety gain with zero-denominator guard
    if overexposure_llm_only == 0:
        safety_gain = 0.0
    else:
        safety_gain = (overexposure_llm_only - overexposure_gated) / overexposure_llm_only
    
    return {
        "total_cases": total,
        "accuracy_llm_only": round(accuracy_llm_only, 3),
        "accuracy_gated": round(accuracy_gated, 3),
        "accuracy_delta": round(accuracy_gated - accuracy_llm_only, 3),
        "overexposure_llm_only": round(overexposure_llm_only, 3),
        "overexposure_gated": round(overexposure_gated, 3),
        "overexposure_delta": round(overexposure_llm_only - overexposure_gated, 3),
        "safety_gain": round(safety_gain, 3),
    }


# ── Milestone 3b: Policy Regret ─────────────────────────────────────────────

def compute_policy_regret(results: list[dict]) -> dict[str, Any]:
    """Compute policy regret: optimal_plan_score - actual_plan_score.
    
    Where:
    - optimal_plan_score: Plan score using expected segment (benchmark proxy)
    - actual_plan_score: Plan score using gated segment
    
    Note: optimal_plan_score is a benchmark proxy using the expected segment
    as the policy oracle, not a claim of globally optimal user utility.
    """
    # For now, we use segment correctness as a proxy for plan score
    # In production, this would use actual plan scores from plan_from_goal family
    regrets = []
    llm_regrets = []
    
    for r in results:
        expected = r["expected_segment"]
        gated_segment = r["actual_segment"]
        llm_segment = r.get("llm_segment", "unknown")
        
        # Regret = distance from expected segment (lower is better)
        try:
            expected_idx = SEGMENT.get(expected, 0)
            gated_idx = SEGMENT.get(gated_segment, 0)
            llm_idx = SEGMENT.get(llm_segment, 0)
            
            gated_regret = abs(gated_idx - expected_idx)
            llm_regret = abs(llm_idx - expected_idx)
            
            regrets.append(gated_regret)
            llm_regrets.append(llm_regret)
        except (KeyError, TypeError):
            regrets.append(1)
            llm_regrets.append(1)
    
    avg_regret_gated = sum(regrets) / len(regrets) if regrets else 0
    avg_regret_llm_only = sum(llm_regrets) / len(llm_regrets) if llm_regrets else 0
    net_regret_delta = avg_regret_llm_only - avg_regret_gated
    
    return {
        "avg_regret_llm_only": round(avg_regret_llm_only, 3),
        "avg_regret_gated": round(avg_regret_gated, 3),
        "net_regret_delta": round(net_regret_delta, 3),
        "regret_improved": net_regret_delta > 0,
    }


# ── Milestone 4: False Conservatism with Near-Miss Tracking ─────────────────

def compute_false_conservatism_detailed(results: list[dict]) -> dict[str, Any]:
    """Compute false conservatism with near-miss unlock category.
    
    Types:
    - missed_capability: expected=advanced/power, actual=lower, medium/high impact
    - near_miss_unlock: expected=advanced/power, actual=lower, low impact
    - safe_downgrade: expected=advanced/power, actual=lower, no impact
    - appropriate_conservatism: expected=beginner/intermediate, actual=lower or same
    """
    advanced_power_cases = [r for r in results if r["expected_segment"] in ("advanced", "power")]
    gated_on_advanced_power = [r for r in advanced_power_cases if r.get("gating_override")]
    
    false_conservatism_count = 0
    near_miss_count = 0
    safe_downgrade_count = 0
    
    for r in gated_on_advanced_power:
        expected = r["expected_segment"]
        actual = r["actual_segment"]
        
        try:
            expected_idx = SEGMENT.get(expected, 0)
            actual_idx = SEGMENT.get(actual, 0)
            
            if actual_idx < expected_idx:
                # Gating forced lower than expected
                # Check impact severity (simplified: use confidence as proxy)
                confidence = r.get("confidence", 0.5)
                if confidence < 0.6:
                    # Low confidence after gating → near-miss
                    near_miss_count += 1
                else:
                    # Higher confidence → missed capability
                    false_conservatism_count += 1
            else:
                safe_downgrade_count += 1
        except (KeyError, TypeError):
            pass
    
    refined_denominator = len(gated_on_advanced_power) if gated_on_advanced_power else 1
    false_conservatism_rate = false_conservatism_count / refined_denominator
    near_miss_rate = near_miss_count / refined_denominator
    
    return {
        "total_advanced_power_cases": len(advanced_power_cases),
        "gated_on_advanced_power": len(gated_on_advanced_power),
        "false_conservatism_count": false_conservatism_count,
        "near_miss_unlock_count": near_miss_count,
        "safe_downgrade_count": safe_downgrade_count,
        "false_conservatism_rate": round(false_conservatism_rate, 3),
        "near_miss_rate": round(near_miss_rate, 3),
        "refined_denominator": refined_denominator,
    }


# ── Comprehensive Validation Runner ─────────────────────────────────────────

async def run_comprehensive_validation() -> dict[str, Any]:
    """Run all validation milestones and produce comprehensive report."""
    from run_ambiguous_holdout import AMBIGUOUS_HOLDOUT_CASES
    
    family = FeatureExposureFamily()
    family.reset_gate_stats()
    
    results = []
    
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
        
        # Get LLM segment (before gating) from grader artifacts
        llm_segment = fe_result.grader_artifacts.get("llm_segment", "unknown") if fe_result.grader_artifacts else "unknown"
        
        actual_segment = fe_output.get("user_segment", "unknown") if fe_output else "unknown"
        is_correct = actual_segment == expected_segment
        false_conservatism = fe_output.get("false_conservatism", False) if fe_output else False
        gating_override = fe_output.get("gating_override") if fe_output else None
        gates_fired = fe_output.get("gates_fired", []) if fe_output else []
        
        result = {
            "case_id": case_id,
            "slice": slice_name,
            "expected_segment": expected_segment,
            "llm_segment": llm_segment,
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
        results.append(result)
        
        # Print status
        status = "✅" if is_correct else "❌"
        fc_marker = " [FALSE CONSERVATISM]" if false_conservatism else ""
        override_marker = f" [GATED: {gating_override}]" if gating_override else ""
        print(f"{status} {case_id} ({slice_name}): expected={expected_segment}, llm={llm_segment}, actual={actual_segment}{fc_marker}{override_marker}")
    
    # ── Milestone 2: Gate Distribution Analysis ──────────────────────────
    print(f"\n{'='*60}")
    print(f"MILESTONE 2: GATE DISTRIBUTION ANALYSIS")
    print(f"{'='*60}")
    gate_dist = compute_gate_distribution(family)
    print(f"Total cases: {gate_dist['total_cases']}")
    print(f"Total overrides: {gate_dist['total_overrides']}")
    print(f"Median gate share: {gate_dist['median_gate_share']:.1%}")
    print(f"Max gate share: {gate_dist['max_gate_share']:.1%}")
    print(f"Distribution alert: {'YES ⚠️' if gate_dist['distribution_alert'] else 'no ✅'}")
    print(f"Dominance alert: {'YES ⚠️' if gate_dist['dominance_alert'] else 'no ✅'}")
    for gate_name, info in gate_dist.get("gates", {}).items():
        alert = " ⚠️" if info["distribution_alert"] else ""
        print(f"  {gate_name}: {info['raw_gate_firings']} ({info['percentage']}){alert}")
    
    # ── Milestone 3a: Counterfactual Baseline ────────────────────────────
    print(f"\n{'='*60}")
    print(f"MILESTONE 3a: COUNTERFACTUAL BASELINE")
    print(f"{'='*60}")
    counterfactual = compute_counterfactual_baseline(results)
    print(f"Accuracy (LLM-only): {counterfactual['accuracy_llm_only']:.1%}")
    print(f"Accuracy (Gated): {counterfactual['accuracy_gated']:.1%}")
    print(f"Accuracy delta: {counterfactual['accuracy_delta']:+.1%}")
    print(f"Overexposure (LLM-only): {counterfactual['overexposure_llm_only']:.1%}")
    print(f"Overexposure (Gated): {counterfactual['overexposure_gated']:.1%}")
    print(f"Safety gain: {counterfactual['safety_gain']:.1%}")
    
    # ── Milestone 3b: Policy Regret ──────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"MILESTONE 3b: POLICY REGRET")
    print(f"{'='*60}")
    regret = compute_policy_regret(results)
    print(f"Avg regret (LLM-only): {regret['avg_regret_llm_only']:.3f}")
    print(f"Avg regret (Gated): {regret['avg_regret_gated']:.3f}")
    print(f"Net regret delta: {regret['net_regret_delta']:+.3f}")
    print(f"Regret improved: {'YES ✅' if regret['regret_improved'] else 'NO ⚠️'}")
    
    # ── Milestone 4: False Conservatism with Near-Miss ───────────────────
    print(f"\n{'='*60}")
    print(f"MILESTONE 4: FALSE CONSERVATISM (DETAILED)")
    print(f"{'='*60}")
    fc_detailed = compute_false_conservatism_detailed(results)
    print(f"Advanced/power cases: {fc_detailed['total_advanced_power_cases']}")
    print(f"Gated on advanced/power: {fc_detailed['gated_on_advanced_power']}")
    print(f"False conservatism: {fc_detailed['false_conservatism_count']} ({fc_detailed['false_conservatism_rate']:.1%})")
    print(f"Near-miss unlock: {fc_detailed['near_miss_unlock_count']} ({fc_detailed['near_miss_rate']:.1%})")
    print(f"Safe downgrade: {fc_detailed['safe_downgrade_count']}")
    
    # ── Overall Summary ──────────────────────────────────────────────────
    total = len(results)
    correct = sum(1 for r in results if r["correct"])
    
    print(f"\n{'='*60}")
    print(f"COMPREHENSIVE VALIDATION SUMMARY")
    print(f"{'='*60}")
    print(f"Total cases: {total}")
    print(f"Correct: {correct}/{total} ({correct/total:.1%})")
    print(f"\nMilestone 1 (Holdout): {'✅ PASS' if correct/total >= 0.9 else '❌ FAIL'}")
    print(f"Milestone 2 (Distribution): {'✅ PASS' if not gate_dist['dominance_alert'] else '❌ FAIL'}")
    print(f"Milestone 3a (Counterfactual): {'✅ PASS' if counterfactual['safety_gain'] >= 0.5 or counterfactual['overexposure_llm_only'] == 0 else '⚠️ PARTIAL'}")
    print(f"Milestone 3b (Regret): {'✅ PASS' if regret['regret_improved'] else '❌ FAIL'}")
    print(f"Milestone 4 (False Conservatism): {'✅ PASS' if fc_detailed['false_conservatism_rate'] < 0.1 else '❌ FAIL'}")
    
    return {
        "results": results,
        "milestone_1": {
            "total": total,
            "correct": correct,
            "accuracy": correct / total if total > 0 else 0,
        },
        "milestone_2": gate_dist,
        "milestone_3a": counterfactual,
        "milestone_3b": regret,
        "milestone_4": fc_detailed,
    }


async def main():
    results = await run_comprehensive_validation()
    
    # Save results
    output_dir = Path(__file__).parent / "results" / "comprehensive-validation"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"comprehensive-validation-{run_id}.json"
    
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nResults saved to: {output_path}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
