# From Prompt Engineering to Policy-Constrained Reasoning: A Benchmark-Driven Architecture for Trustworthy AI Product Decisions

## Abstract

This paper describes the design, implementation, and validation of a benchmark-driven, policy-constrained AI decision platform built for a productivity application. The system began as an evaluation laboratory for multiple LLM-backed capabilities and evolved into a policy-constrained architecture where LLM reasoning is bounded by deterministic signals and structural constraints. We document the architectural shift from prompt-only behavior shaping to a three-layer decision stack comprising observed signals, policy constraints, and bounded LLM judgment. We present seven benchmark families (170 cases, 45 dimensions), a portfolio governance layer with tiered release constraints, and a hard gating system that converts soft behavioral distinctions into structural constraints the LLM cannot override. Validation results show that cross-family policy consistency improved from 40% to 100% through the combination of a conservatism prior and hard gating, while catastrophic overexposure errors were eliminated on tested slices with zero false conservatism on ambiguous holdout cases. We discuss the validation methodology, including counterfactual baselines, policy regret, and refined false conservatism metrics, and outline the remaining gap between benchmark evidence and live-outcome validation.

---

## Executive Summary

We built a benchmark-driven AI decision platform for a todo/productivity application that combines LLM reasoning, deterministic evaluation, and structural policy constraints to produce safe, consistent, and high-quality product decisions. The system's most important architectural shift was moving from prompt-only optimization—where behavior is shaped through prompt wording, penalties, and heuristics—to a policy-constrained architecture where grounded signals are computed first, structural policy constraints are applied, and the LLM reasons within those bounds. This changed the LLM from a policy source into a policy-guided reasoner.

The platform includes seven benchmark families covering task critique, rewriting, planning, clarification, prioritization, structured extraction, and feature exposure. These are aggregated through a portfolio layer with tiered governance: Tier 1 families (feature exposure, clarification policy) cannot regress; Tier 2 families (prioritization, planning) must improve or stay neutral; Tier 3 families (critic, rewriter, extraction) can fluctuate within bounds.

The feature exposure family became the most policy-relevant benchmark because it controls progressive exposure of advanced features to users based on maturity. We found that the model consistently over-classified active users upward, mistaking high activity volume for sophistication. This led to a signal design separating activity level, capability level, and automation signals, followed by eight structural gates that the LLM cannot override.

Validation results on 30 ambiguous holdout cases near tier boundaries show 93.3% overall accuracy, 100% safety gain (overexposure reduced from 3.3% to 0.0%), improved policy regret (+0.033 net delta), and 0.0% false conservatism with a refined denominator. Cross-family policy consistency improved from 40% to 100% through conservatism prior and hard gating.

What is established: the architecture has been built, the benchmark portfolio exists, cross-family consistency improved through conservatism prior and hard gating, and catastrophic overexposure errors were eliminated on tested slices. What is not yet fully proven: long-term live product impact, the full tradeoff between safety gain and unlock loss in production, and whether gates remain well-calibrated as the product evolves.

---

## 1. Introduction / Problem Statement

AI-powered product features introduce a fundamental tension: the same flexibility that makes LLMs useful also makes them unpredictable. In a productivity application, this unpredictability manifests in several ways. A task critique model may over-penalize a vague but actionable task. A planning model may generate an ambitious but unrealistic plan. A clarification model may ask unnecessary questions or proceed when it should ask. And perhaps most critically, a feature exposure model may show advanced capabilities to users who are not ready for them, or withhold powerful features from users who are.

Traditional approaches to this problem rely on prompt engineering: carefully worded instructions, examples, and output format constraints designed to shape model behavior. This works to a point. But as the number of AI-backed capabilities grows, and as their interactions become more complex, prompt-only optimization becomes insufficient. The model's behavior is shaped by too many competing objectives, and there is no structural guarantee that it will respect product policy constraints.

We faced this problem directly. Our application had grown to include multiple LLM-backed capabilities: task quality assessment, task rewriting, goal decomposition into plans, clarification under uncertainty, task prioritization, structured extraction from unstructured text, and progressive feature exposure based on user maturity. Each capability was evaluated in isolation, but their interactions were not. A user classified as "advanced" by the feature exposure model would receive a different planning mode than one classified as "intermediate," which would affect prioritization behavior, which would affect the quality of the plan. Errors in one capability cascaded through the others.

This paper describes the system we built to address this problem: a benchmark-driven, policy-constrained AI decision platform that combines LLM reasoning with deterministic signals and structural constraints. We document the architecture, the evaluation methodology, the validation results, and the remaining gaps between benchmark evidence and live-outcome validation.

---

## 2. Why Prompt-Only Optimization Was Insufficient

Our initial approach to each AI capability followed a familiar pattern: define the task, write a prompt, evaluate outputs manually, iterate on the prompt, and ship. This worked for individual capabilities in isolation. But as we added more capabilities, three problems emerged.

**First, prompt conflicts.** Each capability had its own prompt, optimized for its own objective. But these objectives sometimes conflicted. The feature exposure model was optimized to classify users accurately, which meant rewarding it for detecting subtle signals of advanced usage. The planning model was optimized to generate ambitious plans, which meant rewarding it for assuming user capability. When the feature exposure model over-classified a user as "advanced," the planning model would generate a plan that assumed advanced feature usage, which the user was not actually ready for. The prompts were individually well-tuned but collectively misaligned.

