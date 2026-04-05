#!/usr/bin/env python3
"""Generate Context-Aware Planning benchmark cases.

20 cases across 5 project states:
- healthy_project (4): On-track project with normal state
- blocked_project (4): Project with active blockers
- overdue_project (4): Project behind schedule
- new_project (4): Newly started project
- complex_dependencies (4): Project with complex dependency chains

Planning types: project_plan, next_work, work_graph_analysis
"""
import json
import os

CASES = [
    # ── Healthy Project (4 cases) ──────────────────────────────────────────
    {
        "id": "001",
        "input": {
            "project_context": {"name": "Mobile App v2", "start_date": "2026-02-01", "target_date": "2026-05-01", "progress": "45%", "budget_used": "40%", "team_size": 4},
            "task_state": [
                {"title": "Design new UI components", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Implement authentication flow", "priority": "high", "status": "in_progress", "depends_on": []},
                {"title": "Build dashboard screens", "priority": "medium", "status": "pending", "depends_on": ["Design new UI components"]},
                {"title": "Write unit tests", "priority": "medium", "status": "pending", "depends_on": ["Implement authentication flow"]},
                {"title": "Set up CI/CD pipeline", "priority": "low", "status": "pending", "depends_on": []},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "normal",
            "expected_plan": ["Implement authentication flow", "Build dashboard screens", "Write unit tests", "Set up CI/CD pipeline"],
            "expected_next_work": "Implement authentication flow",
            "expected_risks": ["Authentication flow is in progress but not yet complete"],
            "what_good_plan_looks_like": "Continues in-progress auth flow first, then parallel dashboard and tests. CI/CD can be done anytime.",
            "common_failure_modes": ["misses_in_progress_task", "wrong_dependency_order", "misses_parallel_opportunities"],
            "acceptable_variation": "May suggest different ordering for independent tasks. Auth flow should be first.",
            "notes": "Healthy project with one in-progress task. Should continue auth flow first.",
        },
    },
    {
        "id": "002",
        "input": {
            "project_context": {"name": "Mobile App v2", "start_date": "2026-02-01", "target_date": "2026-05-01", "progress": "45%", "budget_used": "40%", "team_size": 4},
            "task_state": [
                {"title": "Design new UI components", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Implement authentication flow", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Build dashboard screens", "priority": "medium", "status": "pending", "depends_on": ["Design new UI components"]},
                {"title": "Write unit tests", "priority": "medium", "status": "pending", "depends_on": ["Implement authentication flow"]},
                {"title": "Set up CI/CD pipeline", "priority": "low", "status": "pending", "depends_on": []},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "normal",
            "expected_plan": ["Build dashboard screens", "Write unit tests", "Set up CI/CD pipeline"],
            "expected_next_work": "Build dashboard screens",
            "expected_risks": [],
            "what_good_plan_looks_like": "Dashboard screens are unblocked (design complete) and medium priority. Good next work.",
            "common_failure_modes": ["suggests_completed_task", "misses_unblocked_tasks"],
            "acceptable_variation": "May suggest unit tests as next work (also unblocked). Dashboard or tests are both valid.",
            "notes": "Auth flow complete. Dashboard screens are now unblocked and should be next work.",
        },
    },
    {
        "id": "003",
        "input": {
            "project_context": {"name": "Website Redesign", "start_date": "2026-03-01", "target_date": "2026-06-01", "progress": "30%", "budget_used": "25%", "team_size": 3},
            "task_state": [
                {"title": "Research competitor sites", "priority": "medium", "status": "completed", "depends_on": []},
                {"title": "Create wireframes", "priority": "high", "status": "completed", "depends_on": ["Research competitor sites"]},
                {"title": "Design visual mockups", "priority": "high", "status": "in_progress", "depends_on": ["Create wireframes"]},
                {"title": "Develop frontend components", "priority": "high", "status": "pending", "depends_on": ["Design visual mockups"]},
                {"title": "Set up CMS integration", "priority": "medium", "status": "pending", "depends_on": []},
                {"title": "Content migration", "priority": "medium", "status": "pending", "depends_on": ["Set up CMS integration"]},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "normal",
            "expected_plan": ["Design visual mockups", "Develop frontend components", "Set up CMS integration", "Content migration"],
            "expected_next_work": "Design visual mockups",
            "expected_risks": ["Frontend development blocked until mockups complete"],
            "what_good_plan_looks_like": "Continues mockups, then frontend. CMS integration can start in parallel.",
            "common_failure_modes": ["misses_in_progress_task", "wrong_dependency_order"],
            "acceptable_variation": "May suggest CMS integration as parallel work. Mockups should be first.",
            "notes": "Healthy project with mockups in progress. Frontend blocked until mockups done.",
        },
    },
    {
        "id": "004",
        "input": {
            "project_context": {"name": "API Gateway", "start_date": "2026-01-15", "target_date": "2026-04-15", "progress": "60%", "budget_used": "55%", "team_size": 2},
            "task_state": [
                {"title": "Design API schema", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Implement core endpoints", "priority": "high", "status": "completed", "depends_on": ["Design API schema"]},
                {"title": "Add rate limiting", "priority": "medium", "status": "completed", "depends_on": ["Implement core endpoints"]},
                {"title": "Write API documentation", "priority": "medium", "status": "in_progress", "depends_on": []},
                {"title": "Set up monitoring", "priority": "low", "status": "pending", "depends_on": []},
                {"title": "Load testing", "priority": "high", "status": "pending", "depends_on": ["Implement core endpoints", "Add rate limiting"]},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "normal",
            "expected_plan": ["Write API documentation", "Load testing", "Set up monitoring"],
            "expected_next_work": "Load testing",
            "expected_risks": ["Load testing is high priority and dependencies are met"],
            "what_good_plan_looks_like": "Load testing is high priority with all dependencies met. Should be next work over documentation.",
            "common_failure_modes": ["suggests_documentation_over_load_testing", "misses_high_priority_unblocked_task"],
            "acceptable_variation": "May suggest documentation as next work (in progress). Load testing is higher priority.",
            "notes": "Load testing is high priority and unblocked. Should be prioritized over documentation.",
        },
    },

    # ── Blocked Project (4 cases) ──────────────────────────────────────────
    {
        "id": "005",
        "input": {
            "project_context": {"name": "Database Migration", "start_date": "2026-02-15", "target_date": "2026-04-01", "progress": "20%", "budget_used": "35%", "team_size": 3},
            "task_state": [
                {"title": "Assess current schema", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Design new schema", "priority": "high", "status": "blocked", "depends_on": [], "blocker": "Waiting on DBA approval"},
                {"title": "Write migration scripts", "priority": "high", "status": "pending", "depends_on": ["Design new schema"]},
                {"title": "Test migration on staging", "priority": "high", "status": "pending", "depends_on": ["Write migration scripts"]},
                {"title": "Execute production migration", "priority": "high", "status": "pending", "depends_on": ["Test migration on staging"]},
                {"title": "Update application code", "priority": "medium", "status": "pending", "depends_on": ["Design new schema"]},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "blocked",
            "expected_plan": ["Design new schema (unblock first)", "Write migration scripts", "Update application code", "Test migration on staging", "Execute production migration"],
            "expected_next_work": "Follow up on DBA approval to unblock schema design",
            "expected_risks": ["Schema design blocked on DBA approval", "Entire project stalled until schema is approved", "Target date at risk"],
            "what_good_plan_looks_like": "Identifies blocker as critical path issue. Recommends unblocking schema design first. Flags timeline risk.",
            "common_failure_modes": ["misses_blocker", "suggests_blocked_task", "doesnt_flag_timeline_risk"],
            "acceptable_variation": "May suggest different unblocking actions. Should flag blocker as critical.",
            "notes": "Project blocked on schema design. DBA approval needed. Critical path blocked.",
        },
    },
    {
        "id": "006",
        "input": {
            "project_context": {"name": "SSO Integration", "start_date": "2026-03-01", "target_date": "2026-05-15", "progress": "15%", "budget_used": "20%", "team_size": 2},
            "task_state": [
                {"title": "Research SSO providers", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Set up Okta integration", "priority": "high", "status": "blocked", "depends_on": [], "blocker": "Okta account not provisioned"},
                {"title": "Set up Azure AD integration", "priority": "high", "status": "pending", "depends_on": ["Research SSO providers"]},
                {"title": "Implement SAML flow", "priority": "high", "status": "pending", "depends_on": ["Set up Okta integration", "Set up Azure AD integration"]},
                {"title": "Test with enterprise clients", "priority": "medium", "status": "pending", "depends_on": ["Implement SAML flow"]},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "blocked",
            "expected_plan": ["Set up Azure AD integration", "Set up Okta integration (unblock)", "Implement SAML flow", "Test with enterprise clients"],
            "expected_next_work": "Set up Azure AD integration",
            "expected_risks": ["Okta integration blocked on account provisioning", "SAML flow blocked until both integrations complete"],
            "what_good_plan_looks_like": "Suggests Azure AD work (unblocked) as next work. Flags Okta blocker. Recommends unblocking.",
            "common_failure_modes": ["suggests_blocked_task", "misses_unblocked_alternative"],
            "acceptable_variation": "May suggest following up on Okta provisioning. Azure AD is valid next work.",
            "notes": "Okta blocked but Azure AD is unblocked. Should suggest Azure AD as next work.",
        },
    },
    {
        "id": "007",
        "input": {
            "project_context": {"name": "Payment System", "start_date": "2026-01-01", "target_date": "2026-03-01", "progress": "40%", "budget_used": "60%", "team_size": 5},
            "task_state": [
                {"title": "Design payment flow", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Integrate Stripe API", "priority": "high", "status": "completed", "depends_on": ["Design payment flow"]},
                {"title": "Implement webhook handling", "priority": "high", "status": "blocked", "depends_on": ["Integrate Stripe API"], "blocker": "Stripe webhook endpoint not configured"},
                {"title": "Build payment UI", "priority": "medium", "status": "in_progress", "depends_on": ["Design payment flow"]},
                {"title": "Add refund functionality", "priority": "medium", "status": "pending", "depends_on": ["Integrate Stripe API"]},
                {"title": "Security audit", "priority": "high", "status": "pending", "depends_on": ["Implement webhook handling", "Build payment UI"]},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "blocked",
            "expected_plan": ["Build payment UI", "Add refund functionality", "Implement webhook handling (unblock)", "Security audit"],
            "expected_next_work": "Continue payment UI (in progress) or configure Stripe webhook",
            "expected_risks": ["Webhook handling blocked on Stripe config", "Security audit blocked until webhook and UI complete", "Budget overrun risk (60% used at 40% progress)"],
            "what_good_plan_looks_like": "Continues UI work, suggests refund functionality, flags webhook blocker and budget risk.",
            "common_failure_modes": ["misses_budget_risk", "suggests_blocked_task", "misses_security_audit_dependency"],
            "acceptable_variation": "May suggest different unblocking actions. Should flag budget risk.",
            "notes": "Webhook blocked, budget overrun risk. Should continue UI and flag risks.",
        },
    },
    {
        "id": "008",
        "input": {
            "project_context": {"name": "Data Pipeline", "start_date": "2026-03-15", "target_date": "2026-06-15", "progress": "10%", "budget_used": "15%", "team_size": 2},
            "task_state": [
                {"title": "Define data schema", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Set up data ingestion", "priority": "high", "status": "blocked", "depends_on": [], "blocker": "AWS access not granted"},
                {"title": "Build transformation layer", "priority": "high", "status": "pending", "depends_on": ["Set up data ingestion"]},
                {"title": "Create data warehouse tables", "priority": "medium", "status": "pending", "depends_on": ["Define data schema"]},
                {"title": "Set up monitoring and alerting", "priority": "low", "status": "pending", "depends_on": ["Set up data ingestion"]},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "blocked",
            "expected_plan": ["Create data warehouse tables", "Set up data ingestion (unblock)", "Build transformation layer", "Set up monitoring and alerting"],
            "expected_next_work": "Create data warehouse tables",
            "expected_risks": ["Data ingestion blocked on AWS access", "Transformation layer blocked until ingestion complete", "Project just started (10% progress)"],
            "what_good_plan_looks_like": "Suggests warehouse tables (unblocked) as next work. Flags AWS access blocker.",
            "common_failure_modes": ["suggests_blocked_task", "misses_unblocked_alternative"],
            "acceptable_variation": "May suggest following up on AWS access. Warehouse tables are valid next work.",
            "notes": "Ingestion blocked on AWS access. Warehouse tables are unblocked and should be next work.",
        },
    },

    # ── Overdue Project (4 cases) ──────────────────────────────────────────
    {
        "id": "009",
        "input": {
            "project_context": {"name": "Website Migration", "start_date": "2026-01-15", "target_date": "2026-03-15", "progress": "30%", "budget_used": "70%", "team_size": 3},
            "task_state": [
                {"title": "Audit current site", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Design new site structure", "priority": "high", "status": "completed", "depends_on": ["Audit current site"]},
                {"title": "Migrate content", "priority": "high", "status": "in_progress", "depends_on": ["Design new site structure"]},
                {"title": "Set up redirects", "priority": "high", "status": "pending", "depends_on": ["Migrate content"]},
                {"title": "Test new site", "priority": "high", "status": "pending", "depends_on": ["Migrate content", "Set up redirects"]},
                {"title": "Go live", "priority": "high", "status": "pending", "depends_on": ["Test new site"]},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "overdue",
            "expected_plan": ["Migrate content", "Set up redirects", "Test new site", "Go live"],
            "expected_next_work": "Migrate content",
            "expected_risks": ["Project is 2 weeks past target date", "Budget overrun (70% used at 30% progress)", "All remaining tasks are high priority"],
            "what_good_plan_looks_like": "Flags overdue status and budget risk. Prioritizes remaining critical path tasks.",
            "common_failure_modes": ["misses_overdue_status", "misses_budget_risk", "suggests_non_critical_tasks"],
            "acceptable_variation": "May suggest different risk mitigation. Should flag overdue and budget.",
            "notes": "Project 2 weeks overdue, budget overrun. All remaining tasks are critical path.",
        },
    },
    {
        "id": "010",
        "input": {
            "project_context": {"name": "Mobile App Launch", "start_date": "2025-12-01", "target_date": "2026-02-01", "progress": "50%", "budget_used": "80%", "team_size": 6},
            "task_state": [
                {"title": "Design app screens", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Build core features", "priority": "high", "status": "completed", "depends_on": ["Design app screens"]},
                {"title": "Implement push notifications", "priority": "medium", "status": "in_progress", "depends_on": []},
                {"title": "Beta testing", "priority": "high", "status": "pending", "depends_on": ["Build core features"]},
                {"title": "Fix beta bugs", "priority": "high", "status": "pending", "depends_on": ["Beta testing"]},
                {"title": "App store submission", "priority": "high", "status": "pending", "depends_on": ["Fix beta bugs"]},
                {"title": "Marketing campaign", "priority": "medium", "status": "pending", "depends_on": []},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "overdue",
            "expected_plan": ["Beta testing", "Fix beta bugs", "App store submission", "Implement push notifications", "Marketing campaign"],
            "expected_next_work": "Beta testing",
            "expected_risks": ["Project is 2 months overdue", "Severe budget overrun (80% used at 50% progress)", "Critical path: beta → bugs → submission"],
            "what_good_plan_looks_like": "Flags severe overdue and budget issues. Prioritizes beta testing as critical path start.",
            "common_failure_modes": ["misses_severity_of_overdue", "suggests_marketing_over_beta", "misses_budget_crisis"],
            "acceptable_variation": "May suggest different crisis management. Beta testing should be next work.",
            "notes": "Project 2 months overdue, severe budget overrun. Beta testing is critical path start.",
        },
    },
    {
        "id": "011",
        "input": {
            "project_context": {"name": "ERP Upgrade", "start_date": "2026-01-01", "target_date": "2026-04-01", "progress": "25%", "budget_used": "50%", "team_size": 8},
            "task_state": [
                {"title": "Assess current ERP", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Plan upgrade path", "priority": "high", "status": "completed", "depends_on": ["Assess current ERP"]},
                {"title": "Backup current data", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Upgrade database", "priority": "high", "status": "in_progress", "depends_on": ["Backup current data"]},
                {"title": "Upgrade application server", "priority": "high", "status": "pending", "depends_on": ["Upgrade database"]},
                {"title": "Migrate custom modules", "priority": "high", "status": "pending", "depends_on": ["Upgrade application server"]},
                {"title": "User acceptance testing", "priority": "high", "status": "pending", "depends_on": ["Migrate custom modules"]},
                {"title": "Go live", "priority": "high", "status": "pending", "depends_on": ["User acceptance testing"]},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "overdue",
            "expected_plan": ["Upgrade database", "Upgrade application server", "Migrate custom modules", "User acceptance testing", "Go live"],
            "expected_next_work": "Upgrade database",
            "expected_risks": ["Project is behind schedule (25% at 75% timeline)", "Budget overrun risk (50% used at 25% progress)", "All remaining tasks are sequential high-priority"],
            "what_good_plan_looks_like": "Flags schedule and budget risks. Identifies sequential critical path. Continues database upgrade.",
            "common_failure_modes": ["misses_sequential_dependency_chain", "misses_budget_trajectory"],
            "acceptable_variation": "May suggest different risk mitigation. Should flag budget trajectory.",
            "notes": "Behind schedule with budget concerns. Sequential critical path from database to go-live.",
        },
    },
    {
        "id": "012",
        "input": {
            "project_context": {"name": "Security Audit", "start_date": "2026-02-01", "target_date": "2026-03-01", "progress": "60%", "budget_used": "90%", "team_size": 2},
            "task_state": [
                {"title": "Scan dependencies", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Penetration testing", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Review access controls", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Document findings", "priority": "high", "status": "in_progress", "depends_on": ["Scan dependencies", "Penetration testing", "Review access controls"]},
                {"title": "Create remediation plan", "priority": "high", "status": "pending", "depends_on": ["Document findings"]},
                {"title": "Present to leadership", "priority": "high", "status": "pending", "depends_on": ["Create remediation plan"]},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "overdue",
            "expected_plan": ["Document findings", "Create remediation plan", "Present to leadership"],
            "expected_next_work": "Document findings",
            "expected_risks": ["Project is 1 month overdue", "Severe budget overrun (90% used at 60% progress)", "Only 3 tasks remaining but all high priority"],
            "what_good_plan_looks_like": "Flags overdue and severe budget issues. Continues documentation as critical path.",
            "common_failure_modes": ["misses_budget_crisis", "suggests_non_essential_work"],
            "acceptable_variation": "May suggest different crisis management. Documentation should continue.",
            "notes": "1 month overdue, 90% budget used. Only 3 tasks remain on critical path.",
        },
    },

    # ── New Project (4 cases) ──────────────────────────────────────────────
    {
        "id": "013",
        "input": {
            "project_context": {"name": "AI Chatbot", "start_date": "2026-04-01", "target_date": "2026-07-01", "progress": "5%", "budget_used": "3%", "team_size": 3},
            "task_state": [
                {"title": "Define chatbot requirements", "priority": "high", "status": "in_progress", "depends_on": []},
                {"title": "Research LLM providers", "priority": "medium", "status": "pending", "depends_on": []},
                {"title": "Design conversation flows", "priority": "high", "status": "pending", "depends_on": ["Define chatbot requirements"]},
                {"title": "Build prototype", "priority": "high", "status": "pending", "depends_on": ["Research LLM providers", "Design conversation flows"]},
                {"title": "User testing", "priority": "medium", "status": "pending", "depends_on": ["Build prototype"]},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "normal",
            "expected_plan": ["Define chatbot requirements", "Research LLM providers", "Design conversation flows", "Build prototype", "User testing"],
            "expected_next_work": "Define chatbot requirements",
            "expected_risks": ["New project with undefined scope", "LLM provider choice will impact architecture"],
            "what_good_plan_looks_like": "Sets up project rhythms. Requirements first, then parallel research and design.",
            "common_failure_modes": ["over_decomposed_for_new_project", "misses_parallel_opportunities"],
            "acceptable_variation": "May suggest different setup activities. Requirements should be first.",
            "notes": "Newly started project. Requirements in progress. Should set up project rhythms.",
        },
    },
    {
        "id": "014",
        "input": {
            "project_context": {"name": "Employee Portal", "start_date": "2026-04-01", "target_date": "2026-06-01", "progress": "0%", "budget_used": "0%", "team_size": 4},
            "task_state": [],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "normal",
            "expected_plan": ["Define project scope and requirements", "Set up development environment", "Create project timeline and milestones", "Identify key stakeholders"],
            "expected_next_work": "Define project scope and requirements",
            "expected_risks": ["No tasks defined yet", "Project needs initial planning"],
            "what_good_plan_looks_like": "Recommends initial planning activities. Does not invent specific technical tasks.",
            "common_failure_modes": ["invents_specific_technical_tasks", "overly_prescriptive"],
            "acceptable_variation": "May suggest different planning activities. Should focus on setup.",
            "notes": "Brand new project with no tasks. Should recommend planning activities.",
        },
    },
    {
        "id": "015",
        "input": {
            "project_context": {"name": "Data Dashboard", "start_date": "2026-04-01", "target_date": "2026-05-15", "progress": "10%", "budget_used": "5%", "team_size": 2},
            "task_state": [
                {"title": "Gather dashboard requirements", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Set up data connections", "priority": "high", "status": "pending", "depends_on": []},
                {"title": "Design dashboard layout", "priority": "medium", "status": "pending", "depends_on": ["Gather dashboard requirements"]},
                {"title": "Build visualization components", "priority": "high", "status": "pending", "depends_on": ["Set up data connections", "Design dashboard layout"]},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "normal",
            "expected_plan": ["Set up data connections", "Design dashboard layout", "Build visualization components"],
            "expected_next_work": "Set up data connections",
            "expected_risks": ["Short timeline (6 weeks)", "Data connections are critical path"],
            "what_good_plan_looks_like": "Suggests data connections as next work (unblocked, high priority). Notes short timeline.",
            "common_failure_modes": ["misses_short_timeline", "suggests_design_over_data"],
            "acceptable_variation": "May suggest design layout as parallel work. Data connections are critical.",
            "notes": "New project with short timeline. Data connections are critical path start.",
        },
    },
    {
        "id": "016",
        "input": {
            "project_context": {"name": "Unknown Project", "start_date": None, "target_date": None, "progress": None, "budget_used": None, "team_size": None},
            "task_state": [],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "adversarial",
            "expected_plan": [],
            "expected_next_work": "Define project basics before planning",
            "expected_risks": ["No project data available"],
            "what_good_plan_looks_like": "Notes lack of data. Recommends defining project basics. Does not invent plans.",
            "common_failure_modes": ["invents_project_plan", "generic_advice"],
            "acceptable_variation": "Should note missing data. May suggest different setup steps.",
            "notes": "No project data. Should not invent plan.",
        },
    },

    # ── Complex Dependencies (4 cases) ─────────────────────────────────────
    {
        "id": "017",
        "input": {
            "project_context": {"name": "E-commerce Platform", "start_date": "2026-01-01", "target_date": "2026-06-01", "progress": "35%", "budget_used": "30%", "team_size": 8},
            "task_state": [
                {"title": "Design product catalog", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Build shopping cart", "priority": "high", "status": "completed", "depends_on": ["Design product catalog"]},
                {"title": "Implement payment gateway", "priority": "high", "status": "in_progress", "depends_on": ["Build shopping cart"]},
                {"title": "Build order management", "priority": "high", "status": "pending", "depends_on": ["Implement payment gateway", "Build shopping cart"]},
                {"title": "Set up inventory system", "priority": "medium", "status": "pending", "depends_on": ["Design product catalog"]},
                {"title": "Build user reviews", "priority": "low", "status": "pending", "depends_on": ["Design product catalog"]},
                {"title": "Implement recommendation engine", "priority": "medium", "status": "pending", "depends_on": ["Build user reviews", "Build order management"]},
                {"title": "Set up analytics", "priority": "low", "status": "pending", "depends_on": []},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "complex",
            "expected_plan": ["Implement payment gateway", "Build order management", "Set up inventory system", "Build user reviews", "Implement recommendation engine", "Set up analytics"],
            "expected_next_work": "Implement payment gateway",
            "expected_risks": ["Order management blocked until payment gateway complete", "Recommendation engine has long dependency chain"],
            "what_good_plan_looks_like": "Continues payment gateway, then order management. Inventory and reviews can be parallel. Flags recommendation engine dependency chain.",
            "common_failure_modes": ["wrong_dependency_order", "misses_parallel_opportunities", "misses_long_dependency_chain"],
            "acceptable_variation": "May suggest different parallel work ordering. Payment gateway should be first.",
            "notes": "Complex dependency graph. Payment gateway is critical path. Recommendation engine has long chain.",
        },
    },
    {
        "id": "018",
        "input": {
            "project_context": {"name": "Microservices Migration", "start_date": "2026-02-01", "target_date": "2026-08-01", "progress": "20%", "budget_used": "25%", "team_size": 6},
            "task_state": [
                {"title": "Identify service boundaries", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Set up service mesh", "priority": "high", "status": "completed", "depends_on": ["Identify service boundaries"]},
                {"title": "Migrate user service", "priority": "high", "status": "in_progress", "depends_on": ["Set up service mesh"]},
                {"title": "Migrate order service", "priority": "high", "status": "pending", "depends_on": ["Set up service mesh", "Migrate user service"]},
                {"title": "Migrate payment service", "priority": "high", "status": "pending", "depends_on": ["Set up service mesh", "Migrate order service"]},
                {"title": "Migrate notification service", "priority": "medium", "status": "pending", "depends_on": ["Set up service mesh"]},
                {"title": "Migrate analytics service", "priority": "medium", "status": "pending", "depends_on": ["Set up service mesh", "Migrate user service"]},
                {"title": "Decommission monolith", "priority": "high", "status": "pending", "depends_on": ["Migrate user service", "Migrate order service", "Migrate payment service", "Migrate notification service", "Migrate analytics service"]},
            ],
            "planning_type": "project_plan",
        },
        "expected": {
            "planning_type": "project_plan",
            "category": "complex",
            "expected_plan": ["Migrate user service", "Migrate order service", "Migrate notification service", "Migrate analytics service", "Migrate payment service", "Decommission monolith"],
            "expected_next_work": "Migrate user service",
            "expected_risks": ["Payment service has long dependency chain (user → order → payment)", "Decommission monolith blocked until ALL services migrated"],
            "what_good_plan_looks_like": "Continues user service. Identifies notification and analytics as parallel work. Flags monolith decommission as final gate.",
            "common_failure_modes": ["wrong_migration_order", "misses_parallel_services", "misses_monolith_gate"],
            "acceptable_variation": "May suggest different parallel service ordering. User service should continue first.",
            "notes": "Sequential migration chain with parallel opportunities. Monolith decommission is final gate.",
        },
    },
    {
        "id": "019",
        "input": {
            "project_context": {"name": "CI/CD Overhaul", "start_date": "2026-03-01", "target_date": "2026-05-01", "progress": "40%", "budget_used": "35%", "team_size": 3},
            "task_state": [
                {"title": "Audit current pipeline", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Design new pipeline architecture", "priority": "high", "status": "completed", "depends_on": ["Audit current pipeline"]},
                {"title": "Set up build servers", "priority": "high", "status": "completed", "depends_on": ["Design new pipeline architecture"]},
                {"title": "Migrate build scripts", "priority": "high", "status": "in_progress", "depends_on": ["Set up build servers"]},
                {"title": "Set up test automation", "priority": "high", "status": "pending", "depends_on": ["Set up build servers"]},
                {"title": "Configure deployment pipelines", "priority": "high", "status": "pending", "depends_on": ["Migrate build scripts", "Set up test automation"]},
                {"title": "Train team on new pipeline", "priority": "medium", "status": "pending", "depends_on": ["Configure deployment pipelines"]},
                {"title": "Decommission old pipeline", "priority": "medium", "status": "pending", "depends_on": ["Configure deployment pipelines", "Train team on new pipeline"]},
            ],
            "planning_type": "next_work",
        },
        "expected": {
            "planning_type": "next_work",
            "category": "complex",
            "expected_plan": ["Migrate build scripts", "Set up test automation", "Configure deployment pipelines", "Train team on new pipeline", "Decommission old pipeline"],
            "expected_next_work": "Migrate build scripts",
            "expected_risks": ["Deployment pipelines blocked until both build scripts and test automation complete", "Team training needed before decommissioning old pipeline"],
            "what_good_plan_looks_like": "Continues build scripts. Suggests test automation as parallel work. Flags deployment pipeline dependency.",
            "common_failure_modes": ["misses_parallel_test_automation", "wrong_deployment_ordering"],
            "acceptable_variation": "May suggest test automation as next work (also unblocked). Build scripts should continue.",
            "notes": "Build scripts in progress. Test automation can start in parallel. Deployment blocked on both.",
        },
    },
    {
        "id": "020",
        "input": {
            "project_context": {"name": "API Redesign", "start_date": "2026-02-15", "target_date": "2026-05-15", "progress": "25%", "budget_used": "30%", "team_size": 4},
            "task_state": [
                {"title": "Document current API", "priority": "high", "status": "completed", "depends_on": []},
                {"title": "Design new API schema", "priority": "high", "status": "completed", "depends_on": ["Document current API"]},
                {"title": "Implement v2 endpoints", "priority": "high", "status": "in_progress", "depends_on": ["Design new API schema"]},
                {"title": "Write v2 documentation", "priority": "medium", "status": "pending", "depends_on": ["Design new API schema"]},
                {"title": "Build backward compatibility layer", "priority": "high", "status": "pending", "depends_on": ["Implement v2 endpoints"]},
                {"title": "Migrate existing clients to v2", "priority": "high", "status": "pending", "depends_on": ["Build backward compatibility layer", "Write v2 documentation"]},
                {"title": "Deprecate v1 endpoints", "priority": "medium", "status": "pending", "depends_on": ["Migrate existing clients to v2"]},
            ],
            "planning_type": "work_graph_analysis",
        },
        "expected": {
            "planning_type": "work_graph_analysis",
            "category": "complex",
            "expected_plan": ["Implement v2 endpoints", "Write v2 documentation", "Build backward compatibility layer", "Migrate existing clients to v2", "Deprecate v1 endpoints"],
            "expected_next_work": "Implement v2 endpoints",
            "expected_risks": ["Client migration blocked until both compatibility layer and documentation complete", "V1 deprecation is final gate"],
            "what_good_plan_looks_like": "Continues v2 endpoints. Suggests documentation as parallel work. Flags client migration dependency.",
            "common_failure_modes": ["wrong_migration_order", "misses_parallel_documentation", "misses_client_migration_dependency"],
            "acceptable_variation": "May suggest documentation as next work (also unblocked). V2 endpoints should continue.",
            "notes": "V2 endpoints in progress. Documentation can be parallel. Client migration has complex dependency.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-cp/eval-lab/tasks/context-aware-planning-quality"

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
        f.write(f'[task]\nname = "context-aware-planning-case-{cid}"\ndescription = "{case["expected"]["what_good_plan_looks_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: planning_type={case['expected']['planning_type']}, category={case['expected']['category']}")

print(f"\nGenerated {len(CASES)} cases")
