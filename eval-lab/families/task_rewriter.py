"""Task Rewriter benchmark family.

Tests whether the system can transform a weak task into a clearer,
actionable one without changing intent or inventing facts.

Core question: Can the system improve task quality while preserving intent?
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


# ── Task Rewriter Score Dimensions ───────────────────────────────────────────

TASK_REWRITER_DIMENSIONS = [
    ScoreDimension(
        name="intent_preservation",
        weight=0.30,
        description="Rewritten task preserves the original intent and key facts",
    ),
    ScoreDimension(
        name="clarity_improvement",
        weight=0.25,
        description="Rewritten title/description is clearer than original",
    ),
    ScoreDimension(
        name="actionability",
        weight=0.20,
        description="Rewritten task is more actionable (starts with verb, has scope)",
    ),
    ScoreDimension(
        name="constraint_adherence",
        weight=0.10,
        description="Respects constraints (dates, names, numbers) from original",
    ),
    ScoreDimension(
        name="no_hallucination",
        weight=0.10,
        description="Does not invent facts, details, or specifics not in original",
    ),
    ScoreDimension(
        name="format_compliance",
        weight=0.05,
        description="Output has required fields (rewritten_title, rewritten_description)",
    ),
]


class TaskRewriterFamily(BenchmarkFamily):
    """Benchmark family for task rewriting quality evaluation."""

    NAME = "task_rewriter"
    VERSION = "1"

    def __init__(self, cases_dir: Optional[Path] = None):
        if cases_dir is None:
            cases_dir = Path(__file__).parent.parent / "tasks" / "task-rewriter-quality"
        super().__init__(cases_dir)
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")

    # ── Score Dimensions ─────────────────────────────────────────────────

    def score_dimensions(self) -> list[ScoreDimension]:
        return TASK_REWRITER_DIMENSIONS

    def score_weights(self) -> dict[str, float]:
        return {d.name: d.weight for d in TASK_REWRITER_DIMENSIONS}

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
            quality_score = expected_data.get("original_quality", 50)

            # Determine difficulty
            if category == "adversarial":
                difficulty = CaseDifficulty.ADVERSARIAL
            elif category in ("multi-intent", "over-specified"):
                difficulty = CaseDifficulty.HARD
            elif quality_score > 70:
                difficulty = CaseDifficulty.EASY  # Already good, minimal edit needed
            elif quality_score < 30:
                difficulty = CaseDifficulty.MEDIUM  # Very bad, but obvious how to fix
            else:
                difficulty = CaseDifficulty.MEDIUM

            metadata = CaseMetadata(
                source="hand_curated",
                slices=[category],
                difficulty=difficulty,
                why_this_case=expected_data.get("notes", ""),
                what_good_looks_like=expected_data.get("what_good_rewriting_looks_like", ""),
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
        """Call the LLM to rewrite the task."""
        input_data = case.input
        title = input_data.get("title", "")
        description = input_data.get("description") or ""

        system_prompt = prompt_override or (
            "You are a task quality expert. Rewrite the given task to make it clearer "
            "and more actionable WITHOUT changing the original intent or inventing new facts.\n\n"
            "Rules:\n"
            "1. Preserve all dates, names, numbers, and specific details from the original\n"
            "2. Do NOT add specifics that weren't in the original\n"
            "3. Start the title with a clear action verb\n"
            "4. Make the description include acceptance criteria or definition of done\n"
            "5. If the task is already good, make only minimal edits\n"
            "6. If the task mixes multiple actions, split them (mark as split: true)\n\n"
            "Return JSON with:\n"
            "- rewritten_title: string\n"
            "- rewritten_description: string\n"
            "- split: boolean (true if task was split into multiple)\n"
            "- split_tasks: array of {title, description} (only if split is true)\n"
            "- changes_made: array of strings describing what was changed\n"
            "- intent_preserved: boolean\n"
            "- facts_invented: boolean (should be false)"
        )

        user_prompt = f"Original task:\nTitle: {title}\nDescription: {description or '(none)'}"

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
                        "max_tokens": 500,
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
                    dimensions={d.name: 0.0 for d in TASK_REWRITER_DIMENSIONS},
                    grader_rationale=f"Service error: {error or 'No output'}",
                ),
                failure_types=[FailureType.SERVICE_ERROR],
                slices=case.metadata.slices,
                difficulty=case.metadata.difficulty.value,
            )

        expected = case.expected
        original_title = case.input.get("title", "")
        rewritten_title = output.get("rewritten_title", "")
        rewritten_desc = output.get("rewritten_description", "")
        expected_title = expected.get("rewritten_title", "")
        facts_invented = output.get("facts_invented", False)
        split = output.get("split", False)

        # Intent preservation: key facts from original are present
        original_facts = self._extract_key_facts(case.input)
        preserved_facts = sum(
            1 for fact in original_facts
            if fact.lower() in rewritten_title.lower() or fact.lower() in rewritten_desc.lower()
        )
        intent_preservation = preserved_facts / len(original_facts) if original_facts else 1.0

        # Clarity improvement: title starts with verb, is specific
        starts_with_verb = self._starts_with_action_verb(rewritten_title)
        clarity_improvement = 0.0
        if starts_with_verb:
            clarity_improvement += 0.5
        if len(rewritten_title) >= 10 and len(rewritten_title) <= 120:
            clarity_improvement += 0.3
        if rewritten_desc and len(rewritten_desc) >= 20:
            clarity_improvement += 0.2
        clarity_improvement = min(1.0, clarity_improvement)

        # Actionability: has verb, scope, and definition of done
        actionability = 0.0
        if starts_with_verb:
            actionability += 0.4
        if any(kw in rewritten_desc.lower() for kw in ["done", "criteria", "deliver", "output", "result"]):
            actionability += 0.3
        if len(rewritten_desc) >= 30:
            actionability += 0.3
        actionability = min(1.0, actionability)

        # Constraint adherence: dates, names, numbers preserved
        constraints = self._extract_constraints(case.input)
        preserved_constraints = sum(
            1 for c in constraints
            if c.lower() in rewritten_title.lower() or c.lower() in rewritten_desc.lower()
        )
        constraint_adherence = preserved_constraints / len(constraints) if constraints else 1.0

        # No hallucination
        no_hallucination = 0.0 if facts_invented else 1.0

        # Format compliance
        format_compliance = 1.0 if rewritten_title and rewritten_desc else 0.0

        dimensions = {
            "intent_preservation": round(intent_preservation, 2),
            "clarity_improvement": round(clarity_improvement, 2),
            "actionability": round(actionability, 2),
            "constraint_adherence": round(constraint_adherence, 2),
            "no_hallucination": no_hallucination,
            "format_compliance": format_compliance,
        }

        # Detect failure types
        failure_types = self._detect_failures(case, output, dimensions)

        # Grader rationale
        rationale_parts = []
        if intent_preservation < 0.5:
            rationale_parts.append(f"intent lost ({preserved_facts}/{len(original_facts)} facts)")
        if not starts_with_verb:
            rationale_parts.append("no action verb in title")
        if facts_invented:
            rationale_parts.append("invented facts detected")
        if constraint_adherence < 0.5:
            rationale_parts.append(f"constraints dropped ({preserved_constraints}/{len(constraints)})")
        if not rationale_parts:
            rationale_parts.append("all dimensions passed")

        breakdown = ScoreBreakdown(
            dimensions=dimensions,
            grader_rationale="; ".join(rationale_parts),
            borderline=0.4 <= clarity_improvement <= 0.6,
        )

        return CaseResult(
            case_id=case.id,
            split=case.split,
            predicted=output,
            score=breakdown.composite(self.score_weights()),
            breakdown=breakdown,
            failure_types=failure_types,
            abs_error=0.0,  # No scalar expected for rewriter
            slices=case.metadata.slices,
            difficulty=case.metadata.difficulty.value,
            grader_artifacts={
                "grader_type": "deterministic",
                "dimensions": dimensions,
                "original_facts": original_facts,
                "preserved_facts": preserved_facts,
                "constraints": constraints,
                "preserved_constraints": preserved_constraints,
            },
        )

    def _detect_failures(
        self,
        case: Case,
        output: dict,
        dimensions: dict[str, float],
    ) -> list[FailureType]:
        """Detect failure types for a case."""
        failures = []

        if dimensions.get("intent_preservation", 1.0) < 0.5:
            failures.append(FailureType.INTENT_DRIFT)

        if dimensions.get("no_hallucination", 1.0) < 1.0:
            failures.append(FailureType.HALLUCINATED_ISSUE)

        if dimensions.get("constraint_adherence", 1.0) < 0.5:
            failures.append(FailureType.DROPPED_CONSTRAINT)

        if dimensions.get("clarity_improvement", 0.0) < 0.3:
            failures.append(FailureType.INSUFFICIENT_SPECIFICITY)

        # Over-editing: changed too much for an already-good task
        if case.metadata.slices == ["already-good"]:
            original_title = case.input.get("title", "")
            rewritten_title = output.get("rewritten_title", "")
            if original_title and rewritten_title:
                # Simple similarity check
                orig_words = set(original_title.lower().split())
                new_words = set(rewritten_title.lower().split())
                overlap = len(orig_words & new_words) / max(len(orig_words), 1)
                if overlap < 0.5:
                    failures.append(FailureType.OVER_EDITED)

        return failures

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _extract_key_facts(input_data: dict) -> list[str]:
        """Extract key facts from original task input."""
        facts = []
        title = input_data.get("title", "")
        desc = input_data.get("description") or ""

        # Extract dates
        import re
        dates = re.findall(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d+|\d{4}-\d{2}-\d{2}|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b', title + " " + desc, re.IGNORECASE)
        facts.extend(dates)

        # Extract numbers with units
        numbers = re.findall(r'\$?\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|m|million|billion|hours?|days?|weeks?|months?|people|users?)?', title + " " + desc, re.IGNORECASE)
        facts.extend(numbers)

        # Extract proper nouns (capitalized words that aren't start of sentence)
        nouns = re.findall(r'\b[A-Z][a-z]{2,}\b', title + " " + desc)
        facts.extend([n for n in nouns if n not in ("The", "And", "For", "With", "From", "This", "That", "Need", "Make", "Include")])

        return list(set(facts))

    @staticmethod
    def _extract_constraints(input_data: dict) -> list[str]:
        """Extract constraints (dates, names, specific values) that must be preserved."""
        constraints = []
        title = input_data.get("title", "")
        desc = input_data.get("description") or ""
        text = title + " " + desc

        import re
        # Dates
        dates = re.findall(r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d+|\d{4}-\d{2}-\d{2}', text, re.IGNORECASE)
        constraints.extend(dates)

        # Dollar amounts
        amounts = re.findall(r'\$\d+(?:,\d+)*(?:\.\d+)?', text)
        constraints.extend(amounts)

        # Names (capitalized words that look like names)
        names = re.findall(r'\b(?:Sarah|John|Mike|Alice|Bob|Acme|Google|AWS|Stripe)\b', text)
        constraints.extend(names)

        return list(set(constraints))

    @staticmethod
    def _starts_with_action_verb(title: str) -> bool:
        """Check if title starts with an action verb."""
        action_verbs = {
            "add", "create", "build", "write", "design", "implement", "fix",
            "update", "review", "prepare", "schedule", "ship", "publish",
            "launch", "test", "plan", "complete", "define", "draft", "send",
            "book", "call", "submit", "cancel", "configure", "set", "setup",
            "migrate", "refactor", "deploy", "monitor", "document", "research",
            "analyze", "conduct", "organize", "arrange", "compile", "generate",
            "extract", "convert", "normalize", "compress", "rewrite", "improve",
        }
        first_word = title.strip().split()[0].lower() if title.strip() else ""
        return first_word in action_verbs