**Second, no structural guarantees.** No matter how carefully we worded the prompt, there was no guarantee that the model would respect product policy constraints. We could instruct it to "prefer lower exposure when signals conflict," but the model could still override this instruction if it detected what it interpreted as strong signals. We could penalize over-classification in the evaluation, but the penalty was applied after the fact, not enforced structurally.

**Third, no cross-capability evaluation.** Each capability was evaluated in isolation. We had no mechanism for testing whether a user classified as "intermediate" by the feature exposure model would receive appropriate planning, prioritization, and clarification behavior. The evaluation was local; the product decisions were global.

These problems pointed to a deeper issue: we were treating the LLM as a policy source, when it should have been a policy-guided reasoner. The policy—what features to show, what planning mode to use, when to ask for clarification—should have been determined by structural constraints, not by prompt wording. The LLM's role should have been to reason within those constraints, not to define them.

---

## 3. System Architecture

The system is organized as a three-layer decision stack:

**Layer 1: Observed Signals (Ground Truth / Structural)**

These are deterministic computations from user behavior data, not LLM outputs:

- `activity_level`: Usage volume—days active, tasks created, planning sessions. Computed from raw counts with ordinal thresholds (low, medium, high).
- `capability_level`: Feature usage depth—not volume, but how deeply the user engages with features at each tier. Computed from the count of distinct features used at core, intermediate, advanced, and power tiers.
- `automation_signals`: Actual usage of automation features—recurring tasks used repeatedly (5+ times), bulk edits, automation rules, custom automations, API access. Computed from feature usage logs.

These signals are structural: they are computed deterministically from user data, not predicted by the LLM. They form the ground truth that policy constraints operate on.

By computing Layer 1 signals deterministically, we reduce the LLM's token search space significantly. The model does not need to infer usage patterns from raw behavioral logs—it receives pre-computed ordinal signals (activity_level: medium, capability_level: high, automation_signals: [recurring_tasks_repeated, bulk_edits_used]). This shifts the LLM's role from pattern extraction to pattern interpretation, which is both more reliable and more token-efficient. In practice, this reduces the prompt context by approximately 40-60% compared to passing raw behavioral logs, and eliminates a class of hallucination errors where the model miscounts or misattributes feature usage.

**Layer 2: Policy Constraints (Deterministic Rules)**

These are hard rules that cap or allow exposure and routing decisions. They are applied after the LLM produces its initial classification, and they cannot be overridden by the LLM. Eight structural gates enforce constraints such as:

- No automation signals → cannot be classified as "power"
- High activity + low capability → intermediate at most, not advanced
- Low activity + low capability → beginner at most

These gates convert soft behavioral distinctions into structural constraints. They are the mechanism that changed the LLM from a policy source into a policy-guided reasoner.

**Layer 3: LLM Judgment (Bounded Reasoning)**

The LLM produces an initial classification, recommendation, or plan based on the user context and feature catalog. But this output is then passed through the policy constraints, which may override it. The LLM's role is to detect subtle signals, reason about ambiguous cases, and produce structured outputs—but it does not have the final say on policy decisions.

This architecture ensures that the LLM's flexibility is used where it adds value (detecting subtle patterns, reasoning about ambiguity) but is bounded where structural guarantees are required (preventing overexposure, enforcing tier boundaries).

---

## 4. Eval-Lab Design

Eval-Lab is the benchmark and evaluation platform that underpins the system. It was designed to answer a simple question: did this change make things better or worse, across all capabilities, not just one?

**Design Principles**

1. **Benchmark-driven development.** Every capability is evaluated against a fixed set of cases with known expected outputs. Changes are accepted only if they improve or maintain scores across the portfolio.

2. **Cross-family aggregation.** Individual family scores are aggregated into a portfolio score with weighted contributions. This prevents optimizing one capability at the expense of others.

3. **Stratified sampling.** Cases are split into dev/test/holdout sets with stratification by slice (behavioral category) and difficulty (easy, medium, hard, adversarial). This ensures evaluation coverage across the full range of user behaviors.

4. **Meta-dimension mapping.** Family-specific dimensions (45 total across 7 families) are mapped to 6 meta-buckets (correctness, compliance, robustness, reasoning, safety) for portfolio-level interpretation.

5. **Significance testing.** All comparisons use bootstrap resampling (1000 iterations) to compute p-values and confidence intervals. This prevents overinterpreting noise as signal.

**Platform Components**

- `framework/schemas.py`: Core data models (Case, CaseResult, ScoreBreakdown, RunResult)
- `framework/hardening.py`: Holdout manager, CI regression gate, grader registry
- `framework/evaluators.py`: LLM graders, significance testing, human review workflow
- `families/`: Seven benchmark family implementations
- `portfolio.py`: Portfolio aggregation, comparison, guardrails
- `run_portfolio.py`: CLI runner with CI gate and grader audit modes
- `calibrate.py`: LLM grader calibration workflow
- `cross_family_policy.py`: Cross-family policy tests
- `run_ambiguous_holdout.py`: 30-case ambiguous holdout validation
- `run_comprehensive_validation.py`: Comprehensive validation for all milestones

