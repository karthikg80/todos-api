"""Portfolio-level evaluation runner.

Runs all benchmark families, aggregates results, and enables
cross-family run comparison.

Features:
- Full vs partial portfolio labeling
- Contribution breakdowns by family for each meta-dimension
- Case-level diffing with biggest improvements/regressions
- Comparison guardrails (regression thresholds, no-safety-regression rule)
- Drill-down paths (aggregate → family → slice → case)
- Cost/latency metrics per family and per case
- Holdout evaluation support
- CI regression gate integration
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

from framework.schemas import RunConfig, RunResult
from framework.hardening import (
    HoldoutManager,
    CIRegressionGate,
    GraderRegistry,
    HoldoutResult,
    HoldoutAccessEvent,
    DEFAULT_GUARDRAILS,
)
from framework.evaluators import SignificanceTester
from meta_dimensions import (
    get_meta_dimension,
    get_meta_dimension_scores,
    get_all_meta_dimensions,
    META_DIMENSION_VERSION,
)


# ── Family Registry ──────────────────────────────────────────────────────────

FAMILY_REGISTRY = {
    "task_critic": "families.task_critic:TaskCriticFamily",
    "task_rewriter": "families.task_rewriter:TaskRewriterFamily",
    "plan_from_goal": "families.plan_from_goal:PlanFromGoalFamily",
    "clarification_policy": "families.clarification_policy:ClarificationPolicyFamily",
    "prioritization": "families.prioritization:PrioritizationFamily",
    "structured_extraction": "families.structured_extraction:StructuredExtractionFamily",
}

# Default family weights for aggregate scoring
DEFAULT_FAMILY_WEIGHTS = {
    "task_critic": 0.20,
    "task_rewriter": 0.18,
    "plan_from_goal": 0.18,
    "clarification_policy": 0.14,
    "prioritization": 0.15,
    "structured_extraction": 0.15,
}

# Guardrail thresholds
DEFAULT_GUARDRAILS = {
    "max_aggregate_regression": -0.020,  # Aggregate can drop by at most 0.020
    "max_family_regression": -0.050,     # No family can drop by more than 0.050
    "no_safety_regression": True,         # Safety meta-dimension must not regress
    "max_error_rate_increase": 0.05,      # Error rate can increase by at most 5%
}


def load_family(name: str):
    """Dynamically load a benchmark family class."""
    if name not in FAMILY_REGISTRY:
        raise ValueError(f"Unknown family: {name}")
    module_path, class_name = FAMILY_REGISTRY[name].split(":")
    import importlib
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


async def run_portfolio(
    families: Optional[list[str]] = None,
    prompt_name: str = "baseline",
    run_id: Optional[str] = None,
) -> dict[str, RunResult]:
    """Run all (or selected) families and return results by family name."""
    if families is None:
        families = list(FAMILY_REGISTRY.keys())

    results = {}
    for family_name in families:
        family_cls = load_family(family_name)
        family = family_cls()

        config = RunConfig(
            benchmark_name=family_name,
            benchmark_version=family.VERSION,
            prompt_name=prompt_name,
            model=os.getenv("AI_PROVIDER_MODEL", "unknown"),
        )

        result = await family.run_benchmark(config, prompt_override=None)
        results[family_name] = result

    return results


def aggregate_portfolio(
    results: dict[str, RunResult],
    weights: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    """Compute portfolio-level aggregate metrics.

    Returns a dict with:
    - weighted_score: Family-weighted aggregate score
    - is_full_portfolio: Whether all families were run
    - total_cases, total_errors, error_rate
    - meta_dimension_averages: Averages across families
    - meta_dimension_contributions: Contribution by family to each meta-dimension
    - split_averages, difficulty_averages
    - failure_summary
    - family_scores: Per-family breakdown
    """
    if weights is None:
        weights = DEFAULT_FAMILY_WEIGHTS

    # Filter to families that were run
    active_weights = {k: v for k, v in weights.items() if k in results}
    total_weight = sum(active_weights.values())
    if total_weight == 0:
        return {"error": "No families with weights"}

    is_full_portfolio = set(results.keys()) == set(FAMILY_REGISTRY.keys())

    # Weighted mean score
    weighted_score = sum(
        active_weights.get(name, 0) * result.mean_score
        for name, result in results.items()
    ) / total_weight

    # Total cases and errors
    total_cases = sum(r.total_cases for r in results.values())
    total_errors = sum(r.error_count for r in results.values())
    total_grader_errors = sum(
        sum(1 for c in r.cases if c.grader_error)
        for r in results.values()
    )

    # Meta-dimension averages and contributions
    # Exclude both execution errors AND grader errors from semantic aggregate
    meta_dimension_totals: dict[str, list[float]] = {}
    meta_dimension_contributions: dict[str, dict[str, float]] = {}

    for name, result in results.items():
        family_weight = active_weights.get(name, 0) / total_weight
        for case_result in result.cases:
            if case_result.error or case_result.grader_error:
                continue
            for dim_name, score in case_result.breakdown.dimensions.items():
                meta = get_meta_dimension(name, dim_name)
                if meta:
                    meta_dimension_totals.setdefault(meta.name, []).append(score)
                    meta_dimension_contributions.setdefault(meta.name, {})[name] = \
                        meta_dimension_contributions.get(meta.name, {}).get(name, 0) + score

    meta_averages = {
        k: round(sum(v) / len(v), 3)
        for k, v in meta_dimension_totals.items()
    }

    # Normalize contributions to show each family's contribution to the meta-dimension average
    meta_contributions = {}
    for meta_name, family_totals in meta_dimension_contributions.items():
        total = sum(family_totals.values())
        meta_contributions[meta_name] = {
            fam: round(val / total, 3) if total > 0 else 0.0
            for fam, val in family_totals.items()
        }

    # By split
    by_split: dict[str, list[float]] = {}
    for name, result in results.items():
        for split, score in result.score_by_split().items():
            by_split.setdefault(split, []).append(score)
    split_averages = {k: round(sum(v) / len(v), 3) for k, v in by_split.items()}

    # By difficulty
    by_difficulty: dict[str, list[float]] = {}
    for name, result in results.items():
        for diff, score in result.score_by_difficulty().items():
            by_difficulty.setdefault(diff, []).append(score)
    difficulty_averages = {k: round(sum(v) / len(v), 3) for k, v in by_difficulty.items()}

    # Failure summary across families
    failure_totals: dict[str, int] = {}
    for name, result in results.items():
        for ft, count in result.failure_summary().items():
            failure_totals[ft] = failure_totals.get(ft, 0) + count

    # Cost/latency aggregation
    total_cost_usd = 0.0
    total_latency_ms = 0.0
    cost_by_family: dict[str, float] = {}
    latency_by_family: dict[str, float] = {}
    coverage_by_family: dict[str, float] = {}
    for name, result in results.items():
        family_cost = sum(c.cost_usd for c in result.cases)
        family_latency = sum(c.latency_ms for c in result.cases)
        family_grader_errors = sum(1 for c in result.cases if c.grader_error)
        total_cost_usd += family_cost
        total_latency_ms += family_latency
        cost_by_family[name] = round(family_cost, 4)
        latency_by_family[name] = round(family_latency, 2)
        # Semantic coverage: % of cases successfully graded (no execution or grader errors)
        valid_cases = sum(1 for c in result.cases if not c.error and not c.grader_error)
        coverage_by_family[name] = round(valid_cases / result.total_cases, 3) if result.total_cases > 0 else 0.0

    # Overall semantic coverage
    total_valid_cases = total_cases - total_errors - total_grader_errors
    semantic_coverage = round(total_valid_cases / total_cases, 3) if total_cases > 0 else 0.0

    return {
        "weighted_score": round(weighted_score, 3),
        "is_full_portfolio": is_full_portfolio,
        "families_included": list(results.keys()),
        "total_families_available": len(FAMILY_REGISTRY),
        "total_cases": total_cases,
        "total_errors": total_errors,
        "total_grader_errors": total_grader_errors,
        "semantic_coverage": semantic_coverage,
        "error_rate": round(total_errors / total_cases, 3) if total_cases > 0 else 0.0,
        "grader_error_rate": round(total_grader_errors / total_cases, 3) if total_cases > 0 else 0.0,
        "meta_dimension_averages": meta_averages,
        "meta_dimension_contributions": meta_contributions,
        "split_averages": split_averages,
        "difficulty_averages": difficulty_averages,
        "failure_summary": failure_totals,
        "cost_usd": round(total_cost_usd, 4),
        "latency_ms": round(total_latency_ms, 2),
        "cost_by_family": cost_by_family,
        "latency_by_family": latency_by_family,
        "coverage_by_family": coverage_by_family,
        "family_scores": {
            name: {
                "score": result.mean_score,
                "cases": result.total_cases,
                "errors": result.error_count,
                "grader_errors": sum(1 for c in result.cases if c.grader_error),
                "coverage": coverage_by_family.get(name, 0),
                "weight": active_weights.get(name, 0),
                "cost_usd": cost_by_family.get(name, 0),
                "latency_ms": latency_by_family.get(name, 0),
            }
            for name, result in results.items()
        },
    }


def check_guardrails(
    baseline_agg: dict[str, Any],
    candidate_agg: dict[str, Any],
    guardrails: Optional[dict[str, Any]] = None,
    holdout_result: Optional[HoldoutResult] = None,
) -> dict[str, Any]:
    """Check whether a candidate run passes guardrails vs baseline.

    Uses CIRegressionGate for consistent checking across CLI and API.
    """
    gate = CIRegressionGate()
    result = gate.check(baseline_agg, candidate_agg, guardrails, holdout_result)
    return {
        "passed": result.passed,
        "violations": result.violations,
        "details": result.details,
    }


def compare_runs(
    baseline: dict[str, RunResult],
    candidate: dict[str, RunResult],
    weights: Optional[dict[str, float]] = None,
    guardrails: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Compare two portfolio runs and show deltas with guardrail checking."""
    baseline_agg = aggregate_portfolio(baseline, weights)
    candidate_agg = aggregate_portfolio(candidate, weights)

    score_delta = round(candidate_agg["weighted_score"] - baseline_agg["weighted_score"], 3)

    # Per-family deltas
    family_deltas = {}
    for name in set(list(baseline.keys()) + list(candidate.keys())):
        b = baseline.get(name)
        c = candidate.get(name)
        if b and c:
            family_deltas[name] = {
                "baseline_score": b.mean_score,
                "candidate_score": c.mean_score,
                "delta": round(c.mean_score - b.mean_score, 3),
                "baseline_errors": b.error_count,
                "candidate_errors": c.error_count,
            }

    # Per-case deltas
    case_deltas = []
    for name in set(list(baseline.keys()) + list(candidate.keys())):
        b = baseline.get(name)
        c = candidate.get(name)
        if not b or not c:
            continue
        for bc, cc in zip(b.cases, c.cases):
            if bc.case_id != cc.case_id:
                continue
            case_deltas.append({
                "family": name,
                "case_id": bc.case_id,
                "baseline_score": bc.score,
                "candidate_score": cc.score,
                "delta": round(cc.score - bc.score, 3),
                "baseline_error": bc.error,
                "candidate_error": cc.error,
                "slices": bc.slices,
                "difficulty": bc.difficulty,
            })

    # Win/loss summary
    wins = sum(1 for d in case_deltas if d["delta"] > 0)
    losses = sum(1 for d in case_deltas if d["delta"] < 0)
    ties = sum(1 for d in case_deltas if d["delta"] == 0)

    # Significance testing
    tester = SignificanceTester(n_bootstrap=1000)
    baseline_scores = [d["baseline_score"] for d in case_deltas]
    candidate_scores = [d["candidate_score"] for d in case_deltas]
    significance = tester.test(baseline_scores, candidate_scores)

    # Biggest improvements and regressions
    sorted_deltas = sorted(case_deltas, key=lambda d: d["delta"])
    biggest_improvements = [d for d in sorted_deltas if d["delta"] > 0][-5:]
    biggest_regressions = sorted_deltas[:5]

    # Meta-dimension deltas
    baseline_meta = baseline_agg.get("meta_dimension_averages", {})
    candidate_meta = candidate_agg.get("meta_dimension_averages", {})
    meta_deltas = {}
    for meta_name in set(list(baseline_meta.keys()) + list(candidate_meta.keys())):
        b = baseline_meta.get(meta_name, 0)
        c = candidate_meta.get(meta_name, 0)
        meta_deltas[meta_name] = round(c - b, 3)

    # Guardrail checking
    guardrail_result = check_guardrails(baseline_agg, candidate_agg, guardrails)

    return {
        "baseline_aggregate": baseline_agg,
        "candidate_aggregate": candidate_agg,
        "score_delta": score_delta,
        "meta_dimension_deltas": meta_deltas,
        "family_deltas": family_deltas,
        "case_deltas": case_deltas,
        "biggest_improvements": biggest_improvements,
        "biggest_regressions": biggest_regressions,
        "win_loss": {"wins": wins, "losses": losses, "ties": ties},
        "significance": {
            "delta": significance.delta,
            "p_value": significance.p_value,
            "confidence_interval": list(significance.confidence_interval),
            "significant": significance.significant,
            "bootstrap_samples": significance.bootstrap_samples,
        },
        "guardrails": guardrail_result,
    }


