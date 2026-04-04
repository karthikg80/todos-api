"""Core data models for the eval-lab benchmark framework.

These schemas define the contract that every benchmark family must follow.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Failure Taxonomy ─────────────────────────────────────────────────────────


class FailureType(str, Enum):
    """Normalized failure types across all benchmark families."""

    # Content failures
    MISUNDERSTOOD_INTENT = "misunderstood_intent"
    DROPPED_CONSTRAINT = "dropped_constraint"
    OVER_PENALIZED = "over_penalized"
    UNDER_PENALIZED = "under_penalized"
    HALLUCINATED_ISSUE = "hallucinated_issue"
    INSUFFICIENT_SPECIFICITY = "insufficient_specificity"
    OVER_EDITED = "over_edited"  # For rewriter: changed too much
    INTENT_DRIFT = "intent_drift"  # For rewriter: changed meaning

    # Format/protocol failures
    MALFORMED_RESPONSE = "malformed_response"
    SCHEMA_VIOLATION = "schema_violation"
    EMPTY_RESPONSE = "empty_response"

    # Execution failures
    TIMEOUT = "timeout"
    SERVICE_ERROR = "service_error"
    UNSUPPORTED_EDGE_CONDITION = "unsupported_edge_condition"

    # Policy failures
    OVER_LITERAL = "over_literal_interpretation"
    UNSAFE_ACTION = "unsafe_action"


# ── Score Dimensions ─────────────────────────────────────────────────────────


class ScoreDimension(BaseModel):
    """A single scoring dimension with weight."""

    name: str
    weight: float  # 0-1, weights should sum to 1.0
    description: str = ""


class ScoreBreakdown(BaseModel):
    """Decomposed scores for a single case.

    Families define their own dimensions via ScoreDimension list.
    This model stores arbitrary dimension scores + computes weighted composite.
    """

    # Arbitrary dimension scores (0-1 each)
    dimensions: dict[str, float] = Field(default_factory=dict)

    # Optional: safety/policy for agentic use cases
    safety: Optional[float] = None

    # Grader artifacts (for debugging score disagreements)
    grader_rationale: str = ""
    grader_prompt_version: str = ""
    borderline: bool = False  # True if score is near a decision boundary

    def composite(self, weights: Optional[dict[str, float]] = None) -> float:
        """Weighted composite score.

        If weights provided, uses them. Otherwise equal-weights all dimensions.
        """
        if not self.dimensions:
            return 0.0

        if weights:
            # Use provided weights, normalize if needed
            total_weight = sum(weights.get(k, 0) for k in self.dimensions)
            if total_weight == 0:
                return 0.0
            score = sum(
                weights.get(k, 0) * v for k, v in self.dimensions.items()
            ) / total_weight
        else:
            # Equal weights
            score = sum(self.dimensions.values()) / len(self.dimensions)

        if self.safety is not None:
            score = score * 0.85 + self.safety * 0.15

        return round(score, 3)


# ── Case Definition ──────────────────────────────────────────────────────────


class CaseDifficulty(str, Enum):
    """Difficulty levels for benchmark cases."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    ADVERSARIAL = "adversarial"


class CaseMetadata(BaseModel):
    """Metadata for a single benchmark case."""

    # Provenance
    source: str = "hand_curated"  # hand_curated, production_derived, synthetic, adversarial, regression
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Slice labels for reporting
    slices: list[str] = []  # e.g. ["vague", "no-deadline", "short-title"]

    # Difficulty
    difficulty: CaseDifficulty = CaseDifficulty.MEDIUM

    # Expected failure modes (for diagnosis)
    expected_failure_modes: list[FailureType] = []

    # Rationale (gold rationale fields)
    why_this_case: str = ""
    what_good_looks_like: str = ""
    common_failure_modes: list[str] = []
    acceptable_variation: str = ""  # What outputs are acceptable even if different from expected

    # Regression tracking
    regression_for_bug: str = ""  # If this case is a regression, what bug does it cover?


