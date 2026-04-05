"""Context-Aware Planning benchmark family.

Tests whether the system can generate context-aware plans and next-work recommendations
using loaded project state, dependencies, and urgency signals.

Core question: Can the system generate context-aware plans and next-work recommendations?
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


# ── Context-Aware Planning Score Dimensions ──────────────────────────────────

CONTEXT_AWARE_PLANNING_DIMENSIONS = [
    ScoreDimension(
        name="context_utilization",
        weight=0.25,
        description="Plan uses project context, dependencies, and urgency signals appropriately",
    ),
    ScoreDimension(
        name="dependency_respect",
        weight=0.20,
        description="Respects task dependencies and constraints",
    ),
    ScoreDimension(
        name="urgency_alignment",
        weight=0.15,
        description="Next-work recommendation matches urgency signals",
    ),
    ScoreDimension(
        name="feasibility",
        weight=0.15,
        description="Plan is realistic given current state and resources",
    ),
    ScoreDimension(
        name="risk_awareness",
        weight=0.15,
        description="Correctly identifies and flags risks",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.10,
        description="Valid output structure with required fields",
    ),
]


class ContextAwarePlanningFamily(BenchmarkFamily):
    """Benchmark family for context-aware planning evaluation."""

    NAME = "context_aware_planning"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "context-aware-planning-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return CONTEXT_AWARE_PLANNING_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in CONTEXT_AWARE_PLANNING_DIMENSIONS}

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
            planning_type = expected_data.get("planning_type", "unknown")

            # Determine difficulty
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("blocked", "complex"):
                difficulty = CaseDifficulty.HARD
            elif planning_type == "next_work":
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[planning_type, category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_plan_looks_like", ""),
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
        """Call the LLM to generate a context-aware plan."""
        project_context = case.input.get("project_context", {})
        task_state = case.input.get("task_state", [])
        planning_type = case.input.get("planning_type", "project_plan")

        system_prompt = prompt_override or (
            f"You are a context-aware planning assistant. Generate a {planning_type.replace('_', ' ')} "
            "based on the provided project context and task state.\n\n"
            "Your plan should include:\n"
            "- plan: array of {task, priority, timing, dependencies}\n"
            "- next_work: {task, reasoning}\n"
            "- risk_flags: array of strings\n\n"
            "Rules:\n"
            "1. Use all provided project context and task state\n"
            "2. Respect task dependencies (blocked tasks come after blockers)\n"
            "3. Align next-work recommendation with urgency signals\n"
            "4. Flag any risks or concerns you identify\n"
            "5. Be realistic about what can be accomplished\n\n"
            "Return JSON with:\n"
            "- plan: array of {task, priority, timing, dependencies}\n"
            "- next_work: {task, reasoning}\n"
            "- risk_flags: array of strings\n"
            "- confidence: 0.0-1.0"
        )

        user_prompt = (
            f"Project context:\n{json.dumps(project_context, indent=2)}\n\n"
            f"Task state:\n{json.dumps(task_state, indent=2)}\n\n"
            f"Generate a {planning_type.replace('_', ' ')}."
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
                    dimensions={d.name: 0.0 for d in CONTEXT_AWARE_PLANNING_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        expected_plan = expected.get("expected_plan", [])
        expected_next_work = expected.get("expected_next_work", "")
        expected_risks = expected.get("expected_risks", [])

        actual_plan = output.get("plan", [])
        actual_next_work = output.get("next_work", {}).get("task", "")
        actual_risks = output.get("risk_flags", [])

        # Context utilization: plan uses project context appropriately
        context_utilization = self._grade_context_utilization(output, case.input, expected_plan)

        # Dependency respect: respects task dependencies
        dependency_respect = self._grade_dependency_respect(actual_plan, case.input)

        # Urgency alignment: next-work matches urgency signals
        urgency_alignment = self._grade_urgency_alignment(actual_next_work, case.input, expected_next_work)

        # Feasibility: plan is realistic
        feasibility = self._grade_feasibility(actual_plan, case.input)

        # Risk awareness: correctly identifies risks
        risk_awareness = self._grade_risk_awareness(actual_risks, expected_risks)

        # Format compliance
        required_fields = ["plan", "next_work", "risk_flags"]
        format_compliance = 1.0 if all(f in output for f in required_fields) else 0.5

        dimensions = {
            "context_utilization": round(context_utilization, 2),
            "dependency_respect": round(dependency_respect, 2),
            "urgency_alignment": round(urgency_alignment, 2),
            "feasibility": round(feasibility, 2),
            "risk_awareness": round(risk_awareness, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Rationale
        rationale_parts = []
        if context_utilization < 0.5:
            rationale_parts.append("plan does not use project context")
        if dependency_respect < 0.5:
            rationale_parts.append("ignores task dependencies")
        if risk_awareness < 0.5:
            rationale_parts.append("misses critical risks")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= context_utilization <= 0.6,
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
    def _grade_context_utilization(output: dict, input_data: dict, expected_plan: list) -> float:
        """Grade whether plan uses project context appropriately."""
        project_context = input_data.get("project_context", {})
        if not project_context:
            return 1.0

        plan_text = json.dumps(output).lower()
        context_text = json.dumps(project_context).lower()

        # Check if plan references key context elements
        key_context = [w for w in context_text.split() if len(w) > 4]
        context_mentions = sum(1 for w in key_context if w in plan_text)

        if not key_context:
            return 1.0

        return min(1.0, context_mentions / max(1, len(key_context) * 0.3))

    @staticmethod
    def _grade_dependency_respect(actual_plan: list, input_data: dict) -> float:
        """Grade whether plan respects task dependencies."""
        task_state = input_data.get("task_state", [])
        dependencies = {t["title"]: t.get("depends_on", []) for t in task_state if t.get("depends_on")}

        if not dependencies:
            return 1.0

        # Check if dependent tasks come after their dependencies in plan
        plan_order = [p.get("task", "").lower() for p in actual_plan]
        respected = 0
        total = 0

        for task, deps in dependencies.items():
            task_lower = task.lower()
            if task_lower in plan_order:
                task_idx = plan_order.index(task_lower)
                for dep in deps:
                    dep_lower = dep.lower()
                    if dep_lower in plan_order:
                        dep_idx = plan_order.index(dep_lower)
                        total += 1
                        if dep_idx < task_idx:
                            respected += 1

        return respected / total if total > 0 else 1.0

    @staticmethod
    def _grade_urgency_alignment(actual_next_work: str, input_data: dict, expected_next_work: str) -> float:
        """Grade whether next-work recommendation matches urgency signals."""
        task_state = input_data.get("task_state", [])
        overdue_tasks = [t for t in task_state if t.get("is_overdue")]
        high_priority = [t for t in task_state if t.get("priority") == "high"]

        if not overdue_tasks and not high_priority:
            return 1.0

        next_work_lower = actual_next_work.lower()
        urgent_titles = [t["title"].lower() for t in overdue_tasks + high_priority]

        # Check if next work matches any urgent task
        for title in urgent_titles:
            if any(w in next_work_lower for w in title.split() if len(w) > 3):
                return 1.0

        return 0.5

    @staticmethod
    def _grade_feasibility(actual_plan: list, input_data: dict) -> float:
        """Grade whether plan is realistic given current state."""
        if not actual_plan:
            return 1.0

        # Check for obviously unrealistic plans (too many tasks for timeframe)
        project_context = input_data.get("project_context", {})
        target_date = project_context.get("target_date")

        # Simple heuristic: plan should not have more tasks than available
        if len(actual_plan) > 20:
            return max(0.0, 1.0 - (len(actual_plan) - 20) / 20)

        return 1.0

    @staticmethod
    def _grade_risk_awareness(actual_risks: list, expected_risks: list) -> float:
        """Grade whether risks are correctly identified."""
        if not expected_risks:
            return 1.0 if not actual_risks else 0.7

        identified = 0
        for exp_risk in expected_risks:
            exp_lower = exp_risk.lower()
            for act_risk in actual_risks:
                act_lower = act_risk.lower()
                # Check keyword overlap
                exp_words = set(exp_lower.split())
                act_words = set(act_lower.split())
                common = exp_words & act_words
                if len(common) >= 2:
                    identified += 1
                    break

        return identified / len(expected_risks)

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("dependency_respect", 1.0) < 0.3:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("context_utilization", 1.0) < 0.3:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        if dimensions.get("risk_awareness", 1.0) < 0.3:
            failures.append(FailureType.UNSAFE_ACTION)

        return failures
