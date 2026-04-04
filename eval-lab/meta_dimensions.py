"""Meta-dimension mapping for portfolio-level reporting.

Maps family-specific dimensions into common meta-buckets so that
portfolio-level reporting can compare apples to apples across families.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MetaDimension:
    """A meta-dimension that groups family-specific dimensions."""

    name: str
    description: str


# ── Meta-Dimensions ──────────────────────────────────────────────────────────

CORRECTNESS = MetaDimension(
    name="correctness",
    description="How well the output matches expected behavior or content",
)
COMPLIANCE = MetaDimension(
    name="compliance",
    description="Whether output follows required format and constraints",
)
ROBUSTNESS = MetaDimension(
    name="robustness",
    description="Quality under variation, edge cases, and adversarial inputs",
)
SAFETY = MetaDimension(
    name="safety",
    description="Whether the system avoids dangerous or irreversible actions",
)
REASONING = MetaDimension(
    name="reasoning",
    description="Quality of justification, explanation, and decision logic",
)

# ── Family Dimension Mapping ─────────────────────────────────────────────────

# Maps (family_name, dimension_name) → MetaDimension
DIMENSION_MAP: dict[tuple[str, str], MetaDimension] = {
    # Task Critic
    ("task_critic", "correctness"): CORRECTNESS,
    ("task_critic", "instruction_following"): COMPLIANCE,
    ("task_critic", "suggestion_quality"): ROBUSTNESS,
    ("task_critic", "format_compliance"): COMPLIANCE,

    # Task Rewriter
    ("task_rewriter", "intent_preservation"): CORRECTNESS,
    ("task_rewriter", "clarity_improvement"): CORRECTNESS,
    ("task_rewriter", "actionability"): ROBUSTNESS,
    ("task_rewriter", "constraint_adherence"): COMPLIANCE,
    ("task_rewriter", "no_hallucination"): SAFETY,
    ("task_rewriter", "format_compliance"): COMPLIANCE,

    # Plan-from-Goal
    ("plan_from_goal", "goal_coverage"): CORRECTNESS,
    ("plan_from_goal", "step_quality"): CORRECTNESS,
    ("plan_from_goal", "sequencing"): REASONING,
    ("plan_from_goal", "feasibility"): ROBUSTNESS,
    ("plan_from_goal", "granularity"): REASONING,
    ("plan_from_goal", "non_redundancy"): CORRECTNESS,
    ("plan_from_goal", "constraint_adherence"): COMPLIANCE,
    ("plan_from_goal", "format_compliance"): COMPLIANCE,

    # Clarification Policy
    ("clarification_policy", "decision_quality"): CORRECTNESS,
    ("clarification_policy", "question_quality"): REASONING,
    ("clarification_policy", "minimality"): REASONING,
    ("clarification_policy", "safety"): SAFETY,
    ("clarification_policy", "format_compliance"): COMPLIANCE,

    # Prioritization
    ("prioritization", "ordering_quality"): CORRECTNESS,
    ("prioritization", "dependency_respect"): COMPLIANCE,
    ("prioritization", "justification_quality"): REASONING,
    ("prioritization", "tie_handling"): REASONING,
    ("prioritization", "format_compliance"): COMPLIANCE,
}


def get_meta_dimension(family_name: str, dimension_name: str) -> MetaDimension | None:
    """Look up the meta-dimension for a family-specific dimension."""
    return DIMENSION_MAP.get((family_name, dimension_name))


def get_family_dimensions(family_name: str) -> list[str]:
    """Get all dimension names for a family."""
    return [
        dim_name
        for (fam, dim_name) in DIMENSION_MAP.keys()
        if fam == family_name
    ]


def get_meta_dimension_scores(
    family_name: str,
    dimension_scores: dict[str, float],
) -> dict[str, list[float]]:
    """Group dimension scores by meta-dimension."""
    meta_scores: dict[str, list[float]] = {}
    for dim_name, score in dimension_scores.items():
        meta = get_meta_dimension(family_name, dim_name)
        if meta:
            meta_scores.setdefault(meta.name, []).append(score)
    # Average within each meta-dimension
    return {k: round(sum(v) / len(v), 3) for k, v in meta_scores.items()}
