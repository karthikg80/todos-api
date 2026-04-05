# Hard Gating Validation Plan: Safety Gain vs Unlock Loss

## Executive Summary

This document defines the validation plan for the hard gating system in Eval-Lab's
feature exposure family. The goal is to prove that hard gating improves real-world
outcomes without materially increasing missed advanced unlocks.

**Current state:** 8 structural gates enforce policy constraints post-LLM, converting
soft behavioral distinctions into hard decision boundaries. Cross-family consistency
is 5/5 (100%), ambiguous holdout accuracy is 7/7 (100%), false conservatism rate is 0.0%.

**Validation goal:** Demonstrate that hard gating reduces overexposure without
suppressing legitimate advanced/power unlocks, making the system operationally
trustworthy for feature rollout decisions.

---

## 1. Holdout Design

### 1.1 Ambiguous Holdout Slice

Focus on users near tier boundaries where false conservatism is most likely to hide.

| Slice | Boundary | Case Count | Criteria |
|-------|----------|------------|----------|
| INT-ADV | Intermediate / Advanced | 10 | Uses some advanced features but not consistently; recurring tasks occasional (2-5x) |
| ADV-PWR | Advanced / Power | 10 | Uses automation features but not power features; or uses power features sparingly |
| HIGH-ACT-LOW-CAP | High activity / Low capability | 5 | High task volume but shallow feature usage |
| LOW-ACT-HIGH-CAP | Low activity / High capability | 5 | Low task volume but deep feature usage |

**Total: 30 ambiguous holdout cases**

### 1.2 Labeling Protocol

Each case is labeled by:
1. **Computed signals**: activity_level, capability_level, automation_signals (structural)
2. **Expected segment**: human-labeled ground truth based on feature usage depth
3. **LLM segment**: raw LLM classification before gating
4. **Gated segment**: final segment after hard gating

Labeling criteria:
- **Intermediate**: Uses due dates, projects, daily planning; recurring tasks occasional
- **Advanced**: Uses dependencies, goals, recurring tasks repeatedly (5+); no automation rules
- **Power**: Uses automation rules, bulk edits, agentic planning, or custom automations

### 1.3 Holdout Access Policy

- Holdout cases are never used for prompt optimization or gate tuning
- Access is logged and rate-limited (1x/month)
- Results are compared against dev/test to detect overfitting

---

## 2. Gate Metrics

### 2.1 Gate Hit-Rate by Gate

Track how often each of the 8 gates fires:

| Gate | Description | Target Hit Rate | Alert Threshold |
|------|-------------|-----------------|-----------------|
| Gate 1 | No automation → cannot be power | 5-15% | >30% (overcorrecting) |
| Gate 2 | High activity + low capability → intermediate | 3-10% | >20% |
| Gate 3 | Weak automation → advanced at most | 5-15% | >30% |
| Gate 4 | No recurring tasks → intermediate at most | 5-15% | >30% |
| Gate 5 | Low capability → intermediate at most | 3-10% | >20% |
| Gate 6 | Medium capability + no advanced features → intermediate | 5-15% | >30% |
| Gate 7 | Low activity + low capability → beginner at most | 5-15% | >30% |
| Gate 8 | No power features → cannot be power | 5-15% | >30% |

**Health check:** No single gate should account for >40% of all overrides.

### 2.2 Gate Hit-Rate by Slice

Track gate hits by user segment boundary:

| Slice | Expected Gate Hits | False Conservatism Target |
|-------|-------------------|--------------------------|
| INT-ADV | Gate 4, 5, 6 | <10% |
| ADV-PWR | Gate 1, 3, 8 | <10% |
| HIGH-ACT-LOW-CAP | Gate 2, 5 | <5% |
| LOW-ACT-HIGH-CAP | Gate 7 | <5% |

### 2.3 Pre-Gate vs Post-Gate Label

For each case, track:
- `llm_segment`: Raw LLM classification
- `gated_segment`: Final segment after hard gating
- `override_applied`: Whether gating changed the segment
- `override_direction`: upward (rare) or downward (common)
- `override_delta`: Tier distance changed (e.g., power→advanced = 1 tier)

### 2.4 Score Delta from Each Override

For each gating override, measure:
- `pre_gate_score`: LLM grader score before gating
- `post_gate_score`: Grader score after gating
- `score_delta`: post_gate_score - pre_gate_score
- `confidence_delta`: post_gate_confidence - pre_gate_confidence

