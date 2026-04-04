#!/usr/bin/env python3
"""Generate task rewriter benchmark cases."""
import json
import os

CASES = [
    # ── Vague tasks ──────────────────────────────────────────────────────
    {
        "id": "001",
        "input": {"title": "work on project", "description": None, "dueDate": None, "priority": None},
        "expected": {
            "category": "vague",
            "original_quality": 15,
            "rewritten_title": "Define first concrete step for current project",
            "rewritten_description": "Identify the most impactful next action for the project. Document the specific deliverable, owner, and deadline. Definition of done: a clear, actionable task with acceptance criteria is created.",
            "what_good_rewriting_looks_like": "Acknowledges vagueness, asks for clarification or proposes a scoping task. Does NOT invent project specifics.",
            "common_failure_modes": ["invented_project", "too_specific", "missed_vague_nature"],
            "acceptable_variation": "Any title that proposes scoping/clarification is acceptable. Should NOT name a specific project.",
        },
    },
    {
        "id": "002",
        "input": {"title": "figure out taxes", "description": "Need to do something about tax filing this year", "dueDate": None, "priority": None},
        "expected": {
            "category": "vague",
            "original_quality": 25,
            "rewritten_title": "Research tax filing requirements for current year",
            "rewritten_description": "Determine what tax forms need to be filed, gather necessary documents (W-2s, 1099s, receipts), and identify filing deadline. Definition of done: a complete list of required forms and documents is compiled, and a filing plan with deadlines is created.",
            "what_good_rewriting_looks_like": "Converts vague intent into a research/scoping task. Preserves 'taxes' topic without inventing specifics about jurisdiction or amounts.",
            "common_failure_modes": ["invented_jurisdiction", "invented_deadline", "too_prescriptive"],
            "acceptable_variation": "Any title about researching/organizing tax filing is acceptable. Should not assume specific tax situation.",
        },
    },
    {
        "id": "003",
        "input": {"title": "research", "description": None, "dueDate": None, "priority": None},
        "expected": {
            "category": "vague",
            "original_quality": 10,
            "rewritten_title": "Clarify research topic and scope",
            "rewritten_description": "Identify what needs to be researched, why it matters, and what decision this research will inform. Definition of done: a one-paragraph research brief with topic, purpose, key questions, and deadline is written.",
            "what_good_rewriting_looks_like": "Recognizes single-word task is unusable. Proposes a clarification/scoping task. Does NOT invent a research topic.",
            "common_failure_modes": ["invented_topic", "too_specific", "ignored_vagueness"],
            "acceptable_variation": "Any title about clarifying research scope is acceptable.",
        },
    },
    # ── Well-defined tasks (should get minimal edits) ────────────────────
    {
        "id": "004",
        "input": {"title": "Book flights to Tokyo for March 15-22 trip", "description": "Need round-trip flights from SFO. Budget ~$1200. Prefer direct flights.", "dueDate": "2026-03-01T00:00:00Z", "priority": "high"},
        "expected": {
            "category": "well-defined",
            "original_quality": 75,
            "rewritten_title": "Book round-trip SFO-Tokyo flights for March 15-22",
            "rewritten_description": "Find and book round-trip flights from SFO to Tokyo for March 15-22. Budget: ~$1200. Preference: direct flights. Definition of done: flights are booked, confirmation email received, and calendar invite created for March 15-22.",
            "what_good_rewriting_looks_like": "Minimal edits. Preserves all facts (dates, budget, route, preference). Adds definition of done. Title is slightly more structured.",
            "common_failure_modes": ["over_edited", "changed_budget", "changed_dates", "added_unnecessary_detail"],
            "acceptable_variation": "Minor rewording is fine. All dates, budget, and route must be preserved exactly.",
        },
    },
    {
        "id": "005",
        "input": {"title": "Send Q4 board deck to Sarah by Friday", "description": "Include updated metrics from the dashboard, budget variance analysis, and the hiring plan. Sarah needs it before the Monday board meeting.", "dueDate": "2026-04-11T00:00:00Z", "priority": "urgent"},
        "expected": {
            "category": "well-defined",
            "original_quality": 80,
            "rewritten_title": "Send Q4 board deck to Sarah by Friday",
            "rewritten_description": "Compile and send Q4 board deck to Sarah before Friday. Include: (1) updated metrics from dashboard, (2) budget variance analysis, (3) hiring plan. Context: Sarah needs it before Monday's board meeting. Definition of done: deck is sent to Sarah with all three sections included, and confirmation of receipt is received.",
            "what_good_rewriting_looks_like": "Very minimal edits. Structure the description with bullet points. Add definition of done. Preserve Sarah, Friday, Monday, and all three content items exactly.",
            "common_failure_modes": ["changed_recipient", "changed_deadline", "dropped_content_item", "over_edited"],
            "acceptable_variation": "Reordering content items is fine. All names, dates, and content items must be preserved.",
        },
    },
    # ── Over-specified / noisy tasks ─────────────────────────────────────
    {
        "id": "006",
        "input": {
            "title": "Update the React component to use the new API endpoint and fix the styling issues in the header and also add dark mode support while you're at it",
            "description": "The current header looks bad on mobile and the API is slow. Also we should probably add dark mode since users have been asking for it. And maybe refactor the CSS while we're touching it.",
            "dueDate": "2026-04-15T00:00:00Z",
            "priority": "medium",
        },
        "expected": {
            "category": "over-specified",
            "original_quality": 35,
            "rewritten_title": "Split: Update React component, fix header styling, and add dark mode",
            "rewritten_description": "This task mixes three separate concerns. Recommended split:\n1. Update React component to use new API endpoint (address API slowness)\n2. Fix header styling for mobile responsiveness\n3. Add dark mode support (user-requested feature)\n\nDefinition of done for each: (1) API calls use new endpoint with improved performance, (2) header renders correctly on mobile viewports, (3) dark mode toggle works across all components.",
            "what_good_rewriting_looks_like": "Identifies the task mixes multiple actions. Splits into 3 separate tasks. Preserves the core concerns (API, header mobile, dark mode) without adding implementation detail.",
            "common_failure_modes": ["kept_as_single_task", "added_implementation_detail", "dropped_one_of_three_concerns"],
            "acceptable_variation": "May keep as single task with clear sub-sections if split is not used. All three concerns must be addressed.",
        },
    },
    {
        "id": "007",
        "input": {
            "title": "Implement the new recommendation engine using a collaborative filtering approach with matrix factorization, incorporating user-item interaction data from the past 90 days, with A/B testing framework, offline evaluation metrics (NDCG@10, coverage, diversity), online metrics (CTR, conversion rate), feature flags for gradual rollout, and monitoring dashboards for model drift detection",
            "description": "Current rule-based recommendations have 2% CTR. Target is 5%. Use the ML platform team's infrastructure. Training data is in the data lake at s3://ml-data/recs/. Model should retrain weekly. Latency budget is <100ms for inference. Need to support 1M+ users.",
            "dueDate": "2026-07-01T00:00:00Z",
            "priority": "high",
        },
        "expected": {
            "category": "over-specified",
            "original_quality": 40,
            "rewritten_title": "Design recommendation engine improvement plan (collaborative filtering)",
            "rewritten_description": "This is a multi-phase project. Recommended phases:\n1. Data exploration and baseline establishment (current 2% CTR → target 5%)\n2. Model development (collaborative filtering with matrix factorization)\n3. A/B testing framework setup (NDCG@10, CTR, conversion rate metrics)\n4. Production deployment with feature flags and monitoring\n\nConstraints: weekly retraining, <100ms inference latency, 1M+ users, use ML platform team's infrastructure, training data at s3://ml-data/recs/. Definition of done for Phase 1: baseline metrics documented and data quality verified.",
            "what_good_rewriting_looks_like": "Recognizes this is a quarter-long project. Structures into phases. Preserves all constraints (CTR targets, latency, user count, data location, retraining frequency). Does NOT add technical specifics beyond what's given.",
            "common_failure_modes": ["kept_as_single_task", "dropped_constraint", "added_technical_detail", "ignored_scale_requirements"],
            "acceptable_variation": "May use different phase names or groupings. All constraints and metrics must be preserved.",
        },
    },
    # ── Already-good tasks (minimal edit expected) ───────────────────────
    {
        "id": "008",
        "input": {"title": "Schedule dentist appointment for annual cleaning", "description": "Prefer morning slots. Check if Delta Dental insurance is still valid.", "dueDate": "2026-04-15T00:00:00Z", "priority": "low"},
        "expected": {
            "category": "already-good",
            "original_quality": 85,
            "rewritten_title": "Schedule dentist appointment for annual cleaning",
            "rewritten_description": "Call dentist to schedule annual cleaning. Preferences: morning appointment slot. Action item: verify Delta Dental insurance is still valid before booking. Definition of done: appointment is scheduled, insurance is confirmed, and calendar invite is created.",
            "what_good_rewriting_looks_like": "Very minimal edits. Maybe adds 'call' action and definition of done. Preserves morning preference, Delta Dental, and annual cleaning exactly.",
            "common_failure_modes": ["over_edited", "changed_insurance_name", "changed_preference", "added_unnecessary_steps"],
            "acceptable_variation": "Almost any minimal restructuring is fine. Core facts must be unchanged.",
        },
    },
    {
        "id": "009",
        "input": {"title": "Submit expense report for March client dinner", "description": "Receipt attached. $127.50 at Nobu with Acme Corp team. Project code: ACME-2026-Q1.", "dueDate": "2026-04-05T00:00:00Z", "priority": "medium"},
        "expected": {
            "category": "already-good",
            "original_quality": 90,
            "rewritten_title": "Submit expense report for March client dinner",
            "rewritten_description": "Submit expense report for client dinner at Nobu ($127.50) with Acme Corp team. Receipt is attached. Project code: ACME-2026-Q1. Definition of done: expense is submitted, approved, and reimbursement is confirmed.",
            "what_good_rewriting_looks_like": "Minimal edits. Maybe restructures description slightly. All facts (amount, restaurant, team, project code) preserved exactly.",
            "common_failure_modes": ["changed_amount", "changed_restaurant", "changed_project_code", "over_edited"],
            "acceptable_variation": "Minor rewording is fine. All specific facts must be preserved.",
        },
    },
    # ── Missing-context-but-salvageable ──────────────────────────────────
    {
        "id": "010",
        "input": {"title": "call mom", "description": None, "dueDate": None, "priority": None},
        "expected": {
            "category": "missing-context-salvageable",
            "original_quality": 35,
            "rewritten_title": "Call mom to check in",
            "rewritten_description": "Call mom for a personal check-in. Consider: any upcoming events, birthdays, or family matters to discuss. Definition of done: call is completed and any follow-up actions (sending something, planning a visit) are noted.",
            "what_good_rewriting_looks_like": "Adds minimal context without inventing specifics. Makes it actionable (check-in) while preserving the personal nature. Does NOT invent reasons for calling.",
            "common_failure_modes": ["invented_reason", "too_prescriptive", "ignored_personal_context"],
            "acceptable_variation": "Any gentle enhancement that makes the task actionable without inventing specifics.",
        },
    },
    {
        "id": "011",
        "input": {"title": "update docs", "description": "the readme is outdated", "dueDate": None, "priority": "low"},
        "expected": {
            "category": "missing-context-salvageable",
            "original_quality": 30,
            "rewritten_title": "Review and update project README",
            "rewritten_description": "Audit the current README for outdated information. Check: installation instructions, usage examples, API documentation, and contribution guidelines. Update any sections that no longer reflect the current state of the project. Definition of done: README is reviewed, outdated sections are updated, and changes are committed.",
            "what_good_rewriting_looks_like": "Expands 'docs' to README specifically (from context). Suggests common sections to check without inventing project-specific details. Makes it actionable.",
            "common_failure_modes": ["invented_project_details", "too_vague_still", "ignored_readme_context"],
            "acceptable_variation": "May reference other doc types (wiki, API docs) if README is not specified. Should stay general about what to update.",
        },
    },
    # ── Multi-intent tasks ───────────────────────────────────────────────
    {
        "id": "012",
        "input": {
            "title": "Plan team offsite for Q2",
            "description": "Need venue, agenda, activities, catering. Budget $5k. 12 people. Somewhere in the Bay Area. Preferably outdoors since it'll be spring.",
            "dueDate": "2026-05-15T00:00:00Z",
            "priority": "medium",
        },
        "expected": {
            "category": "multi-intent",
            "original_quality": 65,
            "rewritten_title": "Plan Q2 team offsite (venue, agenda, catering)",
            "rewritten_description": "Organize Q2 team offsite. Constraints: budget $5k, 12 people, Bay Area location, preferably outdoors (spring). Key workstreams:\n1. Venue: research and book outdoor-friendly Bay Area venue\n2. Agenda: draft half-day or full-day schedule\n3. Activities: plan team-building activities suitable for outdoors\n4. Catering: arrange food/beverage for 12 people\n\nDefinition of done: venue is booked, agenda is shared with team, activities are planned, catering is ordered, and all arrangements are within $5k budget.",
            "what_good_rewriting_looks_like": "Structures the existing workstreams. Preserves all constraints (budget, headcount, location, season preference). Does NOT invent specific venues or activities.",
            "common_failure_modes": ["invented_venue", "invented_activity", "dropped_constraint", "changed_budget"],
            "acceptable_variation": "May group workstreams differently. All constraints must be preserved.",
        },
    },
    {
        "id": "013",
        "input": {
            "title": "Conduct user research interviews with 5 power users about the new dashboard redesign",
            "description": "Prepare interview guide with 8-10 questions. Focus on: navigation ease, information hierarchy, feature discoverability, and overall satisfaction. Record sessions (with consent). Synthesize findings into a 1-page summary by end of sprint.",
            "dueDate": "2026-04-18T00:00:00Z",
            "priority": "medium",
        },
        "expected": {
            "category": "multi-intent",
            "original_quality": 85,
            "rewritten_title": "Conduct 5 user research interviews on dashboard redesign",
            "rewritten_description": "Interview 5 power users about the new dashboard redesign. Focus areas: (1) navigation ease, (2) information hierarchy, (3) feature discoverability, (4) overall satisfaction.\n\nPreparation: create interview guide with 8-10 questions. Logistics: record sessions with participant consent. Output: synthesize findings into a 1-page summary by end of sprint.\n\nDefinition of done: 5 interviews completed, recordings stored, 1-page summary is written and shared with the team.",
            "what_good_rewriting_looks_like": "Minimal restructuring. Organizes into preparation/logistics/output. Preserves all specifics (5 users, 8-10 questions, 4 focus areas, 1-page summary, sprint deadline).",
            "common_failure_modes": ["changed_user_count", "changed_question_count", "dropped_focus_area", "changed_deadline"],
            "acceptable_variation": "May reorder sections. All numbers and specifics must be preserved.",
        },
    },
    # ── Adversarial / edge cases ─────────────────────────────────────────
    {
        "id": "014",
        "input": {"title": "Do the thing we talked about", "description": None, "dueDate": None, "priority": None},
        "expected": {
            "category": "adversarial",
            "original_quality": 10,
            "rewritten_title": "Clarify: what task needs to be done?",
            "rewritten_description": "This task references a prior conversation but has no actionable content. Recommended action: follow up with the task creator to identify the specific work item, deadline, and priority. Definition of done: a concrete task with title, description, and deadline replaces this placeholder.",
            "what_good_rewriting_looks_like": "Recognizes the task is unactionable. Proposes clarification rather than inventing content. Does NOT guess what 'the thing' is.",
            "common_failure_modes": ["invented_task", "guessed_intent", "too_prescriptive"],
            "acceptable_variation": "Any response that asks for clarification without inventing specifics is acceptable.",
        },
    },
    {
        "id": "015",
        "input": {"title": "??????", "description": "!!!", "dueDate": None, "priority": None},
        "expected": {
            "category": "adversarial",
            "original_quality": 5,
            "rewritten_title": "Create a meaningful task with clear action and purpose",
            "rewritten_description": "The current task has no actionable content. Replace with a specific task that includes: (1) what needs to be done, (2) why it matters, (3) when it's due. Definition of done: a properly formed task with title, description, and deadline exists.",
            "what_good_rewriting_looks_like": "Recognizes the task is meaningless. Proposes a template for a proper task. Does NOT invent a specific task.",
            "common_failure_modes": ["invented_task", "ignored_meaninglessness", "too_vague_still"],
            "acceptable_variation": "Any response that flags the task as needing content without inventing specifics.",
        },
    },
    {
        "id": "016",
        "input": {"title": "something about the API", "description": "the api is slow and we should probably do something about it maybe look into it when you have time", "dueDate": None, "priority": None},
        "expected": {
            "category": "adversarial",
            "original_quality": 15,
            "rewritten_title": "Investigate API performance issues",
            "rewritten_description": "The API is reported as slow. Investigate and identify the root cause. Recommended steps: (1) measure current response times and identify slowest endpoints, (2) review recent changes that may have impacted performance, (3) propose specific optimizations with estimated impact. Definition of done: performance baseline is documented, root cause(s) identified, and optimization recommendations are written.",
            "what_good_rewriting_looks_like": "Converts vague concern into an investigation task. Does NOT invent specific endpoints, metrics, or solutions. Preserves the general concern (API is slow).",
            "common_failure_modes": ["invented_endpoint", "invented_metric", "too_prescriptive", "ignored_vague_nature"],
            "acceptable_variation": "May frame as 'research' or 'audit' instead of 'investigate'. Should not invent specifics about what's slow.",
        },
    },
    # ── Too-long tasks ───────────────────────────────────────────────────
    {
        "id": "017",
        "input": {
            "title": "Refactor the entire codebase to use the new design system components while maintaining backward compatibility with the old components during a 3-month transition period, updating all 200+ pages, writing migration guides, training the team, and setting up deprecation warnings",
            "description": "The old design system is being sunset at end of year. New components are in the design-system package. Need to update every page, form, modal, and notification. Also update the component documentation site. Coordinate with the design team on any gaps in the new system.",
            "dueDate": "2026-09-30T00:00:00Z",
            "priority": "high",
        },
        "expected": {
            "category": "too-long",
            "original_quality": 35,
            "rewritten_title": "Plan design system migration (200+ pages, 3-month transition)",
            "rewritten_description": "This is a large-scale migration. Recommended approach:\n\nPhase 1: Inventory all 200+ pages and map old→new component usage\nPhase 2: Update pages in priority order with backward compatibility\nPhase 3: Write migration guides and train the team\nPhase 4: Set up deprecation warnings and update documentation\n\nConstraints: 3-month transition period, old design system sunsets end of year, new components in design-system package, coordinate with design team on gaps. Definition of done for Phase 1: complete inventory with migration effort estimates per page.",
            "what_good_rewriting_looks_like": "Recognizes this is a multi-phase project. Structures into phases. Preserves all constraints (200+ pages, 3 months, end-of-year sunset, design-system package, design team coordination). Does NOT invent technical migration details.",
            "common_failure_modes": ["kept_as_single_task", "dropped_page_count", "changed_timeline", "added_technical_detail"],
            "acceptable_variation": "May use different phase groupings. All constraints must be preserved.",
        },
    },
    # ── Additional cases for coverage ────────────────────────────────────
    {
        "id": "018",
        "input": {"title": "Buy birthday gift for Sarah", "description": "She mentioned liking candles and books. Budget $40. Birthday is April 20.", "dueDate": "2026-04-18T00:00:00Z", "priority": "medium"},
        "expected": {
            "category": "well-defined",
            "original_quality": 80,
            "rewritten_title": "Buy birthday gift for Sarah (by April 18)",
            "rewritten_description": "Purchase a birthday gift for Sarah. Preferences: candles or books (she mentioned liking both). Budget: $40. Birthday: April 20. Definition of done: gift is purchased and wrapped, ready for April 20.",
            "what_good_rewriting_looks_like": "Minimal edits. Adds deadline to title. Preserves Sarah, preferences, budget, and birthday exactly.",
            "common_failure_modes": ["changed_name", "changed_budget", "changed_birthday", "invented_gift"],
            "acceptable_variation": "May suggest specific gift types within budget, but should not assume a specific item.",
        },
    },
    {
        "id": "019",
        "input": {"title": "Review and approve the new brand guidelines document from the design team before the stakeholder meeting on Monday", "description": "The design team sent v3 of the brand guidelines. Need to check: logo usage, color palette, typography, tone of voice, and social media templates. Meeting is Monday 10am with CEO and CMO. Send feedback by Friday EOD so design team has weekend to incorporate changes.", "dueDate": "2026-04-11T00:00:00Z", "priority": "high"},
        "expected": {
            "category": "well-defined",
            "original_quality": 75,
            "rewritten_title": "Review brand guidelines v3 before Monday stakeholder meeting",
            "rewritten_description": "Review brand guidelines v3 from the design team. Check areas: (1) logo usage, (2) color palette, (3) typography, (4) tone of voice, (5) social media templates.\n\nDeadline: send feedback by Friday EOD (design team needs weekend to incorporate changes). Context: stakeholder meeting Monday 10am with CEO and CMO. Definition of done: feedback is sent to design team by Friday EOD covering all five review areas.",
            "what_good_rewriting_looks_like": "Structures the review areas. Preserves all specifics (v3, five review areas, Friday EOD, Monday 10am, CEO/CMO). Adds clear deadline structure.",
            "common_failure_modes": ["changed_version", "dropped_review_area", "changed_deadline", "changed_attendees"],
            "acceptable_variation": "May reorder review areas. All specifics must be preserved.",
        },
    },
    {
        "id": "020",
        "input": {"title": "Cancel unused SaaS subscriptions", "description": "Review the finance spreadsheet for tools we pay for but nobody uses. Focus on tools over $100/month.", "dueDate": "2026-04-12T00:00:00Z", "priority": "medium"},
        "expected": {
            "category": "well-defined",
            "original_quality": 70,
            "rewritten_title": "Audit and cancel unused SaaS subscriptions over $100/month",
            "rewritten_description": "Review the finance spreadsheet to identify SaaS tools that are paid for but unused. Focus on subscriptions over $100/month. For each unused tool: verify no active users, document the cancellation process, and cancel. Definition of done: all unused SaaS subscriptions over $100/month are identified and cancelled, with a summary of savings documented.",
            "what_good_rewriting_looks_like": "Adds action verb and specificity. Preserves finance spreadsheet reference and $100/month threshold. Adds definition of done.",
            "common_failure_modes": ["changed_threshold", "dropped_spreadsheet_reference", "invented_tools"],
            "acceptable_variation": "May add steps about documenting savings. Core facts (spreadsheet, $100/month) must be preserved.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-rewriter/eval-lab/tasks/task-rewriter-quality"

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
        f.write(f'[task]\nname = "task-rewriter-case-{cid}"\ndescription = "{case["expected"]["what_good_rewriting_looks_like"][:80]}"\n\n[scoring]\noriginal_quality_score = {case["expected"]["original_quality"]}\nweight = 1.0\n')

    print(f"Created case-{cid}: category={case['expected']['category']}, original_quality={case['expected']['original_quality']}")

print(f"\nGenerated {len(CASES)} cases")
