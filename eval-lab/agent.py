"""Benchmark runner for task critic quality."""
import json
import os
import asyncio
import shutil
from pathlib import Path
from datetime import datetime, timezone

from adapters.task_critic import call_task_critic
from schemas.task_critic import TaskCriticInput
from verifiers.task_critic import score_case, compute_final_score

BASE_DIR = Path(__file__).parent
TASKS_DIR = BASE_DIR / "tasks" / "task-critic-quality"
RESULTS_DIR = BASE_DIR / "results"
PROMPTS_DIR = BASE_DIR / "prompts" / "task_critic"


def load_prompt(prompt_name: str = "baseline") -> str | None:
    """Load prompt from prompts/task_critic/{name}.txt."""
    prompt_path = PROMPTS_DIR / f"{prompt_name}.txt"
    if not prompt_path.exists():
        return None
    return prompt_path.read_text()


def load_cases() -> list[tuple[dict, dict, str]]:
    """Load all benchmark cases. Returns [(input, expected, case_name)]."""
    cases = []
    for case_dir in sorted(TASKS_DIR.glob("case-*")):
        with open(case_dir / "input.json") as f:
            input_data = json.load(f)
        with open(case_dir / "expected.json") as f:
            expected = json.load(f)
        cases.append((input_data, expected, case_dir.name))
    return cases


async def run_benchmark(prompt_name: str = "baseline") -> dict:
    """Run all cases and return aggregate results."""
    prompt_override = load_prompt(prompt_name)
    cases = load_cases()
    case_results = []

    for input_data, expected, case_name in cases:
        input_obj = TaskCriticInput(**input_data)
        output = await call_task_critic(
            input_obj, prompt_override=prompt_override
        )

        result = score_case(
            input_obj,
            output,
            expected["quality_score"],
            expected.get("expected_suggestion_themes", []),
        )

        abs_error = (
            abs(output.quality_score - expected["quality_score"])
            if output
            else 999
        )
        improved_changed = (
            output.improved_title is not None
            and output.improved_title.strip().lower()
            != input_obj.title.strip().lower()
        ) if output else False

        case_results.append(
            {
                "case": case_name,
                "score": result["score"],
                "predicted": output.quality_score if output else None,
                "expected": expected["quality_score"],
                "abs_error": round(abs_error, 1),
                "quality_band": expected.get("quality_band", "unknown"),
                "category": expected.get("category", "unknown"),
                "suggestions_count": len(output.suggestions) if output else 0,
                "improved_title_changed": improved_changed,
                "error": result.get("error"),
                "breakdown": {
                    k: v for k, v in result.items() if k != "error"
                },
            }
        )

    final_score = compute_final_score(case_results)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    return {
        "run_id": run_id,
        "prompt": prompt_name,
        "final_score": final_score,
        "num_cases": len(case_results),
        "num_errors": sum(1 for r in case_results if r["error"]),
        "cases": case_results,
    }


def write_results(result: dict):
    """Write results to TSV and save per-run file."""
    RESULTS_DIR.mkdir(exist_ok=True)
    runs_dir = RESULTS_DIR / "runs"
    runs_dir.mkdir(exist_ok=True)

    # Per-run file
    run_file = runs_dir / f"{result['run_id']}.tsv"
    with open(run_file, "w") as f:
        f.write(
            "case\tscore\tpredicted\texpected\tabs_error\t"
            "quality_band\tcategory\tsuggestions_count\t"
            "improved_title_changed\terror\n"
        )
        for c in result["cases"]:
            f.write(
                f"{c['case']}\t{c['score']}\t{c['predicted']}\t"
                f"{c['expected']}\t{c['abs_error']}\t"
                f"{c['quality_band']}\t{c['category']}\t"
                f"{c['suggestions_count']}\t"
                f"{c['improved_title_changed']}\t{c['error']}\n"
            )

    # Copy to latest.tsv (portable, no symlinks)
    latest = RESULTS_DIR / "latest.tsv"
    shutil.copy2(run_file, latest)

    print(
        f"Run {result['run_id']} | "
        f"Score: {result['final_score']} | "
        f"Cases: {result['num_cases']} | "
        f"Errors: {result['num_errors']}"
    )


async def main():
    prompt = os.getenv("EVAL_PROMPT", "baseline")
    result = await run_benchmark(prompt)
    write_results(result)
    return result["final_score"]


if __name__ == "__main__":
    asyncio.run(main())
