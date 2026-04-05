"""Narrative Brief benchmark family.

Tests whether the system produces accurate, actionable, and well-structured
narrative analysis (priorities briefs, weekly reviews, project health reports,
feedback summaries, and productivity insights).

Core question: Does the AI produce accurate, actionable, and well-structured narrative analysis?
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Optional

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


# ── Narrative Brief Score Dimensions ─────────────────────────────────────────

NARRATIVE_BRIEF_DIMENSIONS = [
    ScoreDimension(
        name="accuracy",
        weight=0.25,
        description="Analysis correctly reflects underlying data and patterns",
    ),
    ScoreDimension(
        name="actionability",
        weight=0.20,
        description="Recommendations are concrete and prioritized",
    ),
    ScoreDimension(
        name="clarity",
        weight=0.15,
        description="Narrative is clear and well-structured",
    ),
    ScoreDimension(
        name="completeness",
        weight=0.15,
        description="All relevant patterns and insights are covered",
    ),
    ScoreDimension(
        name="no_hallucination",
        weight=0.15,
        description="No invented facts or false patterns",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.10,
        description="Valid output structure with required fields",
    ),
]


class NarrativeBriefFamily(BenchmarkFamily):
    """Benchmark family for narrative/analytical output quality evaluation."""

    NAME = "narrative_brief"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "narrative-brief-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return NARRATIVE_BRIEF_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in NARRATIVE_BRIEF_DIMENSIONS}

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

            brief_type = expected_data.get("brief_type", "unknown")
            category = expected_data.get("category", "unknown")

            # Determine difficulty
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("noisy", "sparse"):
                difficulty = CaseDifficulty.HARD
            elif brief_type in ("daily_priorities", "project_health"):
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[brief_type, category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_brief_looks_like", ""),
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
        """Call the LLM to generate a narrative brief."""
        brief_type = case.input.get("brief_type", "priorities_brief")
        data_context = case.input.get("data_context", {})

        system_prompt = prompt_override or (
            f"You are an AI {brief_type.replace('_', ' ')} generator. "
            "Analyze the provided data and produce a clear, actionable narrative brief.\n\n"
            "Your brief should include:\n"
            "- summary: A concise overview of the current state\n"
            "- priorities: A list of top priorities with reasoning\n"
            "- recommendations: Concrete, prioritized recommendations\n"
            "- risks: Any identified risks or concerns\n\n"
            "Rules:\n"
            "1. Base all analysis on the provided data only\n"
            "2. Do NOT invent facts or patterns not present in the data\n"
            "3. Prioritize recommendations by impact and urgency\n"
            "4. Be specific and actionable, not generic\n"
            "5. If data is insufficient, note the limitations\n\n"
            "Return JSON with:\n"
            "- summary: string\n"
            "- priorities: array of {item, reasoning, urgency}\n"
            "- recommendations: array of {action, rationale, priority}\n"
            "- risks: array of strings\n"
            "- confidence: 0.0-1.0"
        )

        user_prompt = (
            f"Data context:\n{json.dumps(data_context, indent=2)}\n\n"
            f"Generate a {brief_type.replace('_', ' ')} based on this data."
        )

        try:
            import httpx
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
                    dimensions={d.name: 0.0 for d in NARRATIVE_BRIEF_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        expected_patterns = expected.get("expected_patterns", [])
        expected_recommendations = expected.get("expected_recommendations", [])

        # Accuracy: does analysis reflect underlying data
        accuracy = self._grade_accuracy(output, case.input, expected_patterns)

        # Actionability: are recommendations concrete and prioritized
        actionability = self._grade_actionability(output)

        # Clarity: is narrative clear and well-structured
        clarity = self._grade_clarity(output)

        # Completeness: are all relevant patterns covered
        completeness = self._grade_completeness(output, expected_patterns, expected_recommendations)

        # No hallucination: no invented facts
        no_hallucination = self._grade_hallucination(output, case.input)

        # Format compliance
        required_fields = ["summary", "priorities", "recommendations"]
        format_compliance = 1.0 if all(f in output for f in required_fields) else 0.5

        dimensions = {
            "accuracy": round(accuracy, 2),
            "actionability": round(actionability, 2),
            "clarity": round(clarity, 2),
            "completeness": round(completeness, 2),
            "no_hallucination": round(no_hallucination, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Rationale
        rationale_parts = []
        if accuracy < 0.5:
            rationale_parts.append("analysis does not reflect underlying data")
        if no_hallucination < 0.5:
            rationale_parts.append("invented facts or false patterns")
        if actionability < 0.5:
            rationale_parts.append("recommendations not concrete or prioritized")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= accuracy <= 0.6,
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
            },
        )

    # ── Grading Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _grade_accuracy(output: dict, input_data: dict, expected_patterns: list) -> float:
        """Grade whether analysis correctly reflects underlying data."""
        summary = output.get("summary", "").lower()
        data_context = input_data.get("data_context", {})

        # Check if summary mentions key data points
        key_facts = str(data_context).lower()
        fact_mentions = sum(1 for word in key_facts.split() if len(word) > 4 and word in summary)
        total_facts = len([w for w in key_facts.split() if len(w) > 4])

        if total_facts == 0:
            return 1.0

        return min(1.0, fact_mentions / max(1, total_facts * 0.3))

    @staticmethod
    def _grade_actionability(output: dict) -> float:
        """Grade whether recommendations are concrete and prioritized."""
        recommendations = output.get("recommendations", [])
        if not recommendations:
            return 0.5

        actionable_count = 0
        for r in recommendations:
            action = r.get("action", "")
            has_priority = "priority" in r
            is_concrete = len(action) > 10 and not any(
                kw in action.lower() for kw in ["consider", "maybe", "perhaps", "think about"]
            )
            if is_concrete and has_priority:
                actionable_count += 1

        return actionable_count / len(recommendations)

    @staticmethod
    def _grade_clarity(output: dict) -> float:
        """Grade whether narrative is clear and well-structured."""
        summary = output.get("summary", "")
        priorities = output.get("priorities", [])
        recommendations = output.get("recommendations", [])

        # Check structure
        has_structure = bool(summary) and bool(priorities) and bool(recommendations)
        summary_length = len(summary.split())

        if not has_structure:
            return 0.5

        # Good summary is 2-5 sentences
        if 20 <= summary_length <= 150:
            return 1.0
        elif summary_length > 0:
            return 0.7

        return 0.5

    @staticmethod
    def _grade_completeness(output: dict, expected_patterns: list, expected_recommendations: list) -> float:
        """Grade whether all relevant patterns and insights are covered."""
        if not expected_patterns:
            return 1.0

        output_text = json.dumps(output).lower()
        covered = 0
        for pattern in expected_patterns:
            pattern_lower = pattern.lower()
            # Check if any key terms from pattern appear in output
            key_terms = [w for w in pattern_lower.split() if len(w) > 4]
            if any(term in output_text for term in key_terms):
                covered += 1

        return covered / len(expected_patterns)

    @staticmethod
    def _grade_hallucination(output: dict, input_data: dict) -> float:
        """Grade whether output contains invented facts."""
        data_context = str(input_data.get("data_context", {})).lower()
        output_text = json.dumps(output).lower()

        # Check for obviously invented specifics (exact numbers not in data)
        import re
        numbers_in_output = set(re.findall(r'\b\d{2,}\b', output_text))
        numbers_in_data = set(re.findall(r'\b\d{2,}\b', data_context))

        invented_numbers = numbers_in_output - numbers_in_data
        # Allow some tolerance for derived numbers
        if len(invented_numbers) > 3:
            return max(0.0, 1.0 - len(invented_numbers) / 10)

        return 1.0

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("accuracy", 1.0) < 0.3:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("no_hallucination", 1.0) < 0.5:
            failures.append(FailureType.HALLUCINATED_ISSUE)

        if dimensions.get("actionability", 1.0) < 0.3:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        return failures
