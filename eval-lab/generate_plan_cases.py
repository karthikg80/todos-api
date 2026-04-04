#!/usr/bin/env python3
"""Generate plan-from-goal benchmark cases."""
import json
import os

CASES = [
    # ── Clear goal + clear deadline ──────────────────────────────────────
    {
        "id": "001",
        "input": {
            "goal": "Prepare for AWS Solutions Architect certification exam",
            "context": "I have 6 months of cloud experience. The exam covers EC2, S3, RDS, Lambda, IAM, VPC, and CloudFormation.",
            "constraints": "Exam date is June 15. Can study 10 hours per week. Budget $200 for practice exams and courses.",
        },
        "expected": {
            "category": "clear",
            "expected_output_mode": "plan",
            "expected_step_count_range": [5, 10],
            "must_have_steps": ["assess current knowledge", "study core services", "practice exams", "hands-on labs", "review weak areas"],
            "optional_steps": ["join study group", "watch video courses", "read whitepapers"],
            "forbidden_steps": ["schedule exam for different date", "study for different certification"],
            "what_good_plan_looks_like": "Phased plan: assessment → study → practice → review. Respects June 15 deadline and 10hr/week constraint. Includes practice exams within $200 budget.",
            "common_failure_modes": ["ignores_deadline", "exceeds_budget", "too_many_steps_for_timeframe", "misses_practice_exams"],
            "acceptable_variation": "May order study topics differently. May include or omit optional steps. Must include assessment, practice, and review phases.",
            "notes": "Clear goal with specific deadline, constraints, and scope. Should produce a realistic study plan.",
        },
    },
    {
        "id": "002",
        "input": {
            "goal": "Launch a personal blog with custom domain",
            "context": "I want to write about software engineering. Prefer static site generator over CMS.",
            "constraints": "Budget $50/year for hosting. Want it live within 2 weeks.",
        },
        "expected": {
            "category": "clear",
            "expected_output_mode": "plan",
            "expected_step_count_range": [4, 8],
            "must_have_steps": ["choose platform", "set up hosting", "configure domain", "create initial content", "deploy"],
            "optional_steps": ["set up analytics", "configure CI/CD", "add custom theme"],
            "forbidden_steps": ["use WordPress", "spend more than $50"],
            "what_good_plan_looks_like": "Simple plan: choose SSG → set up hosting (GitHub Pages/Netlify) → configure domain → write first post → deploy. Respects $50/year and 2-week deadline.",
            "common_failure_modes": ["suggests_expensive_hosting", "ignores_deadline", "overly_complex_setup"],
            "acceptable_variation": "May suggest different SSGs (Hugo, Jekyll, Astro). May include or omit optional steps.",
            "notes": "Straightforward goal with clear constraints. Should produce a simple, actionable plan.",
        },
    },
    # ── Vague goal ───────────────────────────────────────────────────────
    {
        "id": "003",
        "input": {
            "goal": "Get better at coding",
            "context": None,
            "constraints": None,
        },
        "expected": {
            "category": "vague",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Asks clarifying questions: what language? what level? what goal (career, hobby, specific project)? how much time available?",
            "common_failure_modes": ["invents_specific_plan", "assumes_language", "ignores_vagueness"],
            "acceptable_variation": "Any set of clarifying questions that address language, level, goal, and time commitment is acceptable.",
            "notes": "Extremely vague goal. Should ask for clarification rather than invent a specific plan.",
        },
    },
    {
        "id": "004",
        "input": {
            "goal": "Plan a trip",
            "context": "Somewhere warm. Maybe Europe?",
            "constraints": "Not sure when yet. Budget TBD.",
        },
        "expected": {
            "category": "vague",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Asks for: destination, dates, budget, travel style, interests, group size. Cannot plan without these.",
            "common_failure_modes": ["invents_destination", "invents_dates", "invents_budget"],
            "acceptable_variation": "Any clarifying response that asks for destination, dates, and budget is acceptable.",
            "notes": "Vague goal with uncertain constraints. Should ask for specifics before planning.",
        },
    },
    # ── Constrained goal ─────────────────────────────────────────────────
    {
        "id": "005",
        "input": {
            "goal": "Migrate our monolith to microservices",
            "context": "Current monolith is a Rails app with 50k lines. Team of 4 developers. Using PostgreSQL and Redis.",
            "constraints": "Must maintain zero downtime during migration. Budget $10k for infrastructure. Complete within 6 months. Cannot hire additional developers.",
        },
        "expected": {
            "category": "constrained",
            "expected_output_mode": "plan",
            "expected_step_count_range": [6, 12],
            "must_have_steps": ["identify service boundaries", "set up infrastructure", "extract first service", "establish communication patterns", "migrate data", "test integration", "deploy incrementally"],
            "optional_steps": ["set up monitoring", "document APIs", "train team on microservices"],
            "forbidden_steps": ["big bang migration", "hire contractors", "rewrite from scratch"],
            "what_good_plan_looks_like": "Strangler fig pattern: identify boundaries → extract services one by one → maintain compatibility. Respects zero-downtime, 6-month, and team-size constraints.",
            "common_failure_modes": ["suggests_big_bang", "ignores_zero_downtime", "exceeds_budget", "suggests_hiring"],
            "acceptable_variation": "May suggest different extraction order. May include or omit optional steps. Must respect all constraints.",
            "notes": "Constrained goal with specific technical and resource limits. Should produce a phased migration plan.",
        },
    },
    # ── Oversized goal ───────────────────────────────────────────────────
    {
        "id": "006",
        "input": {
            "goal": "Build a social media platform like Twitter",
            "context": "I'm a solo developer with basic web development skills.",
            "constraints": "3 months. $500 budget. No prior experience with distributed systems.",
        },
        "expected": {
            "category": "oversized",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Acknowledges the goal is too large for the constraints. Suggests scoping down (MVP with core features only) or extending timeline. Asks what the real goal is (learning? launching a startup?).",
            "common_failure_modes": ["creates_unrealistic_plan", "ignores_constraints", "invents_team"],
            "acceptable_variation": "May suggest MVP scoping, timeline extension, or goal clarification. Should NOT produce a full Twitter clone plan.",
            "notes": "Massively oversized goal. Should flag the mismatch and suggest scoping.",
        },
    },
    {
        "id": "007",
        "input": {
            "goal": "Learn machine learning and build a production-ready recommendation system",
            "context": "I know Python basics but have no ML experience.",
            "constraints": "2 months. 5 hours per week. No budget for courses.",
        },
        "expected": {
            "category": "oversized",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Flags that learning ML + building production system in 2 months at 5hr/week is unrealistic. Suggests focusing on one: either learn ML fundamentals OR build a simple rule-based recommender.",
            "common_failure_modes": ["creates_cramped_plan", "ignores_time_constraint", "assumes_prior_knowledge"],
            "acceptable_variation": "May suggest learning-only or building-only path. Should NOT produce a full ML + production plan.",
            "notes": "Oversized goal for the constraints. Should suggest scoping down.",
        },
    },
    # ── Conflicting constraints ──────────────────────────────────────────
    {
        "id": "008",
        "input": {
            "goal": "Launch a mobile app for our restaurant",
            "context": "We want online ordering, loyalty program, and table reservations.",
            "constraints": "Must launch in 2 weeks. Budget $500. Must support iOS and Android natively.",
        },
        "expected": {
            "category": "conflicting",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Identifies the conflict: native iOS+Android with 3 features in 2 weeks for $500 is impossible. Suggests alternatives: web app, no-code platform, or extending timeline/budget.",
            "common_failure_modes": ["creates_impossible_plan", "ignores_budget", "ignores_timeline"],
            "acceptable_variation": "May suggest web app, no-code, or constraint relaxation. Should NOT produce a native app plan.",
            "notes": "Conflicting constraints. Should identify the conflict and suggest alternatives.",
        },
    },
    # ── Missing context ──────────────────────────────────────────────────
    {
        "id": "009",
        "input": {
            "goal": "Prepare for the board presentation",
            "context": "It's next month.",
            "constraints": None,
        },
        "expected": {
            "category": "missing-context",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Asks for: audience (board members' priorities), current status of key metrics, what decisions need to be made, what format is expected.",
            "common_failure_modes": ["invents_metrics", "invents_audience", "creates_generic_plan"],
            "acceptable_variation": "Any clarifying response that asks for audience, metrics, decisions, and format is acceptable.",
            "notes": "Missing critical context. Should ask for specifics before planning.",
        },
    },
    {
        "id": "010",
        "input": {
            "goal": "Set up CI/CD for our project",
            "context": "We're using GitHub. Not sure what else we need.",
            "constraints": "Should be automated. No specific deadline.",
        },
        "expected": {
            "category": "missing-context",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Asks for: tech stack, deployment target, testing strategy, team size, current pain points. Cannot plan CI/CD without knowing what to build, test, and deploy.",
            "common_failure_modes": ["assumes_tech_stack", "invents_deployment_target", "creates_generic_pipeline"],
            "acceptable_variation": "May suggest a basic GitHub Actions template while asking for specifics.",
            "notes": "Missing technical context. Should ask for stack, deployment, and testing details.",
        },
    },
    # ── Adversarial / unrealistic ────────────────────────────────────────
    {
        "id": "011",
        "input": {
            "goal": "Become a senior engineer at Google in 6 months",
            "context": "I'm currently a junior developer with 1 year of experience.",
            "constraints": "I can work 40 hours per week on this. No budget for bootcamps.",
        },
        "expected": {
            "category": "adversarial",
            "expected_output_mode": "unsupported",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Explains why this is unrealistic: Google senior roles typically require 5-10+ years of experience. Suggests a more realistic path: mid-level roles first, skill building, and longer timeline.",
            "common_failure_modes": ["creates_unrealistic_plan", "validates_unrealistic_goal", "ignores_experience_gap"],
            "acceptable_variation": "May suggest alternative companies or roles. Should NOT produce a 6-month Google senior plan.",
            "notes": "Unrealistic goal. Should explain why and suggest a realistic alternative path.",
        },
    },
    {
        "id": "012",
        "input": {
            "goal": "Make $1M in revenue from my SaaS product",
            "context": "I have an idea but no product yet.",
            "constraints": "6 months. Solo founder. No prior SaaS experience.",
        },
        "expected": {
            "category": "adversarial",
            "expected_output_mode": "unsupported",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Explains why $1M in 6 months as a solo first-time founder is extremely unlikely. Suggests realistic milestones: validate idea → build MVP → get first 10 customers → iterate.",
            "common_failure_modes": ["creates_get_rich_quick_plan", "validates_unrealistic_revenue", "ignores_lack_of_experience"],
            "acceptable_variation": "May suggest alternative revenue targets or timelines. Should NOT produce a $1M-in-6-months plan.",
            "notes": "Unrealistic revenue goal. Should explain why and suggest realistic milestones.",
        },
    },
    # ── Additional cases for coverage ────────────────────────────────────
    {
        "id": "013",
        "input": {
            "goal": "Organize a team offsite for 20 people",
            "context": "We're a remote-first engineering team. Want a mix of team building and strategic planning.",
            "constraints": "Budget $15k. 2 days. Somewhere in the US. Next quarter.",
        },
        "expected": {
            "category": "clear",
            "expected_output_mode": "plan",
            "expected_step_count_range": [5, 8],
            "must_have_steps": ["define objectives", "research venues", "plan agenda", "arrange logistics", "communicate with team"],
            "optional_steps": ["plan activities", "arrange catering", "send surveys"],
            "forbidden_steps": ["exceed $15k budget", "plan for more than 2 days"],
            "what_good_plan_looks_like": "Phased plan: objectives → venue → agenda → logistics → communication. Respects $15k budget and 2-day constraint.",
            "common_failure_modes": ["exceeds_budget", "ignores_team_size", "misses_logistics"],
            "acceptable_variation": "May order phases differently. May include or omit optional steps.",
            "notes": "Clear goal with specific constraints. Should produce a practical event planning plan.",
        },
    },
    {
        "id": "014",
        "input": {
            "goal": "Improve our team's productivity",
            "context": "We're an engineering team of 8. Sprint velocity has been declining.",
            "constraints": "No budget for consultants. Want to see results in 1 month.",
        },
        "expected": {
            "category": "vague",
            "expected_output_mode": "clarification_required",
            "must_have_steps": [],
            "optional_steps": [],
            "forbidden_steps": [],
            "what_good_plan_looks_like": "Asks for: current metrics, specific pain points, team structure, recent changes. Cannot plan productivity improvement without diagnosing the problem first.",
            "common_failure_modes": ["creates_generic_plan", "assumes_root_cause", "suggests_expensive_tools"],
            "acceptable_variation": "May suggest a diagnostic phase while asking for specifics.",
            "notes": "Vague goal with unclear root cause. Should ask for diagnosis before planning.",
        },
    },
    {
        "id": "015",
        "input": {
            "goal": "Write a technical book about distributed systems",
            "context": "I have 10 years of experience in the field. Want to share practical knowledge.",
            "constraints": "Can write 5 hours per week. Want to self-publish. Target: 200 pages.",
        },
        "expected": {
            "category": "clear",
            "expected_output_mode": "plan",
            "expected_step_count_range": [5, 10],
            "must_have_steps": ["outline chapters", "write first draft", "review and revise", "technical review", "format and publish"],
            "optional_steps": ["get beta readers", "design cover", "set up marketing"],
            "forbidden_steps": ["suggest traditional publishing", "exceed 200 pages"],
            "what_good_plan_looks_like": "Phased writing plan: outline → draft → review → publish. Respects 5hr/week constraint and 200-page target. Self-publishing focus.",
            "common_failure_modes": ["suggests_traditional_publishing", "ignores_page_limit", "unrealistic_writing_pace"],
            "acceptable_variation": "May suggest different chapter structures. May include or omit optional steps.",
            "notes": "Clear goal with specific constraints. Should produce a realistic writing plan.",
        },
    },
    {
        "id": "016",
        "input": {
            "goal": "Redesign our company website",
            "context": "Current site is 5 years old. Built on WordPress. Has 50+ pages.",
            "constraints": "Must preserve all existing URLs (SEO). Budget $5k. Launch in 6 weeks.",
        },
        "expected": {
            "category": "constrained",
            "expected_output_mode": "plan",
            "expected_step_count_range": [5, 8],
            "must_have_steps": ["audit existing content", "design new layout", "migrate content", "set up redirects", "test and launch"],
            "optional_steps": ["update branding", "improve performance", "add analytics"],
            "forbidden_steps": ["change URLs", "exceed $5k budget", "exceed 6 weeks"],
            "what_good_plan_looks_like": "Phased plan: audit → design → migrate → redirect → launch. Preserves all URLs. Respects budget and timeline.",
            "common_failure_modes": ["ignores_seo_constraint", "exceeds_budget", "misses_redirects"],
            "acceptable_variation": "May suggest different tech stacks. Must preserve URL constraint.",
            "notes": "Constrained goal with SEO requirement. Should produce a migration plan with redirect strategy.",
        },
    },
    {
        "id": "017",
        "input": {
            "goal": "Learn to play piano",
            "context": "Complete beginner. No musical background.",
            "constraints": "30 minutes per day. No budget for lessons. Want to play pop songs within 3 months.",
        },
        "expected": {
            "category": "clear",
            "expected_output_mode": "plan",
            "expected_step_count_range": [4, 8],
            "must_have_steps": ["learn basics (notes, rhythm)", "practice scales and chords", "learn simple songs", "build repertoire"],
            "optional_steps": ["use free apps", "watch YouTube tutorials", "join online communities"],
            "forbidden_steps": ["suggest paid lessons", "exceed 30 min/day"],
            "what_good_plan_looks_like": "Progressive learning plan: basics → practice → simple songs → repertoire. Uses free resources. Respects 30min/day constraint.",
            "common_failure_modes": ["suggests_paid_lessons", "unrealistic_progression", "ignores_time_constraint"],
            "acceptable_variation": "May suggest different learning resources. Must respect free and 30min/day constraints.",
            "notes": "Clear goal with specific constraints. Should produce a self-directed learning plan.",
        },
    },
    {
        "id": "018",
        "input": {
            "goal": "Reduce our cloud infrastructure costs by 50%",
            "context": "Currently spending $20k/month on AWS. Team of 3 engineers manages the infrastructure.",
            "constraints": "Cannot impact performance or reliability. Must complete within 2 months.",
        },
        "expected": {
            "category": "constrained",
            "expected_output_mode": "plan",
            "expected_step_count_range": [5, 8],
            "must_have_steps": ["audit current spending", "identify waste", "right-size resources", "implement cost controls", "monitor and optimize"],
            "optional_steps": ["negotiate reserved instances", "explore spot instances", "set up budget alerts"],
            "forbidden_steps": ["reduce performance", "impact reliability", "exceed 2 months"],
            "what_good_plan_looks_like": "Phased optimization: audit → identify waste → right-size → implement controls → monitor. Respects performance/reliability constraint.",
            "common_failure_modes": ["suggests_performance_impact", "ignores_reliability", "unrealistic_savings"],
            "acceptable_variation": "May suggest different optimization strategies. Must respect performance/reliability constraint.",
            "notes": "Constrained goal with non-negotiable performance requirement. Should produce a cost optimization plan.",
        },
    },
    {
        "id": "019",
        "input": {
            "goal": "Build a data pipeline for our analytics",
            "context": "We have data in PostgreSQL, MongoDB, and CSV files. Want a unified dashboard.",
            "constraints": "Team has no data engineering experience. Budget $2k. Prefer no-code/low-code tools.",
        },
        "expected": {
            "category": "constrained",
            "expected_output_mode": "plan",
            "expected_step_count_range": [4, 8],
            "must_have_steps": ["assess data sources", "choose integration tool", "build extraction", "transform and load", "create dashboard"],
            "optional_steps": ["set up scheduling", "add data quality checks", "document pipeline"],
            "forbidden_steps": ["suggest complex data engineering tools", "exceed $2k budget"],
            "what_good_plan_looks_like": "Simple plan using no-code/low-code tools (e.g., Airbyte, Metabase). Respects team skill level and budget.",
            "common_failure_modes": ["suggests_complex_tools", "ignores_skill_level", "exceeds_budget"],
            "acceptable_variation": "May suggest different no-code tools. Must respect skill level and budget.",
            "notes": "Constrained goal with skill level limitation. Should produce a simple, accessible plan.",
        },
    },
    {
        "id": "020",
        "input": {
            "goal": "Plan a product launch",
            "context": "We're launching a new SaaS feature. Target audience is existing customers.",
            "constraints": "Launch date is fixed: March 1. Marketing team of 2. Budget $3k.",
        },
        "expected": {
            "category": "clear",
            "expected_output_mode": "plan",
            "expected_step_count_range": [5, 8],
            "must_have_steps": ["define messaging", "prepare marketing materials", "set up launch infrastructure", "communicate with customers", "monitor and iterate"],
            "optional_steps": ["create demo video", "write blog post", "set up feedback collection"],
            "forbidden_steps": ["change launch date", "exceed $3k budget"],
            "what_good_plan_looks_like": "Phased launch plan: messaging → materials → infrastructure → communication → monitoring. Respects March 1 deadline and $3k budget.",
            "common_failure_modes": ["ignores_fixed_date", "exceeds_budget", "overwhelms_small_team"],
            "acceptable_variation": "May suggest different marketing channels. Must respect fixed date and budget.",
            "notes": "Clear goal with fixed deadline. Should produce a practical launch plan for a small team.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-plan/eval-lab/tasks/plan-from-goal-quality"

for case in CASES:
    cid = case["id"]
    case_dir = f"{base}/case-{cid}"
    os.makedirs(case_dir, exist_ok=True)

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
        f.write(f'[task]\nname = "plan-from-goal-case-{cid}"\ndescription = "{case["expected"]["what_good_plan_looks_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: category={case['expected']['category']}, mode={case['expected']['expected_output_mode']}")

print(f"\nGenerated {len(CASES)} cases")
