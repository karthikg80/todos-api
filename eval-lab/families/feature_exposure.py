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
        weight=0.22,
        description="User segment classification matches expected segment",
    ),
    ScoreDimension(
        name="feature_appropriateness",
        weight=0.22,
        description="Enabled features match user maturity level",
    ),
    ScoreDimension(
        name="over_exposure_avoidance",
        weight=0.18,
        description="Advanced features not shown to novice users",
    ),
    ScoreDimension(
        name="under_exposure_avoidance",
        weight=0.13,
        description="Power users get access to advanced features",
    ),
    ScoreDimension(
        name="nudge_quality",
        weight=0.10,
        description="Growth nudges are relevant and actionable",
    ),
    ScoreDimension(
        name="confidence_calibration",
        weight=0.10,
        description="Confidence matches accuracy (high confidence = usually correct)",
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
    
    # Gate hit-rate tracking (class-level)
    GATE_HIT_COUNTS: dict[str, int] = {}
    GATE_TOTAL_CASES: int = 0

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
            "  Advanced users are GOOD USERS — they use the system well but within it\n"
            "- power: Users who CHANGE the system behavior — automation, bulk ops, meta-workflows\n"
            "  Power users are SYSTEM-LEVEL USERS — they optimize workflows, not just tasks\n\n"
            "CRITICAL: Advanced vs Power distinction:\n"
            "- Advanced = consistently uses features correctly, organizes well, uses planning\n"
            "- Power = uses automation/rules, bulk operations, integrations, system optimization\n"
            "- High engagement or frequent usage alone is INSUFFICIENT for power classification\n"
            "- Only classify as 'power' if there is clear evidence of workflow automation,\n"
            "  bulk operations, or system-level optimization behavior\n"
            "- Advanced users may be highly active and structured but do not necessarily\n"
            "  use automation or advanced system features\n\n"
            "Feature exposure rules:\n"
            "- Never expose advanced features to beginners\n"
            "- Always expose core features to all users\n"
            "- Progressive unlock as user demonstrates readiness\n"
            "- Include growth nudges to encourage feature adoption\n"
            "- When confidence is low, choose safer exposure policy\n\n"
            "IMPORTANT CONSERVATISM PRIOR:\n"
            "- When signals conflict or are ambiguous, prefer the LOWER exposure tier\n"
            "- High activity volume does NOT equal sophistication if account is new\n"
            "- Reward progressive nudges more than full unlocks in ambiguous cases\n"
            "- It is better to under-expose than over-expose\n"
            "- Upward misclassification (e.g., advanced→power) is MORE harmful than\n"
            "  downward misclassification (e.g., power→advanced)\n"
            "- Only classify as 'advanced' or 'power' when there is clear evidence of\n"
            "  sustained advanced feature usage over multiple weeks\n\n"
            "Automation signals to look for:\n"
            "- Uses recurring tasks repeatedly (not just once)\n"
            "- Uses batch edits or bulk operations\n"
            "- Uses advanced filters or custom views\n"
            "- Uses integrations or automation rules\n"
            "- No automation signals → cannot be power user\n"
            "- Weak automation signals → advanced at most\n"
            "- Strong automation signals → power user candidate\n\n"
            "Return JSON with:\n"
            "- user_segment: beginner|intermediate|advanced|power\n"
            "- confidence: 0.0-1.0\n"
            "- signals: list of behavioral signals used for classification\n"
            "- automation_signals: list of automation-specific signals observed\n"
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
                output = json.loads(content)
                
                # HARD GATING: Enforce structural constraints post-LLM
                # This converts soft prompt rules into hard policy constraints
                output = self._apply_hard_gating(output, user_context)
                
                return output
        except Exception:
            return None
    
    # ── Hard Gating ──────────────────────────────────────────────────────
    
    def _apply_hard_gating(self, output: dict, user_context: dict) -> dict:
        """Apply hard gating rules to LLM output.

        This enforces structural constraints that the LLM cannot override:
        - No automation signals → cannot be power user
        - High activity + low capability → intermediate (not advanced)
        - Separate activity_level from capability_level
        """
        current_segment = output.get("user_segment", "unknown")
        llm_automation_signals = output.get("automation_signals", [])
        signals = output.get("signals", [])
        
        # Track total cases for hit-rate calculation
        FeatureExposureFamily.GATE_TOTAL_CASES += 1

        # Compute activity vs capability separately
        activity_level = self._compute_activity_level(user_context)
        capability_level = self._compute_capability_level(user_context, signals)

        # Compute automation signals from user context directly (not LLM)
        automation_signals = self._compute_automation_signals(user_context)

        # Add derived signals to output
        output["activity_level"] = activity_level
        output["capability_level"] = capability_level
        output["automation_signals"] = automation_signals
        output["automation_signal_count"] = len(automation_signals)
        
        # Track which gates fire
        gates_fired = []

        # HARD GATE 1: No automation → cannot be power
        if not automation_signals and current_segment == "power":
            output["user_segment"] = "advanced"
            output["gating_override"] = "power→advanced: no automation signals"
            output["confidence"] = min(output.get("confidence", 0.5), 0.7)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_1_no_automation"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_1_no_automation", 0) + 1
            gates_fired.append("gate_1_no_automation")

        # HARD GATE 2: High activity + low capability → intermediate (not advanced)
        if activity_level == "high" and capability_level == "low" and current_segment in ("advanced", "power"):
            output["user_segment"] = "intermediate"
            output["gating_override"] = f"{current_segment}→intermediate: high activity + low capability"
            output["confidence"] = min(output.get("confidence", 0.5), 0.6)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_2_high_activity_low_capability"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_2_high_activity_low_capability", 0) + 1
            gates_fired.append("gate_2_high_activity_low_capability")

        # HARD GATE 3: Weak automation → advanced at most
        if len(automation_signals) <= 1 and current_segment == "power":
            output["user_segment"] = "advanced"
            output["gating_override"] = "power→advanced: weak automation signals"
            output["confidence"] = min(output.get("confidence", 0.5), 0.7)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_3_weak_automation"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_3_weak_automation", 0) + 1
            gates_fired.append("gate_3_weak_automation")

        # HARD GATE 4: No recurring tasks → intermediate at most (not advanced)
        # Advanced users should have repeated recurring task usage
        if "recurring_tasks_repeated" not in automation_signals and current_segment == "advanced":
            output["user_segment"] = "intermediate"
            output["gating_override"] = "advanced→intermediate: no repeated recurring tasks"
            output["confidence"] = min(output.get("confidence", 0.5), 0.7)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_4_no_recurring_tasks"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_4_no_recurring_tasks", 0) + 1
            gates_fired.append("gate_4_no_recurring_tasks")

        # HARD GATE 5: Low capability → intermediate at most
        if capability_level == "low" and current_segment in ("advanced", "power"):
            output["user_segment"] = "intermediate"
            output["gating_override"] = f"{current_segment}→intermediate: low capability level"
            output["confidence"] = min(output.get("confidence", 0.5), 0.6)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_5_low_capability"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_5_low_capability", 0) + 1
            gates_fired.append("gate_5_low_capability")

        # HARD GATE 6: Medium capability + no advanced features → intermediate at most
        features_used = set(user_context.get("features_used", []))
        advanced_features = {"dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"}
        advanced_used = features_used & advanced_features
        if capability_level == "medium" and not advanced_used and current_segment == "advanced":
            output["user_segment"] = "intermediate"
            output["gating_override"] = "advanced→intermediate: medium capability, no advanced features"
            output["confidence"] = min(output.get("confidence", 0.5), 0.7)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_6_medium_capability_no_advanced"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_6_medium_capability_no_advanced", 0) + 1
            gates_fired.append("gate_6_medium_capability_no_advanced")

        # HARD GATE 7: Low activity + low capability → beginner at most
        if activity_level == "low" and capability_level == "low" and current_segment in ("intermediate", "advanced", "power"):
            output["user_segment"] = "beginner"
            output["gating_override"] = f"{current_segment}→beginner: low activity + low capability"
            output["confidence"] = min(output.get("confidence", 0.5), 0.7)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_7_low_activity_low_capability"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_7_low_activity_low_capability", 0) + 1
            gates_fired.append("gate_7_low_activity_low_capability")

        # HARD GATE 8: No power features → cannot be power
        power_features = {"agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"}
        power_used = features_used & power_features
        if not power_used and current_segment == "power":
            output["user_segment"] = "advanced"
            output["gating_override"] = "power→advanced: no power features used"
            output["confidence"] = min(output.get("confidence", 0.5), 0.7)
            FeatureExposureFamily.GATE_HIT_COUNTS["gate_8_no_power_features"] = \
                FeatureExposureFamily.GATE_HIT_COUNTS.get("gate_8_no_power_features", 0) + 1
            gates_fired.append("gate_8_no_power_features")
        
        # Track false conservatism: expected is advanced/power but gating forced lower
        expected_segment = user_context.get("_expected_segment_for_false_conservatism")
        if expected_segment and expected_segment in ("advanced", "power"):
            actual_segment = output.get("user_segment", "unknown")
            segment_order = ["beginner", "intermediate", "advanced", "power"]
            try:
                expected_idx = segment_order.index(expected_segment)
                actual_idx = segment_order.index(actual_segment)
                if actual_idx < expected_idx:
                    # Gating forced lower than expected
                    output["false_conservatism"] = True
                    output["false_conservatism_delta"] = expected_idx - actual_idx
                    FeatureExposureFamily.GATE_HIT_COUNTS["false_conservatism"] = \
                        FeatureExposureFamily.GATE_HIT_COUNTS.get("false_conservatism", 0) + 1
                    gates_fired.append("false_conservatism")
            except ValueError:
                pass
        
        # Store gates fired for this case
        output["gates_fired"] = gates_fired

        return output
    
    @classmethod
    def get_gate_hit_report(cls) -> dict[str, Any]:
        """Get gate hit-rate report.
        
        Returns:
            Dict with gate hit counts, rates, and analysis.
        """
        total = cls.GATE_TOTAL_CASES
        if total == 0:
            return {"total_cases": 0, "gates": {}}
        
        gates = {}
        for gate_name, count in sorted(cls.GATE_HIT_COUNTS.items()):
            gates[gate_name] = {
                "hits": count,
                "rate": round(count / total, 3),
                "percentage": f"{count/total:.1%}",
            }
        
        # Analysis: which gates carry the most weight?
        sorted_gates = sorted(cls.GATE_HIT_COUNTS.items(), key=lambda x: x[1], reverse=True)
        top_gates = sorted_gates[:3]
        
        return {
            "total_cases": total,
            "gates": gates,
            "top_gates": [{"name": name, "hits": count} for name, count in top_gates],
            "false_conservatism_rate": round(cls.GATE_HIT_COUNTS.get("false_conservatism", 0) / total, 3) if total > 0 else 0,
        }
    
    @classmethod
    def reset_gate_stats(cls):
        """Reset gate hit-rate tracking."""
        cls.GATE_HIT_COUNTS = {}
        cls.GATE_TOTAL_CASES = 0
    
    def _compute_automation_signals(self, user_context: dict) -> list[str]:
        """Compute automation signals from user context directly.
        
        This is a structural computation, not LLM-generated.
        """
        signals = []
        features_used = set(user_context.get("features_used", []))
        recurring_tasks_used = user_context.get("recurring_tasks_used", 0)
        
        # Recurring tasks used repeatedly (not just once)
        if recurring_tasks_used >= 5:
            signals.append("recurring_tasks_repeated")
        elif recurring_tasks_used >= 2:
            signals.append("recurring_tasks_occasional")
        
        # Bulk operations
        if "bulk_edits" in features_used:
            signals.append("bulk_edits_used")
        
        # Automation rules
        if "automation_rules" in features_used:
            signals.append("automation_rules_used")
        
        # Custom automations
        if "custom_automations" in features_used:
            signals.append("custom_automations_used")
        
        # Advanced filters/views
        if "custom_views" in features_used:
            signals.append("custom_views_used")
        
        # API access
        if "api_access" in features_used:
            signals.append("api_access_used")
        
        return signals
    
    def _compute_activity_level(self, user_context: dict) -> str:
        """Compute activity level from behavioral volume signals.
        
        Activity = how much the user does (volume, frequency)
        This is a BAD proxy for maturity on its own.
        """
        days_active = user_context.get("days_active", 0)
        tasks_created = user_context.get("tasks_created", 0)
        planning_sessions = user_context.get("planning_sessions", 0)
        
        # Simple heuristic: high activity = lots of actions
        activity_score = 0
        if days_active > 30:
            activity_score += 1
        if days_active > 90:
            activity_score += 1
        if tasks_created > 50:
            activity_score += 1
        if tasks_created > 200:
            activity_score += 1
        if planning_sessions > 10:
            activity_score += 1
        if planning_sessions > 50:
            activity_score += 1
        
        if activity_score >= 5:
            return "high"
        elif activity_score >= 2:
            return "medium"
        else:
            return "low"
    
    def _compute_capability_level(self, user_context: dict, signals: list) -> str:
        """Compute capability level from feature usage depth.
        
        Capability = how well the user uses the system (feature depth)
        This is a GOOD proxy for maturity.
        """
        features_used = set(user_context.get("features_used", []))
        
        # Core features
        core_features = {"quick_add", "task_list", "basic_search", "due_dates"}
        # Intermediate features
        intermediate_features = {"recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities"}
        # Advanced features
        advanced_features = {"dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"}
        # Power features
        power_features = {"agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"}
        
        # Count feature usage by tier
        core_used = len(features_used & core_features)
        intermediate_used = len(features_used & intermediate_features)
        advanced_used = len(features_used & advanced_features)
        power_used = len(features_used & power_features)
        
        # Capability score based on feature depth (not volume)
        capability_score = 0
        if core_used >= 3:
            capability_score += 1
        if intermediate_used >= 3:
            capability_score += 1
        if intermediate_used >= 5:
            capability_score += 1
        if advanced_used >= 2:
            capability_score += 1
        if advanced_used >= 4:
            capability_score += 1
        if power_used >= 1:
            capability_score += 1
        if power_used >= 3:
            capability_score += 1
        
        if capability_score >= 6:
            return "high"
        elif capability_score >= 3:
            return "medium"
        else:
            return "low"

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

        # Classification accuracy with ASYMMETRIC PENALTIES
        # Upward misclassification is MORE harmful than downward
        # beginner→intermediate: mild confusion (penalty: 0.3)
        # intermediate→advanced: feature overload risk (penalty: 0.5)
        # advanced→power: system overload risk (penalty: 0.7)
        # beginner→power: catastrophic exposure (penalty: 1.0)
        # downward errors are less severe (penalty: 0.2)
        segment_order = ["beginner", "intermediate", "advanced", "power"]
        if actual_segment == expected_segment:
            classification_accuracy = 1.0
        else:
            try:
                expected_idx = segment_order.index(expected_segment)
                actual_idx = segment_order.index(actual_segment)
                direction = actual_idx - expected_idx  # positive = upward, negative = downward
                distance = abs(direction)
                
                if direction > 0:
                    # Upward misclassification - more harmful
                    if distance == 1:
                        # Adjacent tier upward (e.g., advanced→power)
                        classification_accuracy = 0.3  # 70% penalty
                    elif distance == 2:
                        # Two tiers upward (e.g., intermediate→power)
                        classification_accuracy = 0.1  # 90% penalty
                    else:
                        # Three tiers upward (e.g., beginner→power)
                        classification_accuracy = 0.0  # 100% penalty
                else:
                    # Downward misclassification - less severe
                    classification_accuracy = 0.8  # 20% penalty
            except ValueError:
                classification_accuracy = 0.0

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

        # Confidence calibration
        # High confidence should only occur when classification is correct
        # Low confidence is appropriate when signals are ambiguous
        is_correct = actual_segment == expected_segment
        is_high_confidence = confidence >= 0.8
        is_low_confidence = confidence < 0.6
        
        if is_correct and is_high_confidence:
            # Correct and confident - ideal
            confidence_calibration = 1.0
        elif not is_correct and is_high_confidence:
            # Wrong but confident - bad overconfidence
            confidence_calibration = 0.0
        elif is_correct and is_low_confidence:
            # Correct but uncertain - appropriately cautious
            confidence_calibration = 0.7
        elif not is_correct and is_low_confidence:
            # Wrong and uncertain - appropriate uncertainty
            confidence_calibration = 0.5
        else:
            # Medium confidence
            confidence_calibration = 0.6 if is_correct else 0.3

        # Format compliance
        required_fields = ["user_segment", "confidence", "enabled_features", "hidden_features"]
        format_compliance = 1.0 if all(f in output for f in required_fields) else 0.0

        dimensions = {
            "classification_accuracy": classification_accuracy,
            "feature_appropriateness": round(feature_appropriateness, 2),
            "over_exposure_avoidance": round(over_exposure_avoidance, 2),
            "under_exposure_avoidance": round(under_exposure_avoidance, 2),
            "nudge_quality": round(nudge_quality, 2),
            "confidence_calibration": round(confidence_calibration, 2),
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