---

## 5. Benchmark Families

The system includes seven benchmark families, each testing a distinct AI capability:

| Family | Cases | Dimensions | Core Question |
|--------|-------|------------|---------------|
| Task Critic | 30 | 4 | How well-defined is this task? |
| Task Rewriter | 20 | 6 | Can we improve the task without changing intent? |
| Plan-from-Goal | 20 | 8 | Can we decompose a goal into a realistic plan? |
| Clarification Policy | 20 | 5 | Ask, proceed, or refuse? |
| Prioritization | 20 | 5 | What matters most and in what order? |
| Structured Extraction | 20 | 5 | Can we extract tasks from unstructured text? |
| Feature Exposure | 20 | 7 | What features should this user see? |

**Total: 170 cases, 45 dimensions, 6 meta-buckets.**

Each family includes cases stratified by slice (behavioral category) and difficulty (easy, medium, hard, adversarial), with a 67/33 dev/test split and a separate holdout set for overfitting detection.

### 5.1 Task Critic

Evaluates whether the system can assess task quality and provide actionable feedback. Cases range from well-structured tasks with clear deadlines to vague, ambiguous requests. Dimensions include correctness, instruction following, suggestion quality, and format compliance.

### 5.2 Task Rewriter

Evaluates whether the system can improve a task's clarity and actionability without changing its intent. Cases include tasks that are vague, overly complex, or missing key details. Dimensions include intent preservation, clarity improvement, actionability, constraint adherence, no hallucination, and format compliance.

### 5.3 Plan-from-Goal

Evaluates whether the system can decompose a goal into a realistic, sequenced plan. Cases range from simple personal goals to complex multi-project objectives with constraints. Dimensions include goal coverage, step quality, sequencing, feasibility, granularity, non-redundancy, constraint adherence, and format compliance.

### 5.4 Clarification Policy

Evaluates whether the system knows when to ask for clarification, proceed with assumptions, or refuse due to insufficient information. Cases include ambiguous requests, conflicting constraints, and safety-sensitive scenarios. Dimensions include decision quality, question quality, minimality, safety, and format compliance.

### 5.5 Prioritization

Evaluates whether the system can rank tasks by true priority, respecting dependencies and urgency. Cases include tasks with conflicting deadlines, implicit dependencies, and adversarial priority signals. Dimensions include ordering quality, dependency respect, justification quality, tie handling, and format compliance.

### 5.6 Structured Extraction

Evaluates whether the system can extract structured task objects from unstructured text (emails, notes, meeting transcripts). Cases range from clear task lists to rambling prose with tasks buried among non-actionable content. Dimensions include extraction accuracy, field completeness, deduplication, no hallucination, and format compliance.

### 5.7 Feature Exposure

Evaluates whether the system can classify user maturity and recommend appropriate feature sets without overwhelming novices or under-serving power users. Cases span the full spectrum from first-week beginners to highly engaged power users, with ambiguous boundary cases near tier transitions. Dimensions include classification accuracy, feature appropriateness, over-exposure avoidance, under-exposure avoidance, nudge quality, format compliance, and confidence calibration.

This family became the most policy-relevant because it controls progressive exposure of advanced features, which directly affects user experience, adoption velocity, and confusion rates.

> **Why Feature Exposure is the focus of this paper.** Of these seven families, Feature Exposure became the most policy-relevant because it directly controls which users see which capabilities. Unlike the other families, which evaluate content quality (critique, rewriting, planning, extraction) or decision quality (prioritization, clarification), Feature Exposure is a *routing* decision: it determines what the user is allowed to do, not just how well the system performs a task. For this reason, the remainder of this paper focuses on Feature Exposure as a case study in policy-constrained reasoning.

---

## 6. Feature Exposure as a Policy Problem

The feature exposure family addresses a fundamental product question: what features should this user see, right now?

The naive approach is to show all features to all users. This overwhelms beginners and under-serves power users. The opposite approach—progressive unlock based on simple thresholds (e.g., "show advanced features after 30 days")—is too rigid and ignores actual user behavior.

The LLM-based approach classifies users into segments (beginner, intermediate, advanced, power) based on their behavior, then recommends which features to enable, hide, or nudge toward. This is more flexible than rule-based thresholds, but it introduces a new risk: the model may over-classify users upward, showing advanced features to users who are not ready for them.

We observed this risk directly. The model consistently mistook high activity volume for sophistication. A user who created 300 tasks in 60 days but only used core features was classified as "advanced" because the model associated high volume with high capability. This is a reasonable inference for an LLM—more activity suggests more engagement—but it is the wrong inference for product policy. Activity is not capability. Heavy usage does not imply advanced readiness.

Overexposure is not merely a classification error; it is a product risk. A user classified as "advanced" who is not actually ready for advanced features may encounter bulk-edit tools, automation rules, or API access that they do not understand. In the worst case, this can lead to irreversible actions (e.g., bulk-deleting 1000 tasks, creating automation loops, or exposing data through API integrations) that the user cannot recover from. This is why upward misclassifications are penalized asymmetrically: the cost of overexposure is not just confusion, but potential data loss or workflow corruption.

