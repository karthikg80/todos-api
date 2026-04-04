"""Plan-from-Goal benchmark family.

Tests whether the system can convert a goal into a structured,
actionable plan with appropriate steps, sequencing, and feasibility.

Core question: Can the system decompose a goal into a realistic plan
without hallucinating steps or missing key aspects?
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


# ── Plan-from-Goal Score Dimensions ──────────────────────────────────────────

PLAN_FROM_GOAL_DIMENSIONS = [
    ScoreDimension(
        name="goal_coverage",
        weight=0.25,
        description="All key aspects of the goal are addressed in the plan",
    ),
    ScoreDimension(
        name="step_quality",
        weight=0.20,
        description="Each step is clear, actionable, and well-scoped",
    ),
    ScoreDimension(
        name="sequencing",
        weight=0.15,
        description="Logical order, dependencies respected",
    ),
    ScoreDimension(
        name="feasibility",
        weight=0.15,
        description="Plan is realistic given constraints (time, budget, resources)",
    ),
    ScoreDimension(
        name="granularity",
        weight=0.10,
        description="Appropriate level of detail — not too vague, not too granular",
    ),
    ScoreDimension(
        name="non_redundancy",
        weight=0.05,
        description="No duplicate or overlapping steps",
    ),
    ScoreDimension(
        name="constraint_adherence",
        weight=0.05,
        description="Respects deadlines, budget, scope from original goal",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.05,
        description="Valid output structure with required fields",
    ),
]


class PlanFromGoalFamily(BenchmarkFamily):
    """Benchmark family for plan-from-goal quality evaluation."""

    NAME = "plan_from_goal"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "plan-from-goal-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return PLAN_FROM_GOAL_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in PLAN_FROM_GOAL_DIMENSIONS}

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

            # Determine difficulty
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("oversized", "conflicting"):
                difficulty = CaseDifficulty.HARD
            elif category == "vague":
                difficulty = CaseDifficulty.MEDIUM
            elif category == "clear":
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[category],
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
        """Call the LLM to generate a plan from the goal."""
        goal = case.input.get("goal", "")
        context = case.input.get("context") or ""
        constraints = case.input.get("constraints") or ""

        system_prompt = prompt_override or (
            "You are an execution planner. Convert the given goal into a structured, "
            "actionable plan with clear steps.\n\n"
            "Rules:\n"
            "1. Each step should be a concrete, actionable task\n"
            "2. Order steps logically — dependencies first\n"
            "3. Respect all constraints (deadlines, budget, scope)\n"
            "4. Do NOT invent specifics not implied by the goal\n"
            "5. If the goal is too vague or conflicting, return output_mode='clarification_required' "
            "and specify what information is needed\n"
            "6. If the goal is unrealistic or contradictory, return output_mode='unsupported' "
            "and explain why\n"
            "7. Otherwise return output_mode='plan' with steps\n\n"
            "Return JSON with:\n"
            "- output_mode: 'plan' | 'clarification_required' | 'unsupported'\n"
            "- summary: string (brief overview of the plan or reason)\n"
            "- steps: array of {title, description, estimated_effort} (only if output_mode='plan')\n"
            "- clarification_needed: array of strings (only if output_mode='clarification_required')\n"
            "- reason_unsupported: string (only if output_mode='unsupported')\n"
            "- total_estimated_effort: string (e.g. '2 weeks', '3 days')"
        )

        user_prompt = f"Goal: {goal}"
        if context:
            user_prompt += f"\nContext: {context}"
        if constraints:
            user_prompt += f"\nConstraints: {constraints}"

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
                    dimensions={d.name: 0.0 for d in PLAN_FROM_GOAL_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        output_mode = output.get("output_mode", "plan")
        steps = output.get("steps", [])
        summary = output.get("summary", "")

        # Handle non-plan outputs
        if output_mode == "clarification_required":
            return self._grade_clarification(case, output, expected)
        elif output_mode == "unsupported":
            return self._grade_unsupported(case, output, expected)

        # Grade plan output
        expected_steps = expected.get("must_have_steps", [])
        optional_steps = expected.get("optional_steps", [])
        forbidden_steps = expected.get("forbidden_steps", [])
        expected_step_count = expected.get("expected_step_count_range", [3, 10])

        # Goal coverage: how many must-have aspects are addressed
        goal_aspects = self._extract_goal_aspects(case.input)
        covered_aspects = sum(
            1 for aspect in goal_aspects
            if self._aspect_covered(aspect, steps, summary)
        )
        goal_coverage = covered_aspects / len(goal_aspects) if goal_aspects else 1.0

        # Step quality: each step is clear, actionable, well-scoped
        step_qualities = [self._grade_step_quality(step) for step in steps]
        step_quality = sum(step_qualities) / len(step_qualities) if step_qualities else 0.0

        # Sequencing: logical order, dependencies respected
        sequencing = self._grade_sequencing(steps)

        # Feasibility: realistic given constraints
        feasibility = self._grade_feasibility(steps, case.input)

        # Granularity: appropriate detail level
        granularity = self._grade_granularity(steps, expected_step_count)

        # Non-redundancy: no duplicate steps
        non_redundancy = self._grade_non_redundancy(steps)

        # Constraint adherence: deadlines, budget, scope preserved
        constraints = self._extract_constraints(case.input)
        preserved_constraints = sum(
            1 for c in constraints
            if self._constraint_preserved(c, steps, summary)
        )
        constraint_adherence = preserved_constraints / len(constraints) if constraints else 1.0

        # Format compliance
        format_compliance = 1.0 if steps and all("title" in s for s in steps) else 0.0

        # Check for forbidden steps
        has_forbidden = any(
            any(f.lower() in step.get("title", "").lower() for f in forbidden_steps)
            for step in steps
        )
        if has_forbidden:
            feasibility = max(0.0, feasibility - 0.3)

        dimensions = {
            "goal_coverage": round(goal_coverage, 2),
            "step_quality": round(step_quality, 2),
            "sequencing": round(sequencing, 2),
            "feasibility": round(feasibility, 2),
            "granularity": round(granularity, 2),
            "non_redundancy": round(non_redundancy, 2),
            "constraint_adherence": round(constraint_adherence, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Grader rationale
        rationale_parts = []
        if goal_coverage < 0.5:
            rationale_parts.append(f"goal coverage weak ({covered_aspects}/{len(goal_aspects)} aspects)")
        if step_quality < 0.5:
            rationale_parts.append("steps are vague or not actionable")
        if sequencing < 0.5:
            rationale_parts.append("poor sequencing or dependency violations")
        if feasibility < 0.5:
            rationale_parts.append("plan is unrealistic")
        if has_forbidden:
            rationale_parts.append("includes forbidden steps")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= step_quality <= 0.6,
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
                "goal_aspects": goal_aspects,
                "covered_aspects": covered_aspects,
                "constraints": constraints,
                "preserved_constraints": preserved_constraints,
                "step_count": len(steps),
                "expected_step_range": expected_step_count,
            },
        )

    def _grade_clarification(
        self, case: Case, output: dict, expected: dict
    ) -> CaseResult:
        """Grade a clarification-required output."""
        expected_mode = expected.get("expected_output_mode", "plan")
        clarification_needed = output.get("clarification_needed", [])

        if expected_mode == "clarification_required":
            # Correct behavior — asked for clarification
            dimensions = {
                "goal_coverage": 1.0,
                "step_quality": 1.0,
                "sequencing": 1.0,
                "feasibility": 1.0,
                "granularity": 1.0,
                "non_redundancy": 1.0,
                "constraint_adherence": 1.0,
                "format_compliance": 1.0,
            }
            rationale = "correctly identified need for clarification"
        elif expected_mode == "unsupported":
            # Should have said unsupported, not clarification
            dimensions = {d.name: 0.5 for d in PLAN_FROM_GOAL_DIMENSIONS}
            rationale = "should have marked as unsupported, not clarification"
        else:
            # Should have produced a plan
            dimensions = {d.name: 0.3 for d in PLAN_FROM_GOAL_DIMENSIONS}
            rationale = "should have produced a plan, not asked for clarification"

        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=ScoreBreakdown(dimensions=dimensions, grader_rationale=rationale).composite(self.score_weights()),
            breakdown=ScoreBreakdown(dimensions=dimensions, grader_rationale=rationale),
            failure_types=[],
            slices=case.metadata.slices,
            difficulty=case.metadata.difficulty.value,
        )

    def _grade_unsupported(
        self, case: Case, output: dict, expected: dict
    ) -> CaseResult:
        """Grade an unsupported output."""
        expected_mode = expected.get("expected_output_mode", "plan")

        if expected_mode == "unsupported":
            dimensions = {d.name: 1.0 for d in PLAN_FROM_GOAL_DIMENSIONS}
            rationale = "correctly identified unsupported goal"
        elif expected_mode == "clarification_required":
            dimensions = {d.name: 0.5 for d in PLAN_FROM_GOAL_DIMENSIONS}
            rationale = "should have asked for clarification, not marked unsupported"
        else:
            dimensions = {d.name: 0.3 for d in PLAN_FROM_GOAL_DIMENSIONS}
            rationale = "should have produced a plan, not marked unsupported"

        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=ScoreBreakdown(dimensions=dimensions, grader_rationale=rationale).composite(self.score_weights()),
            breakdown=ScoreBreakdown(dimensions=dimensions, grader_rationale=rationale),
            failure_types=[],
            slices=case.metadata.slices,
            difficulty=case.metadata.difficulty.value,
        )

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("goal_coverage", 1.0) < 0.5:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("constraint_adherence", 1.0) < 0.5:
            failures.append(FailureType.DROPPED_CONSTRAINT)

        if dimensions.get("feasibility", 1.0) < 0.3:
            failures.append(FailureType.HALLUCINATED_ISSUE)

        if dimensions.get("step_quality", 1.0) < 0.3:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        return failures

    # ── Grading Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _extract_goal_aspects(input_data: dict) -> list[str]:
        """Extract key aspects from the goal that should be covered."""
        aspects = []
        goal = input_data.get("goal", "")
        context = input_data.get("context") or ""
        text = goal + " " + context

        # Extract key nouns and phrases
        import re
        # Look for specific aspects mentioned
        aspects.extend(re.findall(r'\b(?:prepare|study|learn|build|create|plan|organize|complete)\b\s+\w+(?:\s+\w+){0,3}', text, re.IGNORECASE))

        # Extract domain/topic
        domain_match = re.findall(r'(?:for|about|to)\s+([A-Z][a-z]+(?:\s+[a-z]+){0,3})', text)
        aspects.extend(domain_match)

        return list(set(aspects))[:5]  # Limit to 5 aspects

    @staticmethod
    def _aspect_covered(aspect: str, steps: list[dict], summary: str) -> bool:
        """Check if a goal aspect is addressed in the plan."""
        text = " ".join(s.get("title", "") + " " + s.get("description", "") for s in steps) + " " + summary
        aspect_words = aspect.lower().split()
        return any(w in text.lower() for w in aspect_words if len(w) > 3)

    @staticmethod
    def _grade_step_quality(step: dict) -> float:
        """Grade a single step's quality (0-1)."""
        title = step.get("title", "")
        desc = step.get("description", "")
        score = 0.0

        # Has action verb
        action_verbs = {"prepare", "create", "build", "study", "review", "complete", "set", "organize", "plan", "define", "draft", "write", "test", "deploy", "launch", "research", "analyze", "identify", "gather", "schedule"}
        first_word = title.lower().split()[0] if title else ""
        if first_word in action_verbs:
            score += 0.4

        # Has description
        if desc and len(desc) >= 20:
            score += 0.3

        # Has effort estimate
        if step.get("estimated_effort"):
            score += 0.1

        # Title length appropriate
        if 10 <= len(title) <= 100:
            score += 0.2

        return min(1.0, score)

    @staticmethod
    def _grade_sequencing(steps: list[dict]) -> float:
        """Grade logical ordering of steps (0-1)."""
        if len(steps) < 2:
            return 1.0

        # Check for obvious sequencing issues
        # (e.g., "deploy" before "build", "test" before "create")
        order_keywords = {
            "prepare": 1, "research": 1, "gather": 1, "identify": 1,
            "plan": 2, "define": 2, "design": 2,
            "build": 3, "create": 3, "develop": 3, "write": 3,
            "test": 4, "review": 4, "validate": 4,
            "deploy": 5, "launch": 5, "publish": 5, "submit": 5,
        }

        step_orders = []
        for step in steps:
            title = step.get("title", "").lower()
            order = max((order_keywords.get(kw, 0) for kw in order_keywords if kw in title), default=0)
            step_orders.append(order)

        # Check if order is non-decreasing (allowing ties)
        violations = sum(1 for i in range(1, len(step_orders)) if step_orders[i] < step_orders[i-1] and step_orders[i-1] > 0)
        return max(0.0, 1.0 - (violations / max(len(steps) - 1, 1)))

    @staticmethod
    def _grade_feasibility(steps: list[dict], input_data: dict) -> float:
        """Grade whether plan is realistic (0-1)."""
        if not steps:
            return 0.0

        # Check for obviously infeasible plans
        # (e.g., too many steps for the timeframe, impossible constraints)
        constraints = input_data.get("constraints") or ""
        goal = input_data.get("goal", "")

        # If deadline is mentioned, check if plan seems feasible
        import re
        deadline_match = re.search(r'(?:by|before|within|in)\s+(\d+)\s*(days?|weeks?|months?)', constraints + " " + goal, re.IGNORECASE)
        if deadline_match:
            amount = int(deadline_match.group(1))
            unit = deadline_match.group(2).lower()
            days = amount if "day" in unit else amount * 7 if "week" in unit else amount * 30

            # Rough heuristic: 1-2 steps per day is reasonable
            reasonable_steps = max(1, days * 1.5)
            if len(steps) > reasonable_steps * 2:
                return 0.3  # Too many steps for timeframe

        return 0.8  # Default: seems feasible

    @staticmethod
    def _grade_granularity(steps: list[dict], expected_range: list[int]) -> float:
        """Grade whether step count is in expected range (0-1)."""
        if not expected_range:
            return 0.7  # No expectation, neutral score

        min_steps, max_steps = expected_range
        count = len(steps)

        if min_steps <= count <= max_steps:
            return 1.0
        elif count < min_steps:
            return max(0.0, count / min_steps)
        else:
            return max(0.0, max_steps / count)

    @staticmethod
    def _grade_non_redundancy(steps: list[dict]) -> float:
        """Grade whether steps are non-redundant (0-1)."""
        if len(steps) < 2:
            return 1.0

        # Check for duplicate or near-duplicate titles
        titles = [s.get("title", "").lower() for s in steps]
        unique_titles = set(titles)

        # Simple duplicate check
        if len(unique_titles) == len(titles):
            return 1.0

        # Penalize for duplicates
        return len(unique_titles) / len(titles)

    @staticmethod
    def _extract_constraints(input_data: dict) -> list[str]:
        """Extract constraints that must be respected."""
        constraints = []
        text = input_data.get("constraints") or ""
        goal = input_data.get("goal", "")
        full_text = text + " " + goal

        import re
        # Deadlines
        deadlines = re.findall(r'(?:by|before|within|in)\s+\d+\s*(?:days?|weeks?|months?)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d+|\d{4}-\d{2}-\d{2}', full_text, re.IGNORECASE)
        constraints.extend(deadlines)

        # Budgets
        budgets = re.findall(r'\$\d+(?:,\d+)*(?:\.\d+)?', full_text)
        constraints.extend(budgets)

        # Scope limits
        scope = re.findall(r'(?:only|just|maximum|limit|no more than)\s+\w+(?:\s+\w+){0,2}', full_text, re.IGNORECASE)
        constraints.extend(scope)

        return list(set(constraints))

    @staticmethod
    def _constraint_preserved(constraint: str, steps: list[dict], summary: str) -> bool:
        """Check if a constraint is respected in the plan."""
        text = " ".join(s.get("title", "") + " " + s.get("description", "") for s in steps) + " " + summary
        # Check if constraint keywords appear in plan
        constraint_words = constraint.lower().split()
        return any(w in text.lower() for w in constraint_words if len(w) > 3)
