#!/usr/bin/env python3
"""Generate benchmark case files for cases 12-30."""
import json
import os

CASES = [
    {
        "id": "012",
        "input": {"title": "Prepare Q4 board presentation deck with updated metrics", "description": "Include revenue, growth, burn rate, and hiring plan. Board meeting is next Thursday.", "dueDate": "2026-04-10T00:00:00Z", "priority": "urgent"},
        "expected": {"quality_score": 80.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["audience_context", "backup_slides"], "notes": "Strong task — clear deliverable, deadline, scope. Minor: could specify deck format and who reviews first."}
    },
    {
        "id": "013",
        "input": {"title": "fix the thing that's broken", "description": "You know what I mean", "dueDate": None, "priority": None},
        "expected": {"quality_score": 10.0, "quality_band": "low", "category": "vague", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["specificity", "identification", "scope"], "notes": "Extremely vague. No identifiable task, no context, no deadline. Lowest possible score."}
    },
    {
        "id": "014",
        "input": {"title": "Set up CI/CD pipeline for the new microservice using GitHub Actions with Docker builds, ECR pushes, ECS deployments, blue-green strategy, canary analysis, automated rollbacks, Slack notifications, and Datadog monitoring dashboards", "description": "The architecture doc is in Confluence. Talk to the infra team about their standards. Also make sure we have proper IAM roles, security groups, VPC config, and load balancer setup. Oh and don't forget the Terraform modules.", "dueDate": "2026-06-01T00:00:00Z", "priority": "high"},
        "expected": {"quality_score": 30.0, "quality_band": "low", "category": "over-specified", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["split_tasks", "phased_approach", "focus"], "notes": "This is a multi-week project disguised as a single task. Should be split into: design, CI/CD basics, deployment strategy, monitoring, IaC."}
    },
    {
        "id": "015",
        "input": {"title": "Schedule dentist appointment for annual cleaning", "description": "Prefer morning slots. Check if Delta Dental insurance is still valid.", "dueDate": "2026-04-15T00:00:00Z", "priority": "low"},
        "expected": {"quality_score": 85.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["contact_info", "insurance_card"], "notes": "Excellent personal task — specific action, preference, deadline, insurance context. Minor: could include dentist phone number."}
    },
    {
        "id": "016",
        "input": {"title": "research", "description": None, "dueDate": None, "priority": None},
        "expected": {"quality_score": 10.0, "quality_band": "low", "category": "vague", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["topic", "purpose", "scope"], "notes": "Single word with no context. Research what? For what purpose? Lowest score."}
    },
    {
        "id": "017",
        "input": {"title": "Write integration tests for the payment processing module covering Stripe webhook handling, refund flow, subscription upgrades, proration calculations, failed payment retries, and dunning management with proper mock fixtures", "description": "Current test coverage is 40%. Need to get to 80%. Use the existing test utilities in tests/helpers/. Make sure to test both success and failure paths for each endpoint. Also add performance benchmarks for the webhook handler since it processes 10k+ events/day.", "dueDate": "2026-04-20T00:00:00Z", "priority": "high"},
        "expected": {"quality_score": 55.0, "quality_band": "mid", "category": "over-specified", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["split_by_feature", "coverage_target", "priority_ordering"], "notes": "Good context but too many sub-tasks in one. Should split: webhook tests, refund flow, subscription tests, performance tests. Coverage target and deadline are good."}
    },
    {
        "id": "018",
        "input": {"title": "Submit expense report for March client dinner", "description": "Receipt attached. $127.50 at Nobu with Acme Corp team. Project code: ACME-2026-Q1.", "dueDate": "2026-04-05T00:00:00Z", "priority": "medium"},
        "expected": {"quality_score": 90.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["approval_workflow", "submission_portal"], "notes": "Excellent — specific action, amount, context, project code, deadline. Nearly perfect expense task."}
    },
    {
        "id": "019",
        "input": {"title": "update docs", "description": "the readme is outdated", "dueDate": None, "priority": "low"},
        "expected": {"quality_score": 30.0, "quality_band": "low", "category": "vague", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["specific_sections", "what_changed", "deadline"], "notes": "Too vague. Which docs? What's outdated? No deadline. 'Update docs' could mean anything from typos to full rewrite."}
    },
    {
        "id": "020",
        "input": {"title": "Migrate user authentication from session-based to JWT with refresh token rotation", "description": "Current session store is causing scaling issues. New flow: login returns access token (15min) + refresh token (7d). Refresh endpoint rotates tokens and invalidates old ones. Update all API clients to handle 401 + refresh flow.", "dueDate": "2026-05-01T00:00:00Z", "priority": "high"},
        "expected": {"quality_score": 70.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["rollback_plan", "client_coordination", "testing_strategy"], "notes": "Good technical task — clear goal, approach, deadline. Could benefit from: migration strategy, rollback plan, client coordination."}
    },
    {
        "id": "021",
        "input": {"title": "Plan team offsite for Q2", "description": "Need venue, agenda, activities, catering. Budget $5k. 12 people. Somewhere in the Bay Area. Preferably outdoors since it'll be spring.", "dueDate": "2026-05-15T00:00:00Z", "priority": "medium"},
        "expected": {"quality_score": 65.0, "quality_band": "mid", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["date_options", "dietary_restrictions", "transportation"], "notes": "Good context — budget, headcount, location preference, season. Could add: date options, dietary restrictions, transportation plan."}
    },
    {
        "id": "022",
        "input": {"title": "Do the thing we talked about", "description": None, "dueDate": None, "priority": None},
        "expected": {"quality_score": 10.0, "quality_band": "low", "category": "vague", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["identification", "context", "actionability"], "notes": "Completely unactionable without external context. 'The thing' could be anything. Lowest possible score."}
    },
    {
        "id": "023",
        "input": {"title": "Review and approve the new brand guidelines document from the design team before the stakeholder meeting on Monday", "description": "The design team sent v3 of the brand guidelines. Need to check: logo usage, color palette, typography, tone of voice, and social media templates. Meeting is Monday 10am with CEO and CMO. Send feedback by Friday EOD so design team has weekend to incorporate changes.", "dueDate": "2026-04-11T00:00:00Z", "priority": "high"},
        "expected": {"quality_score": 75.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["review_checklist", "document_location"], "notes": "Strong task — clear deliverable, review criteria, stakeholder context, deadline. Minor: could link to the document."}
    },
    {
        "id": "024",
        "input": {"title": "Implement the new recommendation engine using a collaborative filtering approach with matrix factorization, incorporating user-item interaction data from the past 90 days, with A/B testing framework, offline evaluation metrics (NDCG@10, coverage, diversity), online metrics (CTR, conversion rate), feature flags for gradual rollout, and monitoring dashboards for model drift detection", "description": "Current rule-based recommendations have 2% CTR. Target is 5%. Use the ML platform team's infrastructure. Training data is in the data lake at s3://ml-data/recs/. Model should retrain weekly. Latency budget is <100ms for inference. Need to support 1M+ users.", "dueDate": "2026-07-01T00:00:00Z", "priority": "high"},
        "expected": {"quality_score": 40.0, "quality_band": "mid", "category": "over-specified", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["split_phases", "milestone_definition", "success_criteria"], "notes": "This is a quarter-long ML project. Should be split into: data exploration, model development, A/B test setup, production deployment, monitoring. Good metrics and constraints but too much for one task."}
    },
    {
        "id": "025",
        "input": {"title": "Buy birthday gift for Sarah", "description": "She mentioned liking candles and books. Budget $40. Birthday is April 20.", "dueDate": "2026-04-18T00:00:00Z", "priority": "medium"},
        "expected": {"quality_score": 80.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["delivery_timeline", "specific_recommendations"], "notes": "Good personal task — recipient, preferences, budget, deadline. Clear and actionable."}
    },
    {
        "id": "026",
        "input": {"title": "something about the API", "description": "the api is slow and we should probably do something about it maybe look into it when you have time", "dueDate": None, "priority": None},
        "expected": {"quality_score": 15.0, "quality_band": "low", "category": "vague", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["specificity", "measurement", "priority"], "notes": "Vague concern disguised as a task. No specific API, no metrics, no deadline, no priority. 'When you have time' means never."}
    },
    {
        "id": "027",
        "input": {"title": "Conduct user research interviews with 5 power users about the new dashboard redesign", "description": "Prepare interview guide with 8-10 questions. Focus on: navigation ease, information hierarchy, feature discoverability, and overall satisfaction. Record sessions (with consent). Synthesize findings into a 1-page summary by end of sprint.", "dueDate": "2026-04-18T00:00:00Z", "priority": "medium"},
        "expected": {"quality_score": 85.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["recruitment_criteria", "scheduling"], "notes": "Excellent research task — sample size, focus areas, output format, deadline. Minor: could specify recruitment criteria."}
    },
    {
        "id": "028",
        "input": {"title": "Refactor the entire codebase to use the new design system components while maintaining backward compatibility with the old components during a 3-month transition period, updating all 200+ pages, writing migration guides, training the team, and setting up deprecation warnings", "description": "The old design system is being sunset at end of year. New components are in the design-system package. Need to update every page, form, modal, and notification. Also update the component documentation site. Coordinate with the design team on any gaps in the new system.", "dueDate": "2026-09-30T00:00:00Z", "priority": "high"},
        "expected": {"quality_score": 35.0, "quality_band": "low", "category": "over-specified", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["phased_migration", "component_inventory", "team_coordination"], "notes": "Massive undertaking as a single task. Should be: component inventory, pilot migration, team training, phased rollout per page group, deprecation cleanup."}
    },
    {
        "id": "029",
        "input": {"title": "Cancel unused SaaS subscriptions", "description": "Review the finance spreadsheet for tools we pay for but nobody uses. Focus on tools over $100/month.", "dueDate": "2026-04-12T00:00:00Z", "priority": "medium"},
        "expected": {"quality_score": 70.0, "quality_band": "high", "category": "well-defined", "should_improve_title": False, "should_improve_description": False, "expected_suggestion_themes": ["approval_process", "documentation"], "notes": "Good task — clear action, data source, threshold, deadline. Could add: who approves cancellations, document what was cancelled."}
    },
    {
        "id": "030",
        "input": {"title": "??????", "description": "!!!", "dueDate": None, "priority": None},
        "expected": {"quality_score": 5.0, "quality_band": "low", "category": "edge-case", "should_improve_title": True, "should_improve_description": True, "expected_suggestion_themes": ["meaningful_content", "actionability"], "notes": "No meaningful content. Cannot be evaluated. Lowest possible score."}
    },
]

base = "/private/tmp/todos-api-eval-lab-llm/eval-lab/tasks/task-critic-quality"

for case in CASES:
    cid = case["id"]
    case_dir = f"{base}/case-{cid}"

    # input.json
    with open(f"{case_dir}/input.json", "w") as f:
        json.dump(case["input"], f, indent=2)
        f.write("\n")

    # expected.json
    with open(f"{case_dir}/expected.json", "w") as f:
        json.dump(case["expected"], f, indent=2)
        f.write("\n")

    # task.toml
    with open(f"{case_dir}/task.toml", "w") as f:
        f.write(f'[task]\nname = "task-critic-case-{cid}"\ndescription = "{case["expected"]["notes"][:80]}"\n\n[scoring]\nhuman_quality_score = {case["expected"]["quality_score"]}\nweight = 1.0\n')

    print(f"Created case-{cid}: score={case['expected']['quality_score']}, band={case['expected']['quality_band']}, category={case['expected']['category']}")

print(f"\nGenerated {len(CASES)} cases (12-30)")
