# Eval-Lab: Internal Agent Evaluation Platform

A comprehensive evaluation platform for AI agent quality, enabling benchmark-driven development, CI gating, and continuous quality monitoring.

## Overview

Eval-Lab provides:
- **6 benchmark families** covering critique, transformation, planning, decision policy, prioritization, and extraction
- **150 benchmark cases** with stratified dev/test/holdout splits
- **38 family-specific dimensions** mapped to 6 meta-buckets
- **Portfolio aggregation** with cross-family comparison
- **CI regression gates** with configurable guardrails
- **Production failure ingestion** pipeline
- **Nightly automation** with Slack alerts
- **LLM grader calibration** with human review workflow

## Quick Start

```bash
cd eval-lab

# Run full portfolio
python run_portfolio.py

# Run with specific prompt
python run_portfolio.py --prompt best

# Run CI regression gate
python run_portfolio.py --ci-gate baseline.json

# Compare two runs
python run_portfolio.py --compare previous_run.json

# Audit grader registry
python run_portfolio.py --grader-audit
```

## Benchmark Families

| Family | Cases | Dimensions | Core Question |
|--------|-------|------------|---------------|
| task_critic | 30 | 4 | How well-defined is this task? |
| task_rewriter | 20 | 6 | Can we improve it without changing intent? |
| plan_from_goal | 20 | 8 | Can we decompose a goal into a realistic plan? |
| clarification_policy | 20 | 5 | Ask, proceed, or refuse? |
| prioritization | 20 | 5 | What matters most and in what order? |
| structured_extraction | 20 | 5 | Can we extract tasks from unstructured text? |

## Portfolio Metrics

The portfolio reports:
- **Weighted score**: Family-weighted aggregate (0-1)
- **Semantic coverage**: % of cases successfully graded
- **Grader error rate**: % of cases with grader failures
- **Cost/latency**: Total and per-family breakdown
- **Meta-dimension averages**: correctness, compliance, robustness, reasoning, safety

## CI Integration

The CI regression gate checks:
- Aggregate regression ≤ 0.020
- Family regression ≤ 0.050
- Safety: zero tolerance
- Error rate increase ≤ 0.05
- Grader error rate ≤ 0.10
- Holdout delta ≤ 0.030

## Calibration

LLM graders are calibrated against human review:

```bash
# Run calibration on a family
python calibrate.py --family structured_extraction --reviewers alice bob --sample-size 10

# Run end-to-end calibration with actual extraction
python run_calibration_e2e.py
```

Trust levels:
- `not_trusted`: Grader error rate too high
- `not_yet_trusted`: LLM error rate OK, but human review not completed
- `trusted_for_reporting`: Human agreement OK, LLM error rate < 10%
- `trusted_for_gating`: All thresholds met, safe for CI gating

## Production Ingestion

Accept failure reports from production:

```bash
# Ingest a failure report
python ingest.py ingest --source support_ticket --file ticket.json

# List queued cases
python ingest.py list

# Approve a case for benchmark inclusion
python ingest.py approve case-001 --family structured_extraction

# Reject a case
python ingest.py reject case-001 --reason "not reproducible"
```

## Nightly Automation

Run portfolio nightly with alerts:

```bash
python nightly_runner.py --slack-webhook-url https://hooks.slack.com/...
```

## Architecture

```
eval-lab/
├── framework/
│   ├── schemas.py          # Core data models
│   ├── hardening.py        # Holdout, CI gate, grader registry
│   └── evaluators.py       # LLM graders, significance testing, human review
├── families/               # Benchmark family implementations
├── tasks/                  # Benchmark cases
├── portfolio.py            # Portfolio aggregation and comparison
├── run_portfolio.py        # CLI runner
├── calibrate.py            # Calibration workflow
├── run_calibration_e2e.py  # End-to-end calibration runner
├── ingest.py               # Production failure ingestion
└── nightly_runner.py       # Nightly automation
```

## Meta-Dimensions

Family-specific dimensions are mapped to 6 meta-buckets:

| Meta-Dimension | Description | Families Contributing |
|----------------|-------------|----------------------|
| correctness | Output matches expected behavior | All 6 families |
| compliance | Follows required format/constraints | All 6 families |
| robustness | Quality under variation/edge cases | 5 families |
| reasoning | Justification and decision quality | 4 families |
| safety | Avoids dangerous/irreversible actions | 3 families |

## Thresholds

Calibration thresholds (configurable in `calibrate.py`):

| Threshold | Value | Purpose |
|-----------|-------|---------|
| min_human_agreement_kappa | 0.4 | Tolerance-based reviewer agreement |
| min_llm_vs_human_agreement | 0.6 | LLM vs human score agreement |
| max_grader_error_rate | 0.10 | 10% max for reporting trust |
| max_grader_error_rate_for_gating | 0.05 | 5% max for gating trust |
| min_reviewed_cases | 10 | Minimum cases for trust assignment |

## Current Status

- **Trust level**: structured_extraction is `trusted_for_gating`
- **LLM vs human agreement**: 70.0% (threshold: 60%)
- **LLM error rate**: 0.0% (threshold: 5% for gating)

## Contributing

To add a new benchmark family:
1. Create family implementation in `families/`
2. Add cases to `tasks/`
3. Register in `portfolio.py` FAMILY_REGISTRY
4. Add weights to DEFAULT_FAMILY_WEIGHTS
5. Create LLM grader config in `calibrate.py`
6. Run calibration to establish trust level
