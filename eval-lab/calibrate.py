"""Calibration workflow for LLM graders.

Runs human review on a sample of cases, computes agreement,
compares LLM grader vs human labels, and produces a calibration report.

Usage:
    python calibrate.py --family structured_extraction --reviewers alice bob --sample-size 10
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

from framework.evaluators import (
    LLMGrader,
    LLMGraderConfig,
    ReviewAssignment,
    ReviewSet,
)
from framework.schemas import Case
from portfolio import load_family


# ── Calibration Thresholds ───────────────────────────────────────────────────

# Explicit, machine-readable thresholds for trust assignment
CALIBRATION_THRESHOLDS = {
    "min_human_reviewers": 2,
    "min_reviewed_cases": 10,
    "min_human_agreement_kappa": 0.4,  # Tolerance-based reviewer agreement
    "min_llm_vs_human_agreement": 0.6,  # Correlation between LLM and human scores
    "max_grader_error_rate": 0.10,  # 10% max grader errors
    "max_grader_error_rate_for_gating": 0.05,  # 5% max for gating trust
}


# ── Calibration Report ───────────────────────────────────────────────────────

def generate_calibration_report(
    family_name: str,
    review_set: ReviewSet,
    llm_scores: list[dict[str, float]],
    llm_errors: list[Optional[str]],
    human_scores: list[dict[str, float]],
    thresholds: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate a calibration report comparing LLM vs human grading."""
    if thresholds is None:
        thresholds = CALIBRATION_THRESHOLDS

    # Compute human agreement (tolerance-based)
    reviewers = set(a.reviewer for a in review_set.assignments if a.completed)
    reviewer_list = sorted(reviewers)

    agreements = {}
    if len(reviewer_list) >= 2:
        for i in range(len(reviewer_list)):
            for j in range(i + 1, len(reviewer_list)):
                r1, r2 = reviewer_list[i], reviewer_list[j]
                kappa = review_set.compute_kappa(r1, r2)
                agreements[f"{r1}_vs_{r2}"] = kappa

    # Compare LLM vs human average and compute agreement
    llm_averages = {}
    human_averages = {}
    llm_vs_human_agreement = 0.0
    if llm_scores and human_scores:
        # Average across all dimensions
        all_dims = set()
        for s in llm_scores + human_scores:
            all_dims.update(s.keys())

        for dim in all_dims:
            llm_vals = [s.get(dim, 0) for s in llm_scores]
            human_vals = [s.get(dim, 0) for s in human_scores]
            llm_averages[dim] = round(sum(llm_vals) / len(llm_vals), 3) if llm_vals else 0
            human_averages[dim] = round(sum(human_vals) / len(human_vals), 3) if human_vals else 0

        # Compute LLM vs human agreement (tolerance-based: within 0.15)
        total_comparisons = 0
        agreements_count = 0
        for llm_s, human_s in zip(llm_scores, human_scores):
            for dim in all_dims:
                llm_v = llm_s.get(dim, 0)
                human_v = human_s.get(dim, 0)
                total_comparisons += 1
                if abs(llm_v - human_v) <= 0.15:
                    agreements_count += 1
        llm_vs_human_agreement = agreements_count / total_comparisons if total_comparisons > 0 else 0

    # LLM error rate
    llm_error_count = sum(1 for e in llm_errors if e is not None)
    llm_error_rate = llm_error_count / len(llm_errors) if llm_errors else 0

    # Trust recommendation with explicit thresholds
    min_human_agreement = thresholds.get("min_human_agreement_kappa", 0.4)
    min_llm_vs_human = thresholds.get("min_llm_vs_human_agreement", 0.6)
    max_grader_error = thresholds.get("max_grader_error_rate", 0.10)
    max_grader_error_gating = thresholds.get("max_grader_error_rate_for_gating", 0.05)
    min_reviewed = thresholds.get("min_reviewed_cases", 10)

    human_agreement_ok = all(v >= min_human_agreement for v in agreements.values()) if agreements else False
    llm_vs_human_ok = llm_vs_human_agreement >= min_llm_vs_human
    llm_error_rate_ok = llm_error_rate < max_grader_error
    llm_error_rate_gating_ok = llm_error_rate < max_grader_error_gating
    enough_reviews = len(review_set.get_reviewed_cases()) >= min_reviewed

    # Trust progression:
    # not_trusted → trusted_for_reporting → trusted_for_gating
    if human_agreement_ok and llm_vs_human_ok and llm_error_rate_gating_ok and enough_reviews:
        trust_level = "trusted_for_gating"
    elif human_agreement_ok and llm_vs_human_ok and llm_error_rate_ok and enough_reviews:
        trust_level = "trusted_for_reporting"
    elif llm_error_rate_ok:
        trust_level = "not_yet_trusted"
    else:
        trust_level = "not_trusted"

    return {
        "family": family_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "case_count": len(review_set.assignments),
        "reviewed_cases": len(review_set.get_reviewed_cases()),
        "reviewers": reviewer_list,
        "human_agreement": agreements,
        "human_agreement_ok": human_agreement_ok,
        "human_agreement_threshold": min_human_agreement,
        "llm_vs_human_agreement": round(llm_vs_human_agreement, 3),
        "llm_vs_human_agreement_ok": llm_vs_human_ok,
        "llm_vs_human_threshold": min_llm_vs_human,
        "llm_error_rate": round(llm_error_rate, 3),
        "llm_error_rate_ok": llm_error_rate_ok,
        "llm_error_rate_gating_ok": llm_error_rate_gating_ok,
        "max_grader_error_rate": max_grader_error,
        "max_grader_error_rate_for_gating": max_grader_error_gating,
        "llm_averages": llm_averages,
        "human_averages": human_averages,
        "trust_level": trust_level,
        "thresholds_used": thresholds,
        "recommendation": (
            f"LLM grader is {trust_level.replace('_', ' ')} for {family_name}. "
            f"Human agreement: {agreements}. "
            f"LLM vs human agreement: {llm_vs_human_agreement:.1%}. "
            f"LLM error rate: {llm_error_rate:.1%}."
        ),
    }


