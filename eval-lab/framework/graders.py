"""Grading framework with deterministic, rubric-based, and pairwise evaluation."""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Any, Optional

import httpx

from framework.schemas import Case, CaseResult, FailureType, ScoreBreakdown


class Grader(ABC):
    """Base class for graders."""

    @abstractmethod
    def grade(self, case: Case, output: Optional[dict], error: Optional[str] = None) -> CaseResult:
        """Grade a case and return structured result."""
        ...


class DeterministicGrader(Grader):
    """Rule-based grader using explicit checks.

    Subclass implements check_* methods that return 0-1 scores.
    """

    def grade(self, case: Case, output: Optional[dict], error: Optional[str] = None) -> CaseResult:
        if error:
            return CaseResult(
                case_id=case.id,
                split=case.split,
                error=error,
                score=0.2,
                breakdown=ScoreBreakdown(
                    dimensions={"correctness": 0.0, "instruction_following": 0.0, "robustness": 0.0, "format_compliance": 0.0},
                    grader_rationale=f"Service error: {error}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        breakdown = self._compute_breakdown(case, output)
        weights = getattr(self, "_weights", None)
        score = breakdown.composite(weights)

        # Detect failure types
        failure_types = self._detect_failures(case, output)

        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=score,
            breakdown=breakdown,
            failure_types=failure_types,
            abs_error=abs(output.get("quality_score", 0) - case.expected.get("quality_score", 0)) if output else 999,
            slices=case.metadata.slices,
            difficulty=case.metadata.difficulty.value,
            grader_artifacts={"grader_type": "deterministic"},
        )

    @abstractmethod
    def _compute_breakdown(self, case: Case, output: dict) -> ScoreBreakdown:
        """Compute score breakdown for a case."""
        ...

    @abstractmethod
    def _detect_failures(self, case: Case, output: dict) -> list[FailureType]:
        """Detect failure types for a case."""
        ...


class RubricGrader(Grader):
    """LLM-based rubric grader for semantic quality assessment.

    Uses an LLM to grade outputs against a rubric.
    """

    RUBRIC: str = ""
    DIMENSIONS: list[str] = ["quality"]

    def __init__(self, model: Optional[str] = None):
        self.model = model or os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")

    async def grade_async(
        self, case: Case, output: Optional[dict], error: Optional[str] = None
    ) -> CaseResult:
        if error:
            return CaseResult(
                case_id=case.id,
                split=case.split,
                error=error,
                score=0.2,
                breakdown=ScoreBreakdown(
                    dimensions={d: 0.0 for d in self.DIMENSIONS},
                    grader_rationale=f"Service error: {error}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        dimensions, rationale, borderline = await self._llm_grade(case, output)
        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=breakdown.composite() if (breakdown := ScoreBreakdown(dimensions=dimensions, grader_rationale=rationale, borderline=borderline)) else 0.5,
            breakdown=ScoreBreakdown(dimensions=dimensions, grader_rationale=rationale, borderline=borderline),
            slices=case.metadata.slices,
            difficulty=case.metadata.difficulty.value,
            grader_artifacts={"grader_type": "rubric", "model": self.model},
        )

    async def _llm_grade(self, case: Case, output: dict) -> tuple[dict[str, float], str, bool]:
        """Use LLM to grade output against rubric.

        Returns (dimensions, rationale, borderline).
        """
        dims_json = ", ".join(f'"{d}": <0.0-1.0>' for d in self.DIMENSIONS)
        prompt = f"""Grade the following output against this rubric:

Rubric:
{self.RUBRIC}

Case input:
{json.dumps(case.input, indent=2)}

Expected:
{json.dumps(case.expected, indent=2)}

Actual output:
{json.dumps(output, indent=2)}

Return ONLY a JSON object with:
- {dims_json}
- "rationale": "<brief explanation>"
- "borderline": <true if score is near a decision boundary>"""

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.0,
                    "max_tokens": 300,
                    "response_format": {"type": "json_object"},
                },
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            try:
                parsed = json.loads(content)
                dimensions = {d: float(parsed.get(d, 0.5)) for d in self.DIMENSIONS}
                rationale = parsed.get("rationale", "")
                borderline = parsed.get("borderline", False)
                return dimensions, rationale, borderline
            except (json.JSONDecodeError, ValueError):
                return {d: 0.5 for d in self.DIMENSIONS}, f"Failed to parse LLM response: {content[:100]}", False


class HybridGrader(Grader):
    """Combines deterministic checks with rubric-based LLM grading.

    Uses deterministic grader for format/schema checks,
    then rubric grader for semantic quality.
    """

    def __init__(
        self,
        deterministic: DeterministicGrader,
        rubric: Optional[RubricGrader] = None,
        deterministic_weight: float = 0.6,
    ):
        self.deterministic = deterministic
        self.rubric = rubric
        self.deterministic_weight = deterministic_weight

    async def grade_async(
        self, case: Case, output: Optional[dict], error: Optional[str] = None
    ) -> CaseResult:
        # Always run deterministic checks
        det_result = self.deterministic.grade(case, output, error)

        if error or self.rubric is None:
            return det_result

        # Add rubric grading
        rubric_result = await self.rubric.grade_async(case, output)

        # Combine scores
        combined_score = (
            self.deterministic_weight * det_result.score
            + (1 - self.deterministic_weight) * rubric_result.score
        )

        det_result.score = round(combined_score, 3)
        det_result.grader_artifacts = {
            "grader_type": "hybrid",
            "deterministic_score": det_result.score,
            "rubric_score": rubric_result.score,
            "deterministic_weight": self.deterministic_weight,
        }
        return det_result
