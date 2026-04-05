"""Decision Assist benchmark family.

Tests whether the system generates relevant, timely, and appropriate AI suggestions
for users across different product surfaces (home focus, today plan, todo-bound, etc.).

Core question: Is this AI suggestion relevant, timely, and appropriate for this user right now?
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


# ── Decision Assist Score Dimensions ─────────────────────────────────────────

DECISION_ASSIST_DIMENSIONS = [
    ScoreDimension(
        name="relevance",
        weight=0.25,
        description="Suggestion matches user's current work context and recent activity",
    ),
    ScoreDimension(
        name="timeliness",
        weight=0.20,
        description="Suggestion is appropriate for current time/priority state",
    ),
    ScoreDimension(
        name="actionability",
        weight=0.20,
        description="Suggestion is concrete and executable",
    ),
    ScoreDimension(
        name="appropriateness",
        weight=0.15,
        description="Suggestion respects user's plan tier and daily limits",
    ),
    ScoreDimension(
        name="no_hallucination",
        weight=0.10,
        description="No invented tasks or false context references",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.10,
        description="Valid output structure with required fields",
    ),
]


class DecisionAssistFamily(BenchmarkFamily):
    """Benchmark family for AI suggestion quality evaluation."""

    NAME = "decision_assist"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "decision-assist-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return DECISION_ASSIST_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in DECISION_ASSIST_DIMENSIONS}

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

            surface = expected_data.get("surface", "unknown")
            expected_count = len(expected_data.get("expected_suggestions", []))

            # Determine difficulty
            category = expected_data.get("category", "unknown")
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("noisy", "ambiguous"):
                difficulty = CaseDifficulty.HARD
            elif expected_count <= 1:
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[surface, category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_suggestions_look_like", ""),
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
        """Call the LLM to generate AI suggestions for the user context."""
        user_context = case.input.get("user_context", {})
        task_state = case.input.get("task_state", [])
        surface_type = case.input.get("surface_type", "home_focus")
        recent_activity = case.input.get("recent_activity", [])

        system_prompt = prompt_override or (
            "You are an AI decision assist engine. Generate contextual task suggestions "
            "for the user based on their current work context.\n\n"
            "For each suggestion, provide:\n"
            "- title: A clear, actionable task title\n"
            "- description: Additional context or reasoning\n"
            "- priority: high/medium/low\n"
            "- reasoning: Why this suggestion is relevant now\n\n"
            "Rules:\n"
            "1. Only suggest tasks that are relevant to the user's current context\n"
            "2. Do NOT invent tasks that contradict known user state\n"
            "3. Respect the user's plan tier and daily suggestion limits\n"
            "4. Prioritize urgent and overdue items appropriately\n"
            "5. If no relevant suggestions exist, return an empty list\n\n"
            f"Surface type: {surface_type}\n\n"
            "Return JSON with:\n"
            "- suggestions: array of {title, description, priority, reasoning}\n"
            "- appropriateness_score: 0.0-1.0 (how appropriate suggestions are for this context)\n"
            "- throttle_decision: show/limit/abstain"
        )

        user_prompt = (
            f"User context:\n{json.dumps(user_context, indent=2)}\n\n"
            f"Current task state:\n{json.dumps(task_state, indent=2)}\n\n"
            f"Recent activity:\n{json.dumps(recent_activity, indent=2)}\n\n"
            f"Generate contextual suggestions for the {surface_type} surface."
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
                    dimensions={d.name: 0.0 for d in DECISION_ASSIST_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        expected_suggestions = expected.get("expected_suggestions", [])
        expected_count = len(expected_suggestions)

        actual_suggestions = output.get("suggestions", [])
        actual_count = len(actual_suggestions)

        # Relevance: how many suggestions match expected topics/themes
        relevance = self._grade_relevance(actual_suggestions, expected_suggestions)

        # Timeliness: suggestions appropriate for current state
        timeliness = self._grade_timeliness(actual_suggestions, case.input, expected)

        # Actionability: suggestions are concrete and executable
        actionability = self._grade_actionability(actual_suggestions)

        # Appropriateness: respects plan tier and limits
        appropriateness = self._grade_appropriateness(actual_suggestions, case.input, expected)

        # No hallucination: no invented tasks or false context
        no_hallucination = self._grade_hallucination(actual_suggestions, case.input)

        # Format compliance
        required_fields = ["suggestions"]
        format_compliance = 1.0 if all(f in output for f in required_fields) else 0.0
        if actual_suggestions:
            suggestion_fields = ["title", "priority"]
            format_compliance = 1.0 if all(
                all(f in s for f in suggestion_fields)
                for s in actual_suggestions
            ) else 0.5

        dimensions = {
            "relevance": round(relevance, 2),
            "timeliness": round(timeliness, 2),
            "actionability": round(actionability, 2),
            "appropriateness": round(appropriateness, 2),
            "no_hallucination": round(no_hallucination, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Rationale
        rationale_parts = []
        if relevance < 0.5:
            rationale_parts.append("suggestions not relevant to user context")
        if timeliness < 0.5:
            rationale_parts.append("suggestions not timely or appropriate for current state")
        if no_hallucination < 0.5:
            rationale_parts.append("hallucinated tasks or false context references")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= relevance <= 0.6,
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
                "expected_suggestion_count": expected_count,
                "actual_suggestion_count": actual_count,
            },
        )

    # ── Grading Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _grade_relevance(actual: list[dict], expected: list[dict]) -> float:
        """Grade suggestion relevance against expected suggestions."""
        if not expected:
            return 1.0 if not actual else 0.5

        # Check thematic overlap between actual and expected suggestions
        relevant_count = 0
        for exp in expected:
            exp_title = exp.get("title", "").lower()
            exp_keywords = set(exp_title.split()) | set(exp.get("description", "").lower().split())

            for act in actual:
                act_title = act.get("title", "").lower()
                act_keywords = set(act_title.split()) | set(act.get("description", "").lower().split())

                # Check keyword overlap
                common = exp_keywords & act_keywords
                if len(common) >= 2:
                    relevant_count += 1
                    break
                # Check if titles share key terms
                if any(w in act_title for w in exp_keywords if len(w) > 3):
                    relevant_count += 1
                    break

        return relevant_count / len(expected)

    @staticmethod
    def _grade_timeliness(actual: list[dict], input_data: dict, expected: dict) -> float:
        """Grade whether suggestions are timely for current state."""
        if not actual:
            return 1.0

        # Check for overdue task prioritization
        task_state = input_data.get("task_state", [])
        overdue_tasks = [t for t in task_state if t.get("is_overdue")]

        if overdue_tasks and actual:
            # Check if any suggestion addresses overdue items
            addresses_overdue = any(
                any(kw in s.get("title", "").lower() or kw in s.get("description", "").lower()
                    for kw in ["overdue", "late", "past due", "missed"])
                for s in actual
            )
            if not addresses_overdue:
                return 0.5  # Missed overdue items

        return 1.0

    @staticmethod
    def _grade_actionability(actual: list[dict]) -> float:
        """Grade whether suggestions are concrete and executable."""
        if not actual:
            return 1.0

        actionable_count = 0
        for s in actual:
            title = s.get("title", "")
            # Actionable titles start with verbs or are concrete nouns
            is_actionable = (
                len(title) > 3
                and not any(kw in title.lower() for kw in ["maybe", "perhaps", "consider", "think about"])
            )
            if is_actionable:
                actionable_count += 1

        return actionable_count / len(actual)

    @staticmethod
    def _grade_appropriateness(actual: list[dict], input_data: dict, expected: dict) -> float:
        """Grade whether suggestions respect plan tier and limits."""
        surface_type = input_data.get("surface_type", "home_focus")

        # Home focus should have 1-3 suggestions
        # Today plan should have 3-5 suggestions
        # Todo-bound should have 1-2 suggestions
        max_by_surface = {
            "home_focus": 3,
            "today_plan": 5,
            "todo_bound": 2,
            "on_create": 2,
            "task_drawer": 3,
        }
        max_suggestions = max_by_surface.get(surface_type, 3)

        if len(actual) > max_suggestions:
            return max(0.0, 1.0 - (len(actual) - max_suggestions) / max_suggestions)

        return 1.0

    @staticmethod
    def _grade_hallucination(actual: list[dict], input_data: dict) -> float:
        """Grade whether suggestions contain invented tasks or false context."""
        if not actual:
            return 1.0

        task_state = input_data.get("task_state", [])
        known_titles = {t.get("title", "").lower() for t in task_state}
        known_projects = {t.get("project", "").lower() for t in task_state if t.get("project")}

        hallucinated = 0
        for s in actual:
            title = s.get("title", "").lower()
            desc = s.get("description", "").lower()

            # Check if suggestion references unknown projects
            if known_projects:
                for proj in known_projects:
                    if proj in desc and proj not in title:
                        # Referencing a project not in user's state
                        pass  # Not necessarily hallucination

            # Check for obviously invented context
            if any(kw in desc for kw in ["you mentioned", "you said", "according to your notes"]):
                hallucinated += 1

        return max(0.0, 1.0 - (hallucinated / len(actual)))

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("relevance", 1.0) < 0.3:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("no_hallucination", 1.0) < 0.5:
            failures.append(FailureType.HALLUCINATED_ISSUE)

        if dimensions.get("actionability", 1.0) < 0.3:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        return failures
