#!/usr/bin/env python3
"""Generate structured extraction benchmark cases."""
import json
import os

CASES = [
    # ── Clear email with explicit tasks ────────────────────────────────────
    {
        "id": "001",
        "input": {
            "source_text": "Hi team,\n\nJust a few things to wrap up before the holiday:\n\n1. Please submit your Q4 expense reports by Friday Dec 15th\n2. Update the project timeline for the client presentation - it's due Jan 5th\n3. Schedule the team retrospective for next week, maybe Wednesday?\n4. Review the new design mockups and send feedback to Sarah by EOD Thursday\n\nThanks!\n- Mike",
            "source_type": "email",
        },
        "expected": {
            "category": "clear-email",
            "expected_tasks": [
                {"title": "Submit Q4 expense reports", "description": "Submit before Friday Dec 15th", "due_date": "2024-12-15", "priority": "high"},
                {"title": "Update project timeline for client presentation", "description": "Due Jan 5th", "due_date": "2025-01-05", "priority": "medium"},
                {"title": "Schedule team retrospective", "description": "For next week, maybe Wednesday", "due_date": None, "priority": "medium"},
                {"title": "Review design mockups and send feedback to Sarah", "description": "By EOD Thursday", "due_date": None, "priority": "medium"},
            ],
            "what_good_extraction_looks_like": "All 4 tasks extracted with correct titles, dates, and priorities. Expense report should be high priority due to firm deadline.",
            "common_failure_modes": ["misses_expense_report", "misses_design_review", "combines_tasks", "invents_extra_tasks"],
            "acceptable_variation": "Task titles may vary slightly. Dates should be extracted when present.",
            "notes": "Clear email with numbered tasks. Good baseline case.",
        },
    },
    # ── Meeting notes with implicit tasks ──────────────────────────────────
    {
        "id": "002",
        "input": {
            "source_text": "Meeting Notes - Product Sync (Dec 10)\n\nAttendees: Alice, Bob, Carol\n\nDiscussion:\n- The search feature is still returning irrelevant results. We need to fix the ranking algorithm before the end of the month.\n- Carol mentioned that the mobile app crashes on iOS 17 for about 30% of users. This is a P0.\n- We should probably set up better monitoring for the API. Current alerts are too noisy.\n- Bob will handle the database migration next sprint.\n- Need to update the onboarding docs since we changed the signup flow last week.\n\nAction items: TBD",
            "source_type": "meeting_notes",
        },
        "expected": {
            "category": "meeting-notes",
            "expected_tasks": [
                {"title": "Fix search ranking algorithm", "description": "Search returning irrelevant results, fix before end of month", "due_date": None, "priority": "high"},
                {"title": "Fix mobile app crash on iOS 17", "description": "Affects 30% of users, P0", "due_date": None, "priority": "high"},
                {"title": "Set up better API monitoring", "description": "Current alerts are too noisy", "due_date": None, "priority": "medium"},
                {"title": "Handle database migration", "description": "Next sprint, assigned to Bob", "due_date": None, "priority": "medium"},
                {"title": "Update onboarding documentation", "description": "Signup flow changed last week", "due_date": None, "priority": "low"},
            ],
            "what_good_extraction_looks_like": "5 tasks extracted from discussion points. P0 crash should be high priority. Database migration assigned to Bob.",
            "common_failure_modes": ["misses_api_monitoring", "misses_onboarding_docs", "invents_action_items", "combines_search_and_crash"],
            "acceptable_variation": "Task titles may vary. Priority inference is subjective but P0 should be high.",
            "notes": "Meeting notes with implicit tasks in discussion. Requires inference.",
        },
    },
    # ── Slack message with casual tasks ────────────────────────────────────
    {
        "id": "003",
        "input": {
            "source_text": "hey @channel quick reminder - we need to get the security audit done by end of week. also can someone update the README with the new setup instructions? the old ones are broken. oh and don't forget to rotate the API keys, they expire tomorrow. thx!",
            "source_type": "slack_message",
        },
        "expected": {
            "category": "slack-message",
            "expected_tasks": [
                {"title": "Complete security audit", "description": "Due by end of week", "due_date": None, "priority": "high"},
                {"title": "Update README with new setup instructions", "description": "Old instructions are broken", "due_date": None, "priority": "medium"},
                {"title": "Rotate API keys", "description": "Expire tomorrow", "due_date": None, "priority": "high"},
            ],
            "what_good_extraction_looks_like": "3 tasks extracted from casual Slack message. Security audit and API key rotation should be high priority.",
            "common_failure_modes": ["misses_api_keys", "misses_readme_update", "combines_all_into_one", "invents_extra_tasks"],
            "acceptable_variation": "Casual tone makes task boundaries fuzzy. 3 tasks is the right count.",
            "notes": "Casual Slack message with tasks embedded in prose.",
        },
    },
    # ── Voice transcript with rambling tasks ───────────────────────────────
    {
        "id": "004",
        "input": {
            "source_text": "Okay so um I was thinking about what we need to do this week and uh first thing is we really need to get that client proposal out by Wednesday because they're waiting on it and it's been sitting in my drafts for like three days now and then also I need to remember to call the dentist about rescheduling my appointment from next Tuesday to maybe Thursday instead and oh right the quarterly report is due next Friday so I should probably start working on that too and um I guess I should also follow up with the vendor about the invoice they sent last month because accounting keeps asking about it",
            "source_type": "voice_transcript",
        },
        "expected": {
            "category": "voice-transcript",
            "expected_tasks": [
                {"title": "Send client proposal", "description": "Due by Wednesday, been in drafts for 3 days", "due_date": None, "priority": "high"},
                {"title": "Call dentist to reschedule appointment", "description": "From next Tuesday to Thursday", "due_date": None, "priority": "medium"},
                {"title": "Start working on quarterly report", "description": "Due next Friday", "due_date": None, "priority": "medium"},
                {"title": "Follow up with vendor about invoice", "description": "Accounting keeps asking, invoice from last month", "due_date": None, "priority": "medium"},
            ],
            "what_good_extraction_looks_like": "4 tasks extracted from rambling voice transcript. Client proposal should be high priority due to deadline.",
            "common_failure_modes": ["misses_vendor_invoice", "misses_quarterly_report", "combines_tasks", "extracts_non_tasks"],
            "acceptable_variation": "Voice transcripts are noisy. Task boundaries may vary but 4 tasks is correct.",
            "notes": "Rambling voice transcript with filler words. Requires filtering noise.",
        },
    },
    # ── Noisy text with non-tasks mixed in ─────────────────────────────────
    {
        "id": "005",
        "input": {
            "source_text": "Today was a great day! Had lunch with the team at that new Italian place downtown - highly recommend the pasta. Anyway, back to work stuff: we need to deploy the hotfix to production ASAP, the bug is affecting checkout. Also, the design team wants us to review the new brand guidelines by Friday. Oh, and I should mention that the server room temperature was a bit high today, might want to check the AC. Finally, don't forget the team building event next month - it's going to be at the bowling alley!",
            "source_type": "note",
        },
        "expected": {
            "category": "noisy",
            "expected_tasks": [
                {"title": "Deploy hotfix to production", "description": "Bug affecting checkout, ASAP", "due_date": None, "priority": "high"},
                {"title": "Review new brand guidelines", "description": "Design team wants review by Friday", "due_date": None, "priority": "medium"},
            ],
            "what_good_extraction_looks_like": "Only 2 real tasks. Server room AC and team building event are NOT actionable tasks.",
            "common_failure_modes": ["extracts_server_ac_as_task", "extracts_team_building_as_task", "extracts_lunch_as_task", "misses_hotfix"],
            "acceptable_variation": "Should NOT extract non-actionable items. 2 tasks is correct.",
            "notes": "Noisy text with non-tasks mixed in. Tests ability to distinguish tasks from observations.",
        },
    },
    # ── Implicit tasks from problem description ────────────────────────────
    {
        "id": "006",
        "input": {
            "source_text": "The login page is loading really slowly - takes about 8 seconds. Users are complaining. Also, the password reset emails aren't being delivered, we've had 15 support tickets about it this week. The analytics dashboard shows that 40% of users drop off during signup, which is way higher than last month.",
            "source_type": "bug_report",
        },
        "expected": {
            "category": "implicit",
            "expected_tasks": [
                {"title": "Investigate slow login page loading", "description": "Takes 8 seconds, users complaining", "due_date": None, "priority": "high"},
                {"title": "Fix password reset email delivery", "description": "15 support tickets this week", "due_date": None, "priority": "high"},
                {"title": "Investigate signup drop-off rate", "description": "40% drop-off, higher than last month", "due_date": None, "priority": "medium"},
            ],
            "what_good_extraction_looks_like": "3 tasks inferred from problem descriptions. Each problem implies a task to fix it.",
            "common_failure_modes": ["misses_signup_dropoff", "combines_login_and_password", "extracts_problems_not_tasks"],
            "acceptable_variation": "Tasks should be action-oriented (investigate/fix), not just restating problems.",
            "notes": "Implicit tasks from problem descriptions. Requires inference from problems to actions.",
        },
    },
    # ── Adversarial: no tasks at all ───────────────────────────────────────
    {
        "id": "007",
        "input": {
            "source_text": "Just a quick update: the project is going well. We've made good progress on the frontend and the backend is on track. The team is motivated and we should hit our milestone next week. No blockers at this time. Have a great weekend!",
            "source_type": "status_update",
        },
        "expected": {
            "category": "adversarial",
            "expected_tasks": [],
            "what_good_extraction_looks_like": "No tasks extracted. This is a status update with no actionable items.",
            "common_failure_modes": ["invents_tasks", "extracts_hit_milestone_as_task", "extracts_have_great_weekend_as_task"],
            "acceptable_variation": "Should return empty list. No tasks present.",
            "notes": "Status update with no actionable tasks. Tests ability to return empty.",
        },
    },
    # ── Adversarial: ambiguous requests ────────────────────────────────────
    {
        "id": "008",
        "input": {
            "source_text": "Can you look into the performance issues we've been seeing? Also, maybe we should think about improving the onboarding experience at some point. And I heard the client is unhappy about something, not sure what though.",
            "source_type": "vague_request",
        },
        "expected": {
            "category": "adversarial",
            "expected_tasks": [
                {"title": "Investigate performance issues", "description": "Performance issues have been observed", "due_date": None, "priority": "medium"},
            ],
            "what_good_extraction_looks_like": "1 task extracted (investigate performance). Onboarding improvement is too vague ('at some point'). Client unhappiness has no actionable detail.",
            "common_failure_modes": ["extracts_onboarding_as_task", "extracts_client_unhappy_as_task", "misses_performance_investigation"],
            "acceptable_variation": "Should extract the performance investigation. Other items are too vague.",
            "notes": "Mix of actionable and vague requests. Tests ability to filter out non-actionable items.",
        },
    },
    # ── Multiple tasks with overlapping dates ──────────────────────────────
    {
        "id": "009",
        "input": {
            "source_text": "Project deadlines for Q1:\n- Jan 15: Complete user research phase\n- Jan 22: Finish wireframes and get stakeholder approval\n- Feb 5: Complete UI design and handoff to engineering\n- Feb 19: Engineering sprint 1 complete\n- Mar 5: Beta launch\n- Mar 19: Address beta feedback\n- Apr 2: Public launch",
            "source_type": "project_plan",
        },
        "expected": {
            "category": "clear-dates",
            "expected_tasks": [
                {"title": "Complete user research phase", "description": "Q1 project", "due_date": "2025-01-15", "priority": "medium"},
                {"title": "Finish wireframes and get stakeholder approval", "description": "Q1 project", "due_date": "2025-01-22", "priority": "medium"},
                {"title": "Complete UI design and handoff to engineering", "description": "Q1 project", "due_date": "2025-02-05", "priority": "medium"},
                {"title": "Complete engineering sprint 1", "description": "Q1 project", "due_date": "2025-02-19", "priority": "medium"},
                {"title": "Beta launch", "description": "Q1 project", "due_date": "2025-03-05", "priority": "high"},
                {"title": "Address beta feedback", "description": "Q1 project", "due_date": "2025-03-19", "priority": "medium"},
                {"title": "Public launch", "description": "Q1 project", "due_date": "2025-04-02", "priority": "high"},
            ],
            "what_good_extraction_looks_like": "7 tasks with correct dates. All dates should be extracted accurately.",
            "common_failure_modes": ["misses_dates", "combines_tasks", "wrong_date_format", "misses_beta_or_launch"],
            "acceptable_variation": "All 7 tasks should be extracted. Dates should be in YYYY-MM-DD format.",
            "notes": "Clear project plan with dates. Tests date extraction and task separation.",
        },
    },
    # ── Email thread with tasks from multiple people ───────────────────────
    {
        "id": "010",
        "input": {
            "source_text": "From: Alice\nTo: Team\nSubject: Re: Project Updates\n\nThanks for the updates. A few things:\n\n@Bob - can you finalize the API documentation by next Friday? The current draft is missing the authentication section.\n@Carol - please schedule a demo with the client for next week. They want to see the new features.\n@Dave - the security review needs to be completed before we can launch. Let's aim for end of month.\n\nAlso, I'll handle the budget review for the steering committee meeting on the 15th.\n\nBest,\nAlice",
            "source_type": "email_thread",
        },
        "expected": {
            "category": "email-thread",
            "expected_tasks": [
                {"title": "Finalize API documentation", "description": "Missing authentication section, assigned to Bob, due next Friday", "due_date": None, "priority": "medium"},
                {"title": "Schedule client demo", "description": "For next week, show new features, assigned to Carol", "due_date": None, "priority": "medium"},
                {"title": "Complete security review", "description": "Must be done before launch, aim for end of month, assigned to Dave", "due_date": None, "priority": "high"},
                {"title": "Handle budget review for steering committee", "description": "Meeting on the 15th, assigned to Alice", "due_date": None, "priority": "medium"},
            ],
            "what_good_extraction_looks_like": "4 tasks with assignees and deadlines extracted from email thread.",
            "common_failure_modes": ["misses_budget_review", "misses_security_review", "combines_tasks", "extracts_greeting_as_task"],
            "acceptable_variation": "Task titles may vary. Assignees and dates should be captured when present.",
            "notes": "Email thread with tasks from multiple people. Tests assignee extraction.",
        },
    },
    # ── Meeting transcript with decisions and actions ──────────────────────
    {
        "id": "011",
        "input": {
            "source_text": "DECISION: We're going with React for the frontend rewrite.\nACTION: Sarah to create the project repo and set up the initial scaffolding by end of week.\nDECISION: We'll use PostgreSQL instead of MongoDB for the new service.\nACTION: Mike to evaluate the migration effort and report back by next Wednesday.\nACTION: Team to review the API contract and provide feedback by Friday.\nNOTE: The client wants a progress update on the 20th.\nACTION: Prepare the progress update presentation for the client meeting on the 20th.",
            "source_type": "meeting_transcript",
        },
        "expected": {
            "category": "meeting-transcript",
            "expected_tasks": [
                {"title": "Create project repo and set up initial scaffolding", "description": "React frontend rewrite, assigned to Sarah, due end of week", "due_date": None, "priority": "medium"},
                {"title": "Evaluate PostgreSQL migration effort", "description": "Report back by next Wednesday, assigned to Mike", "due_date": None, "priority": "medium"},
                {"title": "Review API contract and provide feedback", "description": "By Friday, team task", "due_date": None, "priority": "medium"},
                {"title": "Prepare progress update presentation", "description": "For client meeting on the 20th", "due_date": None, "priority": "medium"},
            ],
            "what_good_extraction_looks_like": "4 ACTION items extracted. DECISIONs and NOTEs should NOT be extracted as tasks.",
            "common_failure_modes": ["extracts_decisions_as_tasks", "extracts_note_as_task", "misses_presentation_task"],
            "acceptable_variation": "Should only extract ACTION items. 4 tasks is correct.",
            "notes": "Structured meeting transcript with labeled decisions, actions, and notes.",
        },
    },
    # ── Noisy text with tasks buried in prose ──────────────────────────────
    {
        "id": "012",
        "input": {
            "source_text": "So I was thinking about our roadmap and there are a bunch of things we should probably tackle. The search functionality is pretty broken right now - users can't filter by date which is a big complaint. We also really need to get the mobile app updated since it's been months since the last release and the reviews are getting worse. Oh, and the analytics team keeps asking for the data pipeline to be fixed, apparently the numbers have been off for weeks. Also, I guess we should probably update the terms of service since we added the new features last quarter. And someone needs to clean up the old feature flags, there are like 50 of them and most are unused.",
            "source_type": "rambling_note",
        },
        "expected": {
            "category": "noisy",
            "expected_tasks": [
                {"title": "Fix search filtering by date", "description": "Users can't filter by date, big complaint", "due_date": None, "priority": "high"},
                {"title": "Update mobile app", "description": "Months since last release, reviews getting worse", "due_date": None, "priority": "high"},
                {"title": "Fix data pipeline for analytics", "description": "Numbers have been off for weeks", "due_date": None, "priority": "high"},
                {"title": "Update terms of service", "description": "New features added last quarter", "due_date": None, "priority": "low"},
                {"title": "Clean up old feature flags", "description": "50 flags, most unused", "due_date": None, "priority": "low"},
            ],
            "what_good_extraction_looks_like": "5 tasks extracted from rambling prose. Search, mobile, and data pipeline should be high priority.",
            "common_failure_modes": ["misses_feature_flags", "misses_terms_of_service", "combines_tasks", "extracts_non_tasks"],
            "acceptable_variation": "Task titles may vary. 5 tasks is correct.",
            "notes": "Tasks buried in rambling prose. Requires filtering signal from noise.",
        },
    },
    # ── Clear task list (easy case) ────────────────────────────────────────
    {
        "id": "013",
        "input": {
            "source_text": "TODO:\n- [ ] Buy groceries for the week\n- [ ] Call insurance company about claim #12345\n- [ ] Schedule dentist appointment for annual cleaning\n- [ ] Pay electricity bill (due March 1st)\n- [ ] Return library books (3 overdue)",
            "source_type": "todo_list",
        },
        "expected": {
            "category": "clear-todo",
            "expected_tasks": [
                {"title": "Buy groceries for the week", "description": "", "due_date": None, "priority": "medium"},
                {"title": "Call insurance company about claim #12345", "description": "", "due_date": None, "priority": "medium"},
                {"title": "Schedule dentist appointment for annual cleaning", "description": "", "due_date": None, "priority": "medium"},
                {"title": "Pay electricity bill", "description": "Due March 1st", "due_date": "2025-03-01", "priority": "high"},
                {"title": "Return library books", "description": "3 overdue", "due_date": None, "priority": "high"},
            ],
            "what_good_extraction_looks_like": "All 5 tasks extracted exactly. Electricity bill and library books should be higher priority.",
            "common_failure_modes": ["misses_library_books", "misses_electricity_bill", "combines_tasks", "wrong_priority"],
            "acceptable_variation": "Should extract all 5 tasks. Priority inference is subjective.",
            "notes": "Clear TODO list. Easy case to validate basic extraction works.",
        },
    },
    # ── Implicit tasks from user feedback ──────────────────────────────────
    {
        "id": "014",
        "input": {
            "source_text": "User feedback from last week:\n\n'I love the new dashboard but the loading time is terrible, it takes forever to load my reports.'\n'The search function doesn't work properly, I can't find anything even when I know it exists.'\n'Would be great if I could export my data to CSV, that would save me a lot of time.'\n'The mobile version is really hard to use on my phone, the buttons are too small.'\n'I wish there was a way to set reminders for important deadlines.'",
            "source_type": "user_feedback",
        },
        "expected": {
            "category": "implicit",
            "expected_tasks": [
                {"title": "Improve dashboard loading time", "description": "Reports take forever to load", "due_date": None, "priority": "high"},
                {"title": "Fix search function", "description": "Can't find existing items", "due_date": None, "priority": "high"},
                {"title": "Add CSV export for data", "description": "Would save users time", "due_date": None, "priority": "medium"},
                {"title": "Improve mobile usability", "description": "Buttons too small on phone", "due_date": None, "priority": "medium"},
                {"title": "Add reminder feature for deadlines", "description": "User request", "due_date": None, "priority": "low"},
            ],
            "what_good_extraction_looks_like": "5 tasks inferred from user feedback. Each complaint implies a task to fix it.",
            "common_failure_modes": ["misses_reminder_feature", "misses_csv_export", "extracts_feedback_not_tasks"],
            "acceptable_variation": "Tasks should be action-oriented. 5 tasks is correct.",
            "notes": "User feedback implying tasks. Requires inference from complaints to actions.",
        },
    },
    # ── Complex email with nested tasks ────────────────────────────────────
    {
        "id": "015",
        "input": {
            "source_text": "Hi team,\n\nFollowing up on our planning meeting. Here's what we agreed:\n\nPhase 1 (Jan-Feb):\n- Research: Conduct user interviews (5 minimum) by Jan 20\n- Design: Create wireframes based on research findings by Feb 3\n- Tech: Evaluate three framework options and present recommendation by Jan 27\n\nPhase 2 (Mar-Apr):\n- Development: Build MVP with core features (auth, dashboard, reporting)\n- Testing: Set up automated test suite\n- Launch: Beta launch to 100 users by Apr 15\n\nPlease confirm your assignments.\n\nThanks,\nProject Manager",
            "source_type": "planning_email",
        },
        "expected": {
            "category": "complex-email",
            "expected_tasks": [
                {"title": "Conduct user interviews", "description": "5 minimum, by Jan 20", "due_date": "2025-01-20", "priority": "medium"},
                {"title": "Create wireframes based on research", "description": "By Feb 3", "due_date": "2025-02-03", "priority": "medium"},
                {"title": "Evaluate three framework options", "description": "Present recommendation by Jan 27", "due_date": "2025-01-27", "priority": "medium"},
                {"title": "Build MVP with core features", "description": "Auth, dashboard, reporting", "due_date": None, "priority": "high"},
                {"title": "Set up automated test suite", "description": "Phase 2", "due_date": None, "priority": "medium"},
                {"title": "Beta launch to 100 users", "description": "By Apr 15", "due_date": "2025-04-15", "priority": "high"},
            ],
            "what_good_extraction_looks_like": "6 tasks extracted from structured planning email. All dates should be extracted.",
            "common_failure_modes": ["misses_framework_evaluation", "misses_test_suite", "combines_phases", "wrong_dates"],
            "acceptable_variation": "All 6 tasks should be extracted. Dates should be accurate.",
            "notes": "Complex planning email with phases and dates. Tests hierarchical task extraction.",
        },
    },
    # ── Adversarial: tasks disguised as questions ──────────────────────────
    {
        "id": "016",
        "input": {
            "source_text": "Hey, I was wondering if you could maybe look into why the reports are taking so long to generate? Also, would it be possible to get the client feedback compiled before the meeting on Thursday? And I'm not sure if anyone has updated the deployment docs since we switched to the new CI system last month?",
            "source_type": "polite_request",
        },
        "expected": {
            "category": "adversarial",
            "expected_tasks": [
                {"title": "Investigate slow report generation", "description": "Reports are taking too long", "due_date": None, "priority": "medium"},
                {"title": "Compile client feedback", "description": "Before the meeting on Thursday", "due_date": None, "priority": "medium"},
                {"title": "Update deployment docs", "description": "Switched to new CI system last month", "due_date": None, "priority": "low"},
            ],
            "what_good_extraction_looks_like": "3 tasks extracted from polite questions. Each question implies an action.",
            "common_failure_modes": ["misses_deployment_docs", "misses_client_feedback", "extracts_questions_not_tasks"],
            "acceptable_variation": "Tasks should be action-oriented, not restated as questions.",
            "notes": "Tasks disguised as polite questions. Tests ability to convert questions to actions.",
        },
    },
    # ── Noisy text with dates scattered throughout ─────────────────────────
    {
        "id": "017",
        "input": {
            "source_text": "Okay so the Q1 planning doc needs to be done by Jan 10th. Oh and the client demo is scheduled for Jan 25th - we need to prepare the slides. The budget review meeting is on Feb 1st. Don't forget the team offsite is March 15th. Also, the performance review cycle starts Feb 15th and we need to have all self-assessments in by then.",
            "source_type": "scattered_dates",
        },
        "expected": {
            "category": "clear-dates",
            "expected_tasks": [
                {"title": "Complete Q1 planning document", "description": "Due Jan 10th", "due_date": "2025-01-10", "priority": "high"},
                {"title": "Prepare slides for client demo", "description": "Demo on Jan 25th", "due_date": "2025-01-25", "priority": "high"},
                {"title": "Attend budget review meeting", "description": "On Feb 1st", "due_date": "2025-02-01", "priority": "medium"},
                {"title": "Attend team offsite", "description": "March 15th", "due_date": "2025-03-15", "priority": "medium"},
                {"title": "Complete self-assessment for performance review", "description": "Review cycle starts Feb 15th, assessments due by then", "due_date": "2025-02-15", "priority": "high"},
            ],
            "what_good_extraction_looks_like": "5 tasks with correct dates extracted from scattered date mentions.",
            "common_failure_modes": ["misses_self_assessment", "misses_team_offsite", "wrong_dates", "combines_tasks"],
            "acceptable_variation": "All 5 tasks should be extracted. Dates should be accurate.",
            "notes": "Dates scattered throughout text. Tests date extraction from unstructured prose.",
        },
    },
    # ── Implicit tasks from error logs ─────────────────────────────────────
    {
        "id": "018",
        "input": {
            "source_text": "Error log summary for this week:\n- 404 errors on /api/v2/users endpoint (127 occurrences)\n- Database connection timeout on reports service (43 occurrences)\n- SSL certificate expiring in 7 days for api.example.com\n- Memory usage on production server at 92%\n- Failed payment transactions: 15 (all with Stripe error code 4002)",
            "source_type": "error_log",
        },
        "expected": {
            "category": "implicit",
            "expected_tasks": [
                {"title": "Fix 404 errors on /api/v2/users endpoint", "description": "127 occurrences this week", "due_date": None, "priority": "high"},
                {"title": "Fix database connection timeout on reports service", "description": "43 occurrences", "due_date": None, "priority": "high"},
                {"title": "Renew SSL certificate for api.example.com", "description": "Expiring in 7 days", "due_date": None, "priority": "high"},
                {"title": "Investigate high memory usage on production", "description": "At 92%", "due_date": None, "priority": "medium"},
                {"title": "Fix failed payment transactions with Stripe", "description": "15 failures, error code 4002", "due_date": None, "priority": "high"},
            ],
            "what_good_extraction_looks_like": "5 tasks inferred from error log entries. Each error implies a fix task.",
            "common_failure_modes": ["misses_memory_investigation", "misses_stripe_fix", "extracts_errors_not_tasks"],
            "acceptable_variation": "Tasks should be action-oriented (fix/investigate/renew). 5 tasks is correct.",
            "notes": "Error log implying tasks. Tests inference from errors to actions.",
        },
    },
    # ── Clear email with priorities ────────────────────────────────────────
    {
        "id": "019",
        "input": {
            "source_text": "Priority tasks for this sprint:\n\n🔴 URGENT: Fix the checkout bug - customers can't complete purchases\n🟡 IMPORTANT: Update the privacy policy for GDPR compliance (deadline: March 1st)\n🟡 IMPORTANT: Set up monitoring alerts for the new microservices\n🟢 NICE TO HAVE: Refactor the legacy authentication module\n🟢 NICE TO HAVE: Add dark mode to the settings page",
            "source_type": "priority_list",
        },
        "expected": {
            "category": "clear-priority",
            "expected_tasks": [
                {"title": "Fix checkout bug", "description": "Customers can't complete purchases", "due_date": None, "priority": "high"},
                {"title": "Update privacy policy for GDPR compliance", "description": "Deadline March 1st", "due_date": "2025-03-01", "priority": "high"},
                {"title": "Set up monitoring alerts for new microservices", "description": "", "due_date": None, "priority": "medium"},
                {"title": "Refactor legacy authentication module", "description": "", "due_date": None, "priority": "low"},
                {"title": "Add dark mode to settings page", "description": "", "due_date": None, "priority": "low"},
            ],
            "what_good_extraction_looks_like": "5 tasks with correct priorities. Urgent → high, Important → medium/high, Nice to have → low.",
            "common_failure_modes": ["wrong_priorities", "misses_dark_mode", "misses_refactor", "combines_tasks"],
            "acceptable_variation": "All 5 tasks should be extracted. Priority mapping should match the emoji labels.",
            "notes": "Clear priority list with emoji labels. Tests priority inference.",
        },
    },
    # ── Adversarial: tasks mixed with non-actionable information ───────────
    {
        "id": "020",
        "input": {
            "source_text": "Team update:\n\nGood news: We hit 10,000 users last week! 🎉\nBad news: The server crashed twice on Tuesday.\nFYI: The new office opens next month on the 15th floor.\nAction needed: Someone needs to investigate the server crashes and implement auto-scaling.\nReminder: All expense reports are due by end of month.\nNote: The client liked the demo but wants changes to the reporting feature.\nAction: Prepare a revised demo incorporating client feedback by next Friday.\nFun fact: Our competitor just raised $50M.",
            "source_type": "mixed_update",
        },
        "expected": {
            "category": "adversarial",
            "expected_tasks": [
                {"title": "Investigate server crashes and implement auto-scaling", "description": "Server crashed twice on Tuesday", "due_date": None, "priority": "high"},
                {"title": "Submit expense reports", "description": "Due by end of month", "due_date": None, "priority": "medium"},
                {"title": "Prepare revised demo with client feedback", "description": "By next Friday", "due_date": None, "priority": "high"},
            ],
            "what_good_extraction_looks_like": "3 tasks extracted. User milestone, office opening, and competitor funding are NOT tasks.",
            "common_failure_modes": ["extracts_user_milestone_as_task", "extracts_office_opening_as_task", "extracts_competitor_funding_as_task", "misses_expense_reports"],
            "acceptable_variation": "Should only extract actionable items. 3 tasks is correct.",
            "notes": "Mix of tasks, updates, and non-actionable information. Tests filtering.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-extract/eval-lab/tasks/structured-extraction-quality"

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
        f.write(f'[task]\nname = "structured-extraction-case-{cid}"\ndescription = "{case["expected"]["what_good_extraction_looks_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: category={case['expected']['category']}, tasks={len(case['expected']['expected_tasks'])}")

print(f"\nGenerated {len(CASES)} cases")