def generate_portfolio_report(
    results: dict[str, RunResult],
    run_id: Optional[str] = None,
    output_dir: Optional[Path] = None,
) -> Path:
    """Generate a portfolio-level report and write to disk."""
    if output_dir is None:
        output_dir = Path(__file__).parent / "results" / "portfolio"
    output_dir.mkdir(parents=True, exist_ok=True)

    aggregate = aggregate_portfolio(results)

    if run_id is None:
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    report = {
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": os.getenv("AI_PROVIDER_MODEL", "unknown"),
        "meta_dimension_version": META_DIMENSION_VERSION,
        "families_run": list(results.keys()),
        "is_full_portfolio": aggregate.get("is_full_portfolio", False),
        "aggregate": aggregate,
        "family_details": {},
    }

    for name, result in results.items():
        family_detail = {
            "score": result.mean_score,
            "cases": result.total_cases,
            "errors": result.error_count,
            "by_split": result.score_by_split(),
            "by_difficulty": result.score_by_difficulty(),
            "by_slice": result.score_by_slice(),
            "dimension_averages": result.dimension_averages(),
            "meta_dimension_scores": get_meta_dimension_scores(name, result.dimension_averages()),
            "failure_summary": result.failure_summary(),
        }
        report["family_details"][name] = family_detail

    output_path = output_dir / f"portfolio-{run_id}.json"
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    return output_path
