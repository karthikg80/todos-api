"""Task Critic benchmark family implementation.

First concrete implementation of the BenchmarkFamily interface.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from adapters.task_critic import call_task_critic
from framework.benchmark import BenchmarkFamily
from framework.schemas import (
    Case,
    CaseMetadata,
    CaseResult,
    FailureType,
    ScoreBreakdown,
)
from schemas.task_critic import TaskCriticInput, TaskCriticOutput


class TaskCriticFamily(BenchmarkFamily):
    """Benchmark family for task critic quality evaluation."""

    NAME = "task_critic"
    VERSION = "2"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "task-critic-quality"
        super().__init__(cases_dir)

    # ── Case Loading ─────────────────────────────────────────────────────

    def _load_all_cases(self) -> list[Case]:
        cases = []
        for case_dir in sorted(self.CASES_DIR.glob("case-*")):
            input_path = case_dir / "input.json"
            expected_path = case_dir / "expected.json"

            if not input_path.exists() or not expected_path.exists():
                continue

            with open(input_path) as f:
                input_data = json.load(f)
            with open(expected_path) as f:
                expected_data = json.load(f)

            # Determine split from case ID
            case_id = case_dir.name
            # First 20 cases = dev, last 10 = test
            case_num = int(case_id.split("-")[1])
            split = "dev" if case_num <= 20 else "test"

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[expected_data.get("category", "unknown")],
                expected_failure_modes=[],
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=f"Score ~{expected_data.get('quality_score', 0)}, band: {expected_data.get('quality_band', 'unknown')}",
                common_failure_modes=expected_data.get("expected_suggestion_themes", []),
            )

            cases.append(Case(
                id=case_id,
                input=input_data,
                expected=expected_data,
                metadata=metadata,
                split=split,
            ))

        return cases

    # ── Case Execution ───────────────────────────────────────────────────

    async def run_case(
        self, case: Case, prompt_override: Optional[str] = None
    ) -> dict[str, Any] | None:
        input_obj = TaskCriticInput(**case.input)
        output = await call_task_critic(input_obj, prompt_override=prompt_override)
        if output is None:
            return None
        return output.model_dump(by_alias=True)

    # ── Grading ──────────────────────────────────────────────────────────

    def grade_case(
        self,
        case: Case,
        output: Optional[dict[str, Any]],
        error: Optional[str] = None,
    ) -> CaseResult:
        if error:
            return CaseResult(
                case_id=case.id,
                split=case.split,
                error=error,
                score=0.2,
                breakdown=ScoreBreakdown(
                    correctness=0.0,
                    instruction_following=0.0,
                    robustness=0.0,
                    format_compliance=0.0,
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
            )

        expected_score = case.expected.get("quality_score", 50)
        predicted_score = output.get("qualityScore", 50)

        # Score breakdown
        abs_diff = abs(predicted_score - expected_score)

        # Correctness: how close to expected score
        if abs_diff <= 10:
            correctness = 1.0
        elif abs_diff <= 20:
            correctness = 0.7
        elif abs_diff <= 30:
            correctness = 0.4
        else:
            correctness = 0.1

        # Instruction following: did it return required fields?
        has_required = all(
            k in output for k in ["qualityScore", "improvedTitle", "suggestions"]
        )
        instruction_following = 1.0 if has_required else 0.5

        # Robustness: suggestions quality
        suggestions = output.get("suggestions", [])
        if not suggestions:
            robustness = 0.5
        else:
            generic_words = {"improve", "better", "update", "review", "check", "consider"}
            specific = sum(
                1 for s in suggestions
                if not any(w in s.lower() for w in generic_words)
            )
            robustness = min(1.0, specific / len(suggestions))

        # Format compliance
        format_compliance = 1.0
        if not isinstance(output.get("qualityScore"), (int, float)):
            format_compliance = 0.0
        elif not (0 <= output["qualityScore"] <= 100):
            format_compliance = 0.0

        breakdown = ScoreBreakdown(
            correctness=correctness,
            instruction_following=instruction_following,
            robustness=robustness,
            format_compliance=format_compliance,
        )

        # Detect failure types
        failure_types = self._detect_failures(case, output, expected_score, predicted_score)

        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=breakdown.composite,
            breakdown=breakdown,
            failure_types=failure_types,
            abs_error=round(abs_diff, 1),
            slices=case.metadata.slices,
        )

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        expected_score: float,
        predicted_score: float,
    ) -> list[FailureType]:
        """Detect failure types for a case."""
        failures = []
        diff = predicted_score - expected_score

        if abs(diff) > 30:
            if diff > 0:
                failures.append(FailureType.OVER_PENALIZED)
            else:
                failures.append(FailureType.UNDER_PENALIZED)

        suggestions = output.get("suggestions", [])
        expected_themes = case.expected.get("expected_suggestion_themes", [])
        if expected_themes and suggestions:
            all_text = " ".join(suggestions).lower()
            if not any(t.lower() in all_text for t in expected_themes):
                failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        if not output.get("improvedTitle") and case.expected.get("should_improve_title"):
            failures.append(FailureType.DROPPED_CONSTRAINT)

        return failures