This led to a more explicit signal design:

- **activity_level**: How much the user does (volume, frequency). A bad proxy for maturity on its own.
- **capability_level**: How well the user uses the system (feature depth). A good proxy for maturity.
- **automation_signals**: Whether the user actually uses automation features (recurring tasks repeatedly, bulk edits, automation rules, custom automations). The strongest signal for power-tier readiness.

With these signals separated, we could design policy constraints that respected the distinction: high activity + low capability → intermediate at most, not advanced. No automation signals → cannot be power. This was the foundation for hard gating.

---

## 7. From Soft Prompts to Hard Gating

The evolution from prompt-only optimization to hard gating followed three stages.

### 7.1 Stage 1: Prompt-Only Optimization

Initial approach: instruct the model through prompt wording to prefer lower exposure when signals conflict, and to only classify as advanced/power with clear evidence of sustained usage. Results: cross-family consistency was 40% (2/5 cases). The model still over-classified users upward, especially near tier boundaries.

### 7.2 Stage 2: Conservatism Prior

We added explicit prompt instructions:

- When signals conflict or are ambiguous, prefer the lower exposure tier.
- High activity volume does not equal sophistication if the account is new.
- Reward progressive nudges more than full unlocks in ambiguous cases.
- It is better to under-expose than over-expose.

Results: cross-family consistency improved to 80% (4/5 cases). The conservatism prior reduced upward over-classification, but the model could still override it when it detected what it interpreted as strong signals.

### 7.3 Stage 3: Hard Gating

We implemented eight structural gates that the LLM cannot override:

| Gate | Condition | Action |
|------|-----------|--------|
| 1 | No automation signals AND LLM says power | Demote to advanced |
| 2 | High activity AND low capability AND LLM says advanced/power | Demote to intermediate |
| 3 | Weak automation (≤1 signals) AND LLM says power | Demote to advanced |
| 4 | No recurring tasks repeated AND LLM says advanced | Demote to intermediate (unless advanced features compensate) |
| 5 | Low capability AND LLM says advanced/power | Demote to intermediate |
| 6 | Medium capability AND no advanced features AND LLM says advanced | Demote to intermediate |
| 7 | Low activity AND low capability AND LLM says intermediate+ | Demote to beginner |
| 8 | No power features AND LLM says power | Demote to advanced |

These gates are applied post-LLM, as a structural constraint layer. The LLM's output is the input to the gating logic, not the final decision. This converts soft behavioral distinctions into structural constraints.

Results: cross-family consistency improved to 100% (5/5 cases). Catastrophic overexposure errors were eliminated on tested slices. False conservatism rate was 0.0% on ambiguous holdout cases.

**Maintainability Consideration.** Hard gates are versioned and audited through the `GraderRegistry` in `framework/hardening.py`. Each gate has a unique identifier, a changelog entry, and a test case that validates its behavior. We enforce a design constraint: no gate may contain more than two conditional branches. Gate 4's exception (advanced features compensate for lack of recurring tasks) is the most complex gate, and it required a design review before acceptance. As the product evolves, we plan to evaluate whether gates can be auto-generated from policy specifications rather than hand-coded, but for now the hand-coded approach ensures that each gate is intentionally designed and tested.

### 7.4 Asymmetric Penalties

In addition to hard gating, we introduced asymmetric penalties in the evaluation metric. Upward misclassifications (showing more advanced features than appropriate) are penalized more heavily than downward misclassifications (showing fewer features than appropriate):

- Adjacent upward (e.g., intermediate → advanced): 0.3 score (70% penalty)
- Two tiers upward (e.g., intermediate → power): 0.1 score (90% penalty)
- Three tiers upward (e.g., beginner → power): 0.0 score (100% penalty)
- Downward errors: 0.8 score (20% penalty)

This encodes the product policy that over-exposure is worse than under-exposure, and it reinforces the conservatism prior structurally in the evaluation metric, not just in the prompt.

### 7.5 Downstream Impact Scoring

We moved beyond local accuracy to evaluate whether misclassification caused downstream harm:

- Did wrong classification cause wrong feature exposure?
- Did that cause wrong planning mode?
- Did that degrade plan quality?

This turns the system into a true policy optimizer, not just a classifier evaluator. We track directional impact:

- `upward_risk`: Over-exposure danger (beginner → intermediate, advanced → power)
- `downward_loss`: Missed capability (power → advanced, intermediate → beginner)

And severity: none, low, medium, high. This allows us to distinguish harmless conservatism from harmful missed unlocks.

---

## 8. Cross-Family Policy Testing

Individual family evaluation is necessary but insufficient. A user classified as "advanced" by the feature exposure model should receive appropriate planning mode, prioritization behavior, and clarification policy. If the classification is wrong, the downstream decisions compound the error.

We added cross-family policy tests that evaluate multiple decisions together on a single user context:

1. Classify user maturity (feature exposure)
2. Choose feature exposure policy (feature exposure)
3. Choose planning mode (feature exposure → plan_from_goal)
4. Prioritize tasks (prioritization)
5. Produce a plan (plan_from_goal)

