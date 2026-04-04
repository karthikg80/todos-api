"""Benchmark runner using the framework abstraction."""
from __future__ import annotations

import json
import os
import asyncio
import shutil
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from framework.benchmark import BenchmarkFamily
from framework.schemas import RunConfig, RunResult
from framework.reporting import generate_scorecard, write_scorecard
from families.task_critic import TaskCriticFamily

BASE_DIR = Path(__file__).parent
RESULTS_DIR = BASE_DIR / "results"
PROMPTS_DIR = BASE_DIR / "prompts" / "task_critic"


def load_prompt(prompt_name: str = "baseline") -> str | None:
    """Load prompt from prompts/task_critic/{name}.txt."""
    prompt_path = PROMPTS_DIR / f"{prompt_name}.txt"
    if not prompt_path.exists():
        return None
    return prompt_path.read_text()


async def run_benchmark(
    prompt_name: str = "baseline",
    family: BenchmarkFamily | None = None,
    split: str | None = None,
) -> dict:
    """Run benchmark and return aggregate results (backward-compatible dict interface)."""
    if family is None:
        family = TaskCriticFamily()

    prompt_override = load_prompt(prompt_name)

    config = RunConfig(
        benchmark_name=family.NAME,
        benchmark_version=family.VERSION,
        prompt_name=prompt_name,
        model=os.getenv("AI_PROVIDER_MODEL", "unknown"),
    )

    result = await family.run_benchmark(config, prompt_override=prompt_override, split=split)

    # Write scorecard
    scorecard_dir = RESULTS_DIR / "scorecards"
    scorecard_path = write_scorecard(result, scorecard_dir)

    # Also write TSV for backward compatibility
    write_results_tsv(result)

    # Return dict for backward compatibility
    return {
        "run_id": result.config.timestamp,
        "prompt": prompt_name,
        "final_score": result.mean_score,
        "num_cases": result.total_cases,
        "num_errors": result.error_count,
        "cases": [
            {
                "case": c.case_id,
                "score": c.score,
                "predicted": c.predicted.get("qualityScore") if c.predicted else None,
                "expected": next(
                    (case.expected.get("quality_score", 0)
                     for case in family.load_cases()
                     if case.id == c.case_id),
                    0,
                ),
                "abs_error": c.abs_error,
                "quality_band": next(
                    (case.expected.get("quality_band", "unknown")
                     for case in family.load_cases()
                     if case.id == c.case_id),
                    "unknown",
                ),
                "category": c.slices[0] if c.slices else "unknown",
                "suggestions_count": len(c.predicted.get("suggestions", [])) if c.predicted else 0,
                "improved_title_changed": (
                    c.predicted.get("improvedTitle") is not None
                    and c.predicted.get("improvedTitle", "").strip().lower()
                    != next(
                        (case.input.get("title", "").strip().lower()
                         for case in family.load_cases()
                         if case.id == c.case_id),
                        "",
                    )
                ) if c.predicted else False,
                "error": c.error,
                "split": c.split,
                "breakdown": c.breakdown.dimensions,
                "grader_rationale": c.breakdown.grader_rationale,
                "borderline": c.breakdown.borderline,
                "failure_types": [ft.value for ft in c.failure_types],
            }
            for c in result.cases
        ],
        "scorecard_path": str(scorecard_path),
    }


def write_results_tsv(result: RunResult):
    """Write results to TSV for backward compatibility."""
    RESULTS_DIR.mkdir(exist_ok=True)
    runs_dir = RESULTS_DIR / "runs"
    runs_dir.mkdir(exist_ok=True)

    run_file = runs_dir / f"{result.config.timestamp.replace(':', '')}.tsv"
    with open(run_file, "w") as f:
        f.write(
            "case\tscore\tpredicted\texpected\tabs_error\t"
            "quality_band\tcategory\tsuggestions_count\t"
            "improved_title_changed\terror\tsplit\n"
        )
        for c in result.cases:
            predicted = c.predicted.get("qualityScore") if c.predicted else None
            f.write(
                f"{c.case_id}\t{c.score}\t{predicted}\t{c.abs_error}\t"
                f"{c.abs_error}\t{'-'.join(c.slices)}\t"
                f"{len(c.predicted.get('suggestions', [])) if c.predicted else 0}\t"
                f"-\t{c.error}\t{c.split}\n"
            )

    # Copy to latest.tsv
    latest = RESULTS_DIR / "latest.tsv"
    shutil.copy2(run_file, latest)

    print(
        f"Run {result.config.timestamp} | "
        f"Score: {result.mean_score:.3f} | "
        f"Cases: {result.total_cases} | "
        f"Errors: {result.error_count}"
    )


async def main():
    prompt = os.getenv("EVAL_PROMPT", "baseline")
    split = os.getenv("EVAL_SPLIT", None)
    result = await run_benchmark(prompt, split=split)
    print(f"\nFinal score: {result['final_score']:.3f}")


if __name__ == "__main__":
    asyncio.run(main())
