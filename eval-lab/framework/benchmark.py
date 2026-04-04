"""Benchmark family abstraction.

Every benchmark family (task_critic, task_rewriter, plan_from_goal, etc.)
inherits from BenchmarkFamily and implements the required methods.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

from framework.schemas import (
    Case,
    CaseResult,
    RunConfig,
    RunResult,
    ScoreBreakdown,
)


class BenchmarkFamily(ABC):
    """Base class for all benchmark families.

    Subclasses must implement:
    - load_cases(): load cases from disk
    - run_case(): execute a single case against the system under test
    - grade_case(): score a case's output against expected output
    """

    # Override in subclass
    NAME: str = "unnamed"
    VERSION: str = "1"
    CASES_DIR: Path

    def __init__(self, cases_dir: Path):
        self.CASES_DIR = cases_dir
        self._cases: list[Case] | None = None

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

        # Failure summary
        failures = result.failure_summary()
        if failures:
            lines.append("Failure summary:")
            for ft, count in sorted(failures.items(), key=lambda x: -x[1]):
                lines.append(f"  {ft}: {count}")
            lines.append("")

        # Worst cases
        worst = sorted(
            [c for c in result.cases if not c.error],
            key=lambda c: c.score,
        )[:5]
        if worst:
            lines.append("Worst cases:")
            for c in worst:
                lines.append(f"  {c.case_id}: {c.score:.3f} (expected ~{c.abs_error:+.0f})")
            lines.append("")

        return "\n".join(lines)
