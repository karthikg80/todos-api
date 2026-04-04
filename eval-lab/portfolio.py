"""Portfolio-level evaluation runner.

Runs all benchmark families, aggregates results, and enables
cross-family run comparison.
"""
from __future__ import annotations

import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

from framework.schemas import RunConfig, RunResult
from meta_dimensions import get_meta_dimension, get_meta_dimension_scores


# ── Family Registry ──────────────────────────────────────────────────────────

FAMILY_REGISTRY = {
    "task_critic": "families.task_critic:TaskCriticFamily",
    "task_rewriter": "families.task_rewriter:TaskRewriterFamily",
    "plan_from_goal": "families.plan_from_goal:PlanFromGoalFamily",
    "clarification_policy": "families.clarification_policy:ClarificationPolicyFamily",
    "prioritization": "families.prioritization:PrioritizationFamily",
}

# Default family weights for aggregate scoring
DEFAULT_FAMILY_WEIGHTS = {
    "task_critic": 0.25,
    "task_rewriter": 0.20,
    "plan_from_goal": 0.20,
    "clarification_policy": 0.15,
    "prioritization": 0.20,
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
    splits: Optional[list[str]] = None,
) -> dict[str, RunResult]:
    """Run all (or selected) families and return results by family name."""
    if families is None:
        families = list(FAMILY_REGISTRY.keys())
    if splits is None:
        splits = [None]  # Run all splits together

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
    """Compute portfolio-level aggregate metrics."""
    if weights is None:
        weights = DEFAULT_FAMILY_WEIGHTS

    # Filter to families that were run
    weights = {k: v for k, v in weights.items() if k in results}
    total_weight = sum(weights.values())
    if total_weight == 0:
        return {"error": "No families with weights"}

    # Weighted mean score
    weighted_score = sum(
        weights.get(name, 0) * result.mean_score
        for name, result in results.items()
    ) / total_weight

    # Total cases and errors
    total_cases = sum(r.total_cases for r in results.values())
    total_errors = sum(r.error_count for r in results.values())

    # Meta-dimension averages across families
    meta_dimension_totals: dict[str, list[float]] = {}
    for name, result in results.items():
        for case_result in result.cases:
            if case_result.error:
                continue
            for dim_name, score in case_result.breakdown.dimensions.items():
                meta = get_meta_dimension(name, dim_name)
                if meta:
                    meta_dimension_totals.setdefault(meta.name, []).append(score)

    meta_averages = {
        k: round(sum(v) / len(v), 3)
        for k, v in meta_dimension_totals.items()
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

    return {
        "weighted_score": round(weighted_score, 3),
        "total_cases": total_cases,
        "total_errors": total_errors,
        "error_rate": round(total_errors / total_cases, 3) if total_cases > 0 else 0.0,
        "meta_dimension_averages": meta_averages,
        "split_averages": split_averages,
        "difficulty_averages": difficulty_averages,
        "failure_summary": failure_totals,
        "family_scores": {
            name: {
                "score": result.mean_score,
                "cases": result.total_cases,
                "errors": result.error_count,
                "weight": weights.get(name, 0),
            }
            for name, result in results.items()
        },
    }


def compare_runs(
    baseline: dict[str, RunResult],
    candidate: dict[str, RunResult],
    weights: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    """Compare two portfolio runs and show deltas."""
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

    return {
        "baseline_aggregate": baseline_agg,
        "candidate_aggregate": candidate_agg,
        "score_delta": score_delta,
        "family_deltas": family_deltas,
        "case_deltas": case_deltas,
        "win_loss": {"wins": wins, "losses": losses, "ties": ties},
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
        "families_run": list(results.keys()),
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
            "failure_summary": result.failure_summary(),
        }
        report["family_details"][name] = family_detail

    output_path = output_dir / f"portfolio-{run_id}.json"
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    return output_path