class Case(BaseModel):
    """A single benchmark case with input, expected output, and metadata."""

    id: str
    input: dict[str, Any]
    expected: dict[str, Any]
    metadata: CaseMetadata = Field(default_factory=CaseMetadata)

    # Split assignment
    split: str = "dev"  # dev, test, regression


# ── Case Result ──────────────────────────────────────────────────────────────


class CaseResult(BaseModel):
    """Result of running a single case."""

    case_id: str
    split: str = "dev"

    # Output
    predicted: Optional[dict[str, Any]] = None
    error: Optional[str] = None

    # Scoring
    score: float = 0.0
    breakdown: ScoreBreakdown = Field(default_factory=ScoreBreakdown)

    # Failure analysis
    failure_types: list[FailureType] = []
    abs_error: float = 0.0

    # Slice labels (copied from case for easy aggregation)
    slices: list[str] = []
    difficulty: str = "medium"

    # Grader artifacts (preserved for debugging)
    grader_artifacts: dict[str, Any] = Field(default_factory=dict)


# ── Run Artifact ─────────────────────────────────────────────────────────────


class RunConfig(BaseModel):
    """Configuration for a benchmark run."""

    benchmark_name: str
    benchmark_version: str
    prompt_name: str
    prompt_version: str = "1"
    model: str = "unknown"
    grader_version: str = "1"
    case_set_version: str = "1"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RunResult(BaseModel):
    """Complete result of a benchmark run."""

    config: RunConfig
    cases: list[CaseResult]

    @property
    def total_cases(self) -> int:
        return len(self.cases)

    @property
    def error_count(self) -> int:
        return sum(1 for c in self.cases if c.error)

    @property
    def mean_score(self) -> float:
        scores = [c.score for c in self.cases if not c.error]
        return round(sum(scores) / len(scores), 3) if scores else 0.0

    def score_by_split(self) -> dict[str, float]:
        """Mean score per split (dev, test, regression)."""
        by_split: dict[str, list[float]] = {}
        for c in self.cases:
            if c.error:
                continue
            by_split.setdefault(c.split, []).append(c.score)
        return {k: round(sum(v) / len(v), 3) for k, v in by_split.items()}

    def score_by_slice(self) -> dict[str, float]:
        """Mean score per slice label."""
        by_slice: dict[str, list[float]] = {}
        for c in self.cases:
            if c.error:
                continue
            for s in c.slices:
                by_slice.setdefault(s, []).append(c.score)
        return {k: round(sum(v) / len(v), 3) for k, v in by_slice.items()}

    def score_by_difficulty(self) -> dict[str, float]:
        """Mean score per difficulty level."""
        by_diff: dict[str, list[float]] = {}
        for c in self.cases:
            if c.error:
                continue
            by_diff.setdefault(c.difficulty, []).append(c.score)
        return {k: round(sum(v) / len(v), 3) for k, v in by_diff.items()}

    def failure_summary(self) -> dict[str, int]:
        """Count of each failure type."""
        counts: dict[str, int] = {}
        for c in self.cases:
            for ft in c.failure_types:
                counts[ft.value] = counts.get(ft.value, 0) + 1
        return counts

    def failure_rate(self) -> dict[str, float]:
        """Failure rate per type (normalized by total non-error cases)."""
        total = sum(1 for c in self.cases if not c.error)
        if total == 0:
            return {}
        counts = self.failure_summary()
        return {k: round(v / total, 3) for k, v in counts.items()}

    def dimension_averages(self) -> dict[str, float]:
        """Average score per dimension across all cases."""
        dim_totals: dict[str, list[float]] = {}
        for c in self.cases:
            if c.error:
                continue
            for dim, val in c.breakdown.dimensions.items():
                dim_totals.setdefault(dim, []).append(val)
        return {k: round(sum(v) / len(v), 3) for k, v in dim_totals.items()}
