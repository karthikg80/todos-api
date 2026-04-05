"""Nightly portfolio runner.

Runs the full portfolio with baseline prompt every night,
compares to previous night's results, and alerts on regressions.

Usage:
    python nightly_runner.py --slack-webhook-url https://hooks.slack.com/...
    python nightly_runner.py --output-dir /path/to/results
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

from portfolio import run_portfolio, aggregate_portfolio, compare_runs, check_guardrails


# ── Nightly Runner ───────────────────────────────────────────────────────────

class NightlyRunner:
    """Runs portfolio nightly and alerts on regressions."""
    
    def __init__(
        self,
        results_dir: Optional[Path] = None,
        slack_webhook_url: Optional[str] = None,
    ):
        self.results_dir = results_dir or Path(__file__).parent / "results" / "nightly"
        self.results_dir.mkdir(parents=True, exist_ok=True)
        self.slack_webhook_url = slack_webhook_url
    
    async def run(self) -> dict[str, Any]:
        """Run nightly portfolio evaluation."""
        print(f"Nightly run started at {datetime.now(timezone.utc).isoformat()}")
        
        # Run portfolio
        results = await run_portfolio(prompt_name="baseline")
        aggregate = aggregate_portfolio(results)
        
        # Save results
        run_id = datetime.now(timezone.utc).strftime("%Y%m%d")
        results_path = self.results_dir / f"nightly-{run_id}.json"
        with open(results_path, "w") as f:
            json.dump({
                "run_id": run_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "aggregate": aggregate,
            }, f, indent=2)
        
        # Compare to previous night
        prev_results = self._load_previous_results(run_id)
        alert_messages = []
        
        if prev_results:
            prev_agg = prev_results.get("aggregate", {})
            comparison = compare_runs(
                # We need to reconstruct RunResult objects, but for nightly we just compare aggregates
                {},  # baseline
                {},  # candidate
            )
            # Simple comparison
            score_delta = aggregate["weighted_score"] - prev_agg.get("weighted_score", 0)
            if score_delta < -0.020:
                alert_messages.append(
                    f"⚠️ Aggregate regression: {score_delta:+.3f} "
                    f"({prev_agg.get('weighted_score', 0):.3f} → {aggregate['weighted_score']:.3f})"
                )
            
            # Check family-level regressions
            for name, info in aggregate.get("family_scores", {}).items():
                prev_info = prev_agg.get("family_scores", {}).get(name, {})
                prev_score = prev_info.get("score", 0)
                fam_delta = info["score"] - prev_score
                if fam_delta < -0.050:
                    alert_messages.append(
                        f"⚠️ Family '{name}' regression: {fam_delta:+.3f} "
                        f"({prev_score:.3f} → {info['score']:.3f})"
                    )
            
            # Check grader error rate increase
            prev_grader_error = prev_agg.get("grader_error_rate", 0)
            curr_grader_error = aggregate.get("grader_error_rate", 0)
            if curr_grader_error - prev_grader_error > 0.05:
                alert_messages.append(
                    f"⚠️ Grader error rate increase: {curr_grader_error:.1%} "
                    f"(was {prev_grader_error:.1%})"
                )
            
            # Check safety regression
            prev_safety = prev_agg.get("meta_dimension_averages", {}).get("safety", 0)
            curr_safety = aggregate.get("meta_dimension_averages", {}).get("safety", 0)
            if curr_safety < prev_safety:
                alert_messages.append(
                    f"🚨 Safety regression: {prev_safety:.3f} → {curr_safety:.3f}"
                )
        else:
            alert_messages.append("ℹ️ First nightly run — no previous results to compare")
        
        # Send alerts
        if alert_messages:
            summary = "\n".join(alert_messages)
            print(f"\nNightly Summary:\n{summary}")
            
            if self.slack_webhook_url:
                await self._send_slack_alert(summary, aggregate)
        
        return {
            "run_id": run_id,
            "aggregate": aggregate,
            "alerts": alert_messages,
            "results_path": str(results_path),
        }
    
    def _load_previous_results(self, current_run_id: str) -> Optional[dict]:
        """Load the most recent previous nightly results."""
        # Find all nightly files except current
        nightly_files = sorted(self.results_dir.glob("nightly-*.json"))
        nightly_files = [f for f in nightly_files if f.stem != f"nightly-{current_run_id}"]
        
        if not nightly_files:
            return None
        
        # Load most recent
        with open(nightly_files[-1]) as f:
            return json.load(f)
    
    async def _send_slack_alert(self, summary: str, aggregate: dict):
        """Send alert to Slack webhook."""
        if not self.slack_webhook_url:
            return
        
        import httpx
        
        score = aggregate.get("weighted_score", 0)
        coverage = aggregate.get("semantic_coverage", 0)
        
        message = (
            f"*Eval-Lab Nightly Report*\n"
            f"Score: {score:.3f}\n"
            f"Coverage: {coverage:.1%}\n"
            f"Errors: {aggregate.get('total_errors', 0)}\n"
            f"Grader Errors: {aggregate.get('total_grader_errors', 0)}\n\n"
            f"{summary}"
        )
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    self.slack_webhook_url,
                    json={"text": message},
                )
        except Exception as e:
            print(f"Failed to send Slack alert: {e}")


# ── CLI ──────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Nightly portfolio runner")
    parser.add_argument("--slack-webhook-url", type=str, default=None, help="Slack webhook URL")
    parser.add_argument("--output-dir", type=str, default=None, help="Results directory")
    args = parser.parse_args()
    
    runner = NightlyRunner(
        results_dir=Path(args.output_dir) if args.output_dir else None,
        slack_webhook_url=args.slack_webhook_url,
    )
    
    result = await runner.run()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
