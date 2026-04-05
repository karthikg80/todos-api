"""Meta-dimension mapping for portfolio-level reporting.

Maps family-specific dimensions into common meta-buckets so that
portfolio-level reporting can compare apples to apples across families.

This mapping is a versioned rubric — changes should be documented and
reviewed when families are added or dimensions change.

Version: 1.0
Last updated: 2026-04-04
"""
from __future__ import annotations

from dataclasses import dataclass


# ── Version ──────────────────────────────────────────────────────────────────

META_DIMENSION_VERSION = "1.0"


# ── Meta-Dimensions ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class MetaDimension:
    """A meta-dimension that groups family-specific dimensions."""

    name: str
    description: str


CORRECTNESS = MetaDimension(
    name="correctness",
    description="How well the output matches expected behavior or content. "
                "Includes: accuracy, intent preservation, goal coverage, ordering quality.",
)
COMPLIANCE = MetaDimension(
    name="compliance",
    description="Whether output follows required format and constraints. "
                "Includes: format compliance, instruction following, constraint adherence, dependency respect.",
)
ROBUSTNESS = MetaDimension(
    name="robustness",
    description="Quality under variation, edge cases, and adversarial inputs. "
                "Includes: suggestion quality, actionability, feasibility, tie handling.",
)
SAFETY = MetaDimension(
    name="safety",
    description="Whether the system avoids dangerous or irreversible actions. "
                "Includes: no hallucination, safe decision-making.",
)
REASONING = MetaDimension(
    name="reasoning",
    description="Quality of justification, explanation, and decision logic. "
                "Includes: sequencing, justification quality, question quality, minimality, granularity.",
)


# ── Family Dimension Mapping ─────────────────────────────────────────────────

