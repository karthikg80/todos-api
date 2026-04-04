#!/usr/bin/env python3
"""Generate prioritization benchmark cases."""
import json
import os

CASES = [
    # ── Clear priority ordering ────────────────────────────────────────────
    {
        "id": "001",
        "input": {
            "tasks": [
                {"title": "Fix production server crash", "metadata": "urgent, all users affected"},
                {"title": "Update team documentation", "metadata": "low urgency, nice to have"},
                {"title": "Prepare Q1 board presentation", "metadata": "due tomorrow, CEO attending"},
                {"title": "Order office supplies", "metadata": "no deadline, can wait"},
            ],
            "context": "You manage a team of 8 engineers. It's Monday morning.",
        },
        "expected": {
            "category": "clear-urgency",
            "expected_order": [
                "Fix production server crash",
                "Prepare Q1 board presentation",
                "Update team documentation",
                "Order office supplies",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Production crash first (all users affected), then board presentation (due tomorrow, CEO), then documentation, then supplies.",
            "common_failure_modes": ["puts_supplies_first", "misses_production_urgency", "ignores_board_deadline"],
            "acceptable_variation": "May swap documentation and supplies. Must put crash first and presentation second.",
            "notes": "Clear urgency differences. Production crash is P0, board presentation is P1.",
        },
    },
    {
        "id": "002",
        "input": {
            "tasks": [
                {"title": "Deploy v2.3 to production", "metadata": "tested, approved, ready"},
                {"title": "Write unit tests for payment module", "metadata": "blocking release"},
                {"title": "Review PR #432", "metadata": "blocking deployment"},
                {"title": "Plan next sprint", "metadata": "meeting tomorrow"},
            ],
            "context": "You are the tech lead. Release is scheduled for Friday.",
        },
        "expected": {
            "category": "clear-dependencies",
            "expected_order": [
                "Write unit tests for payment module",
                "Review PR #432",
                "Deploy v2.3 to production",
                "Plan next sprint",
            ],
            "expected_dependencies": {
                "Review PR #432": "Write unit tests for payment module",
                "Deploy v2.3 to production": "Review PR #432",
            },
            "expected_ties": [],
            "expected_blocked": {
                "Deploy v2.3 to production": "Review PR #432",
            },
            "what_good_prioritization_looks_like": "Tests first (blocking), then PR review (blocking deploy), then deploy, then sprint planning.",
            "common_failure_modes": ["deploys_before_review", "plans_sprint_before_deploy", "misses_blocking_chain"],
            "acceptable_variation": "May put sprint planning before deploy if reasoning is sound. Must respect dependency chain.",
            "notes": "Clear dependency chain: tests → review → deploy. Sprint planning is independent.",
        },
    },
    # ── Ambiguous: similar urgency ─────────────────────────────────────────
    {
        "id": "003",
        "input": {
            "tasks": [
                {"title": "Refactor authentication module", "metadata": "technical debt, no deadline"},
                {"title": "Add dark mode to mobile app", "metadata": "user request, no deadline"},
                {"title": "Update API documentation", "metadata": "outdated, no deadline"},
                {"title": "Investigate slow query on reports page", "metadata": "performance issue, no deadline"},
            ],
            "context": "All tasks are important but none are urgent. Team has capacity for 2 this week.",
        },
        "expected": {
            "category": "ambiguous",
            "expected_order": [
                "Investigate slow query on reports page",
                "Refactor authentication module",
                "Add dark mode to mobile app",
                "Update API documentation",
            ],
            "expected_dependencies": {},
            "expected_ties": [["Add dark mode to mobile app", "Update API documentation"]],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Performance issue first (user impact), then auth refactor (security), then dark mode and docs (similar priority, can be tied).",
            "common_failure_modes": ["puts_docs_first", "ignores_performance_impact", "no_tie_identification"],
            "acceptable_variation": "May order dark mode and docs differently. Should identify them as similar priority.",
            "notes": "No clear urgency. Should prioritize by impact and identify ties.",
        },
    },
    # ── Many ties: hard to differentiate ───────────────────────────────────
    {
        "id": "004",
        "input": {
            "tasks": [
                {"title": "Fix typo in homepage", "metadata": "cosmetic, low impact"},
                {"title": "Update footer copyright year", "metadata": "cosmetic, low impact"},
                {"title": "Change button color on settings page", "metadata": "design tweak, low impact"},
                {"title": "Add alt text to 3 images", "metadata": "accessibility, low impact"},
                {"title": "Update README with new logo", "metadata": "documentation, low impact"},
            ],
            "context": "All tasks are small, low-impact UI tweaks. Team has capacity for all of them.",
        },
        "expected": {
            "category": "many-ties",
            "expected_order": [
                "Add alt text to 3 images",
                "Fix typo in homepage",
                "Update footer copyright year",
                "Change button color on settings page",
                "Update README with new logo",
            ],
            "expected_dependencies": {},
            "expected_ties": [
                ["Fix typo in homepage", "Update footer copyright year", "Change button color on settings page", "Update README with new logo"],
            ],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Accessibility first (alt text), then groups remaining tasks as similar priority.",
            "common_failure_modes": ["creates_false_ordering", "misses_accessibility_priority", "no_tie_identification"],
            "acceptable_variation": "May order tied tasks differently. Should identify most as similar priority.",
            "notes": "Most tasks are similar priority. Accessibility (alt text) has slight edge.",
        },
    },
    # ── Conflicting signals ────────────────────────────────────────────────
    {
        "id": "005",
        "input": {
            "tasks": [
                {"title": "Launch new feature to all users", "metadata": "marketing campaign starts today"},
                {"title": "Fix critical security vulnerability", "metadata": "affects 5% of users, exploit known"},
                {"title": "Respond to customer complaint about billing", "metadata": "VIP customer, threatening to leave"},
                {"title": "Complete quarterly compliance audit", "metadata": "due end of week, legal requirement"},
            ],
            "context": "You are the product manager. It's Monday morning.",
        },
        "expected": {
            "category": "conflicting-signals",
            "expected_order": [
                "Fix critical security vulnerability",
                "Respond to customer complaint about billing",
                "Complete quarterly compliance audit",
                "Launch new feature to all users",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Security first (known exploit), then VIP customer (revenue risk), then compliance (legal deadline), then feature launch (can wait).",
            "common_failure_modes": ["launches_feature_before_security", "ignores_vip_customer", "misses_legal_deadline"],
            "acceptable_variation": "May swap customer and compliance. Must put security first and feature last.",
            "notes": "Conflicting urgency signals. Security is P0 despite small user base.",
        },
    },
    # ── Adversarial: misleading metadata ───────────────────────────────────
    {
        "id": "006",
        "input": {
            "tasks": [
                {"title": "Respond to CEO email", "metadata": "marked urgent but is just FYI"},
                {"title": "Fix bug affecting 1000 users", "metadata": "no deadline, workaround exists"},
                {"title": "Prepare weekly status report", "metadata": "due Friday, routine"},
                {"title": "Investigate production error from last week", "metadata": "already resolved, post-mortem needed"},
            ],
            "context": "You are an engineering manager. Some 'urgent' items are not actually urgent.",
        },
        "expected": {
            "category": "adversarial",
            "expected_order": [
                "Fix bug affecting 1000 users",
                "Investigate production error from last week",
                "Prepare weekly status report",
                "Respond to CEO email",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Bug affecting 1000 users first (real impact), then post-mortem (learning), then report (deadline), then CEO email (not actually urgent).",
            "common_failure_modes": ["responds_to_ceo_first", "takes_urgent_label_at_face_value", "ignores_user_impact"],
            "acceptable_variation": "May swap report and post-mortem. Must not put CEO email first.",
            "notes": "CEO email is marked urgent but is FYI. Should look past labels to real impact.",
        },
    },
    {
        "id": "007",
        "input": {
            "tasks": [
                {"title": "Migrate database to new schema", "metadata": "estimated 2 weeks, no deadline"},
                {"title": "Fix login page loading slowly", "metadata": "affects 30% of users, 5 second delay"},
                {"title": "Add export to CSV feature", "metadata": "requested by 3 customers"},
                {"title": "Update dependencies to latest versions", "metadata": "security patches included"},
            ],
            "context": "You are a solo developer. Can only do one task this week.",
        },
        "expected": {
            "category": "adversarial",
            "expected_order": [
                "Fix login page loading slowly",
                "Update dependencies to latest versions",
                "Add export to CSV feature",
                "Migrate database to new schema",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Login performance first (30% users, 5s delay), then security (dependencies), then feature request, then migration (longest, no deadline).",
            "common_failure_modes": ["starts_migration_first", "ignores_performance_impact", "misses_security_patches"],
            "acceptable_variation": "May swap dependencies and CSV. Must put login fix first and migration last.",
            "notes": "Migration is longest task with no deadline. Login fix has highest user impact.",
        },
    },
    # ── Additional cases for coverage ──────────────────────────────────────
    {
        "id": "008",
        "input": {
            "tasks": [
                {"title": "Set up CI/CD pipeline", "metadata": "blocking all future deploys"},
                {"title": "Write API for mobile app", "metadata": "mobile team waiting"},
                {"title": "Design new onboarding flow", "metadata": "marketing launch in 2 weeks"},
                {"title": "Fix broken email notifications", "metadata": "users not receiving password resets"},
            ],
            "context": "You are a full-stack developer. Multiple teams are blocked.",
        },
        "expected": {
            "category": "clear-urgency",
            "expected_order": [
                "Fix broken email notifications",
                "Set up CI/CD pipeline",
                "Write API for mobile app",
                "Design new onboarding flow",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Email fix first (password resets broken), then CI/CD (blocking deploys), then API (team waiting), then design (2 weeks out).",
            "common_failure_modes": ["starts_design_first", "ignores_broken_password_resets", "misses_ci_blocking"],
            "acceptable_variation": "May swap CI/CD and API. Must put email fix first.",
            "notes": "Broken password resets is P0. CI/CD is blocking infrastructure.",
        },
    },
    {
        "id": "009",
        "input": {
            "tasks": [
                {"title": "Review and merge feature branch A", "metadata": "tested, approved"},
                {"title": "Review and merge feature branch B", "metadata": "tested, approved"},
                {"title": "Deploy hotfix to production", "metadata": "fixes checkout bug"},
                {"title": "Update project roadmap", "metadata": "stakeholder meeting next week"},
            ],
            "context": "You are the tech lead. Hotfix is ready to go.",
        },
        "expected": {
            "category": "clear-urgency",
            "expected_order": [
                "Deploy hotfix to production",
                "Review and merge feature branch A",
                "Review and merge feature branch B",
                "Update project roadmap",
            ],
            "expected_dependencies": {},
            "expected_ties": [["Review and merge feature branch A", "Review and merge feature branch B"]],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Hotfix first (production bug), then PR reviews (tied), then roadmap (next week).",
            "common_failure_modes": ["reviews_before_hotfix", "updates_roadmap_first", "no_tie_identification"],
            "acceptable_variation": "May order PR reviews either way. Should identify them as tied.",
            "notes": "Hotfix is P0. PR reviews are tied. Roadmap can wait.",
        },
    },
    {
        "id": "010",
        "input": {
            "tasks": [
                {"title": "Optimize database queries", "metadata": "reports taking 30+ seconds"},
                {"title": "Implement user feedback form", "metadata": "requested by sales team"},
                {"title": "Set up monitoring alerts", "metadata": "no current alerts, risky"},
                {"title": "Refactor legacy payment code", "metadata": "works fine, but hard to maintain"},
            ],
            "context": "You are the sole backend developer. Team capacity: 1-2 tasks this week.",
        },
        "expected": {
            "category": "ambiguous",
            "expected_order": [
                "Optimize database queries",
                "Set up monitoring alerts",
                "Implement user feedback form",
                "Refactor legacy payment code",
            ],
            "expected_dependencies": {},
            "expected_ties": [["Implement user feedback form", "Refactor legacy payment code"]],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Query optimization first (user impact), then monitoring (risk reduction), then feedback form and refactoring (similar priority, can be tied).",
            "common_failure_modes": ["refactors_before_monitoring", "implements_form_before_queries", "no_tie_identification"],
            "acceptable_variation": "May swap feedback form and refactoring. Should identify them as similar priority.",
            "notes": "Query optimization has clear user impact. Monitoring is risk reduction.",
        },
    },
    {
        "id": "011",
        "input": {
            "tasks": [
                {"title": "Complete SOC 2 compliance documentation", "metadata": "audit in 3 days, legal requirement"},
                {"title": "Fix mobile app crash on iOS 17", "metadata": "affects 40% of users"},
                {"title": "Onboard new team member", "metadata": "starts Monday, needs setup"},
                {"title": "Prepare demo for investor meeting", "metadata": "meeting in 1 week"},
            ],
            "context": "You are the CTO of a 15-person startup.",
        },
        "expected": {
            "category": "conflicting-signals",
            "expected_order": [
                "Complete SOC 2 compliance documentation",
                "Fix mobile app crash on iOS 17",
                "Onboard new team member",
                "Prepare demo for investor meeting",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "SOC 2 first (3 days, legal), then app crash (40% users), then onboarding (new hire), then investor demo (1 week).",
            "common_failure_modes": ["prepares_demo_before_soc2", "ignores_40_percent_crash", "onboards_before_compliance"],
            "acceptable_variation": "May swap onboarding and investor demo. Must put SOC 2 first.",
            "notes": "SOC 2 has nearest deadline and legal requirement. App crash has highest user impact.",
        },
    },
    {
        "id": "012",
        "input": {
            "tasks": [
                {"title": "Write integration tests for checkout flow", "metadata": "blocking release"},
                {"title": "Fix CSS bug on pricing page", "metadata": "cosmetic, wrong alignment"},
                {"title": "Update API rate limiting", "metadata": "current limits too generous"},
                {"title": "Add logging to payment processing", "metadata": "needed for debugging"},
            ],
            "context": "You are a backend developer. Release is scheduled for Friday.",
        },
        "expected": {
            "category": "clear-dependencies",
            "expected_order": [
                "Write integration tests for checkout flow",
                "Add logging to payment processing",
                "Update API rate limiting",
                "Fix CSS bug on pricing page",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Tests first (blocking release), then logging (needed for debugging), then rate limiting, then CSS (cosmetic).",
            "common_failure_modes": ["fixes_css_before_tests", "updates_rate_limiting_before_tests", "misses_blocking_release"],
            "acceptable_variation": "May swap logging and rate limiting. Must put tests first and CSS last.",
            "notes": "Tests are blocking release. CSS is cosmetic and lowest priority.",
        },
    },
    {
        "id": "013",
        "input": {
            "tasks": [
                {"title": "Respond to 15 customer support tickets", "metadata": "oldest is 3 days old"},
                {"title": "Fix search returning no results", "metadata": "affects all users, workaround exists"},
                {"title": "Update privacy policy for GDPR", "metadata": "legal deadline in 2 weeks"},
                {"title": "Plan team retrospective", "metadata": "sprint ends Friday"},
            ],
            "context": "You are the product manager of a SaaS product.",
        },
        "expected": {
            "category": "ambiguous",
            "expected_order": [
                "Fix search returning no results",
                "Respond to 15 customer support tickets",
                "Update privacy policy for GDPR",
                "Plan team retrospective",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Search fix first (all users affected), then support tickets (3 days old), then GDPR (2 weeks), then retrospective (Friday).",
            "common_failure_modes": ["plans_retrospective_first", "ignores_search_impact", "misses_support_backlog"],
            "acceptable_variation": "May swap support tickets and search. Must put retrospective last.",
            "notes": "Search affects all users. Support tickets are aging. GDPR has 2 weeks.",
        },
    },
    {
        "id": "014",
        "input": {
            "tasks": [
                {"title": "Deploy security patch", "metadata": "CVE-2024-1234, actively exploited"},
                {"title": "Migrate to new cloud provider", "metadata": "estimated 3 months, cost savings"},
                {"title": "Fix typo in error message", "metadata": "cosmetic, user reported"},
                {"title": "Implement two-factor authentication", "metadata": "requested by enterprise customers"},
            ],
            "context": "You are the security engineer at a fintech company.",
        },
        "expected": {
            "category": "clear-urgency",
            "expected_order": [
                "Deploy security patch",
                "Implement two-factor authentication",
                "Migrate to new cloud provider",
                "Fix typo in error message",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Security patch first (actively exploited), then 2FA (enterprise customers), then migration (long-term), then typo (cosmetic).",
            "common_failure_modes": ["starts_migration_first", "fixes_typo_before_security", "misses_active_exploitation"],
            "acceptable_variation": "May swap 2FA and migration. Must put security patch first and typo last.",
            "notes": "Actively exploited CVE is P0. Typo is lowest priority.",
        },
    },
    {
        "id": "015",
        "input": {
            "tasks": [
                {"title": "Create onboarding guide for new hires", "metadata": "5 new hires starting next month"},
                {"title": "Fix broken link in footer", "metadata": "404 error, low traffic page"},
                {"title": "Upgrade Node.js from v16 to v20", "metadata": "v16 EOL in 3 months"},
                {"title": "Add dark mode to dashboard", "metadata": "top user request"},
            ],
            "context": "You are a developer on a small team.",
        },
        "expected": {
            "category": "ambiguous",
            "expected_order": [
                "Upgrade Node.js from v16 to v20",
                "Create onboarding guide for new hires",
                "Add dark mode to dashboard",
                "Fix broken link in footer",
            ],
            "expected_dependencies": {},
            "expected_ties": [["Add dark mode to dashboard", "Fix broken link in footer"]],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Node.js upgrade first (EOL deadline), then onboarding (5 new hires), then dark mode (user request), then broken link (low traffic).",
            "common_failure_modes": ["fixes_link_before_upgrade", "creates_guide_before_upgrade", "no_tie_identification"],
            "acceptable_variation": "May swap dark mode and broken link. Should identify them as similar priority.",
            "notes": "Node.js EOL is the hardest deadline. Broken link is lowest impact.",
        },
    },
    {
        "id": "016",
        "input": {
            "tasks": [
                {"title": "Respond to investor due diligence request", "metadata": "funding round closes in 1 week"},
                {"title": "Fix production database backup failure", "metadata": "no backups for 2 days"},
                {"title": "Complete employee performance reviews", "metadata": "HR deadline in 2 weeks"},
                {"title": "Update company website homepage", "metadata": "rebranding launch in 1 month"},
            ],
            "context": "You are the COO of a 50-person company.",
        },
        "expected": {
            "category": "conflicting-signals",
            "expected_order": [
                "Fix production database backup failure",
                "Respond to investor due diligence request",
                "Complete employee performance reviews",
                "Update company website homepage",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Database backup first (data risk), then investor response (1 week funding), then reviews (2 weeks), then website (1 month).",
            "common_failure_modes": ["responds_to_investors_before_backup", "updates_website_first", "misses_data_risk"],
            "acceptable_variation": "May swap investor response and reviews. Must put backup first and website last.",
            "notes": "No backups for 2 days is existential risk. Funding round is nearest deadline.",
        },
    },
    {
        "id": "017",
        "input": {
            "tasks": [
                {"title": "Write post-mortem for last week's outage", "metadata": "requested by CEO"},
                {"title": "Implement automated backup verification", "metadata": "prevents future outages"},
                {"title": "Fix minor UI glitch on profile page", "metadata": "cosmetic, 1 user reported"},
                {"title": "Update runbook for incident response", "metadata": "outdated, references old systems"},
            ],
            "context": "You are the SRE lead. Team just resolved a major outage.",
        },
        "expected": {
            "category": "clear-dependencies",
            "expected_order": [
                "Write post-mortem for last week's outage",
                "Implement automated backup verification",
                "Update runbook for incident response",
                "Fix minor UI glitch on profile page",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Post-mortem first (CEO request, learning), then backup verification (prevents future outages), then runbook, then UI glitch (cosmetic).",
            "common_failure_modes": ["fixes_ui_glitch_first", "updates_runbook_before_postmortem", "misses_ceo_request"],
            "acceptable_variation": "May swap backup verification and runbook. Must put post-mortem first and UI glitch last.",
            "notes": "Post-mortem is highest priority (CEO + learning). UI glitch is lowest.",
        },
    },
    {
        "id": "018",
        "input": {
            "tasks": [
                {"title": "Renew SSL certificates", "metadata": "expire in 3 days, site goes down"},
                {"title": "Fix pagination bug on search results", "metadata": "users can't see page 2+"},
                {"title": "Add SSO integration for enterprise client", "metadata": "deal worth $500k/year"},
                {"title": "Clean up unused feature flags", "metadata": "technical hygiene"},
            ],
            "context": "You are a senior engineer at a SaaS company.",
        },
        "expected": {
            "category": "clear-urgency",
            "expected_order": [
                "Renew SSL certificates",
                "Add SSO integration for enterprise client",
                "Fix pagination bug on search results",
                "Clean up unused feature flags",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "SSL first (site goes down in 3 days), then SSO ($500k deal), then pagination (user impact), then feature flags (hygiene).",
            "common_failure_modes": ["cleans_flags_first", "adds_sso_before_ssl", "ignores_site_down_risk"],
            "acceptable_variation": "May swap SSO and pagination. Must put SSL first and flags last.",
            "notes": "SSL expiring is existential. Feature flags are lowest value.",
        },
    },
    {
        "id": "019",
        "input": {
            "tasks": [
                {"title": "Prepare tax documents for accountant", "metadata": "deadline April 15"},
                {"title": "Fix email delivery delays", "metadata": "some emails arriving 2+ hours late"},
                {"title": "Update employee handbook", "metadata": "outdated policies, no deadline"},
                {"title": "Set up automated expense tracking", "metadata": "saves 2 hours per week"},
            ],
            "context": "You are the office manager at a small company.",
        },
        "expected": {
            "category": "ambiguous",
            "expected_order": [
                "Prepare tax documents for accountant",
                "Fix email delivery delays",
                "Set up automated expense tracking",
                "Update employee handbook",
            ],
            "expected_dependencies": {},
            "expected_ties": [["Set up automated expense tracking", "Update employee handbook"]],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Tax documents first (April 15 deadline), then email delays (user impact), then expense tracking and handbook (similar priority).",
            "common_failure_modes": ["updates_handbook_first", "sets_up_expense_before_email", "misses_tax_deadline"],
            "acceptable_variation": "May swap expense tracking and handbook. Should identify them as similar priority.",
            "notes": "Tax deadline is hardest. Email delays affect daily operations.",
        },
    },
    {
        "id": "020",
        "input": {
            "tasks": [
                {"title": "Deploy hotfix for checkout crash", "metadata": "affecting 20% of transactions"},
                {"title": "Review pull request for new feature", "metadata": "blocking feature release"},
                {"title": "Update staging environment", "metadata": "needed for testing"},
                {"title": "Attend weekly team standup", "metadata": "recurring, 30 minutes"},
            ],
            "context": "You are a developer. It's Tuesday morning.",
        },
        "expected": {
            "category": "clear-dependencies",
            "expected_order": [
                "Deploy hotfix for checkout crash",
                "Review pull request for new feature",
                "Update staging environment",
                "Attend weekly team standup",
            ],
            "expected_dependencies": {},
            "expected_ties": [],
            "expected_blocked": {},
            "what_good_prioritization_looks_like": "Hotfix first (20% transactions), then PR review (blocking feature), then staging update, then standup (recurring).",
            "common_failure_modes": ["attends_standup_first", "updates_staging_before_hotfix", "misses_transaction_impact"],
            "acceptable_variation": "May swap staging update and standup. Must put hotfix first.",
            "notes": "Checkout crash is P0 (revenue impact). Standup is lowest priority.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-priority/eval-lab/tasks/prioritization-quality"

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
        f.write(f'[task]\nname = "prioritization-case-{cid}"\ndescription = "{case["expected"]["what_good_prioritization_looks_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: category={case['expected']['category']}, order={case['expected']['expected_order'][:2]}...")

print(f"\nGenerated {len(CASES)} cases")
