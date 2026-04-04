"""Reporting module for slice-level scorecards and failure analysis."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from framework.schemas import CaseResult, RunResult


def generate_scorecard(result: RunResult) -> dict[str, Any]:
    """Generate a comprehensive scorecard with breakdowns."""
    scorecard: dict[str, Any] = {
        "benchmark": result.config.benchmark_name,
        "version": result.config.benchmark_version,
        "prompt": result.config.prompt_name,
        "model": result.config.model,
        "timestamp": result.config.timestamp,
        "summary": {
            "total_cases": result.total_cases,
            "errors": result.error_count,
            "mean_score": result.mean_score,
        },
    }

    # By split
    scorecard["by_split"] = result.score_by_split()

    # By slice
    scorecard["by_slice"] = result.score_by_slice()

    # Failure summary
    scorecard["failures"] = result.failure_summary()

    # Per-case details
    scorecard["cases"] = []
    for c in result.cases:
        scorecard["cases"].append({
            "id": c.case_id,
            "split": c.split,
            "score": c.score,
            "error": c.error,
            "slices": c.slices,
            "failure_types": [ft.value for ft in c.failure_types],
            "abs_error": c.abs_error,
        })

    return scorecard


def write_scorecard(result: RunResult, output_dir: Path) -> Path:
    """Write scorecard to JSON file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    scorecard = generate_scorecard(result)
    output_path = output_dir / f"scorecard-{result.config.timestamp.replace(':', '')}.json"
    with open(output_path, "w") as f:
        json.dump(scorecard, f, indent=2)
    return output_path


def compare_runs(results: list[RunResult]) -> dict[str, Any]:
    """Compare multiple runs and show deltas."""
    if len(results) < 2:
        return {"error": "Need at least 2 runs to compare"}

    comparison = {
        "runs": [],
        "deltas": [],
    }

    for r in results:
        comparison["runs"].append({
            "prompt": r.config.prompt_name,
            "model": r.config.model,
            "mean_score": r.mean_score,
            "errors": r.error_count,
            "by_split": r.score_by_split(),
            "by_slice": r.score_by_slice(),
        })

    # Compute deltas between consecutive runs
    for i in range(1, len(results)):
        prev = results[i - 1]
        curr = results[i]
        delta = {
            "from": prev.config.prompt_name,
            "to": curr.config.prompt_name,
            "score_delta": round(curr.mean_score - prev.mean_score, 3),
            "error_delta": curr.error_count - prev.error_count,
            "split_deltas": {},
            "slice_deltas": {},
        }

        prev_splits = prev.score_by_split()
        curr_splits = curr.score_by_split()
        for split_name in set(list(prev_splits.keys()) + list(curr_splits.keys())):
            delta["split_deltas"][split_name] = round(
                curr_splits.get(split_name, 0) - prev_splits.get(split_name, 0), 3
            )

        prev_slices = prev.score_by_slice()
        curr_slices = curr.score_by_slice()
        for slice_name in set(list(prev_slices.keys()) + list(curr_slices.keys())):
            delta["slice_deltas"][slice_name] = round(
                curr_slices.get(slice_name, 0) - prev_slices.get(slice_name, 0), 3
            )

        comparison["deltas"].append(delta)

    return comparison


def failure_heatmap(results: list[RunResult]) -> dict[str, dict[str, int]]:
    """Generate a failure heatmap across runs and failure types."""
    heatmap: dict[str, dict[str, int]] = {}
    for r in results:
        run_name = f"{r.config.prompt_name} ({r.config.timestamp[:10]})"
        heatmap[run_name] = r.failure_summary()
    return heatmap
