"""Task Breakdown benchmark family.

Tests whether the system can decompose an existing task or project into
appropriate subtasks or next actions.

Core question: Can the system decompose an existing task into appropriate subtasks?
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


# ── Task Breakdown Score Dimensions ─────────────────────────────────────────

TASK_BREAKDOWN_DIMENSIONS = [
    ScoreDimension(
        name="decomposition_quality",
        weight=0.25,
        description="Subtasks are appropriately scoped and sequenced",
    ),
    ScoreDimension(
        name="completeness",
        weight=0.20,
        description="All aspects of parent task are covered",
    ),
    ScoreDimension(
        name="non_redundancy",
        weight=0.15,
        description="No duplicate or overlapping subtasks",
    ),
    ScoreDimension(
        name="context_awareness",
        weight=0.15,
        description="Subtasks respect project context and existing state",
    ),
    ScoreDimension(
        name="actionability",
        weight=0.15,
        description="Each subtask is concrete and executable",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.10,
        description="Valid output structure with required fields",
    ),
]


class TaskBreakdownFamily(BenchmarkFamily):
    """Benchmark family for task decomposition evaluation."""

    NAME = "task_breakdown"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "task-breakdown-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return TASK_BREAKDOWN_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in TASK_BREAKDOWN_DIMENSIONS}

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
            expected_count = len(expected_data.get("expected_subtasks", []))

            # Determine difficulty
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("noisy", "ambiguous"):
                difficulty = CaseDifficulty.HARD
            elif expected_count <= 2:
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_breakdown_looks_like", ""),
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
        """Call the LLM to decompose a task into subtasks."""
        task_title = case.input.get("task_title", "")
        task_description = case.input.get("task_description", "")
        project_context = case.input.get("project_context", {})
        existing_subtasks = case.input.get("existing_subtasks", [])

        system_prompt = prompt_override or (
            "You are a task decomposition assistant. Break down a task into actionable subtasks.\n\n"
            "For each subtask, provide:\n"
            "- title: A clear, actionable subtask title (start with action verb)\n"
            "- description: Additional context or details\n"
            "- priority: high/medium/low\n"
            "- dependencies: list of subtask indices this depends on (0-based, empty if none)\n\n"
            "Rules:\n"
            "1. Subtasks should be appropriately scoped (not too large, not too small)\n"
            "2. Cover all aspects of the parent task\n"
            "3. No duplicate or overlapping subtasks\n"
            "4. Respect project context and existing subtasks\n"
            "5. Each subtask should be concrete and executable\n"
            "6. If the task is already atomic, return the original task as a single subtask\n\n"
            "Return JSON with:\n"
            "- subtasks: array of {title, description, priority, dependencies}\n"
            "- next_action: the single most important next step (string)"
        )

        context_str = json.dumps(project_context, indent=2) if project_context else "No specific project context"
        existing_str = json.dumps(existing_subtasks, indent=2) if existing_subtasks else "No existing subtasks"

        user_prompt = (
            f"Task: {task_title}\n"
            f"Description: {task_description}\n\n"
            f"Project context:\n{context_str}\n\n"
            f"Existing subtasks:\n{existing_str}\n\n"
            f"Decompose this task into actionable subtasks."
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
                        "max_tokens": 800,
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
                    dimensions={d.name: 0.0 for d in TASK_BREAKDOWN_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        expected_subtasks = expected.get("expected_subtasks", [])
        actual_subtasks = output.get("subtasks", [])

        # Decomposition quality: how well subtasks are scoped and sequenced
        decomposition_quality = self._grade_decomposition(actual_subtasks, expected_subtasks)

        # Completeness: all aspects of parent task covered
        completeness = self._grade_completeness(actual_subtasks, expected_subtasks)

        # Non-redundancy: no duplicate or overlapping subtasks
        non_redundancy = self._grade_non_redundancy(actual_subtasks)

        # Context awareness: respects project context and existing state
        context_awareness = self._grade_context_awareness(actual_subtasks, case.input, expected)

        # Actionability: each subtask is concrete and executable
        actionability = self._grade_actionability(actual_subtasks)

        # Format compliance
        required_fields = ["subtasks"]
        format_compliance = 1.0 if all(f in output for f in required_fields) else 0.0
        if actual_subtasks:
            subtask_fields = ["title", "priority"]
            format_compliance = 1.0 if all(
                all(f in s for f in subtask_fields)
                for s in actual_subtasks
            ) else 0.5

        dimensions = {
            "decomposition_quality": round(decomposition_quality, 2),
            "completeness": round(completeness, 2),
            "non_redundancy": round(non_redundancy, 2),
            "context_awareness": round(context_awareness, 2),
            "actionability": round(actionability, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Rationale
        rationale_parts = []
        if decomposition_quality < 0.5:
            rationale_parts.append("subtasks poorly scoped or sequenced")
        if completeness < 0.5:
            rationale_parts.append("missing aspects of parent task")
        if non_redundancy < 0.5:
            rationale_parts.append("duplicate or overlapping subtasks")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= decomposition_quality <= 0.6,
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
                "expected_subtask_count": len(expected_subtasks),
                "actual_subtask_count": len(actual_subtasks),
            },
        )

    # ── Grading Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _grade_decomposition(actual: list[dict], expected: list[dict]) -> float:
        """Grade how well subtasks are scoped and sequenced."""
        if not expected:
            return 1.0 if not actual else 0.5

        # Check thematic overlap and appropriate scoping
        matched = 0
        for exp in expected:
            exp_title = exp.get("title", "").lower()
            exp_keywords = set(exp_title.split()) | set(exp.get("description", "").lower().split())

            for act in actual:
                act_title = act.get("title", "").lower()
                act_keywords = set(act_title.split()) | set(act.get("description", "").lower().split())

                common = exp_keywords & act_keywords
                if len(common) >= 2 or any(w in act_title for w in exp_keywords if len(w) > 3):
                    matched += 1
                    break

        return matched / len(expected)

    @staticmethod
    def _grade_completeness(actual: list[dict], expected: list[dict]) -> float:
        """Grade whether all aspects of parent task are covered."""
        if not expected:
            return 1.0

        covered = 0
        for exp in expected:
            exp_title = exp.get("title", "").lower()
            for act in actual:
                act_title = act.get("title", "").lower()
                # Check if actual covers expected aspect
                if any(w in act_title for w in exp_title.split() if len(w) > 3):
                    covered += 1
                    break

        return covered / len(expected)

    @staticmethod
    def _grade_non_redundancy(actual: list[dict]) -> float:
        """Grade whether there are duplicate or overlapping subtasks."""
        if len(actual) <= 1:
            return 1.0

        titles = [s.get("title", "").lower() for s in actual]
        unique_titles = set(titles)

        if len(unique_titles) == len(titles):
            return 1.0

        return len(unique_titles) / len(titles)

    @staticmethod
    def _grade_context_awareness(actual: list[dict], input_data: dict, expected: dict) -> float:
        """Grade whether subtasks respect project context."""
        if not actual:
            return 1.0

        project_context = input_data.get("project_context", {})
        existing_subtasks = input_data.get("existing_subtasks", [])

        # Check for duplicates with existing subtasks
        existing_titles = {s.get("title", "").lower() for s in existing_subtasks}
        actual_titles = {s.get("title", "").lower() for s in actual}

        duplicates = existing_titles & actual_titles
        if duplicates:
            return max(0.0, 1.0 - len(duplicates) / len(actual))

        return 1.0

    @staticmethod
    def _grade_actionability(actual: list[dict]) -> float:
        """Grade whether each subtask is concrete and executable."""
        if not actual:
            return 1.0

        actionable_count = 0
        for s in actual:
            title = s.get("title", "")
            is_actionable = (
                len(title) > 3
                and not any(kw in title.lower() for kw in ["maybe", "perhaps", "consider", "think about"])
            )
            if is_actionable:
                actionable_count += 1

        return actionable_count / len(actual)

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("decomposition_quality", 1.0) < 0.3:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("non_redundancy", 1.0) < 0.5:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        if dimensions.get("completeness", 1.0) < 0.3:
            failures.append(FailureType.DROPPED_CONSTRAINT)

        return failures