Each test case includes a user context, a task list, and a goal. The expected outputs are defined for each family, and consistency is checked across families. For example, a beginner user should not be routed to automation/bulk planning mode, and a plan generated for a beginner should not assume advanced feature usage.

Results:

| Stage | Consistency | Key Change |
|-------|-------------|------------|
| Before conservatism prior | 2/5 (40%) | LLM over-classifies upward |
| After conservatism prior | 4/5 (80%) | Prompt instructions reduce over-classification |
| After hard gating | 5/5 (100%) | Structural constraints eliminate remaining errors |

The remaining errors after hard gating were all LLM parsing issues on edge cases (very low activity + high capability combinations), not gating issues. The gating logic itself was correct in all cases.

---

## 9. Boundary Sharpening

The hardest classification boundary is between "advanced" and "power" users. Both are highly engaged, both use many features, but the distinction matters: power users receive automation capabilities, bulk operations, and API access, which are inappropriate for advanced users who are not yet ready for system-level control.

We sharpened this boundary with three changes.

**Explicit Definition.** We made the distinction explicit in the prompt:

- Advanced = consistently uses features correctly, organizes well, uses planning. Good users who work within the system.
- Power = uses automation/rules, bulk operations, integrations, system optimization. System-level users who change the system's behavior.
- High engagement or frequent usage alone is insufficient for power classification.

**Automation Signals.** We added an `automation_signals` field to the output schema, computed deterministically from user behavior:

- `recurring_tasks_repeated`: Recurring tasks used 5+ times
- `bulk_edits_used`: Bulk edits feature used
- `automation_rules_used`: Automation rules feature used
- `custom_automations_used`: Custom automations feature used
- `api_access_used`: API access feature used

No automation signals → cannot be power. Weak automation signals (≤1) → advanced at most. Strong automation signals (≥2) → power user candidate.

**Gate 4 Exception.** We added an exception to Gate 4 (no recurring tasks → intermediate at most): users with advanced features (dependencies, goals) and medium/high capability can be classified as advanced even without repeated recurring task usage. This prevents the gate from overcorrecting on users who demonstrate advanced capability through feature depth rather than recurring task usage.

---

## 10. Hard Gating Validation Plan

We defined a formal validation plan to prove that hard gating improves real-world outcomes without materially increasing missed advanced unlocks. The plan is structured around four milestones.

### 10.1 Holdout Design

We created 30 ambiguous holdout cases near tier boundaries where false conservatism is most likely to hide:

| Slice | Boundary | Cases | Criteria |
|-------|----------|-------|----------|
| INT-ADV | Intermediate / Advanced | 10 | Uses some advanced features but not consistently |
| ADV-PWR | Advanced / Power | 10 | Uses automation features but not power features |
| HIGH-ACT-LOW-CAP | High activity / Low capability | 5 | High task volume but shallow feature usage |
| LOW-ACT-HIGH-CAP | Low activity / High capability | 5 | Low task volume but deep feature usage |

Each case tracks computed signals, expected segment, raw LLM segment, and gated segment. Holdout cases are never used for prompt optimization or gate tuning; access is logged and rate-limited.

### 10.2 Gate Metrics

We track:

- Gate hit-rate by gate (target 5-15%, alert >30%)
- Gate hit-rate by slice
- Pre-gate vs post-gate label
- Score delta from each override
- Downstream impact after override
- `raw_gate_firings`: total times each gate fires
- `unique_case_overrides`: number of distinct cases where at least one gate fired

Health checks:

- No single gate should account for >40% of all overrides (only meaningful with >5 overrides)
- Distribution-based alert: if `max_gate_share > 2x median_gate_share`, alert for review

### 10.3 Counterfactual Baseline

We compute explicit counterfactual metrics comparing LLM-only vs gated behavior:

| Metric | LLM-Only | Gated | Delta |
|--------|----------|-------|-------|
| Accuracy | accuracy_llm_only | accuracy_gated | gated - llm |
| Overexposure rate | overexposure_llm_only | overexposure_gated | llm - gated |
| False conservatism | N/A | false_conservatism_gated | N/A |
| Avg regret | avg_regret_llm_only | avg_regret_gated | llm - gated |
| Net regret delta | — | — | avg_regret_llm_only - avg_regret_gated |

Safety gain is computed as:

```
if overexposure_llm_only == 0:
    safety_gain = 0.0  # No overexposure to reduce; metric undefined
else:
    safety_gain = (overexposure_llm_only - overexposure_gated) / overexposure_llm_only
```

Target: >50% reduction in overexposure errors.

### 10.4 Policy Regret

We compute policy regret as the difference between optimal and actual plan scores:

```
regret = optimal_plan_score - actual_plan_score
```

Where `optimal_plan_score` is benchmark-defined using the expected segment as the policy oracle (not a claim of globally optimal user utility), and `actual_plan_score` uses the gated segment.

Target: `avg_regret_gated <= avg_regret_llm_only`. This answers whether gating improved or degraded overall decision quality.

### 10.5 False Conservatism

False conservatism occurs when:

1. Expected segment is advanced or power (user is ready for advanced features)
2. Gating forced the final label lower than expected
3. Downstream impact indicates missed capability, not reduced risk

We distinguish three categories:

