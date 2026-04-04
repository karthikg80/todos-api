"""Portfolio runner CLI.

Usage:
    python run_portfolio.py                    # Run all families with baseline prompt
    python run_portfolio.py --prompt best      # Run with best prompt
    python run_portfolio.py --families task_critic task_rewriter  # Run specific families
    python run_portfolio.py --compare baseline.json  # Compare with previous run
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


def print_aggregate(aggregate: dict):
    """Print aggregate portfolio results."""
    is_full = aggregate.get("is_full_portfolio", False)
    label = "FULL" if is_full else f"PARTIAL ({len(aggregate.get('families_included', []))}/{aggregate.get('total_families_available', 0)} families)"

    print(f"\n{'='*60}")
    print(f"PORTFOLIO SUMMARY [{label}]")
    print(f"{'='*60}")
    print(f"Weighted score: {aggregate['weighted_score']:.3f}")
    print(f"Total cases: {aggregate['total_cases']}")
    print(f"Total errors: {aggregate['total_errors']}")
    print(f"Error rate: {aggregate['error_rate']:.1%}")
    print()

    print("By family:")
    for name, info in sorted(aggregate["family_scores"].items()):
        print(f"  {name}: {info['score']:.3f} ({info['cases']} cases, {info['errors']} errors, weight={info['weight']:.2f})")
    print()

    print("By meta-dimension:")
    for dim, score in sorted(aggregate["meta_dimension_averages"].items()):
        print(f"  {dim}: {score:.3f}")
    print()

    # Contribution breakdown
    if "meta_dimension_contributions" in aggregate:
        print("Meta-dimension contributions by family:")
        for dim, contributions in sorted(aggregate["meta_dimension_contributions"].items()):
            contrib_str = ", ".join(f"{fam}={val:.2f}" for fam, val in sorted(contributions.items()))
            print(f"  {dim}: {contrib_str}")
        print()

    print("By difficulty:")
    for diff, score in sorted(aggregate["difficulty_averages"].items()):
        print(f"  {diff}: {score:.3f}")
    print()


def print_comparison(comparison: dict):
    """Print run comparison results."""
    print(f"\n{'='*60}")
    print(f"RUN COMPARISON")
    print(f"{'='*60}")
    print(f"Score delta: {comparison['score_delta']:+.3f}")
    print(f"Win/Loss: {comparison['win_loss']['wins']}W / {comparison['win_loss']['losses']}L / {comparison['win_loss']['ties']}T")
    print()

    print("Meta-dimension deltas:")
    for dim, delta in sorted(comparison["meta_dimension_deltas"].items()):
        print(f"  {dim}: {delta:+.3f}")
    print()

    print("Family deltas:")
    for name, delta_info in sorted(comparison["family_deltas"].items()):
        print(f"  {name}: {delta_info['baseline_score']:.3f} → {delta_info['candidate_score']:.3f} ({delta_info['delta']:+.3f})")
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

    # Guardrail results
    guardrails = comparison.get("guardrails", {})
    if guardrails:
        print(f"Guardrails: {'PASSED' if guardrails.get('passed') else 'FAILED'}")
        if guardrails.get("violations"):
            for v in guardrails["violations"]:
                print(f"  ❌ {v}")
        else:
            print("  ✅ All guardrails passed")
        print()


async def main():
    parser = argparse.ArgumentParser(description="Run eval-lab portfolio")
    parser.add_argument("--prompt", default="baseline", help="Prompt name to use")
    parser.add_argument("--families", nargs="+", default=None, help="Families to run (default: all)")
    parser.add_argument("--compare", type=str, default=None, help="Path to previous run JSON for comparison")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory for reports")
    args = parser.parse_args()

    print(f"Running portfolio with prompt='{args.prompt}'")
    if args.families:
        print(f"Families: {', '.join(args.families)}")
    else:
        print("Families: all")

    results = await run_portfolio(
        families=args.families,
        prompt_name=args.prompt,
    )

    # Print summary
    aggregate = aggregate_portfolio(results)
    print_aggregate(aggregate)

    # Compare with previous run if provided
    if args.compare:
        print(f"Comparing with: {args.compare}")
        with open(args.compare) as f:
            prev_data = json.load(f)

        # Reconstruct RunResult objects from previous run
        # For simplicity, just compare aggregate scores
        prev_score = prev_data.get("aggregate", {}).get("weighted_score", 0)
        delta = round(aggregate["weighted_score"] - prev_score, 3)
        print(f"Previous score: {prev_score:.3f}")
        print(f"Current score:  {aggregate['weighted_score']:.3f}")
        print(f"Delta: {delta:+.3f}")

    # Generate report
    output_dir = Path(args.output_dir) if args.output_dir else None
    report_path = generate_portfolio_report(results, output_dir=output_dir)
    print(f"Report written to: {report_path}")

    return aggregate["weighted_score"]


if __name__ == "__main__":
    score = asyncio.run(main())
    sys.exit(0 if score > 0 else 1)