**Expected pattern:** Overrides should reduce confidence (more conservative) and
either maintain or slightly improve accuracy (by correcting LLM errors).

### 2.5 Downstream Impact After Override

For each gating override, measure:
- `feature_exposure_correct`: Whether gated segment matches expected
- `planning_mode_correct`: Whether planning mode matches expected
- `plan_quality`: Plan score after gating
- `impact_direction`: upward_risk, downward_loss, or none
- `impact_severity`: none, low, medium, high

---

## 3. False Conservatism Metric

### 3.1 Definition

False conservatism occurs when:
1. Expected segment is advanced or power (user is ready for advanced features)
2. Gating forced the final label lower than expected
3. Downstream impact indicates missed capability, not reduced risk

### 3.2 Computation

```python
def compute_false_conservatism(expected, actual, downstream_impact):
    segment_order = ["beginner", "intermediate", "advanced", "power"]
    expected_idx = segment_order.index(expected)
    actual_idx = segment_order.index(actual)
    
    # Gating forced lower than expected
    if actual_idx < expected_idx:
        delta = expected_idx - actual_idx
        
        # Check if downstream impact indicates missed capability
        if downstream_impact.get("direction") == "downward_loss":
            severity = downstream_impact.get("severity", "none")
            if severity in ("medium", "high"):
                return {
                    "false_conservatism": True,
                    "delta": delta,
                    "severity": severity,
                    "type": "missed_capability",
                }
        
        # Conservative but not harmful (safe downgrade)
        return {
            "false_conservatism": False,
            "delta": delta,
            "severity": "safe_downgrade",
            "type": "appropriate_conservatism",
        }
    
    return {"false_conservatism": False, "delta": 0}
```

### 3.3 False Conservatism Rate

```
false_conservatism_rate = false_conservatism_count / total_advanced_power_cases
```

**Target:** <10% false conservatism rate on ambiguous holdout slice.

**Alert threshold:** >20% false conservatism rate triggers gate review.

### 3.4 Safety Gain vs Unlock Loss Tradeoff

| Metric | Formula | Target |
|--------|---------|--------|
| Safety gain | (overexposure_errors_before - overexposure_errors_after) / overexposure_errors_before | >50% reduction |
| Unlock loss | false_conservatism_count / total_advanced_power_cases | <10% |
| Net benefit | safety_gain - unlock_loss | >40% |

---

## 4. Live Outcome Measures

### 4.1 Adoption of Advanced Features

Track whether hard gating improves feature adoption velocity:

| Metric | Description | Target |
|--------|-------------|--------|
| Time-to-first-advanced | Days from signup to first advanced feature usage | <30 days |
| Time-to-first-power | Days from signup to first power feature usage | <60 days |
| Advanced feature adoption rate | % of intermediate users who adopt advanced features within 30 days | >40% |

### 4.2 Misuse/Confusion Rate

Track whether hard gating reduces feature misuse:

| Metric | Description | Target |
|--------|-------------|--------|
| Feature confusion rate | % of users who enable a feature but don't use it within 7 days | <20% |
| Feature abandonment rate | % of users who stop using a feature after 1 use | <30% |
| Support tickets per feature | Support tickets related to feature confusion per 1000 users | <5 |

### 4.3 Advanced-User Unlock Latency

Track whether hard gating delays legitimate unlocks:

| Metric | Description | Target |
|--------|-------------|--------|
| Unlock latency (advanced) | Days from meeting advanced criteria to being classified as advanced | <7 days |
| Unlock latency (power) | Days from meeting power criteria to being classified as power | <14 days |
| False delay rate | % of users who meet criteria but are not unlocked within target | <15% |

### 4.4 Retention by Gated Tier

Track whether hard gating improves retention:

| Metric | Description | Target |
|--------|-------------|--------|
| Retention (beginner) | 7-day retention for users classified as beginner | >40% |
| Retention (intermediate) | 7-day retention for users classified as intermediate | >50% |
| Retention (advanced) | 7-day retention for users classified as advanced | >60% |
| Retention (power) | 7-day retention for users classified as power | >70% |

---

## 5. Portfolio-Level Integration

### 5.1 Feature Exposure as Tier 1 Routing Authority