| Type | Expected | Actual | Impact | Action |
|------|----------|--------|--------|--------|
| missed_capability | advanced/power | lower | medium/high | Review gate |
| near_miss_unlock | advanced/power | lower | low | Monitor, no action |
| safe_downgrade | advanced/power | lower | none | Appropriate |

The refined denominator is:

```
false_conservatism_rate = false_conservatism_count / cases_where_gating_intervened_on_advanced_power
```

Target: <10% false conservatism rate on ambiguous holdout slice. Alert threshold: >20% triggers gate review.

### 10.6 Deterministic Unlock Criteria

We use numeric/ordinal enums in implementation to avoid string comparison ambiguity:

```python
SEGMENT = {"beginner": 0, "intermediate": 1, "advanced": 2, "power": 3}
CAPABILITY = {"low": 0, "medium": 1, "high": 2}

meets_advanced_criteria = (
    capability_score >= CAPABILITY["medium"]
    and recurring_tasks_used >= 5
    and feature_depth >= 3
)

meets_power_criteria = (
    capability_score >= CAPABILITY["high"]
    and automation_signals >= 2
    and power_features_used >= 1
)
```

---

## 11. Portfolio Governance and Tiering

The seven benchmark families are aggregated into a portfolio layer with weighted contributions and tiered governance.

### 11.1 Tiered Constraints

Not all families are equal. We enforce a decision hierarchy:

| Tier | Enforcement Level | Metric Impact | Example |
| :--- | :--- | :--- | :--- |
| **Tier 1** | Hard Gate | Zero tolerance for regression | Feature exposure classification accuracy cannot drop |
| **Tier 2** | Soft Gate | Must be Δ ≥ 0 | Prioritization quality must improve or stay neutral |
| **Tier 3** | Advisory | Δ ± 10% acceptable | Task rewriting quality can fluctuate within bounds |

This prevents improvements in "nice outputs" (Tier 3) from masking regressions in core UX policy (Tier 1). A change that improves task rewriting quality but degrades feature exposure classification is rejected.

### 11.2 Cross-Family Consistency with Gated Segment

Downstream families consume the gated segment, not the raw LLM segment. In cross-family policy tests, the planning mode is selected based on the gated segment, and the plan is evaluated against that mode. The raw LLM segment is logged for analysis but not used for policy decisions.

### 11.3 Meta-Dimension Mapping

Family-specific dimensions (45 total) are mapped to 6 meta-buckets for portfolio-level interpretation:

| Meta-Dimension | Description | Families Contributing |
|----------------|-------------|----------------------|
| Correctness | Output matches expected behavior | All 7 families |
| Compliance | Follows required format/constraints | All 7 families |
| Robustness | Quality under variation/edge cases | 5 families |
| Reasoning | Justification and decision quality | 4 families |
| Safety | Avoids dangerous/irreversible actions | 3 families |

This allows portfolio-level questions: did this prompt improve correctness broadly? Are we regressing on robustness across multiple families? Are gains coming from compliance rather than reasoning?

---

## 12. Operationalization and CI / Nightly Evaluation

The system is operationalized through CI workflow integration, nightly evaluation, and grader calibration.

### 12.1 CI Workflow

A GitHub Actions workflow runs on PRs affecting eval-lab or AI services:

1. Install Python dependencies
2. Run full portfolio evaluation
3. Check against baseline on PRs (CI regression gate)
4. Upload results as artifacts (30-day retention)

The CI regression gate checks:

- Aggregate regression ≤ 0.020
- Family regression ≤ 0.050
- Safety: zero tolerance
- Error rate increase ≤ 0.05
- Grader error rate ≤ 0.10
- Holdout delta ≤ 0.030

If any check fails, the PR is blocked.

### 12.2 Nightly Evaluation

A nightly runner executes the full portfolio with the baseline prompt, compare to the previous night's results, and alert on regressions. Alerts are sent via Slack webhook for:

- Aggregate regression > 0.020
- Family regression > 0.050
- Grader error rate increase > 0.05
- Safety regression (any decrease)

### 12.3 Grader Calibration

LLM graders are calibrated against human review:

1. Sample 10 cases stratified by difficulty
2. Run LLM grader on sampled cases
3. Simulate human review with predefined ground truth scores
4. Compare LLM vs human labels
5. Produce calibration report with trust level

Trust levels:

- `not_trusted`: Grader error rate too high
- `not_yet_trusted`: LLM error rate OK, but human review not completed
- `trusted_for_reporting`: Human agreement OK, LLM error rate < 10%
- `trusted_for_gating`: All thresholds met, safe for CI gating

The structured extraction family is currently `trusted_for_gating` with 70.0% LLM vs human agreement (threshold: 60%) and 0.0% LLM error rate (threshold: 5% for gating).

---

## 13. Results and Current State

### 13.1 Validation Results

| Milestone | Description | Target | Actual | Status |
|-----------|-------------|--------|--------|--------|
| 1 | Holdout Validation | >90% accuracy | 93.3% (28/30) | ✅ |
| 2 | Gate Distribution | No dominance | No dominance | ✅ |
| 3a | Counterfactual Baseline | Safety gain >50% | 100.0% | ✅ |
| 3b | Policy Regret | Regret improved | Yes (+0.033) | ✅ |
| 4 | False Conservatism | <10% | 0.0% (0/1) | ✅ |

