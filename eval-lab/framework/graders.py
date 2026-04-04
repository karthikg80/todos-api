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
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
            )

        breakdown = self._compute_breakdown(case, output)
        score = breakdown.composite

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
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
            )

        score = await self._llm_grade(case, output)
        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=score,
            breakdown=ScoreBreakdown(correctness=score),
            slices=case.metadata.slices,
        )

    async def _llm_grade(self, case: Case, output: dict) -> float:
        """Use LLM to grade output against rubric."""
        prompt = f"""Grade the following output against this rubric:

Rubric:
{self.RUBRIC}

Case input:
{json.dumps(case.input, indent=2)}

Expected:
{json.dumps(case.expected, indent=2)}

Actual output:
{json.dumps(output, indent=2)}

Return ONLY a number between 0.0 and 1.0 representing quality."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.0,
                    "max_tokens": 10,
                },
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            try:
                return float(content)
            except ValueError:
                return 0.5


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
        return det_result