Feature exposure is now a Tier 1 gating family in the portfolio:

| Tier | Families | Constraint |
|------|----------|------------|
| Tier 1 (gating/safety/routing) | feature_exposure, clarification_policy | Cannot regress (hard constraint) |
| Tier 2 (decision quality) | prioritization, plan_from_goal | Must improve or stay neutral |
| Tier 3 (content quality) | task_critic, task_rewriter, structured_extraction | Can fluctuate within bounds |

### 5.2 Cross-Family Consistency with Gated Segment

Downstream families consume the **gated segment**, not the raw LLM segment:

```python
# In cross_family_policy.py
gated_segment = fe_output.get("user_segment", "unknown")
# Use gated_segment for planning mode selection, not llm_segment
```

### 5.3 Raw LLM Segment Logging

The raw LLM segment is logged for analysis but not used for policy decisions:

```python
output["llm_segment"] = llm_raw_segment  # For analysis
output["user_segment"] = gated_segment  # For policy
```

---

## 6. Validation Milestones

### Milestone 1: Holdout Validation (Week 1-2)
- [ ] Run 30 ambiguous holdout cases through hard gating
- [ ] Achieve >90% accuracy on holdout slice
- [ ] Achieve <10% false conservatism rate
- [ ] Publish gate hit-rate report with per-gate and per-slice breakdowns

### Milestone 2: Gate Distribution Analysis (Week 2-3)
- [ ] No single gate accounts for >40% of all overrides
- [ ] Gate hit rates are within target ranges
- [ ] Pre-gate vs post-gate analysis shows corrective work (not restating LLM)
- [ ] Score delta analysis shows gating improves or maintains accuracy

### Milestone 3: Live Outcome Baseline (Week 3-4)
- [ ] Establish baseline for adoption, misuse, unlock latency, retention metrics
- [ ] Compare gated vs ungated cohorts on live outcomes
- [ ] Demonstrate safety gain >50% reduction in overexposure errors
- [ ] Demonstrate unlock loss <10% false conservatism rate

### Milestone 4: Operational Trustworthiness (Week 4-6)
- [ ] Feature exposure is Tier 1 routing authority in portfolio
- [ ] Cross-family consistency uses gated segment
- [ ] Gate hit-rate report is part of nightly portfolio output
- [ ] False conservatism rate is tracked and alerted

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gates overcorrect on ambiguous users | Medium | High | Ambiguous holdout slice, false conservatism metric |
| One gate carries too much corrective work | Medium | Medium | Gate hit-rate monitoring, redistribute gate logic |
| False conservatism increases unlock latency | Low | Medium | Unlock latency tracking, gate tuning |
| Hard gating masks LLM degradation | Low | High | Log raw LLM segment, compare LLM vs gated accuracy |
| Gates become stale as product evolves | Medium | Medium | Monthly gate review, automated gate hit-rate alerts |

---

## 8. Appendix

### 8.1 Gate Definitions

| Gate | Condition | Action |
|------|-----------|--------|
| 1 | No automation signals AND LLM says power | Demote to advanced |
| 2 | High activity AND low capability AND LLM says advanced/power | Demote to intermediate |
| 3 | Weak automation (≤1 signals) AND LLM says power | Demote to advanced |
| 4 | No recurring tasks repeated AND LLM says advanced | Demote to intermediate |
| 5 | Low capability AND LLM says advanced/power | Demote to intermediate |
| 6 | Medium capability AND no advanced features AND LLM says advanced | Demote to intermediate |
| 7 | Low activity AND low capability AND LLM says intermediate+ | Demote to beginner |
| 8 | No power features AND LLM says power | Demote to advanced |

### 8.2 Signal Definitions

| Signal | Computation | Type |
|--------|-------------|------|
| activity_level | Volume-based: days, tasks, sessions | Structural |
| capability_level | Feature depth: tier usage count | Structural |
| automation_signals | Actual feature usage (recurring, bulk, automation) | Structural |

### 8.3 Segment Definitions

| Segment | Criteria |
|---------|----------|
| Beginner | First-week users, low behavioral sophistication |
| Intermediate | Uses due dates, projects, daily planning |
| Advanced | Uses dependencies, goals, recurring tasks repeatedly |
| Power | Uses automation rules, bulk ops, agentic planning, custom automations |