# Maps (family_name, dimension_name) → MetaDimension
# Each mapping includes a rationale comment for review.
DIMENSION_MAP: dict[tuple[str, str], tuple[MetaDimension, str]] = {
    # Task Critic
    ("task_critic", "correctness"): (CORRECTNESS, "Score accuracy vs expected"),
    ("task_critic", "instruction_following"): (COMPLIANCE, "Required fields present"),
    ("task_critic", "suggestion_quality"): (ROBUSTNESS, "Specificity under variation"),
    ("task_critic", "format_compliance"): (COMPLIANCE, "Valid JSON structure"),

    # Task Rewriter
    ("task_rewriter", "intent_preservation"): (CORRECTNESS, "Preserves original meaning"),
    ("task_rewriter", "clarity_improvement"): (CORRECTNESS, "Output is clearer than input"),
    ("task_rewriter", "actionability"): (ROBUSTNESS, "Output is actionable"),
    ("task_rewriter", "constraint_adherence"): (COMPLIANCE, "Respects dates/names/numbers"),
    ("task_rewriter", "no_hallucination"): (SAFETY, "Does not invent facts"),
    ("task_rewriter", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Plan-from-Goal
    ("plan_from_goal", "goal_coverage"): (CORRECTNESS, "All goal aspects addressed"),
    ("plan_from_goal", "step_quality"): (CORRECTNESS, "Each step is clear and actionable"),
    ("plan_from_goal", "sequencing"): (REASONING, "Logical order, dependencies respected"),
    ("plan_from_goal", "feasibility"): (ROBUSTNESS, "Realistic given constraints"),
    ("plan_from_goal", "granularity"): (REASONING, "Appropriate detail level"),
    ("plan_from_goal", "non_redundancy"): (CORRECTNESS, "No duplicate steps"),
    ("plan_from_goal", "constraint_adherence"): (COMPLIANCE, "Respects deadlines/budget"),
    ("plan_from_goal", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Clarification Policy
    ("clarification_policy", "decision_quality"): (CORRECTNESS, "Correct ask/proceed/refuse choice"),
    ("clarification_policy", "question_quality"): (REASONING, "Questions are relevant and specific"),
    ("clarification_policy", "minimality"): (REASONING, "Not over-asking or under-asking"),
    ("clarification_policy", "safety"): (SAFETY, "No dangerous actions without clarification"),
    ("clarification_policy", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Prioritization
    ("prioritization", "ordering_quality"): (CORRECTNESS, "Tasks ordered by true priority"),
    ("prioritization", "dependency_respect"): (COMPLIANCE, "Blocked tasks after blockers"),
    ("prioritization", "justification_quality"): (REASONING, "Reasoning is sound and specific"),
    ("prioritization", "tie_handling"): (REASONING, "Similar-priority tasks grouped"),
    ("prioritization", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Structured Extraction
    ("structured_extraction", "extraction_accuracy"): (CORRECTNESS, "Correct tasks identified"),
    ("structured_extraction", "field_completeness"): (CORRECTNESS, "Complete fields extracted"),
    ("structured_extraction", "deduplication"): (COMPLIANCE, "No duplicate tasks"),
    ("structured_extraction", "no_hallucination"): (SAFETY, "No invented tasks"),
    ("structured_extraction", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Feature Exposure
    ("feature_exposure", "classification_accuracy"): (CORRECTNESS, "User segment matches expected"),
    ("feature_exposure", "feature_appropriateness"): (CORRECTNESS, "Features match maturity"),
    ("feature_exposure", "over_exposure_avoidance"): (SAFETY, "Novice users not overwhelmed"),
    ("feature_exposure", "under_exposure_avoidance"): (ROBUSTNESS, "Power users get advanced features"),
    ("feature_exposure", "nudge_quality"): (REASONING, "Growth nudges are relevant"),
    ("feature_exposure", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Decision Assist
    ("decision_assist", "relevance"): (CORRECTNESS, "Suggestions match user context"),
    ("decision_assist", "timeliness"): (ROBUSTNESS, "Suggestions appropriate for current state"),
    ("decision_assist", "actionability"): (CORRECTNESS, "Suggestions are concrete and executable"),
    ("decision_assist", "appropriateness"): (COMPLIANCE, "Respects plan tier and limits"),
    ("decision_assist", "no_hallucination"): (SAFETY, "No invented tasks or false context"),
    ("decision_assist", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Task Breakdown
    ("task_breakdown", "decomposition_quality"): (CORRECTNESS, "Subtasks appropriately scoped and sequenced"),
    ("task_breakdown", "completeness"): (CORRECTNESS, "All aspects of parent task covered"),
    ("task_breakdown", "non_redundancy"): (COMPLIANCE, "No duplicate or overlapping subtasks"),
    ("task_breakdown", "context_awareness"): (ROBUSTNESS, "Respects project context and existing state"),
    ("task_breakdown", "actionability"): (CORRECTNESS, "Each subtask is concrete and executable"),
    ("task_breakdown", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Narrative Brief
    ("narrative_brief", "accuracy"): (CORRECTNESS, "Analysis correctly reflects underlying data"),
    ("narrative_brief", "actionability"): (ROBUSTNESS, "Recommendations are concrete and prioritized"),
    ("narrative_brief", "clarity"): (REASONING, "Narrative is clear and well-structured"),
    ("narrative_brief", "completeness"): (CORRECTNESS, "All relevant patterns and insights covered"),
    ("narrative_brief", "no_hallucination"): (SAFETY, "No invented facts or false patterns"),
    ("narrative_brief", "format_compliance"): (COMPLIANCE, "Valid output structure"),

    # Context-Aware Planning
    ("context_aware_planning", "context_utilization"): (CORRECTNESS, "Plan uses project context appropriately"),
    ("context_aware_planning", "dependency_respect"): (COMPLIANCE, "Respects task dependencies and constraints"),
    ("context_aware_planning", "urgency_alignment"): (ROBUSTNESS, "Next-work matches urgency signals"),
    ("context_aware_planning", "feasibility"): (ROBUSTNESS, "Plan is realistic given current state"),
    ("context_aware_planning", "risk_awareness"): (REASONING, "Correctly identifies and flags risks"),
    ("context_aware_planning", "format_compliance"): (COMPLIANCE, "Valid output structure"),
}


def get_meta_dimension(family_name: str, dimension_name: str) -> MetaDimension | None:
    """Look up the meta-dimension for a family-specific dimension."""
    entry = DIMENSION_MAP.get((family_name, dimension_name))
    return entry[0] if entry else None


def get_mapping_rationale(family_name: str, dimension_name: str) -> str | None:
    """Get the rationale for why a dimension maps to its meta-dimension."""
    entry = DIMENSION_MAP.get((family_name, dimension_name))
    return entry[1] if entry else None


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


def get_all_meta_dimensions() -> list[MetaDimension]:
    """Get all unique meta-dimensions."""
    seen = set()
    result = []
    for meta, _ in DIMENSION_MAP.values():
        if meta not in seen:
            seen.add(meta)
            result.append(meta)
    return result
