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
    print(f"\n{'='*60}")
    print(f"PORTFOLIO SUMMARY")
    print(f"{'='*60}")
    print(f"Weighted score: {aggregate['weighted_score']:.3f}")
    print(f"Total cases: {aggregate['total_cases']}")
    print(f"Total errors: {aggregate['total_errors']}")
    print(f"Error rate: {aggregate['error_rate']:.1%}")
    print()

    print("By family:")
    for name, info in sorted(aggregate["family_scores"].items()):
        print(f"  {name}: {info['score']:.3f} ({info['cases']} cases, {info['errors']} errors)")
    print()

    print("By meta-dimension:")
    for dim, score in sorted(aggregate["meta_dimension_averages"].items()):
        print(f"  {dim}: {score:.3f}")
    print()

    print("By difficulty:")
    for diff, score in sorted(aggregate["difficulty_averages"].items()):
        print(f"  {diff}: {score:.3f}")
    print()

    # Compare with previous run if provided
    if args.compare:
        print(f"\nComparing with: {args.compare}")
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
    print(f"\nReport written to: {report_path}")

    return aggregate["weighted_score"]


if __name__ == "__main__":
    score = asyncio.run(main())
    sys.exit(0 if score > 0 else 1)
