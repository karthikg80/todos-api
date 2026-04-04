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


# ── Score Decomposition ──────────────────────────────────────────────────────


class ScoreBreakdown(BaseModel):
    """Decomposed scores for a single case."""

    # Core quality (0-1)
    correctness: float = 1.0
    instruction_following: float = 1.0
    robustness: float = 1.0
    format_compliance: float = 1.0

    # Optional: safety/policy for agentic use cases
    safety: Optional[float] = None

    @property
    def composite(self) -> float:
        """Weighted composite score."""
        weights = {
            "correctness": 0.35,
            "instruction_following": 0.25,
            "robustness": 0.20,
            "format_compliance": 0.20,
        }
        total = sum(weights[k] * getattr(self, k) for k in weights)
        if self.safety is not None:
            total = total * 0.85 + self.safety * 0.15
        return round(total, 3)


# ── Case Definition ──────────────────────────────────────────────────────────


class CaseMetadata(BaseModel):
    """Metadata for a single benchmark case."""

    # Provenance
    source: str = "hand_curated"  # hand_curated, production_derived, synthetic, adversarial
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Slice labels for reporting
    slices: list[str] = []  # e.g. ["vague", "no-deadline", "short-title"]

    # Expected failure modes (for diagnosis)
    expected_failure_modes: list[FailureType] = []

    # Rationale
    why_this_case: str = ""
    what_good_looks_like: str = ""
    common_failure_modes: list[str] = []


class Case(BaseModel):
    """A single benchmark case with input, expected output, and metadata."""

    id: str
    input: dict[str, Any]
    expected: dict[str, Any]
    metadata: CaseMetadata = Field(default_factory=CaseMetadata)

    # Split assignment
    split: str = "dev"  # dev, test, stress


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
        """Mean score per split (dev, test, stress)."""
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

    def failure_summary(self) -> dict[str, int]:
        """Count of each failure type."""
        counts: dict[str, int] = {}
        for c in self.cases:
            for ft in c.failure_types:
                counts[ft.value] = counts.get(ft.value, 0) + 1
        return counts