Per-slice accuracy:

| Slice | Accuracy | Status |
|-------|----------|--------|
| INT-ADV | 100.0% (10/10) | ✅ |
| ADV-PWR | 100.0% (10/10) | ✅ |
| HIGH-ACT-LOW-CAP | 100.0% (5/5) | ✅ |
| LOW-ACT-HIGH-CAP | 60.0% (3/5) | ⚠️ |

Two edge cases in LOW-ACT-HIGH-CAP return "unknown" segment due to LLM confusion on very low activity (15-18 days, 20-25 tasks) combined with advanced/power feature usage. These are LLM parsing issues, not gating issues.

### 13.2 Counterfactual Results

| Metric | LLM-Only | Gated | Delta |
|--------|----------|-------|-------|
| Accuracy | 90.0% | 93.3% | +3.3% |
| Overexposure rate | 3.3% | 0.0% | -3.3% |
| Safety gain | — | — | 100.0% |
| Avg regret | 0.200 | 0.167 | -0.033 |

### 13.3 Gate Distribution

| Metric | Value |
|--------|-------|
| Total cases | 30 |
| Total overrides | 1 |
| Median gate share | 3.3% |
| Max gate share | 3.3% |
| Distribution alert | No |
| Dominance alert | No |

### 13.4 False Conservatism

| Metric | Value |
|--------|-------|
| Advanced/power cases | 19 |
| Gated on advanced/power | 1 |
| False conservatism count | 0 |
| Near-miss unlock count | 0 |
| Safe downgrade count | 1 |
| False conservatism rate | 0.0% |

### 13.5 What Is Established

- The architecture has been built and validated on benchmark and holdout slices.
- Cross-family consistency improved from 40% to 100% through conservatism prior and hard gating.
- Catastrophic overexposure errors were eliminated on tested slices.
- Hard gating is effective on current benchmark and holdout slices.
- The system is operationally trustworthy for benchmark-driven decisions.

### 13.6 What Is Not Yet Fully Proven

- Long-term live product impact (adoption velocity, confusion rates, retention by tier).
- The full tradeoff between safety gain and unlock loss in production.
- Whether gates remain well-calibrated as the product evolves and new features are added.
- Generalization to user populations outside the current benchmark distribution.

---

## 14. Limitations

**Benchmark vs Live Outcomes.** All validation results are from benchmark and holdout cases, not live product usage. The system is designed to reduce overexposure and improve decision quality, but the actual impact on adoption velocity, confusion rates, and retention has not been measured in production.

**Holdout Coverage.** The 30-case ambiguous holdout slice covers the most common boundary conditions (INT-ADV, ADV-PWR, HIGH-ACT-LOW-CAP, LOW-ACT-HIGH-CAP), but it does not cover all possible edge cases. Users with unusual behavior patterns (e.g., very high activity with no feature depth, or very low activity with deep feature usage) may not be well represented.

**Gate Stability.** The eight structural gates are tuned on the current benchmark distribution. As the product evolves and new features are added, the gates may need to be re-tuned. The quarterly relabel audit and live-to-benchmark backfill process is designed to address this, but it has not yet been executed.

**LLM Parsing Edge Cases.** Two cases in the LOW-ACT-HIGH-CAP slice return "unknown" segment due to LLM confusion on very low activity combined with high capability. This is an LLM parsing issue, not a gating issue, but it indicates that the LLM classifier is not robust to all input distributions. If the LLM returns "unknown" and the policy applies the conservatism prior, these users would default to "beginner"—which would be a product failure for infrequent but sophisticated users (e.g., a power user who logs in once a week to run a complex API script). We plan to implement a heuristic fallback: if the LLM returns "unknown" but the user has power features in their usage history (automation_rules, api_access, custom_automations), classify as "power" regardless of activity level. This fallback has not yet been implemented or validated.

**Policy Regret Proxy.** The policy regret metric uses `optimal_plan_score` as a benchmark proxy, which is defined using the expected segment as the policy oracle. This is not a claim of globally optimal user utility; it is a benchmark-defined reference point. The true impact of gating on user outcomes can only be measured through live product experiments.

**Computational Trade-offs.** The validation stack introduces latency and cost overhead that has not been fully measured in production. Each portfolio evaluation requires 170 LLM calls (one per case), plus additional calls for cross-family policy tests and holdout validation. On gpt-4o-mini, a full portfolio run takes approximately 8-12 minutes and costs $0.15-$0.25. On gpt-4o, this increases to 15-20 minutes and $1.50-$2.50. The hard gating layer adds negligible latency (<50ms per case, deterministic), but the LLM classification step remains the bottleneck. For CI integration, we run a reduced portfolio (50 cases) to keep PR check times under 3 minutes. The cost-quality tradeoff of model selection for Tier 1 families (which cannot regress) is an open question: locking to gpt-4o for Tier 1 families would improve accuracy but increase cost by 10x. We have not yet determined whether the accuracy gain justifies the cost increase for production routing decisions.

---

## 15. Future Work

