#!/usr/bin/env python3
"""Generate Task Breakdown benchmark cases.

20 cases across 5 categories:
- simple_task (4): Straightforward task decomposition
- complex_task (6): Multi-aspect task with dependencies
- project_with_context (4): Task within project context
- missing_context (3): Vague or ambiguous task
- adversarial (3): Already atomic or impossible to decompose
"""
import json
import os

CASES = [
    # ── Simple Task (4 cases) ──────────────────────────────────────────────
    {
        "id": "001",
        "input": {
            "task_title": "Plan team offsite",
            "task_description": "Organize a 2-day team offsite for 15 people including venue, activities, and meals.",
            "project_context": {"name": "Team Building", "budget": 5000},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "simple_task",
            "expected_subtasks": [
                {"title": "Research and book venue", "description": "Find venue that accommodates 15 people for 2 days", "priority": "high"},
                {"title": "Plan activities and agenda", "description": "Create schedule for 2 days", "priority": "medium"},
                {"title": "Arrange catering and meals", "description": "Order meals for 15 people for 2 days", "priority": "medium"},
                {"title": "Send invitations and collect RSVPs", "description": "Invite team and track attendance", "priority": "low"},
            ],
            "what_good_breakdown_looks_like": "4 subtasks covering venue, activities, meals, and invitations. Venue should be first (high priority).",
            "common_failure_modes": ["misses_venue", "misses_meals", "too_granular", "not_actionable"],
            "acceptable_variation": "May combine activities and agenda. Should have 3-5 subtasks.",
            "notes": "Standard event planning task. Should decompose into venue, activities, meals, logistics.",
        },
    },
    {
        "id": "002",
        "input": {
            "task_title": "Write blog post about Q4 results",
            "task_description": "Create a blog post summarizing Q4 company results and key achievements.",
            "project_context": {"name": "Content Marketing"},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "simple_task",
            "expected_subtasks": [
                {"title": "Gather Q4 data and metrics", "description": "Collect key numbers and achievements", "priority": "high"},
                {"title": "Draft blog post outline", "description": "Structure the post with key sections", "priority": "medium"},
                {"title": "Write first draft", "description": "Write full blog post content", "priority": "high"},
                {"title": "Review and edit", "description": "Proofread and refine", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "4 subtasks: gather data, outline, write, review. Logical sequence.",
            "common_failure_modes": ["misses_data_gathering", "misses_review", "too_granular"],
            "acceptable_variation": "May combine outline and draft. Should have 3-5 subtasks.",
            "notes": "Content creation task. Should decompose into research, outline, write, review.",
        },
    },
    {
        "id": "003",
        "input": {
            "task_title": "Set up CI/CD pipeline",
            "task_description": "Configure automated testing and deployment pipeline for the new microservice.",
            "project_context": {"name": "Infrastructure", "tech_stack": "Python, Docker, Kubernetes"},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "simple_task",
            "expected_subtasks": [
                {"title": "Create Dockerfile for microservice", "description": "Containerize the application", "priority": "high"},
                {"title": "Configure CI pipeline with tests", "description": "Set up automated testing on PR", "priority": "high"},
                {"title": "Configure CD pipeline for deployment", "description": "Set up automated deployment to staging/production", "priority": "medium"},
                {"title": "Add monitoring and alerting", "description": "Set up health checks and alerts", "priority": "low"},
            ],
            "what_good_breakdown_looks_like": "4 subtasks: Dockerfile, CI, CD, monitoring. Dockerfile first as prerequisite.",
            "common_failure_modes": ["misses_docker", "misses_monitoring", "wrong_order"],
            "acceptable_variation": "May combine CI and CD. Should have 3-5 subtasks.",
            "notes": "DevOps task. Should decompose into containerization, CI, CD, monitoring.",
        },
    },
    {
        "id": "004",
        "input": {
            "task_title": "Update README",
            "task_description": "Update the project README with new setup instructions.",
            "project_context": {"name": "Documentation"},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "simple_task",
            "expected_subtasks": [
                {"title": "Review current README content", "description": "Identify outdated sections", "priority": "medium"},
                {"title": "Write new setup instructions", "description": "Document current setup process", "priority": "high"},
                {"title": "Update README and submit PR", "description": "Apply changes and create pull request", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "2-3 subtasks: review, write, update. Simple task, not over-decomposed.",
            "common_failure_modes": ["over_decomposed", "misses_review_step"],
            "acceptable_variation": "May be 2-3 subtasks. Should not be over-decomposed for simple task.",
            "notes": "Simple documentation task. Should have 2-3 subtasks, not over-decomposed.",
        },
    },

    # ── Complex Task (6 cases) ─────────────────────────────────────────────
    {
        "id": "005",
        "input": {
            "task_title": "Migrate database from PostgreSQL 14 to 16",
            "task_description": "Upgrade production database with zero downtime. Includes schema compatibility checks, data migration, and rollback plan.",
            "project_context": {"name": "Infrastructure", "current_version": "PostgreSQL 14", "target_version": "PostgreSQL 16", "downtime_window": "none"},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "complex_task",
            "expected_subtasks": [
                {"title": "Test schema compatibility with PostgreSQL 16", "description": "Verify all queries and schemas work on v16", "priority": "high"},
                {"title": "Set up staging environment with PostgreSQL 16", "description": "Create test environment for migration rehearsal", "priority": "high"},
                {"title": "Rehearse migration on staging", "description": "Run full migration process on staging", "priority": "high"},
                {"title": "Create rollback plan", "description": "Document steps to revert if migration fails", "priority": "high"},
                {"title": "Execute production migration", "description": "Run migration during maintenance window", "priority": "high"},
                {"title": "Verify post-migration health", "description": "Monitor application after migration", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "5-6 subtasks with clear dependencies. Testing and rollback plan are critical.",
            "common_failure_modes": ["misses_rollback_plan", "misses_staging_test", "misses_verification"],
            "acceptable_variation": "May have 5-7 subtasks. Must include testing, rollback, and verification.",
            "notes": "Complex infrastructure task with zero-downtime requirement. Must include testing and rollback.",
        },
    },
    {
        "id": "006",
        "input": {
            "task_title": "Launch new user onboarding flow",
            "task_description": "Design, build, and launch a redesigned onboarding experience with interactive tutorials and progressive disclosure.",
            "project_context": {"name": "Product", "target_launch": "2026-05-01", "team_size": 4},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "complex_task",
            "expected_subtasks": [
                {"title": "Design onboarding wireframes", "description": "Create UI designs for new onboarding flow", "priority": "high"},
                {"title": "Write interactive tutorial content", "description": "Create tutorial steps and copy", "priority": "medium"},
                {"title": "Implement frontend components", "description": "Build onboarding UI components", "priority": "high"},
                {"title": "Implement backend tracking", "description": "Track onboarding completion and progress", "priority": "medium"},
                {"title": "Run user testing", "description": "Test with 5-10 users and collect feedback", "priority": "medium"},
                {"title": "Launch with feature flag", "description": "Deploy behind feature flag for gradual rollout", "priority": "high"},
            ],
            "what_good_breakdown_looks_like": "5-6 subtasks covering design, content, frontend, backend, testing, launch.",
            "common_failure_modes": ["misses_user_testing", "misses_feature_flag", "misses_content_creation"],
            "acceptable_variation": "May have 5-7 subtasks. Must include design, implementation, testing, launch.",
            "notes": "Complex product launch. Must include design, build, test, and phased launch.",
        },
    },
    {
        "id": "007",
        "input": {
            "task_title": "Implement OAuth2 SSO integration",
            "task_description": "Add SSO support for enterprise clients using SAML and OAuth2. Must support multiple identity providers.",
            "project_context": {"name": "Security", "idps": ["Okta", "Azure AD", "Google Workspace"]},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "complex_task",
            "expected_subtasks": [
                {"title": "Research SAML and OAuth2 SSO requirements", "description": "Document protocol requirements for each IdP", "priority": "high"},
                {"title": "Design SSO architecture", "description": "Design authentication flow and data model", "priority": "high"},
                {"title": "Implement SAML integration", "description": "Build SAML assertion handling and validation", "priority": "high"},
                {"title": "Implement OAuth2 integration", "description": "Build OAuth2 flow for each IdP", "priority": "high"},
                {"title": "Test with each identity provider", "description": "Verify Okta, Azure AD, and Google Workspace", "priority": "medium"},
                {"title": "Write admin documentation", "description": "Document SSO setup for enterprise admins", "priority": "low"},
            ],
            "what_good_breakdown_looks_like": "5-6 subtasks covering research, design, SAML, OAuth2, testing, docs.",
            "common_failure_modes": ["misses_testing", "misses_documentation", "combines_SAML_and_OAuth2"],
            "acceptable_variation": "May have 5-7 subtasks. Must cover both SAML and OAuth2 separately.",
            "notes": "Complex security task. Must separate SAML and OAuth2 implementations.",
        },
    },
    {
        "id": "008",
        "input": {
            "task_title": "Prepare annual budget proposal",
            "task_description": "Create next year's budget proposal including headcount, infrastructure, software licenses, and contingency.",
            "project_context": {"name": "Finance", "current_budget": 2000000, "departments": ["Engineering", "Product", "Design"]},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "complex_task",
            "expected_subtasks": [
                {"title": "Collect department budget requests", "description": "Gather requests from Engineering, Product, Design", "priority": "high"},
                {"title": "Analyze current year spending", "description": "Review actuals vs budget for current year", "priority": "high"},
                {"title": "Project headcount costs", "description": "Calculate salaries, benefits, and hiring costs", "priority": "high"},
                {"title": "Estimate infrastructure and license costs", "description": "Project cloud, software, and tool costs", "priority": "medium"},
                {"title": "Build budget model and proposal", "description": "Create spreadsheet and narrative", "priority": "high"},
                {"title": "Review with leadership", "description": "Present proposal and get approval", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "5-6 subtasks covering data collection, analysis, projection, modeling, review.",
            "common_failure_modes": ["misses_current_year_analysis", "misses_leadership_review"],
            "acceptable_variation": "May have 5-7 subtasks. Must include data collection and review.",
            "notes": "Complex financial task. Must include data gathering, analysis, and review.",
        },
    },
    {
        "id": "009",
        "input": {
            "task_title": "Conduct security audit",
            "task_description": "Perform comprehensive security audit of the application including penetration testing, dependency scanning, and access review.",
            "project_context": {"name": "Security", "last_audit": "2025-06-01", "compliance_requirements": ["SOC2", "GDPR"]},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "complex_task",
            "expected_subtasks": [
                {"title": "Run dependency vulnerability scan", "description": "Scan all dependencies for known CVEs", "priority": "high"},
                {"title": "Conduct penetration testing", "description": "Test application for common vulnerabilities", "priority": "high"},
                {"title": "Review access controls and permissions", "description": "Audit user roles and API access", "priority": "high"},
                {"title": "Review compliance requirements", "description": "Check SOC2 and GDPR compliance gaps", "priority": "medium"},
                {"title": "Document findings and remediation plan", "description": "Create audit report with prioritized fixes", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "4-5 subtasks covering scanning, pen testing, access review, compliance, reporting.",
            "common_failure_modes": ["misses_penetration_testing", "misses_compliance_review"],
            "acceptable_variation": "May have 4-6 subtasks. Must include pen testing and compliance.",
            "notes": "Security audit task. Must include technical testing and compliance review.",
        },
    },
    {
        "id": "010",
        "input": {
            "task_title": "Build customer feedback dashboard",
            "task_description": "Create a dashboard that aggregates customer feedback from support tickets, NPS surveys, and product usage analytics.",
            "project_context": {"name": "Analytics", "data_sources": ["Zendesk", "Delighted", "Mixpanel"]},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "complex_task",
            "expected_subtasks": [
                {"title": "Design dashboard wireframes", "description": "Create UI mockups for feedback dashboard", "priority": "high"},
                {"title": "Set up data pipeline from Zendesk", "description": "Extract and transform support ticket data", "priority": "high"},
                {"title": "Set up data pipeline from Delighted", "description": "Extract and transform NPS survey data", "priority": "high"},
                {"title": "Set up data pipeline from Mixpanel", "description": "Extract and transform usage analytics", "priority": "medium"},
                {"title": "Build dashboard frontend", "description": "Implement dashboard UI with charts and filters", "priority": "high"},
                {"title": "Test and validate data accuracy", "description": "Verify dashboard data matches source systems", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "5-6 subtasks covering design, 3 data pipelines, frontend, testing.",
            "common_failure_modes": ["misses_data_validation", "combines_data_pipelines"],
            "acceptable_variation": "May have 5-7 subtasks. Must cover all 3 data sources.",
            "notes": "Analytics dashboard task. Must include each data source separately.",
        },
    },

    # ── Project with Context (4 cases) ─────────────────────────────────────
    {
        "id": "011",
        "input": {
            "task_title": "Implement search feature",
            "task_description": "Add full-text search to the application with filters and sorting.",
            "project_context": {"name": "Core Product", "existing_features": ["task_list", "projects", "filters"], "tech_stack": "React, Node.js, PostgreSQL"},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "project_with_context",
            "expected_subtasks": [
                {"title": "Design search UI components", "description": "Create search bar, filters, and results display", "priority": "high"},
                {"title": "Implement backend search API", "description": "Add full-text search endpoint with filters", "priority": "high"},
                {"title": "Integrate search with existing task list", "description": "Connect search results to existing task list UI", "priority": "medium"},
                {"title": "Add search indexing", "description": "Set up database search indexes", "priority": "high"},
                {"title": "Write search tests", "description": "Test search accuracy and performance", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "4-5 subtasks that respect existing tech stack and features.",
            "common_failure_modes": ["ignores_existing_tech_stack", "misses_integration_with_existing_features"],
            "acceptable_variation": "May have 4-6 subtasks. Should reference existing architecture.",
            "notes": "Search feature within existing product. Should respect current tech stack.",
        },
    },
    {
        "id": "012",
        "input": {
            "task_title": "Add notification system",
            "task_description": "Implement push and email notifications for task assignments, due dates, and mentions.",
            "project_context": {"name": "Core Product", "existing_services": ["email_service", "task_service"], "notification_channels": ["email", "push"]},
            "existing_subtasks": [
                {"title": "Set up email service provider", "description": "Configure SendGrid account", "status": "completed"},
            ],
        },
        "expected": {
            "category": "project_with_context",
            "expected_subtasks": [
                {"title": "Design notification data model", "description": "Define notification types and preferences", "priority": "high"},
                {"title": "Implement push notification service", "description": "Build push notification delivery", "priority": "high"},
                {"title": "Integrate with existing email service", "description": "Connect notification system to SendGrid", "priority": "high"},
                {"title": "Build notification preferences UI", "description": "Allow users to configure notification settings", "priority": "medium"},
                {"title": "Add notification triggers", "description": "Trigger notifications for assignments, due dates, mentions", "priority": "high"},
            ],
            "what_good_breakdown_looks_like": "4-5 subtasks that acknowledge completed email service setup.",
            "common_failure_modes": ["duplicates_completed_work", "ignores_existing_services"],
            "acceptable_variation": "Should not duplicate the completed email service setup task.",
            "notes": "Notification system with email service already set up. Should not duplicate completed work.",
        },
    },
    {
        "id": "013",
        "input": {
            "task_title": "Implement dark mode",
            "task_description": "Add dark mode support across the entire application.",
            "project_context": {"name": "UI/UX", "design_system": "Tailwind CSS", "existing_themes": ["light"]},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "project_with_context",
            "expected_subtasks": [
                {"title": "Define dark mode color palette", "description": "Create dark mode variants for all colors", "priority": "high"},
                {"title": "Update Tailwind CSS configuration", "description": "Add dark mode theme to Tailwind config", "priority": "high"},
                {"title": "Update all components for dark mode", "description": "Apply dark mode styles to all UI components", "priority": "high"},
                {"title": "Add theme toggle component", "description": "Build light/dark mode switcher", "priority": "medium"},
                {"title": "Test dark mode across all pages", "description": "Verify dark mode on every page and component", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "4-5 subtasks covering palette, config, components, toggle, testing.",
            "common_failure_modes": ["misses_testing", "misses_theme_toggle"],
            "acceptable_variation": "May have 4-6 subtasks. Must cover all components.",
            "notes": "Dark mode within existing Tailwind CSS design system.",
        },
    },
    {
        "id": "014",
        "input": {
            "task_title": "Add export to CSV feature",
            "task_description": "Allow users to export their task list and project data to CSV files.",
            "project_context": {"name": "Core Product", "existing_export_formats": [], "data_models": ["tasks", "projects", "users"]},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "project_with_context",
            "expected_subtasks": [
                {"title": "Design CSV export API endpoint", "description": "Create endpoint that returns CSV data", "priority": "high"},
                {"title": "Implement CSV generation for tasks", "description": "Convert task data to CSV format", "priority": "high"},
                {"title": "Implement CSV generation for projects", "description": "Convert project data to CSV format", "priority": "medium"},
                {"title": "Add export button to UI", "description": "Add download button to task list and project views", "priority": "medium"},
                {"title": "Test export with large datasets", "description": "Verify export works with 1000+ tasks", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "4-5 subtasks covering API, data generation, UI, testing.",
            "common_failure_modes": ["misses_testing", "misses_UI_component"],
            "acceptable_variation": "May have 4-6 subtasks. Should cover both tasks and projects.",
            "notes": "CSV export feature. Should cover API, data generation, UI, and testing.",
        },
    },

    # ── Missing Context (3 cases) ──────────────────────────────────────────
    {
        "id": "015",
        "input": {
            "task_title": "Fix the thing",
            "task_description": "",
            "project_context": {},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "missing_context",
            "expected_subtasks": [
                {"title": "Identify the issue", "description": "Clarify what needs to be fixed", "priority": "high"},
            ],
            "what_good_breakdown_looks_like": "1-2 subtasks focused on clarification. Task is too vague to decompose.",
            "common_failure_modes": ["invents_specific_subtasks", "overly_prescriptive"],
            "acceptable_variation": "Should suggest clarification or identification step. Not invent specific fixes.",
            "notes": "Extremely vague task. Should not invent specific subtasks.",
        },
    },
    {
        "id": "016",
        "input": {
            "task_title": "Improve performance",
            "task_description": "The app is slow. Make it faster.",
            "project_context": {"name": "Engineering"},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "missing_context",
            "expected_subtasks": [
                {"title": "Profile application to identify bottlenecks", "description": "Measure current performance and find slow areas", "priority": "high"},
                {"title": "Prioritize performance issues", "description": "Rank issues by impact and effort", "priority": "medium"},
                {"title": "Implement top performance fixes", "description": "Address highest-impact bottlenecks", "priority": "high"},
            ],
            "what_good_breakdown_looks_like": "2-3 subtasks: profile, prioritize, fix. Should not invent specific fixes.",
            "common_failure_modes": ["invents_specific_fixes", "misses_profiling_step"],
            "acceptable_variation": "Should start with profiling. Should not invent specific performance fixes.",
            "notes": "Vague performance task. Should start with profiling, not invent specific fixes.",
        },
    },
    {
        "id": "017",
        "input": {
            "task_title": "Do the migration",
            "task_description": "We need to migrate to the new system.",
            "project_context": {},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "missing_context",
            "expected_subtasks": [
                {"title": "Clarify migration scope and target system", "description": "Identify what needs to be migrated and to where", "priority": "high"},
                {"title": "Assess migration complexity", "description": "Evaluate data volume, dependencies, and risks", "priority": "high"},
            ],
            "what_good_breakdown_looks_like": "1-2 subtasks focused on clarification. Too vague for detailed breakdown.",
            "common_failure_modes": ["invents_specific_migration_steps", "assumes_target_system"],
            "acceptable_variation": "Should suggest clarification. Should not assume target system or data.",
            "notes": "Vague migration task with no context. Should not invent specific migration steps.",
        },
    },

    # ── Adversarial (3 cases) ──────────────────────────────────────────────
    {
        "id": "018",
        "input": {
            "task_title": "Send email to John",
            "task_description": "Quick email to John about the meeting tomorrow.",
            "project_context": {},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "adversarial",
            "expected_subtasks": [
                {"title": "Send email to John", "description": "Quick email about meeting tomorrow", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "Single subtask. This is already atomic and should not be decomposed.",
            "common_failure_modes": ["over_decomposed", "invents_subtasks"],
            "acceptable_variation": "Should return single subtask or original task. Should not decompose further.",
            "notes": "Already atomic task. Should not be decomposed.",
        },
    },
    {
        "id": "019",
        "input": {
            "task_title": "Buy milk",
            "task_description": "",
            "project_context": {},
            "existing_subtasks": [],
        },
        "expected": {
            "category": "adversarial",
            "expected_subtasks": [
                {"title": "Buy milk", "description": "", "priority": "low"},
            ],
            "what_good_breakdown_looks_like": "Single subtask. This is already atomic.",
            "common_failure_modes": ["over_decomposed", "invents_steps_like_go_to_store"],
            "acceptable_variation": "Should return single subtask. Should not invent steps like 'go to store'.",
            "notes": "Already atomic task. Should not be decomposed.",
        },
    },
    {
        "id": "020",
        "input": {
            "task_title": "Complete onboarding",
            "task_description": "Finish the new employee onboarding process.",
            "project_context": {"name": "HR"},
            "existing_subtasks": [
                {"title": "Set up workstation", "status": "completed"},
                {"title": "Complete HR paperwork", "status": "completed"},
                {"title": "Attend orientation session", "status": "completed"},
            ],
        },
        "expected": {
            "category": "adversarial",
            "expected_subtasks": [
                {"title": "Review remaining onboarding items", "description": "Check what onboarding steps are still pending", "priority": "medium"},
            ],
            "what_good_breakdown_looks_like": "1 subtask to check remaining items. Most subtasks are already completed.",
            "common_failure_modes": ["duplicates_completed_subtasks", "invents_new_onboarding_steps"],
            "acceptable_variation": "Should acknowledge completed subtasks. Should suggest checking remaining items.",
            "notes": "Most onboarding subtasks are completed. Should not duplicate completed work.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-tb/eval-lab/tasks/task-breakdown-quality"

for case in CASES:
    cid = case["id"]
    case_dir = f"{base}/case-{cid}"
    os.makedirs(case_dir, exist_ok=True)

    with open(f"{case_dir}/input.json", "w") as f:
        json.dump(case["input"], f, indent=2)
        f.write("\n")

    with open(f"{case_dir}/expected.json", "w") as f:
        json.dump(case["expected"], f, indent=2)
        f.write("\n")

    with open(f"{case_dir}/task.toml", "w") as f:
        f.write(f'[task]\nname = "task-breakdown-case-{cid}"\ndescription = "{case["expected"]["what_good_breakdown_looks_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: category={case['expected']['category']}")

print(f"\nGenerated {len(CASES)} cases")