# ── Calibration Runner ───────────────────────────────────────────────────────

async def run_calibration(
    family_name: str,
    reviewers: list[str],
    sample_size: int = 10,
    output_dir: Optional[Path] = None,
) -> dict[str, Any]:
    """Run full calibration workflow for a family.
    
    1. Load cases from family
    2. Sample cases for review (stratified by difficulty)
    3. Run LLM grader on sampled cases
    4. Generate human review assignments
    5. Compare LLM vs human (once humans complete reviews)
    6. Produce calibration report
    """
    if output_dir is None:
        output_dir = Path(__file__).parent / "results" / "calibration"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load family
    family_cls = load_family(family_name)
    family = family_cls()
    all_cases = family.load_cases()
    
    # Stratified sample by difficulty
    by_difficulty: dict[str, list[Case]] = {}
    for case in all_cases:
        by_difficulty.setdefault(case.metadata.difficulty.value, []).append(case)
    
    sampled_cases = []
    rng = random.Random(42)
    for diff, cases in by_difficulty.items():
        # Sample proportionally, at least 1 per difficulty
        n = max(1, int(sample_size * len(cases) / len(all_cases)))
        sampled_cases.extend(rng.sample(cases, min(n, len(cases))))
    
    # Ensure we have exactly sample_size cases
    if len(sampled_cases) < sample_size:
        remaining = [c for c in all_cases if c not in sampled_cases]
        sampled_cases.extend(rng.sample(remaining, min(sample_size - len(sampled_cases), len(remaining))))
    
    print(f"Sampled {len(sampled_cases)} cases from {family_name}")
    diff_dist = {}
    for c in sampled_cases:
        diff = c.metadata.difficulty.value
        diff_dist[diff] = diff_dist.get(diff, 0) + 1
    print(f"Difficulty distribution: {diff_dist}")
    
    # Create review set
    review_set = ReviewSet(family=family_name)
    for case in sampled_cases:
        for reviewer in reviewers:
            review_set.assignments.append(ReviewAssignment(
                case_id=case.id,
                family=family_name,
                reviewer=reviewer,
            ))
    
    # Run LLM grader
    # Note: This requires a rubric specific to the family
    # For now, we'll use a generic rubric - should be customized per family
    llm_grader = _create_family_grader(family_name)
    
    llm_scores = []
    llm_errors = []
    for case in sampled_cases:
        scores, error = await llm_grader.grade(case.input, case.expected, {})
        llm_scores.append(scores)
        llm_errors.append(error)
    
    print(f"LLM grader completed: {sum(1 for e in llm_errors if e is None)}/{len(llm_errors)} successful")
    
    # Generate calibration report
    # Note: human_scores would come from completed human reviews
    # For now, we'll generate the report with LLM data only
    report = generate_calibration_report(
        family_name=family_name,
        review_set=review_set,
        llm_scores=llm_scores,
        llm_errors=llm_errors,
        human_scores=[],  # Would be populated after human review
    )
    
    # Save report
    report_path = output_dir / f"calibration-{family_name}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    # Save review assignments for human reviewers
    assignments_path = output_dir / f"review-assignments-{family_name}.json"
    with open(assignments_path, "w") as f:
        json.dump({
            "family": family_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "assignments": [
                {
                    "case_id": a.case_id,
                    "reviewer": a.reviewer,
                    "completed": a.completed,
                    "scores": a.scores,
                    "rationale": a.rationale,
                }
                for a in review_set.assignments
            ],
        }, f, indent=2)
    
    print(f"\nCalibration report saved to: {report_path}")
    print(f"Review assignments saved to: {assignments_path}")
    print(f"\n{report['recommendation']}")
    
    return report