**Live Cohort Validation.** The next step is to validate the system against live product outcomes: time-to-first-advanced, time-to-first-power, advanced feature adoption rate, feature confusion rate, feature abandonment rate, support tickets per feature, unlock latency, false delay rate, and retention by gated tier. This will establish whether the benchmark results generalize to production.

**Criteria Drift Monitoring.** As the product evolves, the criteria for "advanced" and "power" may shift. We plan to implement a quarterly relabel audit and live-to-benchmark backfill process to detect and correct for criteria drift. This is the most likely long-term failure mode once the system starts evolving.

**Expanded Holdout Coverage.** We plan to expand the ambiguous holdout slice to cover additional edge cases: users with sporadic usage patterns, users who switch between behavior modes, and users who engage with the product through non-standard workflows.

**Fallback Classifier.** For cases where the LLM returns "unknown" segment, we plan to implement a fallback classifier based on deterministic signals alone. This would ensure that all users receive a valid classification, even when the LLM is uncertain.

**Multi-Model Comparison.** The system has been used to compare gpt-4o-mini vs gpt-4o under the same evaluation portfolio. We plan to expand this to include additional models and to evaluate whether model improvements translate to portfolio-level gains.

**Compound Workflow Evaluation.** We plan to add compound workflow evaluations that test the full decision pipeline end-to-end: classify user → choose feature exposure → choose planning mode → prioritize → plan. This will measure whether the pieces work well as a system, not just in isolation.

**Gate Specification Language.** We are exploring a DSL for gate definitions that can be validated automatically, enabling automated gate validation, diff-based review, and automatic test case generation. The long-term direction is auto-generated gates from declarative policy specifications, but this is research-grade, not production-ready.

---

## 16. Conclusion

We built a benchmark-driven, policy-constrained AI decision platform that combines LLM reasoning, deterministic evaluation, and structural policy constraints to produce safe, consistent, and high-quality product decisions. The system's most important architectural shift was moving from prompt-only behavior shaping to a three-layer decision stack where grounded signals are computed first, structural policy constraints are applied, and the LLM reasons within those bounds.

Validation results on 30 ambiguous holdout cases show 93.3% overall accuracy, 100% safety gain (overexposure reduced from 3.3% to 0.0%), improved policy regret (+0.033 net delta), and 0.0% false conservatism with a refined denominator. Cross-family policy consistency improved from 40% to 100% through the combination of a conservatism prior and hard gating.

The system is operationally trustworthy for benchmark-driven decisions. The remaining work is primarily instrumentation, cohort design, and disciplined live measurement—not framework design. The key contribution is not better prompts, but the shift from prompt-only behavior shaping to policy-constrained reasoning.

---

## Glossary

| Term | Definition |
|------|------------|
| **Activity Level** | Usage volume: days active, tasks created, planning sessions. A bad proxy for maturity on its own. |
| **Advanced User** | Consistently uses features correctly, organizes well, uses planning. Works within the system. |
| **Automation Signals** | Deterministic signals from actual automation feature usage: recurring tasks repeated (5+), bulk edits, automation rules, custom automations, API access. |
| **Benchmark Family** | A set of evaluation cases testing a specific AI capability, with defined dimensions and scoring weights. |
| **Capability Level** | Feature usage depth: how well the user uses the system at each tier (core, intermediate, advanced, power). A good proxy for maturity. |
| **Conservatism Prior** | Prompt instructions to prefer lower exposure when signals conflict, reducing upward over-classification. |
| **Counterfactual Baseline** | Comparison of LLM-only vs gated behavior to ground safety gain and accuracy delta metrics. |
| **Cross-Family Policy Test** | Evaluation of multiple decisions together on a single user context, testing consistency across families. |
| **Downstream Impact** | Evaluation of whether misclassification caused wrong feature exposure, wrong planning mode, or degraded plan quality. |
| **Eval-Lab** | The benchmark and evaluation platform underlying the system. |
| **False Conservatism** | When gating forces a user to a lower segment than expected, and downstream impact indicates missed capability rather than reduced risk. |
| **Feature Exposure** | The policy problem of determining what features a user should see based on their maturity level. |
| **Hard Gating** | Structural constraints applied post-LLM that the LLM cannot override. Converts soft behavioral distinctions into structural constraints. |
| **Holdout** | A set of cases never used for optimization, used to detect overfitting. |
| **Meta-Dimension** | A portfolio-level bucket (correctness, compliance, robustness, reasoning, safety) that groups family-specific dimensions. |
| **Near-Miss Unlock** | A conservative downgrade with only low downstream harm. Distinguished from missed capability. |
| **Policy Regret** | The difference between optimal plan score (using expected segment) and actual plan score (using gated segment). |
| **Portfolio Layer** | Aggregation of benchmark family scores with weighted contributions and tiered governance. |
| **Power User** | Uses automation/rules, bulk operations, integrations, system optimization. A system-level user who changes the system's behavior. |
| **Safety Gain** | Reduction in overexposure rate from LLM-only to gated, normalized by LLM-only overexposure rate. |
| **Tier 1/2/3** | Portfolio governance tiers: Tier 1 cannot regress, Tier 2 must improve or stay neutral, Tier 3 can fluctuate within bounds. |
