"""Benchmark family abstraction.

Every benchmark family (task_critic, task_rewriter, plan_from_goal, etc.)
inherits from BenchmarkFamily and implements the required methods.
"""
from __future__ import annotations

import json
import random
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

from framework.schemas import (
    Case,
    CaseDifficulty,
    CaseMetadata,
    CaseResult,
    RunConfig,
    RunResult,
    ScoreBreakdown,
    ScoreDimension,
)


class BenchmarkFamily(ABC):
    """Base class for all benchmark families.

    Subclasses must implement:
    - load_cases(): load cases from disk
    - run_case(): execute a single case against the system under test
    - grade_case(): score a case's output against expected output

    Subclasses should override:
    - score_dimensions(): define family-specific scoring dimensions + weights
    """

    # Override in subclass
    NAME: str = "unnamed"
    VERSION: str = "1"

    def __init__(self, cases_dir: Path):
        self.CASES_DIR = cases_dir
        self._cases: list[Case] | None = None

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        """Define family-specific scoring dimensions and weights.

        Override in subclass to define custom dimensions.
        Default provides equal-weighted generic dimensions.
        """
        return [
            ScoreDimension(name="correctness", weight=0.35, description="How close to expected output"),
            ScoreDimension(name="instruction_following", weight=0.25, description="Required fields present"),
            ScoreDimension(name="robustness", weight=0.20, description="Output quality under variation"),
            ScoreDimension(name="format_compliance", weight=0.20, description="Valid output format"),
        ]

    def score_weights(self) -> dict[str, float]:
        """Return weight mapping for composite score computation."""
        return {d.name: d.weight for d in self.score_dimensions()}

    # ── Case Loading ─────────────────────────────────────────────────────

    def load_cases(self, split: Optional[str] = None) -> list[Case]:
        """Load all cases, optionally filtered by split."""
        if self._cases is None:
            self._cases = self._load_all_cases()
        if split:
            return [c for c in self._cases if c.split == split]
        return list(self._cases)

    @abstractmethod
    def _load_all_cases(self) -> list[Case]:
        """Load cases from disk. Subclass implements directory structure."""
        ...

    # ── Stratified Split Assignment ──────────────────────────────────────

    @staticmethod
    def assign_stratified_split(
        cases: list[Case],
        dev_ratio: float = 0.67,
        seed: int = 42,
    ) -> list[Case]:
        """Assign dev/test splits stratified by slice and difficulty.

        Ensures each slice/difficulty combination is proportionally
        represented in both splits.
        """
        # Group cases by (slice, difficulty)
        groups: dict[tuple, list[Case]] = {}
        for case in cases:
            # Use first slice as primary stratification key
            primary_slice = case.metadata.slices[0] if case.metadata.slices else "default"
            key = (primary_slice, case.metadata.difficulty)
            groups.setdefault(key, []).append(case)

        # Split each group proportionally
        rng = random.Random(seed)
        result = []
        for key, group in groups.items():
            rng.shuffle(group)
            dev_count = max(1, int(len(group) * dev_ratio))
            for i, case in enumerate(group):
                case.split = "dev" if i < dev_count else "test"
                result.append(case)

        return result

    # ── Case Execution ───────────────────────────────────────────────────

    @abstractmethod
    async def run_case(self, case: Case, prompt_override: Optional[str] = None) -> dict[str, Any] | None:
        """Execute a single case against the system under test.

        Returns the raw output dict, or None on failure.
        """
        ...

    # ── Grading ──────────────────────────────────────────────────────────

    @abstractmethod
    def grade_case(
        self,
        case: Case,
        output: Optional[dict[str, Any]],
        error: Optional[str] = None,
    ) -> CaseResult:
        """Grade a case and return structured result.

        Subclass implements scoring logic, failure detection, etc.
        Should use self.score_weights() for composite computation.
        """
        ...

    # ── Full Run ─────────────────────────────────────────────────────────

    async def run_benchmark(
        self,
        config: RunConfig,
        prompt_override: Optional[str] = None,
        split: Optional[str] = None,
    ) -> RunResult:
        """Run all cases (or a specific split) and return structured results."""
        cases = self.load_cases(split)
        results = []

        for case in cases:
            output = None
            error = None
            try:
                output = await self.run_case(case, prompt_override)
            except Exception as e:
                error = str(e)

            result = self.grade_case(case, output, error)
            results.append(result)

        return RunResult(config=config, cases=results)

    # ── Reporting Helpers ────────────────────────────────────────────────

    def report(self, result: RunResult) -> str:
        """Generate a human-readable report."""
        lines = [
            f"Benchmark: {self.NAME} v{self.VERSION}",
            f"Prompt: {result.config.prompt_name}",
            f"Model: {result.config.model}",
            f"Cases: {result.total_cases} ({result.error_count} errors)",
            f"Mean score: {result.mean_score:.3f}",
            "",
        ]

        # By split
        split_scores = result.score_by_split()
        if split_scores:
            lines.append("Score by split:")
            for split_name, score in sorted(split_scores.items()):
                lines.append(f"  {split_name}: {score:.3f}")
            lines.append("")

        # By slice
        slice_scores = result.score_by_slice()
        if slice_scores:
            lines.append("Score by slice:")
            for slice_name, score in sorted(slice_scores.items()):
                lines.append(f"  {slice_name}: {score:.3f}")
            lines.append("")

        # By difficulty
        diff_scores = result.score_by_difficulty()
        if diff_scores:
            lines.append("Score by difficulty:")
            for diff_name, score in sorted(diff_scores.items()):
                lines.append(f"  {diff_name}: {score:.3f}")
            lines.append("")

        # Dimension averages
        dim_avgs = result.dimension_averages()
        if dim_avgs:
            lines.append("Dimension averages:")
            for dim_name, avg in sorted(dim_avgs.items()):
                lines.append(f"  {dim_name}: {avg:.3f}")
            lines.append("")

        # Failure summary (rates, not raw counts)
        failure_rates = result.failure_rate()
        if failure_rates:
            lines.append("Failure rates:")
            for ft, rate in sorted(failure_rates.items(), key=lambda x: -x[1]):
                lines.append(f"  {ft}: {rate:.1%}")
            lines.append("")

        # Worst cases
        worst = sorted(
            [c for c in result.cases if not c.error],
            key=lambda c: c.score,
        )[:5]
        if worst:
            lines.append("Worst cases:")
            for c in worst:
                lines.append(f"  {c.case_id}: {c.score:.3f} [{c.difficulty}] slices={c.slices}")
            lines.append("")

        return "\n".join(lines)
