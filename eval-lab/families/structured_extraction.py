"""Structured Extraction benchmark family.

Tests whether the system can extract structured task objects from
unstructured text (notes, emails, meeting transcripts, etc.).

Core question: Can the system identify tasks in raw text and extract
them with correct titles, descriptions, dates, and priorities?
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

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


# ── Structured Extraction Score Dimensions ───────────────────────────────────

STRUCTURED_EXTRACTION_DIMENSIONS = [
    ScoreDimension(
        name="extraction_accuracy",
        weight=0.35,
        description="Correct tasks identified with correct titles and descriptions",
    ),
    ScoreDimension(
        name="field_completeness",
        weight=0.20,
        description="Extracted tasks have complete fields (title, description, due_date, priority)",
    ),
    ScoreDimension(
        name="deduplication",
        weight=0.15,
        description="No duplicate tasks extracted from the same source",
    ),
    ScoreDimension(
        name="no_hallucination",
        weight=0.15,
        description="No tasks invented that weren't in the source text",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.15,
        description="Valid output structure with required fields",
    ),
]


class StructuredExtractionFamily(BenchmarkFamily):
    """Benchmark family for structured task extraction from unstructured text."""

    NAME = "structured_extraction"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "structured-extraction-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return STRUCTURED_EXTRACTION_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in STRUCTURED_EXTRACTION_DIMENSIONS}

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
            expected_task_count = len(expected_data.get("expected_tasks", []))

            # Determine difficulty
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("noisy", "implicit"):
                difficulty = CaseDifficulty.HARD
            elif expected_task_count <= 2:
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_extraction_looks_like", ""),
                common_failure_modes=expected_data.get("common_failure_modes", []),
                acceptable_variation=expected_data.get("acceptable_variation", ""),
            )

            cases.append(Case(
                id=case_dir.name,
                input=input_data,
                expected=expected_data,
                metadata=metadata,
                split="dev",
            ))

        # Apply stratified split
        cases = self.assign_stratified_split(cases, dev_ratio=0.67)
        return cases

    # ── Case Execution ───────────────────────────────────────────────────

    async def run_case(
        self, case: Case, prompt_override: Optional[str] = None
    ) -> dict[str, Any] | None:
        """Call the LLM to extract tasks from unstructured text."""
        source_text = case.input.get("source_text", "")
        source_type = case.input.get("source_type", "note")

        system_prompt = prompt_override or (
            "You are a task extraction assistant. Extract all actionable tasks from the given text.\n\n"
            "For each task, extract:\n"
            "- title: A clear, actionable task title (start with action verb if possible)\n"
            "- description: Additional context or details (can be empty if not available)\n"
            "- due_date: Due date if mentioned (ISO format YYYY-MM-DD, or null)\n"
            "- priority: high/medium/low if implied or stated (or null)\n\n"
            "Rules:\n"
            "1. Only extract tasks that are actually mentioned or implied in the text\n"
            "2. Do NOT invent tasks that aren't in the source text\n"
            "3. Do NOT extract duplicate tasks for the same action\n"
            "4. If no tasks are found, return an empty list\n"
            "5. Normalize dates to YYYY-MM-DD format when possible\n\n"
            "Return JSON with:\n"
            "- tasks: array of {title, description, due_date, priority}"
        )

        user_prompt = f"Source text ({source_type}):\n---\n{source_text}\n---\n\nExtract all actionable tasks."

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1000,
                        "response_format": {"type": "json_object"},
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                return json.loads(content)
        except Exception:
            return None

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
                error=error or "No output",
                score=0.2,
                breakdown=ScoreBreakdown(
                    dimensions={d.name: 0.0 for d in STRUCTURED_EXTRACTION_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        expected_tasks = expected.get("expected_tasks", [])
        extracted_tasks = output.get("tasks", [])

        # Extraction accuracy: how many expected tasks were found?
        extraction_accuracy = self._grade_extraction(extracted_tasks, expected_tasks)

        # Field completeness: do extracted tasks have all fields?
        field_completeness = self._grade_completeness(extracted_tasks)

        # Deduplication: no duplicate tasks?
        deduplication = self._grade_deduplication(extracted_tasks)

        # No hallucination: no tasks invented?
        no_hallucination = self._grade_hallucination(extracted_tasks, expected_tasks)

        # Format compliance
        format_compliance = 1.0 if extracted_tasks and all("title" in t for t in extracted_tasks) else 0.0

        dimensions = {
            "extraction_accuracy": round(extraction_accuracy, 2),
            "field_completeness": round(field_completeness, 2),
            "deduplication": round(deduplication, 2),
            "no_hallucination": round(no_hallucination, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Rationale
        rationale_parts = []
        if extraction_accuracy < 0.5:
            rationale_parts.append(f"missed {len(expected_tasks) - int(extraction_accuracy * len(expected_tasks))} tasks")
        if no_hallucination < 1.0:
            rationale_parts.append("hallucinated tasks detected")
        if deduplication < 1.0:
            rationale_parts.append("duplicate tasks detected")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= extraction_accuracy <= 0.6,
        )

        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=breakdown.composite(self.score_weights()),
            breakdown=breakdown,
            failure_types=failure_types,
            abs_error=0.0,
            slices=case.metadata.slices,
            difficulty=case.metadata.difficulty.value,
            grader_artifacts={
                "grader_type": "deterministic",
                "dimensions": dimensions,
                "expected_task_count": len(expected_tasks),
                "extracted_task_count": len(extracted_tasks),
            },
        )

    # ── Grading Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _grade_extraction(extracted: list[dict], expected: list[dict]) -> float:
        """Grade how many expected tasks were found (0-1)."""
        if not expected:
            return 1.0 if not extracted else 0.5

        found = 0
        for exp_task in expected:
            exp_title = exp_task.get("title", "").lower()
            # Check if any extracted task matches
            for ext_task in extracted:
                ext_title = ext_task.get("title", "").lower()
                if StructuredExtractionFamily._titles_match(exp_title, ext_title):
                    found += 1
                    break

        return found / len(expected)

    @staticmethod
    def _titles_match(title1: str, title2: str) -> bool:
        """Check if two task titles refer to the same task."""
        # Exact match
        if title1 == title2:
            return True

        # One contains the other (for partial matches)
        if title1 in title2 or title2 in title1:
            return True

        # Shared key words (at least 2 significant words in common)
        words1 = set(re.findall(r'\b[a-z]{3,}\b', title1))
        words2 = set(re.findall(r'\b[a-z]{3,}\b', title2))
        common = words1 & words2
        return len(common) >= 2

    @staticmethod
    def _grade_completeness(tasks: list[dict]) -> float:
        """Grade field completeness (0-1)."""
        if not tasks:
            return 1.0  # No tasks to grade

        required_fields = ["title"]
        optional_fields = ["description", "due_date", "priority"]

        total_score = 0
        for task in tasks:
            score = 0
            # Required fields
            for field in required_fields:
                if task.get(field):
                    score += 1
            # Optional fields (partial credit)
            for field in optional_fields:
                if task.get(field):
                    score += 0.5
            total_score += score / (len(required_fields) + len(optional_fields) * 0.5)

        return total_score / len(tasks)

    @staticmethod
    def _grade_deduplication(tasks: list[dict]) -> float:
        """Grade whether there are duplicate tasks (0-1)."""
        if len(tasks) <= 1:
            return 1.0

        # Check for duplicate titles
        titles = [t.get("title", "").lower() for t in tasks]
        unique_titles = set(titles)

        if len(unique_titles) == len(titles):
            return 1.0

        # Penalize for duplicates
        return len(unique_titles) / len(titles)

    @staticmethod
    def _grade_hallucination(extracted: list[dict], expected: list[dict]) -> float:
        """Grade whether tasks were hallucinated (0-1)."""
        if not extracted:
            return 1.0  # No tasks = no hallucination

        hallucinated = 0
        for ext_task in extracted:
            ext_title = ext_task.get("title", "").lower()
            # Check if this matches any expected task
            found = any(
                StructuredExtractionFamily._titles_match(exp_task.get("title", "").lower(), ext_title)
                for exp_task in expected
            )
            if not found:
                hallucinated += 1

        return max(0.0, 1.0 - (hallucinated / len(extracted)))

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("extraction_accuracy", 1.0) < 0.5:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("no_hallucination", 1.0) < 0.5:
            failures.append(FailureType.HALLUCINATED_ISSUE)

        if dimensions.get("deduplication", 1.0) < 0.5:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        return failures
