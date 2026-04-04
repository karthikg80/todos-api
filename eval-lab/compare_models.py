"""Model comparison runner.

Runs the full portfolio against two different models and compares results.

Usage:
    python compare_models.py --baseline gpt-4o-mini --candidate gpt-4o
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from portfolio import run_portfolio, aggregate_portfolio, compare_runs, generate_portfolio_report


async def run_with_model(model: str, prompt_name: str = "baseline") -> dict:
    """Run full portfolio with a specific model."""
    # Override the model env var
    old_model = os.environ.get("AI_PROVIDER_MODEL")
    os.environ["AI_PROVIDER_MODEL"] = model
    
    # Also need to reload the adapters since they cache the model
    # The adapters read os.getenv("AI_PROVIDER_MODEL") at call time, so this should work
    
    print(f"\n{'='*60}")
    print(f"Running full portfolio with {model}")
    print(f"{'='*60}")
    
    results = await run_portfolio(prompt_name=prompt_name)
    
    # Restore old model
    if old_model:
        os.environ["AI_PROVIDER_MODEL"] = old_model
    
    return results


async def main():
    parser = argparse.ArgumentParser(description="Compare models across full portfolio")
    parser.add_argument("--baseline", default="gpt-4o-mini", help="Baseline model name")
    parser.add_argument("--candidate", default="gpt-4o", help="Candidate model name")
    parser.add_argument("--prompt", default="baseline", help="Prompt name to use")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory")
    args = parser.parse_args()
    
    print(f"Model comparison: {args.baseline} vs {args.candidate}")
    print(f"Prompt: {args.prompt}")
    
    # Run baseline model
    baseline_results = await run_with_model(args.baseline, args.prompt)
    baseline_agg = aggregate_portfolio(baseline_results)
    
    # Save baseline results
    baseline_data = {
        "model": args.baseline,
        "prompt": args.prompt,
        "aggregate": baseline_agg,
        "families": {name: {
            "score": r.mean_score,
            "cases": r.total_cases,
            "errors": r.error_count,
        } for name, r in baseline_results.items()}
    }
    
    # Run candidate model
    candidate_results = await run_with_model(args.candidate, args.prompt)
    candidate_agg = aggregate_portfolio(candidate_results)
    
    # Save candidate results
    candidate_data = {
        "model": args.candidate,
        "prompt": args.prompt,
        "aggregate": candidate_agg,
        "families": {name: {
            "score": r.mean_score,
            "cases": r.total_cases,
            "errors": r.error_count,
        } for name, r in candidate_results.items()}
    }
    
    # Compare
    comparison = compare_runs(baseline_results, candidate_results)
    
    # Print results
    print(f"\n{'='*60}")
    print(f"MODEL COMPARISON RESULTS")
    print(f"{'='*60}")
    print(f"Baseline ({args.baseline}): {baseline_agg['weighted_score']:.3f}")
    print(f"Candidate ({args.candidate}): {candidate_agg['weighted_score']:.3f}")
    delta = candidate_agg['weighted_score'] - baseline_agg['weighted_score']
    print(f"Delta: {delta:+.3f}")
    print()
    
    print("Per-family deltas:")
    for name in baseline_results:
        b = baseline_results[name]
        c = candidate_results[name]
        fam_delta = c.mean_score - b.mean_score
        print(f"  {name}: {b.mean_score:.3f} → {c.mean_score:.3f} ({fam_delta:+.3f})")
    print()
    
    print("Meta-dimension deltas:")
    for dim, delta_val in sorted(comparison["meta_dimension_deltas"].items()):
        print(f"  {dim}: {delta_val:+.3f}")
    print()
    
    print("Win/Loss:")
    wl = comparison["win_loss"]
    print(f"  {wl['wins']}W / {wl['losses']}L / {wl['ties']}T")
    print()
    
    if comparison.get("biggest_improvements"):
        print("Biggest improvements:")
        for d in comparison["biggest_improvements"]:
            print(f"  {d['family']}/{d['case_id']}: {d['baseline_score']:.3f} → {d['candidate_score']:.3f} ({d['delta']:+.3f})")
        print()
    
    if comparison.get("biggest_regressions"):
        print("Biggest regressions:")
        for d in comparison["biggest_regressions"]:
            print(f"  {d['family']}/{d['case_id']}: {d['baseline_score']:.3f} → {d['candidate_score']:.3f} ({d['delta']:+.3f})")
        print()
    
    # Guardrail check
    guardrails = comparison.get("guardrails", {})
    print(f"Guardrails: {'PASSED' if guardrails.get('passed') else 'FAILED'}")
    if guardrails.get("violations"):
        for v in guardrails["violations"]:
            print(f"  ❌ {v}")
    else:
        print("  ✅ All guardrails passed")
    
    # Save results
    output_dir = Path(args.output_dir) if args.output_dir else Path(__file__).parent / "results" / "model-comparison"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with open(output_dir / f"comparison-{args.baseline}-vs-{args.candidate}.json", "w") as f:
        json.dump({
            "baseline": baseline_data,
            "candidate": candidate_data,
            "comparison": comparison,
        }, f, indent=2)
    
    print(f"\nResults saved to: {output_dir}")
    
    return delta


if __name__ == "__main__":
    delta = asyncio.run(main())
    sys.exit(0)
