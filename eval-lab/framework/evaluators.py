"""LLM graders and statistical significance testing.

Phase 2 evaluator trustworthiness components:
- LLMGrader: base class for LLM-based grading with configurable rubric
- SignificanceTester: bootstrap resampling for confidence intervals
- HumanReviewWorkflow: sample cases, assign reviewers, compute kappa
"""
from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass, field
from typing import Any, Optional


# ── LLM Grader ───────────────────────────────────────────────────────────────

@dataclass
class LLMGraderConfig:
    """Configuration for an LLM grader."""
    family: str
    rubric: str  # The grading rubric text
    dimension_names: list[str]  # Names of dimensions to score
    dimension_descriptions: dict[str, str]  # Description for each dimension
    output_format: str = "json"  # "json" or "score_only"
    temperature: float = 0.0  # Always 0 for grading consistency
    max_tokens: int = 500


class LLMGrader:
    """Base class for LLM-based grading.
    
    Uses an LLM to grade case outputs against expected outputs using
    a configurable rubric. Returns dimension-level scores.
    
    Usage:
        grader = LLMGrader(config)
        result = await grader.grade(case, output)
        # result = {"dimension1": 0.8, "dimension2": 0.6, ...}
    """
    
    def __init__(self, config: LLMGraderConfig):
        self.config = config
        self.base_url = os.getenv("AI_PROVIDER_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("AI_PROVIDER_API_KEY", "")
        self.model = os.getenv("AI_PROVIDER_MODEL", "gpt-4o-mini")
        self.version = "llm-1"  # Increment when rubric changes
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for grading."""
        dims = "\n".join(
            f"- {name}: {self.config.dimension_descriptions.get(name, '')}"
            for name in self.config.dimension_names
        )
        example_parts = ", ".join(f'"{d}": 0.8' for d in self.config.dimension_names)
        return (
            f"You are an expert evaluator for the {self.config.family} benchmark family.\n\n"
            f"Grade the following dimensions on a scale of 0.0 to 1.0:\n{dims}\n\n"
            f"Rubric:\n{self.config.rubric}\n\n"
            f"Return ONLY a JSON object with dimension names as keys and scores (0.0-1.0) as values.\n"
            f"Example: {{{example_parts}}}"
        )
    
    def _build_user_prompt(self, case_input: dict, case_expected: dict, output: dict) -> str:
        """Build the user prompt for grading."""
        return (
            f"Case input:\n{json.dumps(case_input, indent=2)}\n\n"
            f"Expected output:\n{json.dumps(case_expected, indent=2)}\n\n"
            f"Actual output:\n{json.dumps(output, indent=2)}\n\n"
            f"Grade the actual output against the expected output."
        )
    
    async def grade(
        self,
        case_input: dict,
        case_expected: dict,
        output: dict,
    ) -> dict[str, float]:
        """Grade a case output and return dimension scores."""
        import httpx
        
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(case_input, case_expected, output)
        
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
                        "temperature": self.config.temperature,
                        "max_tokens": self.config.max_tokens,
                        "response_format": {"type": "json_object"},
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                scores = json.loads(content)

                # Validate scores are in range
                return {
                    dim: max(0.0, min(1.0, float(scores.get(dim, 0.0))))
                    for dim in self.config.dimension_names
                }, None
        except Exception as e:
            # Return error message instead of neutral scores
            # Caller should mark case as grader_error and exclude from aggregate
            return {dim: 0.0 for dim in self.config.dimension_names}, str(e)


# ── Significance Tester ──────────────────────────────────────────────────────

@dataclass
class SignificanceResult:
    """Result of significance testing."""
    delta: float  # Observed difference
    p_value: float  # Probability of observing this delta by chance
    confidence_interval: tuple[float, float]  # 95% CI
    significant: bool  # Whether p < 0.05
    bootstrap_samples: int  # Number of bootstrap iterations


class SignificanceTester:
    """Bootstrap resampling for confidence intervals on score deltas.
    
    Usage:
        tester = SignificanceTester(n_bootstrap=1000)
        result = tester.test(baseline_scores, candidate_scores)
        if result.significant:
            print(f"Delta {result.delta:.3f} is significant (p={result.p_value:.3f})")
    """
    
    def __init__(self, n_bootstrap: int = 1000, seed: int = 42):
        self.n_bootstrap = n_bootstrap
        self.rng = random.Random(seed)
    
    def test(
        self,
        baseline_scores: list[float],
        candidate_scores: list[float],
    ) -> SignificanceResult:
        """Test whether the delta between baseline and candidate is significant.
        
        Uses bootstrap resampling to compute confidence intervals and p-values.
        """
        if len(baseline_scores) != len(candidate_scores):
            raise ValueError("Baseline and candidate must have same number of scores")
        
        n = len(baseline_scores)
        if n == 0:
            return SignificanceResult(
                delta=0.0, p_value=1.0, confidence_interval=(0.0, 0.0),
                significant=False, bootstrap_samples=0,
            )
        
        # Observed delta
        observed_delta = sum(candidate_scores) / n - sum(baseline_scores) / n
        
        # Bootstrap resampling
        bootstrap_deltas = []
        for _ in range(self.n_bootstrap):
            # Sample with replacement
            indices = [self.rng.randint(0, n - 1) for _ in range(n)]
            bs_baseline = [baseline_scores[i] for i in indices]
            bs_candidate = [candidate_scores[i] for i in indices]
            bs_delta = sum(bs_candidate) / n - sum(bs_baseline) / n
            bootstrap_deltas.append(bs_delta)
        
        # Sort bootstrap deltas
        bootstrap_deltas.sort()
        
        # 95% confidence interval
        ci_lower = bootstrap_deltas[int(0.025 * self.n_bootstrap)]
        ci_upper = bootstrap_deltas[int(0.975 * self.n_bootstrap)]
        
        # P-value: proportion of bootstrap deltas with opposite sign to observed
        if observed_delta > 0:
            p_value = sum(1 for d in bootstrap_deltas if d <= 0) / self.n_bootstrap
        else:
            p_value = sum(1 for d in bootstrap_deltas if d >= 0) / self.n_bootstrap
        
        return SignificanceResult(
            delta=round(observed_delta, 3),
            p_value=round(p_value, 3),
            confidence_interval=(round(ci_lower, 3), round(ci_upper, 3)),
            significant=p_value < 0.05,
            bootstrap_samples=self.n_bootstrap,
        )


# ── Human Review Workflow ────────────────────────────────────────────────────

@dataclass
class ReviewAssignment:
    """A single case review assignment."""
    case_id: str
    family: str
    reviewer: str
    scores: dict[str, float] = field(default_factory=dict)
    rationale: str = ""
    completed: bool = False


@dataclass
class ReviewSet:
    """A set of case reviews for calibration."""
    family: str
    assignments: list[ReviewAssignment] = field(default_factory=list)
    
    def compute_kappa(self, reviewer1: str, reviewer2: str) -> float:
        """Compute Cohen's kappa between two reviewers.
        
        Simplified: uses score agreement within tolerance.
        """
        r1_scores = {a.case_id: a.scores for a in self.assignments if a.reviewer == reviewer1 and a.completed}
        r2_scores = {a.case_id: a.scores for a in self.assignments if a.reviewer == reviewer2 and a.completed}
        
        common_cases = set(r1_scores.keys()) & set(r2_scores.keys())
        if not common_cases:
            return 0.0
        
        # Compute agreement: scores within 0.15 tolerance count as agreement
        agreements = 0
        total = 0
        for case_id in common_cases:
            s1 = r1_scores[case_id]
            s2 = r2_scores[case_id]
            for dim in set(list(s1.keys()) + list(s2.keys())):
                v1 = s1.get(dim, 0.5)
                v2 = s2.get(dim, 0.5)
                total += 1
                if abs(v1 - v2) <= 0.15:
                    agreements += 1
        
        observed_agreement = agreements / total if total > 0 else 0.0
        
        # Expected agreement by chance (simplified: assume uniform distribution)
        expected_agreement = 0.5  # Simplified
        
        kappa = (observed_agreement - expected_agreement) / (1 - expected_agreement)
        return round(max(-1.0, min(1.0, kappa)), 3)
    
    def get_reviewed_cases(self) -> list[str]:
        """Get list of case IDs that have been reviewed by at least 2 reviewers."""
        case_reviewers: dict[str, set[str]] = {}
        for a in self.assignments:
            if a.completed:
                case_reviewers.setdefault(a.case_id, set()).add(a.reviewer)
        return [cid for cid, reviewers in case_reviewers.items() if len(reviewers) >= 2]
