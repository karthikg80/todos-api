"""Iterative prompt optimizer for task critic quality.

Uses the LLM to generate prompt variations, runs the benchmark,
and hill-climbs toward better scores. Mimics AutoAgent's optimization
loop without requiring the full AutoAgent infrastructure.
"""
import asyncio
import json
import os
import httpx
import shutil
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from agent import run_benchmark, write_results, load_prompt
from adapters.task_critic import call_task_critic
from schemas.task_critic import TaskCriticInput

BASE_DIR = Path(__file__).parent
PROMPTS_DIR = BASE_DIR / "prompts" / "task_critic"
RESULTS_DIR = BASE_DIR / "results" / "optimization"
OPTIMIZER_PROMPT = """You are an expert prompt engineer optimizing a task critic system prompt.

The current prompt is used to evaluate how well-defined and actionable tasks are.
Your goal is to improve the prompt so that the LLM's quality scores better match human ratings.

Current benchmark score: {current_score:.3f}
Target: improve by at least 0.005

Rules for modification:
1. Keep the JSON output format requirement (qualityScore, improvedTitle, improvedDescription, suggestions)
2. Keep the 0-100 scoring scale
3. Make SMALL, targeted adjustments — do NOT rewrite the entire prompt
4. Focus on ONE specific issue at a time (e.g., calibration, over-scoring, under-scoring)
5. Preserve what is already working well

Return ONLY the new prompt text. No explanation, no markdown."""


async def generate_candidate(
    current_prompt: str,
    current_score: float,
    failure_analysis: str,
) -> str:
    """Use LLM to generate a candidate prompt variation."""
    system_msg = "You are an expert prompt engineer. Return ONLY the prompt text."
    user_msg = OPTIMIZER_PROMPT.format(current_score=current_score)

    if failure_analysis:
        user_msg += f"\n\nFailure analysis from last run:\n{failure_analysis}"

    user_msg += f"\n\nCurrent prompt:\n---\n{current_prompt}\n---\n\nReturn the improved prompt:"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{os.getenv('AI_PROVIDER_BASE_URL', 'https://api.openai.com/v1')}/chat/completions",
            json={
                "model": os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini"),
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                "temperature": 0.7,
                "max_tokens": 1500,
            },
            headers={"Authorization": f"Bearer {os.getenv('AI_PROVIDER_API_KEY', '')}"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


def analyze_failures(result: dict) -> str:
    """Analyze benchmark results to identify patterns."""
    cases = result.get("cases", [])
    if not cases:
        return ""

    # Find worst-performing cases
    worst = sorted(cases, key=lambda c: c["score"])[:5]
    lines = [f"Worst cases (score vs expected):"]
    for c in worst:
        if c.get("error"):
            lines.append(f"  {c['case']}: ERROR ({c['error']})")
        else:
            diff = c["predicted"] - c["expected"]
            direction = "over" if diff > 0 else "under"
            lines.append(f"  {c['case']}: predicted {c['predicted']} vs expected {c['expected']} ({direction}-scored by {abs(diff):.0f})")

    # Category averages
    by_cat = {}
    for c in cases:
        if c.get("error"):
            continue
        cat = c.get("category", "unknown")
        by_cat.setdefault(cat, []).append(c["score"])

    lines.append(f"\nCategory averages:")
    for cat, scores in sorted(by_cat.items()):
        avg = sum(scores) / len(scores)
        lines.append(f"  {cat}: {avg:.3f} (n={len(scores)})")

    return "\n".join(lines)


async def run_optimization_loop(
    max_iterations: int = 10,
    min_improvement: float = 0.005,
):
    """Run the optimization loop."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Start with the best known prompt
    best_prompt_name = "calibrated"
    best_prompt = load_prompt(best_prompt_name)
    best_result = await run_benchmark(best_prompt_name)
    best_score = best_result["final_score"]

    print(f"\n{'='*60}")
    print(f"Starting optimization from '{best_prompt_name}' (score: {best_score:.3f})")
    print(f"Max iterations: {max_iterations}, Min improvement: {min_improvement}")
    print(f"{'='*60}\n")

    iteration = 0
    stagnation_count = 0

    while iteration < max_iterations:
        iteration += 1

        # Generate candidate
        failure_text = analyze_failures(best_result)
        print(f"\n--- Iteration {iteration} ---")
        print(f"Generating candidate prompt...")

        try:
            candidate_prompt = await generate_candidate(
                best_prompt, best_score, failure_text
            )
        except Exception as e:
            print(f"Failed to generate candidate: {e}")
            stagnation_count += 1
            if stagnation_count >= 3:
                print("3 consecutive generation failures, stopping.")
                break
            continue

        # Save candidate
        candidate_name = f"opt-v{iteration:03d}"
        candidate_path = PROMPTS_DIR / f"{candidate_name}.txt"
        candidate_path.write_text(candidate_prompt)

        # Run benchmark
        print(f"Running benchmark for {candidate_name}...")
        candidate_result = await run_benchmark(candidate_name)
        candidate_score = candidate_result["final_score"]

        print(f"  Candidate score: {candidate_score:.3f} (best: {best_score:.3f})")

        # Check improvement
        improvement = candidate_score - best_score
        if improvement >= min_improvement:
            print(f"  ✅ IMPROVED by +{improvement:.3f}")
            best_prompt = candidate_prompt
            best_prompt_name = candidate_name
            best_score = candidate_score
            best_result = candidate_result
            stagnation_count = 0

            # Save best
            (PROMPTS_DIR / "best.txt").write_text(candidate_prompt)
        else:
            print(f"  ❌ No significant improvement ({improvement:+.3f})")
            stagnation_count += 1
            # Keep rejected prompts for analysis (rename with score)
            rejected_path = PROMPTS_DIR / f"{candidate_name}_rej-{candidate_score:.3f}.txt"
            candidate_path.rename(rejected_path)

        if stagnation_count >= 3:
            print(f"\nStagnated for {stagnation_count} iterations. Stopping.")
            break

        # Save iteration log
        log_entry = {
            "iteration": iteration,
            "candidate": candidate_name,
            "score": candidate_score,
            "best_score": best_score,
            "improvement": round(improvement, 3),
            "accepted": improvement >= min_improvement,
        }
        log_file = RESULTS_DIR / "optimization_log.jsonl"
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

    print(f"\n{'='*60}")
    print(f"Optimization complete.")
    print(f"Best prompt: {best_prompt_name}")
    print(f"Best score: {best_score:.3f}")
    print(f"{'='*60}\n")

    return best_score, best_prompt_name


async def main():
    max_iter = int(os.getenv("OPT_MAX_ITERATIONS", "10"))
    min_improve = float(os.getenv("OPT_MIN_IMPROVEMENT", "0.010"))
    await run_optimization_loop(max_iterations=max_iter, min_improvement=min_improve)


if __name__ == "__main__":
    asyncio.run(main())