def _create_family_grader(family_name: str) -> LLMGrader:
    """Create an LLM grader configured for a specific family.
    
    This should be customized per family with appropriate rubrics.
    """
    if family_name == "structured_extraction":
        config = LLMGraderConfig(
            family=family_name,
            rubric=(
                "Grade the extracted tasks against the expected tasks.\n"
                "- extraction_accuracy: How many expected tasks were found with correct titles\n"
                "- field_completeness: Do extracted tasks have complete fields (title, description, due_date, priority)\n"
                "- deduplication: No duplicate tasks extracted\n"
                "- no_hallucination: No tasks invented that weren't in the source text\n"
                "- format_compliance: Valid output structure with required fields"
            ),
            dimension_names=[
                "extraction_accuracy",
                "field_completeness",
                "deduplication",
                "no_hallucination",
                "format_compliance",
            ],
            dimension_descriptions={
                "extraction_accuracy": "How many expected tasks were found with correct titles (0-1)",
                "field_completeness": "Do extracted tasks have complete fields (0-1)",
                "deduplication": "No duplicate tasks extracted (0-1)",
                "no_hallucination": "No tasks invented that weren't in source (0-1)",
                "format_compliance": "Valid output structure (0-1)",
            },
        )
    elif family_name == "plan_from_goal":
        config = LLMGraderConfig(
            family=family_name,
            rubric=(
                "Grade the generated plan against the expected plan.\n"
                "- goal_coverage: All key aspects of goal addressed\n"
                "- step_quality: Each step is clear and actionable\n"
                "- sequencing: Logical order, dependencies respected\n"
                "- feasibility: Realistic given constraints\n"
                "- granularity: Appropriate level of detail\n"
                "- non_redundancy: No duplicate steps\n"
                "- constraint_adherence: Respects deadlines/budget\n"
                "- format_compliance: Valid output structure"
            ),
            dimension_names=[
                "goal_coverage",
                "step_quality",
                "sequencing",
                "feasibility",
                "granularity",
                "non_redundancy",
                "constraint_adherence",
                "format_compliance",
            ],
            dimension_descriptions={
                "goal_coverage": "All key aspects of goal addressed (0-1)",
                "step_quality": "Each step is clear and actionable (0-1)",
                "sequencing": "Logical order, dependencies respected (0-1)",
                "feasibility": "Realistic given constraints (0-1)",
                "granularity": "Appropriate level of detail (0-1)",
                "non_redundancy": "No duplicate steps (0-1)",
                "constraint_adherence": "Respects deadlines/budget (0-1)",
                "format_compliance": "Valid output structure (0-1)",
            },
        )
    else:
        # Generic grader for other families
        config = LLMGraderConfig(
            family=family_name,
            rubric=f"Grade the output for the {family_name} family on quality and correctness.",
            dimension_names=["quality", "correctness"],
            dimension_descriptions={
                "quality": "Overall quality of the output (0-1)",
                "correctness": "How correct the output is (0-1)",
            },
        )
    
    return LLMGrader(config)


async def main():
    parser = argparse.ArgumentParser(description="Run calibration for an LLM grader")
    parser.add_argument("--family", required=True, help="Family name to calibrate")
    parser.add_argument("--reviewers", nargs="+", required=True, help="Reviewer names")
    parser.add_argument("--sample-size", type=int, default=10, help="Number of cases to sample")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory")
    args = parser.parse_args()
    
    report = await run_calibration(
        family_name=args.family,
        reviewers=args.reviewers,
        sample_size=args.sample_size,
        output_dir=Path(args.output_dir) if args.output_dir else None,
    )
    
    return 0 if report["trust_level"] != "not_trusted" else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
