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
    CaseDifficulty,
    CaseMetadata,
    CaseResult,
    FailureType,
    ScoreBreakdown,
    ScoreDimension,
)
from schemas.task_critic import TaskCriticInput, TaskCriticOutput


# ── Task Critic Score Dimensions ─────────────────────────────────────────────

TASK_CRITIC_DIMENSIONS = [
    ScoreDimension(
        name="correctness",
        weight=0.40,
        description="How close predicted score is to expected score",
    ),
    ScoreDimension(
        name="instruction_following",
        weight=0.25,
        description="Required fields present (qualityScore, improvedTitle, suggestions)",
    ),
    ScoreDimension(
        name="suggestion_quality",
        weight=0.20,
        description="Suggestions are specific, actionable, and non-generic",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.15,
        description="Valid output format and score range",
    ),
]


class TaskCriticFamily(BenchmarkFamily):
    """Benchmark family for task critic quality evaluation."""

    NAME = "task_critic"
    VERSION = "3"  # Bumped for family-specific dimensions + stratified split

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "task-critic-quality"
        super().__init__(cases_dir)

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return TASK_CRITIC_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in TASK_CRITIC_DIMENSIONS}

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

            category = expected_data.get("category", "unknown")
            quality_score = expected_data.get("quality_score", 50)

            # Determine difficulty from expected score range and category
            if category == "edge-case":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category == "over-specified":
                difficulty = CaseDifficulty.HARD
            elif quality_score < 30:
                difficulty = CaseDifficulty.EASY  # Easy for LLM to identify as bad
            elif quality_score > 75:
                difficulty = CaseDifficulty.EASY  # Easy for LLM to identify as good
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[category],
                difficulty=difficulty,
                expected_failure_modes=[],
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=f"Score ~{quality_score}, band: {expected_data.get('quality_band', 'unknown')}",
                common_failure_modes=expected_data.get("expected_suggestion_themes", []),
                acceptable_variation="±10 points on quality score is acceptable",
            )

            cases.append(Case(
                id=case_dir.name,
                input=input_data,
                expected=expected_data,
                metadata=metadata,
                split="dev",  # Will be reassigned by stratified split
            ))

        # Apply stratified split
        cases = self.assign_stratified_split(cases, dev_ratio=0.67)
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
        if error or output is None:
            return CaseResult(
                case_id=case.id,
                split=case.split,
                error=error,
                score=0.2,
                breakdown=ScoreBreakdown(
                    dimensions={d.name: 0.0 for d in TASK_CRITIC_DIMENSIONS},
                    grader_rationale=f"Service error: {error}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected_score = case.expected.get("quality_score", 50)
        predicted_score = output.get("qualityScore", 50)

        # Score breakdown using family-specific dimensions
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

        # Suggestion quality: specific, actionable, non-generic
        suggestions = output.get("suggestions", [])
        expected_themes = case.expected.get("expected_suggestion_themes", [])
        if not suggestions:
            suggestion_quality = 0.5
        else:
            generic_words = {"improve", "better", "update", "review", "check", "consider"}
            specific = sum(
                1 for s in suggestions
                if not any(w in s.lower() for w in generic_words)
            )
            suggestion_quality = min(1.0, specific / len(suggestions))

            # Bonus for hitting expected themes
            if expected_themes:
                all_text = " ".join(suggestions).lower()
                theme_hits = sum(1 for t in expected_themes if t.lower() in all_text)
                theme_bonus = theme_hits / len(expected_themes)
                suggestion_quality = min(1.0, suggestion_quality * 0.7 + theme_bonus * 0.3)

        # Format compliance
        format_compliance = 1.0
        if not isinstance(output.get("qualityScore"), (int, float)):
            format_compliance = 0.0
        elif not (0 <= output["qualityScore"] <= 100):
            format_compliance = 0.0

        dimensions = {
            "correctness": correctness,
            "instruction_following": instruction_following,
            "suggestion_quality": suggestion_quality,
            "format_compliance": format_compliance,
        }

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale=f"correctness={correctness:.2f} (diff={abs_diff:.0f}), instr={instruction_following:.2f}, sugg={suggestion_quality:.2f}, fmt={format_compliance:.2f}",
            borderline=15 <= abs_diff <= 25,  # Near decision boundary
        )

        # Detect failure types
        failure_types = self._detect_failures(case, output, expected_score, predicted_score)

        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=breakdown.composite(self.score_weights()),
            breakdown=breakdown,
            failure_types=failure_types,
            abs_error=round(abs_diff, 1),
            slices=case.metadata.slices,
            difficulty=case.metadata.difficulty.value,
            grader_artifacts={"grader_type": "deterministic", "dimensions": dimensions},
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
