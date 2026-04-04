"""Case-level + run-level scoring for task critic outputs."""
from schemas.task_critic import TaskCriticInput, TaskCriticOutput

# ── Case-level checks (deterministic, 60% of case score) ───────────────────


def check_score_range(output: TaskCriticOutput) -> float:
    """Quality score must be in valid range [0, 100]."""
    return 1.0 if 0 <= output.quality_score <= 100 else 0.0


def check_suggestions_actionable(output: TaskCriticOutput) -> float:
    """Suggestions should be non-empty and specific (not generic)."""
    if not output.suggestions:
        return 0.5
    generic_words = {
        "improve",
        "better",
        "update",
        "review",
        "check",
        "consider",
        "ensure",
    }
    specific = sum(
        1
        for s in output.suggestions
        if not any(w in s.lower() for w in generic_words)
    )
    return min(1.0, specific / len(output.suggestions))


def check_title_improvement(
    input: TaskCriticInput, output: TaskCriticOutput
) -> float:
    """Improved title should differ from original and be meaningful."""
    if not output.improved_title:
        return 0.5
    if output.improved_title.strip().lower() == input.title.strip().lower():
        return 0.3  # no change
    return 1.0 if len(output.improved_title.strip()) >= 4 else 0.4


def check_theme_overlap(
    output: TaskCriticOutput, expected_themes: list[str]
) -> float:
    """Check if suggestions touch expected themes."""
    if not expected_themes or not output.suggestions:
        return 1.0  # neutral
    all_text = " ".join(output.suggestions).lower()
    hits = sum(1 for t in expected_themes if t.lower() in all_text)
    return hits / len(expected_themes)


def score_case(
    input: TaskCriticInput,
    output: TaskCriticOutput | None,
    expected_score: float,
    expected_themes: list[str] | None = None,
) -> dict:
    """Score a single case. Returns dict with score and breakdown."""
    if output is None:
        # Service failure — partial credit
        return {
            "score": 0.2,
            "score_range": 0.0,
            "suggestion_quality": 0.0,
            "title_improvement": 0.0,
            "theme_overlap": 0.0,
            "human_agreement": 0.0,
            "error": "service_unavailable",
        }

    score_range = check_score_range(output)
    suggestion_q = check_suggestions_actionable(output)
    title_imp = check_title_improvement(input, output)
    theme_ov = check_theme_overlap(output, expected_themes or [])

    deterministic = (
        0.25 * score_range
        + 0.25 * suggestion_q
        + 0.20 * title_imp
        + 0.30 * theme_ov
    )

    # Human agreement (40% of case score)
    diff = abs(output.quality_score - expected_score)
    if diff <= 10:
        human = 1.0
    elif diff <= 20:
        human = 0.7
    elif diff <= 30:
        human = 0.4
    else:
        human = 0.1

    case_score = 0.60 * deterministic + 0.40 * human

    return {
        "score": round(case_score, 3),
        "score_range": score_range,
        "suggestion_quality": suggestion_q,
        "title_improvement": title_imp,
        "theme_overlap": theme_ov,
        "human_agreement": human,
        "error": None,
    }


# ── Run-level metrics (15% of final score) ─────────────────────────────────


def compute_band_coverage(case_results: list[dict]) -> float:
    """Check score distribution across quality bands.

    Measures whether the critic uses the full score range rather than
    clustering everything in one band.
    """
    if not case_results:
        return 0.0
    scores = [r["score"] for r in case_results if r["error"] is None]
    if len(scores) < 3:
        return 0.5
    low = sum(1 for s in scores if s < 0.4)
    mid = sum(1 for s in scores if 0.4 <= s < 0.7)
    high = sum(1 for s in scores if s >= 0.7)
    bands_used = sum(1 for c in [low, mid, high] if c > 0)
    return bands_used / 3.0  # 1.0 if all bands represented


def compute_score_stability(case_results: list[dict]) -> float:
    """Penalize runs where scores are wildly all over the place.

    This is NOT "similar tasks score similarly" — that requires
    near-duplicate grouping. This is a noise floor check.
    """
    if len(case_results) < 2:
        return 1.0
    scores = [r["score"] for r in case_results if r["error"] is None]
    if not scores:
        return 0.0
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    return max(0.0, 1.0 - (variance / 0.25))  # normalize


def compute_run_score(case_results: list[dict]) -> float:
    coverage = compute_band_coverage(case_results)
    stability = compute_score_stability(case_results)
    return 0.60 * coverage + 0.40 * stability


# ── Final composite ────────────────────────────────────────────────────────


def compute_final_score(case_results: list[dict]) -> float:
    """85% mean case score + 15% run-level metrics."""
    case_scores = [r["score"] for r in case_results]
    mean_case = sum(case_scores) / len(case_scores) if case_scores else 0.0
    run_score = compute_run_score(case_results)
    return round(0.85 * mean_case + 0.15 * run_score, 3)
