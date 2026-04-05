"""Feature Exposure benchmark family.

Tests whether the system exposes advanced features only when the user is likely ready,
and avoids overwhelming novice users with advanced features too early.

Core question: Can the system classify user maturity and recommend appropriate feature sets?
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


# ── Feature Exposure Score Dimensions ────────────────────────────────────────

FEATURE_EXPOSURE_DIMENSIONS = [
    ScoreDimension(
        name="classification_accuracy",
        weight=0.25,
        description="User segment classification matches expected segment",
    ),
    ScoreDimension(
        name="feature_appropriateness",
        weight=0.25,
        description="Enabled features match user maturity level",
    ),
    ScoreDimension(
        name="over_exposure_avoidance",
        weight=0.20,
        description="Advanced features not shown to novice users",
    ),
    ScoreDimension(
        name="under_exposure_avoidance",
        weight=0.15,
        description="Power users get access to advanced features",
    ),
    ScoreDimension(
        name="nudge_quality",
        weight=0.10,
        description="Growth nudges are relevant and actionable",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.05,
        description="Valid output structure with required fields",
    ),
]


class FeatureExposureFamily(BenchmarkFamily):
    """Benchmark family for adaptive feature exposure evaluation."""

    NAME = "feature_exposure"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "feature-exposure-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return FEATURE_EXPOSURE_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in FEATURE_EXPOSURE_DIMENSIONS}

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
            expected_segment = expected_data.get("expected_user_segment", "unknown")

            # Determine difficulty
            if category == "misclassification":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("power-user", "planning-routing"):
                difficulty = CaseDifficulty.HARD
            elif expected_segment == "beginner":
                difficulty = CaseDifficulty.EASY
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_exposure_looks_like", ""),
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
        """Call the LLM to classify user and recommend feature exposure."""
        user_context = case.input.get("user_context", {})
        feature_catalog = case.input.get("feature_catalog", {})

        system_prompt = prompt_override or (
            "You are a feature exposure policy engine. Classify the user's maturity level "
            "and recommend which features to enable, hide, or nudge toward.\n\n"
            "User segments:\n"
            "- beginner: First-week users, low behavioral sophistication\n"
            "- intermediate: Users who use due dates, projects, daily planning\n"
            "- advanced: Users with repeated advanced behaviors, dependencies, goals\n"
            "- power: Highly engaged users ready for automation and bulk workflows\n\n"
            "Feature exposure rules:\n"
            "- Never expose advanced features to beginners\n"
            "- Always expose core features to all users\n"
            "- Progressive unlock as user demonstrates readiness\n"
            "- Include growth nudges to encourage feature adoption\n"
            "- When confidence is low, choose safer exposure policy\n\n"
            "Return JSON with:\n"
            "- user_segment: beginner|intermediate|advanced|power\n"
            "- confidence: 0.0-1.0\n"
            "- signals: list of behavioral signals used for classification\n"
            "- enabled_features: list of features to show\n"
            "- hidden_features: list of features to hide\n"
            "- nudges: list of growth nudges\n"
            "- guardrails: list of safety constraints"
        )

        user_prompt = (
            f"User context:\n{json.dumps(user_context, indent=2)}\n\n"
            f"Available features:\n{json.dumps(feature_catalog, indent=2)}\n\n"
            f"Classify this user and recommend feature exposure policy."
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
                    dimensions={d.name: 0.0 for d in FEATURE_EXPOSURE_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        expected_segment = expected.get("expected_user_segment", "unknown")
        expected_enabled = set(expected.get("expected_enabled_features", []))
        expected_hidden = set(expected.get("expected_hidden_features", []))

        actual_segment = output.get("user_segment", "unknown")
        actual_enabled = set(output.get("enabled_features", []))
        actual_hidden = set(output.get("hidden_features", []))
        confidence = output.get("confidence", 0.0)

        # Classification accuracy
        classification_accuracy = 1.0 if actual_segment == expected_segment else 0.0

        # Feature appropriateness (Jaccard similarity)
        if expected_enabled or actual_enabled:
            intersection = len(expected_enabled & actual_enabled)
            union = len(expected_enabled | actual_enabled)
            feature_appropriateness = intersection / union if union > 0 else 0.0
        else:
            feature_appropriateness = 1.0

        # Over-exposure avoidance (advanced features not shown to novices)
        advanced_features = set(expected.get("advanced_features", []))
        if expected_segment in ("beginner", "intermediate"):
            over_exposed = len(actual_enabled & advanced_features)
            over_exposure_avoidance = max(0.0, 1.0 - (over_exposed / len(advanced_features))) if advanced_features else 1.0
        else:
            over_exposure_avoidance = 1.0

        # Under-exposure avoidance (power users get advanced features)
        if expected_segment in ("advanced", "power"):
            under_exposed = len(advanced_features - actual_enabled)
            under_exposure_avoidance = max(0.0, 1.0 - (under_exposed / len(advanced_features))) if advanced_features else 1.0
        else:
            under_exposure_avoidance = 1.0

        # Nudge quality
        expected_nudges = set(expected.get("expected_nudges", []))
        actual_nudges = set(output.get("nudges", []))
        if expected_nudges or actual_nudges:
            nudge_intersection = len(expected_nudges & actual_nudges)
            nudge_union = len(expected_nudges | actual_nudges)
            nudge_quality = nudge_intersection / nudge_union if nudge_union > 0 else 0.0
        else:
            nudge_quality = 1.0

        # Format compliance
        required_fields = ["user_segment", "confidence", "enabled_features", "hidden_features"]
        format_compliance = 1.0 if all(f in output for f in required_fields) else 0.0

        dimensions = {
            "classification_accuracy": classification_accuracy,
            "feature_appropriateness": round(feature_appropriateness, 2),
            "over_exposure_avoidance": round(over_exposure_avoidance, 2),
            "under_exposure_avoidance": round(under_exposure_avoidance, 2),
            "nudge_quality": round(nudge_quality, 2),
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Rationale
        rationale_parts = []
        if classification_accuracy == 0.0:
            rationale_parts.append(f"wrong segment: expected {expected_segment}, got {actual_segment}")
        if over_exposure_avoidance < 0.5:
            rationale_parts.append("over-exposed advanced features to novice user")
        if under_exposure_avoidance < 0.5:
            rationale_parts.append("under-exposed advanced features to power user")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= feature_appropriateness <= 0.6,
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
                "expected_segment": expected_segment,
                "actual_segment": actual_segment,
                "confidence": confidence,
            },
        )

    # ── Failure Detection ────────────────────────────────────────────────

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        failures = []

        if dimensions.get("classification_accuracy", 1.0) < 0.5:
            failures.append(FailureType.MISUNDERSTOOD_INTENT)

        if dimensions.get("over_exposure_avoidance", 1.0) < 0.5:
            failures.append(FailureType.UNSAFE_ACTION)

        if dimensions.get("feature_appropriateness", 1.0) < 0.3:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        return failures
