"""Prioritization benchmark family.

Tests whether the system can correctly rank or categorize tasks
by urgency, importance, and dependency.

Core question: Can the system identify what matters most and order
tasks in a way that maximizes impact and respects constraints?
"""
from __future__ import annotations

import json
import os
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


# ── Prioritization Score Dimensions ──────────────────────────────────────────

PRIORITIZATION_DIMENSIONS = [
    ScoreDimension(
        name="ordering_quality",
        weight=0.35,
        description="Tasks are ordered by true urgency/importance/impact",
    ),
    ScoreDimension(
        name="dependency_respect",
        weight=0.20,
        description="Dependencies are respected (blocked tasks come after blockers)",
    ),
    ScoreDimension(
        name="justification_quality",
        weight=0.20,
        description="Reasoning for prioritization is sound and specific",
    ),
    ScoreDimension(
        name="tie_handling",
        weight=0.10,
        description="Similar-priority tasks are handled appropriately (grouped or explained)",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.15,
        description="Valid output structure with required fields",
    ),
]


class PrioritizationFamily(BenchmarkFamily):
    """Benchmark family for task prioritization evaluation."""

    NAME = "prioritization"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "prioritization-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return PRIORITIZATION_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in PRIORITIZATION_DIMENSIONS}

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
            task_count = len(input_data.get("tasks", []))

            # Determine difficulty
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("ambiguous", "many-ties"):
                difficulty = CaseDifficulty.HARD
            elif task_count <= 5:
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_prioritization_looks_like", ""),
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
        """Present a list of tasks and ask the system to prioritize them."""
        tasks = case.input.get("tasks", [])
        context = case.input.get("context") or ""

        task_list = "\n".join(
            f"{i+1}. {t.get('title', '')}" + (f" [{t.get('metadata', '')}]" if t.get('metadata') else "")
            for i, t in enumerate(tasks)
        )

        system_prompt = prompt_override or (
            "You are a prioritization assistant. Given a list of tasks, rank them by priority.\n\n"
            "Consider:\n"
            "- Urgency (deadlines, time sensitivity)\n"
            "- Impact (business value, consequences of delay)\n"
            "- Dependencies (blocked tasks should come after blockers)\n"
            "- Effort (quick wins may be priorit if impact is similar)\n\n"
            "Return JSON with:\n"
            "- ranked_tasks: array of {rank, task_title, priority_reason, urgency, impact}\n"
            "- summary: string (brief explanation of prioritization approach)\n"
            "- ties: array of strings (groups of tasks with similar priority, if any)\n"
            "- blocked_tasks: array of {task_title, blocked_by} (tasks that are blocked)"
        )

        user_prompt = f"Tasks to prioritize:\n{task_list}"
        if context:
            user_prompt += f"\n\nContext: {context}"

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
                    dimensions={d.name: 0.0 for d in PRIORITIZATION_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        expected_order = expected.get("expected_order", [])
        expected_dependencies = expected.get("expected_dependencies", {})
        expected_blocked = expected.get("expected_blocked", {})
        expected_ties = expected.get("expected_ties", [])

        ranked_tasks = output.get("ranked_tasks", [])
        ties = output.get("ties", [])
        blocked_tasks = output.get("blocked_tasks", [])
        summary = output.get("summary", "")

        # Ordering quality: how close is the ranking to expected?
        ordering_quality = self._grade_ordering(ranked_tasks, expected_order)

        # Dependency respect: are dependencies respected?
        dependency_respect = self._grade_dependencies(ranked_tasks, expected_dependencies)

        # Justification quality: is reasoning sound?
        justification_quality = self._grade_justification(ranked_tasks, summary, case)

        # Tie handling: are similar-priority tasks handled appropriately?
        tie_handling = self._grade_ties(ties, expected_ties, ranked_tasks)

        # Format compliance
        format_compliance = 1.0 if ranked_tasks and all("rank" in t and "task_title" in t for t in ranked_tasks) else 0.0

        dimensions = {
            "ordering_quality": round(ordering_quality, 2),
            "dependency_respect": round(dependency_respect, 2),
            "justification_quality": round(justification_quality, 2),
            "tie_handling": round(tie_handling, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Rationale
        rationale_parts = []
        if ordering_quality < 0.5:
            rationale_parts.append(f"poor ordering ({ordering_quality:.2f})")
        if dependency_respect < 0.5:
            rationale_parts.append("dependencies violated")
        if justification_quality < 0.3:
            rationale_parts.append("weak justification")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= ordering_quality <= 0.6,
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
                "expected_order": expected_order,
                "actual_order": [t.get("task_title", "") for t in ranked_tasks],
                "dependency_violations": self._count_dependency_violations(ranked_tasks, expected_dependencies),
            },
        )

    # ── Grading Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _grade_ordering(ranked_tasks: list[dict], expected_order: list[str]) -> float:
        """Grade how close the ranking is to expected order (0-1)."""
        if not expected_order or not ranked_tasks:
            return 0.5

        actual_order = [t.get("task_title", "") for t in ranked_tasks]

        # Kendall tau-like: count pairwise agreements
        agreements = 0
        total_pairs = 0
        for i in range(len(expected_order)):
            for j in range(i + 1, len(expected_order)):
                if expected_order[i] not in actual_order or expected_order[j] not in actual_order:
                    continue
                total_pairs += 1
                actual_i = actual_order.index(expected_order[i])
                actual_j = actual_order.index(expected_order[j])
                if (actual_i < actual_j) == (i < j):
                    agreements += 1

        return agreements / total_pairs if total_pairs > 0 else 0.5

    @staticmethod
    def _grade_dependencies(ranked_tasks: list[dict], expected_deps: dict[str, str]) -> float:
        """Grade whether dependencies are respected (0-1)."""
        if not expected_deps:
            return 1.0

        actual_order = [t.get("task_title", "") for t in ranked_tasks]
        violations = 0

        for task, blocked_by in expected_deps.items():
            if task in actual_order and blocked_by in actual_order:
                task_idx = actual_order.index(task)
                blocker_idx = actual_order.index(blocked_by)
                if task_idx < blocker_idx:
                    violations += 1

        return max(0.0, 1.0 - (violations / len(expected_deps)))

    @staticmethod
    def _grade_justification(ranked_tasks: list[dict], summary: str, case: Case) -> float:
        """Grade whether reasoning is sound (0-1)."""
        if not ranked_tasks:
            return 0.0

        # Check if each task has a reason
        reasons = [t.get("priority_reason", "") for t in ranked_tasks]
        has_reasons = sum(1 for r in reasons if len(r) > 10)
        reason_coverage = has_reasons / len(ranked_tasks) if ranked_tasks else 0.0

        # Check if summary mentions key factors
        input_tasks = case.input.get("tasks", [])
        has_deadlines = any("dueDate" in t or "deadline" in t.get("metadata", "").lower() for t in input_tasks)
        has_dependencies = any("depends" in t.get("metadata", "").lower() for t in input_tasks)

        summary_lower = summary.lower()
        mentions_urgency = any(w in summary_lower for w in ["urgent", "deadline", "due", "time"])
        mentions_impact = any(w in summary_lower for w in ["impact", "important", "critical", "value"])

        factor_score = 0.0
        if has_deadlines and mentions_urgency:
            factor_score += 0.5
        elif not has_deadlines:
            factor_score += 0.5
        if has_dependencies and mentions_impact:
            factor_score += 0.5
        elif not has_dependencies:
            factor_score += 0.5

        return round(min(1.0, reason_coverage * 0.5 + factor_score * 0.5), 2)

    @staticmethod
    def _grade_ties(ties: list, expected_ties: list, ranked_tasks: list[dict]) -> float:
        """Grade whether ties are handled appropriately (0-1)."""
        if not expected_ties:
            return 1.0  # No expected ties, neutral

        if not ties:
            return 0.5  # Should have identified ties but didn't

        # Check if any expected ties are captured
        expected_tie_tasks = set()
        for tie_group in expected_ties:
            expected_tie_tasks.update(tie_group)

        actual_tie_tasks = set()
        for tie_group in ties:
            if isinstance(tie_group, list):
                actual_tie_tasks.update(tie_group)
            elif isinstance(tie_group, str):
                actual_tie_tasks.add(tie_group)

        overlap = len(expected_tie_tasks & actual_tie_tasks)
        return min(1.0, overlap / len(expected_tie_tasks)) if expected_tie_tasks else 1.0

    @staticmethod
    def _count_dependency_violations(ranked_tasks: list[dict], expected_deps: dict[str, str]) -> int:
        """Count dependency violations for debugging."""
        if not expected_deps:
            return 0
        actual_order = [t.get("task_title", "") for t in ranked_tasks]
        violations = 0
        for task, blocked_by in expected_deps.items():
            if task in actual_order and blocked_by in actual_order:
                if actual_order.index(task) < actual_order.index(blocked_by):
                    violations += 1
        return violations

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("ordering_quality", 1.0) < 0.3:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("dependency_respect", 1.0) < 0.5:
            failures.append(FailureType.DROPPED_CONSTRAINT)

        if dimensions.get("justification_quality", 1.0) < 0.2:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        return failures
