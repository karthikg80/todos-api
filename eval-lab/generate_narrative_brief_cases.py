#!/usr/bin/env python3
"""Generate Narrative Brief benchmark cases.

20 cases across 5 brief types:
- daily_priorities (4): Daily priorities brief
- weekly_review (4): Weekly review analysis
- project_health (4): Project health report
- feedback_summary (4): User feedback summary
- productivity_insights (4): Productivity insights and recommendations

Categories: normal, noisy, sparse, adversarial
"""
import json
import os

CASES = [
    # ── Daily Priorities (4 cases) ─────────────────────────────────────────
    {
        "id": "001",
        "input": {
            "brief_type": "daily_priorities",
            "data_context": {
                "today": "2026-04-05",
                "tasks_due_today": [
                    {"title": "Submit Q4 budget", "priority": "high", "is_overdue": True},
                    {"title": "Client meeting at 2pm", "priority": "high", "time": "14:00"},
                    {"title": "Review design mockups", "priority": "medium", "due_date": "2026-04-05"},
                ],
                "tasks_due_this_week": [
                    {"title": "Plan team offsite", "priority": "medium", "due_date": "2026-04-08"},
                    {"title": "Update project roadmap", "priority": "low", "due_date": "2026-04-10"},
                ],
                "recent_completions": ["Send weekly report", "Fix login bug"],
            },
        },
        "expected": {
            "brief_type": "daily_priorities",
            "category": "normal",
            "expected_patterns": ["overdue budget submission", "scheduled client meeting", "design review due today"],
            "expected_recommendations": ["Submit Q4 budget immediately (overdue)", "Prepare for 2pm client meeting", "Complete design mockup review"],
            "what_good_brief_looks_like": "Highlights overdue budget first, then scheduled meeting, then other due items. 3 concrete recommendations.",
            "common_failure_modes": ["misses_overdue_item", "misses_scheduled_meeting", "generic_recommendations"],
            "acceptable_variation": "May phrase recommendations differently. Should prioritize overdue items.",
            "notes": "Standard daily priorities with one overdue item and one scheduled meeting.",
        },
    },
    {
        "id": "002",
        "input": {
            "brief_type": "daily_priorities",
            "data_context": {
                "today": "2026-04-05",
                "tasks_due_today": [],
                "tasks_due_this_week": [],
                "recent_completions": ["Finish quarterly report", "Send tax documents", "Complete performance reviews"],
            },
        },
        "expected": {
            "brief_type": "daily_priorities",
            "category": "adversarial",
            "expected_patterns": ["no tasks due today", "recent completions show productive week"],
            "expected_recommendations": [],
            "what_good_brief_looks_like": "Acknowledges clear day with no due items. May suggest planning ahead. No urgent recommendations.",
            "common_failure_modes": ["invents_urgent_tasks", "generic_advice", "overly_prescriptive"],
            "acceptable_variation": "Should note clear schedule. May suggest light planning work.",
            "notes": "No tasks due today or this week. All recent items completed.",
        },
    },
    {
        "id": "003",
        "input": {
            "brief_type": "daily_priorities",
            "data_context": {
                "today": "2026-04-05",
                "tasks_due_today": [
                    {"title": "Deploy v2.0", "priority": "high", "is_overdue": True},
                    {"title": "Run final tests", "priority": "high", "depends_on": []},
                    {"title": "Update release notes", "priority": "medium"},
                    {"title": "Notify stakeholders", "priority": "medium"},
                    {"title": "Archive old logs", "priority": "low"},
                    {"title": "Update documentation", "priority": "low"},
                ],
                "tasks_due_this_week": [
                    {"title": "Plan Q2 roadmap", "priority": "high", "due_date": "2026-04-08"},
                ],
                "recent_completions": ["Complete testing"],
            },
        },
        "expected": {
            "brief_type": "daily_priorities",
            "category": "noisy",
            "expected_patterns": ["overdue deployment", "release day with multiple tasks", "Q2 roadmap planning due soon"],
            "expected_recommendations": ["Deploy v2.0 (overdue, highest priority)", "Run final tests before deployment", "Plan Q2 roadmap (due in 3 days)"],
            "what_good_brief_looks_like": "Prioritizes overdue deployment, then release tasks, then Q2 planning. Filters out low-priority noise.",
            "common_failure_modes": ["wrong_priority_order", "misses_overdue", "includes_low_priority_items"],
            "acceptable_variation": "May suggest 3-4 top priorities. Should filter low-priority items.",
            "notes": "Release day with 6 tasks due. Should prioritize top 3-4, filtering noise.",
        },
    },
    {
        "id": "004",
        "input": {
            "brief_type": "daily_priorities",
            "data_context": {
                "today": "2026-04-05",
                "tasks_due_today": [
                    {"title": "Something important", "priority": "medium"},
                ],
                "tasks_due_this_week": [],
                "recent_completions": [],
            },
        },
        "expected": {
            "brief_type": "daily_priorities",
            "category": "sparse",
            "expected_patterns": ["single vague task due", "no recent activity"],
            "expected_recommendations": ["Clarify what 'Something important' means"],
            "what_good_brief_looks_like": "Notes sparse data. Suggests clarifying the vague task. No invented priorities.",
            "common_failure_modes": ["invents_specific_tasks", "overly_generic_advice"],
            "acceptable_variation": "Should note sparse data. May suggest task clarification.",
            "notes": "Very sparse data with one vague task. Should not invent priorities.",
        },
    },

    # ── Weekly Review (4 cases) ────────────────────────────────────────────
    {
        "id": "005",
        "input": {
            "brief_type": "weekly_review",
            "data_context": {
                "week": "2026-03-30 to 2026-04-05",
                "tasks_completed": 12,
                "tasks_created": 8,
                "tasks_overdue": 2,
                "top_projects": [
                    {"name": "Q4 Budget", "tasks_completed": 5, "tasks_remaining": 3},
                    {"name": "Client Proposal", "tasks_completed": 4, "tasks_remaining": 1},
                    {"name": "Team Offsite", "tasks_completed": 2, "tasks_remaining": 6},
                ],
                "time_distribution": {"deep_work": "40%", "meetings": "35%", "admin": "25%"},
            },
        },
        "expected": {
            "brief_type": "weekly_review",
            "category": "normal",
            "expected_patterns": ["net positive task completion (12 completed vs 8 created)", "2 overdue items need attention", "Team Offsite has most remaining work", "meeting-heavy week at 35%"],
            "expected_recommendations": ["Address 2 overdue items first thing Monday", "Plan Team Offsite work (6 remaining tasks)", "Consider reducing meeting time next week"],
            "what_good_brief_looks_like": "Summarizes completion rate, highlights overdue items, identifies Team Offsite as needing attention. 3 recommendations.",
            "common_failure_modes": ["misses_overdue_count", "misses_team_offsite_backlog", "generic_recommendations"],
            "acceptable_variation": "May phrase recommendations differently. Should highlight overdue and Team Offsite.",
            "notes": "Productive week with 12 completions. 2 overdue items and Team Offsite backlog need attention.",
        },
    },
    {
        "id": "006",
        "input": {
            "brief_type": "weekly_review",
            "data_context": {
                "week": "2026-03-30 to 2026-04-05",
                "tasks_completed": 3,
                "tasks_created": 15,
                "tasks_overdue": 8,
                "top_projects": [
                    {"name": "Product Launch", "tasks_completed": 1, "tasks_remaining": 20},
                    {"name": "Bug Fixes", "tasks_completed": 2, "tasks_remaining": 12},
                ],
                "time_distribution": {"deep_work": "15%", "meetings": "50%", "admin": "35%"},
            },
        },
        "expected": {
            "brief_type": "weekly_review",
            "category": "normal",
            "expected_patterns": ["task backlog growing (3 completed vs 15 created)", "8 overdue items is concerning", "Product Launch has 20 remaining tasks", "meeting-heavy week with low deep work"],
            "expected_recommendations": ["Address 8 overdue items urgently", "Reduce meetings to increase deep work time", "Break down Product Launch into manageable chunks"],
            "what_good_brief_looks_like": "Flags growing backlog and high overdue count. Recommends meeting reduction and task breakdown.",
            "common_failure_modes": ["misses_backlog_growth", "misses_meeting_problem", "too_positive_tone"],
            "acceptable_variation": "Should flag concerning trends. May suggest different specific actions.",
            "notes": "Concerning week with growing backlog and high overdue count. Should flag issues.",
        },
    },
    {
        "id": "007",
        "input": {
            "brief_type": "weekly_review",
            "data_context": {
                "week": "2026-03-30 to 2026-04-05",
                "tasks_completed": 0,
                "tasks_created": 0,
                "tasks_overdue": 0,
                "top_projects": [],
                "time_distribution": {"deep_work": "0%", "meetings": "0%", "admin": "0%"},
            },
        },
        "expected": {
            "brief_type": "weekly_review",
            "category": "adversarial",
            "expected_patterns": ["no activity this week", "empty data"],
            "expected_recommendations": ["Review why no tasks were tracked this week"],
            "what_good_brief_looks_like": "Notes no activity. Suggests reviewing tracking habits. Does not invent patterns.",
            "common_failure_modes": ["invents_patterns", "generic_advice", "overly_prescriptive"],
            "acceptable_variation": "Should note empty week. May suggest habit review.",
            "notes": "Empty week with no activity. Should not invent patterns.",
        },
    },
    {
        "id": "008",
        "input": {
            "brief_type": "weekly_review",
            "data_context": {
                "week": "2026-03-30 to 2026-04-05",
                "tasks_completed": 20,
                "tasks_created": 10,
                "tasks_overdue": 0,
                "top_projects": [
                    {"name": "Sprint 12", "tasks_completed": 15, "tasks_remaining": 0},
                    {"name": "Documentation", "tasks_completed": 5, "tasks_remaining": 2},
                ],
                "time_distribution": {"deep_work": "60%", "meetings": "20%", "admin": "20%"},
            },
        },
        "expected": {
            "brief_type": "weekly_review",
            "category": "normal",
            "expected_patterns": ["strong completion rate (20 vs 10 created)", "Sprint 12 completed", "good deep work ratio at 60%"],
            "expected_recommendations": ["Plan next sprint", "Complete remaining documentation tasks", "Maintain current deep work ratio"],
            "what_good_brief_looks_like": "Positive review highlighting strong completion and good time distribution. Forward-looking recommendations.",
            "common_failure_modes": ["misses_sprint_completion", "misses_good_time_distribution"],
            "acceptable_variation": "May phrase positively. Should note sprint completion and deep work ratio.",
            "notes": "Strong week with 20 completions and good time distribution. Positive review.",
        },
    },

    # ── Project Health (4 cases) ───────────────────────────────────────────
    {
        "id": "009",
        "input": {
            "brief_type": "project_health",
            "data_context": {
                "project": "Mobile App Redesign",
                "start_date": "2026-02-01",
                "target_date": "2026-05-01",
                "progress": "45%",
                "tasks_completed": 18,
                "tasks_remaining": 22,
                "blockers": ["Waiting on design team for final mockups", "API endpoint not ready"],
                "recent_activity": "Completed user research and wireframes. Waiting on design handoff.",
                "budget_used": "40%",
                "budget_total": 50000,
            },
        },
        "expected": {
            "brief_type": "project_health",
            "category": "normal",
            "expected_patterns": ["on track timeline (45% progress with 40% budget used)", "2 blockers need resolution", "design handoff is critical path"],
            "expected_recommendations": ["Follow up with design team on mockups", "Coordinate with API team on endpoint readiness", "Plan for design handoff transition"],
            "what_good_brief_looks_like": "Assesses health as generally on track but flags 2 blockers. Recommends following up on critical path items.",
            "common_failure_modes": ["misses_blockers", "misses_design_handoff_dependency", "overly_optimistic"],
            "acceptable_variation": "May assess health slightly differently. Should flag both blockers.",
            "notes": "Project at 45% with 2 blockers. Generally on track but needs blocker resolution.",
        },
    },
    {
        "id": "010",
        "input": {
            "brief_type": "project_health",
            "data_context": {
                "project": "Website Migration",
                "start_date": "2026-01-15",
                "target_date": "2026-03-15",
                "progress": "30%",
                "tasks_completed": 8,
                "tasks_remaining": 35,
                "blockers": ["Database migration failed twice", "SSL certificate issues", "DNS propagation delays"],
                "recent_activity": "Multiple failed migration attempts. Team investigating root cause.",
                "budget_used": "70%",
                "budget_total": 30000,
            },
        },
        "expected": {
            "brief_type": "project_health",
            "category": "normal",
            "expected_patterns": ["behind schedule (30% progress past target date)", "budget overrun risk (70% used with 30% progress)", "3 critical blockers", "migration failures are root cause"],
            "expected_recommendations": ["Escalate database migration issue immediately", "Reassess project timeline and budget", "Consider bringing in external migration expertise"],
            "what_good_brief_looks_like": "Flags critical health issues: behind schedule, budget overrun, multiple blockers. Urgent recommendations.",
            "common_failure_modes": ["understates_severity", "misses_budget_risk", "generic_recommendations"],
            "acceptable_variation": "Should flag critical health. May suggest different specific actions.",
            "notes": "Project in trouble: behind schedule, over budget, 3 blockers. Critical health assessment.",
        },
    },
    {
        "id": "011",
        "input": {
            "brief_type": "project_health",
            "data_context": {
                "project": "New Feature",
                "start_date": "2026-04-01",
                "target_date": "2026-06-01",
                "progress": "5%",
                "tasks_completed": 1,
                "tasks_remaining": 15,
                "blockers": [],
                "recent_activity": "Project just started. Initial planning complete.",
                "budget_used": "3%",
                "budget_total": 20000,
            },
        },
        "expected": {
            "brief_type": "project_health",
            "category": "normal",
            "expected_patterns": ["early stage project", "no blockers", "on track with budget"],
            "expected_recommendations": ["Set up regular check-ins for new project", "Define milestones for first month", "Identify potential risks early"],
            "what_good_brief_looks_like": "Notes early stage with no issues. Recommends setting up project rhythms and risk identification.",
            "common_failure_modes": ["overly_detailed_for_early_stage", "misses_risk_identification_recommendation"],
            "acceptable_variation": "Should note early stage. May suggest different setup activities.",
            "notes": "Newly started project with no issues. Early stage health assessment.",
        },
    },
    {
        "id": "012",
        "input": {
            "brief_type": "project_health",
            "data_context": {
                "project": "Unknown Project",
                "start_date": None,
                "target_date": None,
                "progress": None,
                "tasks_completed": 0,
                "tasks_remaining": 0,
                "blockers": [],
                "recent_activity": "",
                "budget_used": None,
                "budget_total": None,
            },
        },
        "expected": {
            "brief_type": "project_health",
            "category": "adversarial",
            "expected_patterns": ["no project data available"],
            "expected_recommendations": ["Set up project tracking before assessing health"],
            "what_good_brief_looks_like": "Notes lack of data. Does not invent health assessment. Recommends setting up tracking.",
            "common_failure_modes": ["invents_health_assessment", "generic_advice"],
            "acceptable_variation": "Should note missing data. May suggest different setup steps.",
            "notes": "No project data. Should not invent health assessment.",
        },
    },

    # ── Feedback Summary (4 cases) ─────────────────────────────────────────
    {
        "id": "013",
        "input": {
            "brief_type": "feedback_summary",
            "data_context": {
                "period": "Last 30 days",
                "total_feedback": 45,
                "sentiment_distribution": {"positive": 20, "neutral": 15, "negative": 10},
                "top_themes": [
                    {"theme": "Search is slow", "count": 12, "sentiment": "negative"},
                    {"theme": "Love the new dashboard", "count": 10, "sentiment": "positive"},
                    {"theme": "Mobile app crashes", "count": 8, "sentiment": "negative"},
                    {"theme": "Good customer support", "count": 7, "sentiment": "positive"},
                ],
                "nps_score": 42,
                "nps_trend": "up from 38 last month",
            },
        },
        "expected": {
            "brief_type": "feedback_summary",
            "category": "normal",
            "expected_patterns": ["search performance is top complaint", "dashboard redesign well-received", "mobile crashes are urgent", "NPS improving"],
            "expected_recommendations": ["Investigate and fix search performance", "Address mobile app crashes urgently", "Continue dashboard improvements"],
            "what_good_brief_looks_like": "Highlights search and mobile as top issues, dashboard as win. Notes improving NPS. 3 recommendations.",
            "common_failure_modes": ["misses_search_complaint", "misses_mobile_crashes", "misses_nps_trend"],
            "acceptable_variation": "May phrase themes differently. Should highlight top 2-3 issues.",
            "notes": "45 feedback items with clear themes. Search and mobile are top issues.",
        },
    },
    {
        "id": "014",
        "input": {
            "brief_type": "feedback_summary",
            "data_context": {
                "period": "Last 30 days",
                "total_feedback": 5,
                "sentiment_distribution": {"positive": 2, "neutral": 2, "negative": 1},
                "top_themes": [
                    {"theme": "App is okay", "count": 2, "sentiment": "neutral"},
                    {"theme": "Could be faster", "count": 1, "sentiment": "negative"},
                ],
                "nps_score": 10,
                "nps_trend": "down from 15 last month",
            },
        },
        "expected": {
            "brief_type": "feedback_summary",
            "category": "sparse",
            "expected_patterns": ["very low feedback volume", "insufficient data for strong patterns", "NPS declining"],
            "expected_recommendations": ["Increase feedback collection to get better signal", "Monitor NPS trend closely"],
            "what_good_brief_looks_like": "Notes low volume and insufficient data. Does not over-interpret 5 data points. Recommends more collection.",
            "common_failure_modes": ["over_interprets_small_sample", "invents_patterns"],
            "acceptable_variation": "Should note low volume. May suggest different collection methods.",
            "notes": "Only 5 feedback items. Should not over-interpret small sample.",
        },
    },
    {
        "id": "015",
        "input": {
            "brief_type": "feedback_summary",
            "data_context": {
                "period": "Last 30 days",
                "total_feedback": 0,
                "sentiment_distribution": {},
                "top_themes": [],
                "nps_score": None,
                "nps_trend": None,
            },
        },
        "expected": {
            "brief_type": "feedback_summary",
            "category": "adversarial",
            "expected_patterns": ["no feedback collected"],
            "expected_recommendations": ["Set up feedback collection channels"],
            "what_good_brief_looks_like": "Notes no feedback. Does not invent patterns. Recommends setting up collection.",
            "common_failure_modes": ["invents_feedback_patterns", "generic_advice"],
            "acceptable_variation": "Should note no data. May suggest different collection channels.",
            "notes": "No feedback data. Should not invent patterns.",
        },
    },
    {
        "id": "016",
        "input": {
            "brief_type": "feedback_summary",
            "data_context": {
                "period": "Last 30 days",
                "total_feedback": 120,
                "sentiment_distribution": {"positive": 30, "neutral": 40, "negative": 50},
                "top_themes": [
                    {"theme": "Login issues", "count": 35, "sentiment": "negative"},
                    {"theme": "Billing confusion", "count": 25, "sentiment": "negative"},
                    {"theme": "Feature requests for exports", "count": 20, "sentiment": "neutral"},
                    {"theme": "Great new UI", "count": 15, "sentiment": "positive"},
                    {"theme": "Slow loading times", "count": 15, "sentiment": "negative"},
                ],
                "nps_score": 15,
                "nps_trend": "down from 28 last month",
            },
        },
        "expected": {
            "brief_type": "feedback_summary",
            "category": "noisy",
            "expected_patterns": ["login issues are dominant complaint", "billing confusion is second", "NPS declining significantly", "more negative than positive feedback"],
            "expected_recommendations": ["Fix login issues as top priority", "Clarify billing process", "Investigate performance issues"],
            "what_good_brief_looks_like": "Highlights login and billing as top issues. Notes declining NPS. Prioritizes fixes.",
            "common_failure_modes": ["misses_login_issues", "misses_nps_decline", "wrong_priority_order"],
            "acceptable_variation": "May phrase themes differently. Should prioritize login and billing.",
            "notes": "120 feedback items with negative trend. Login and billing are top issues.",
        },
    },

    # ── Productivity Insights (4 cases) ────────────────────────────────────
    {
        "id": "017",
        "input": {
            "brief_type": "productivity_insights",
            "data_context": {
                "period": "Last 90 days",
                "total_tasks_completed": 180,
                "average_completion_time": "2.3 days",
                "peak_productivity_day": "Tuesday",
                "least_productive_day": "Friday",
                "task_completion_trend": "increasing (15% improvement over 90 days)",
                "top_categories": {"Work": 60, "Personal": 25, "Health": 15},
                "streak_data": {"longest_streak": 14, "current_streak": 5},
            },
        },
        "expected": {
            "brief_type": "productivity_insights",
            "category": "normal",
            "expected_patterns": ["strong completion trend (15% improvement)", "Tuesday is peak day", "current streak of 5 days", "work dominates task categories"],
            "expected_recommendations": ["Protect Tuesday focus time for deep work", "Build on current 5-day streak", "Consider rebalancing work/personal tasks"],
            "what_good_brief_looks_like": "Highlights improving trend and current streak. Notes Tuesday peak. 3 actionable insights.",
            "common_failure_modes": ["misses_improvement_trend", "misses_streak_data", "generic_insights"],
            "acceptable_variation": "May phrase insights differently. Should highlight trend and streak.",
            "notes": "90-day data showing improvement. Strong productivity patterns.",
        },
    },
    {
        "id": "018",
        "input": {
            "brief_type": "productivity_insights",
            "data_context": {
                "period": "Last 90 days",
                "total_tasks_completed": 45,
                "average_completion_time": "8.5 days",
                "peak_productivity_day": "Monday",
                "least_productive_day": "Thursday",
                "task_completion_trend": "decreasing (20% decline over 90 days)",
                "top_categories": {"Work": 70, "Personal": 20, "Health": 10},
                "streak_data": {"longest_streak": 7, "current_streak": 0},
            },
        },
        "expected": {
            "brief_type": "productivity_insights",
            "category": "normal",
            "expected_patterns": ["declining productivity trend (20% drop)", "long average completion time (8.5 days)", "current streak broken", "work-heavy distribution"],
            "expected_recommendations": ["Investigate root cause of declining trend", "Break large tasks into smaller chunks", "Rebuild productivity streak with small wins"],
            "what_good_brief_looks_like": "Flags declining trend and broken streak. Recommends investigation and small wins approach.",
            "common_failure_modes": ["understates_decline", "misses_broken_streak", "too_positive_tone"],
            "acceptable_variation": "Should flag concerning trends. May suggest different specific actions.",
            "notes": "90-day data showing decline. Concerning productivity patterns.",
        },
    },
    {
        "id": "019",
        "input": {
            "brief_type": "productivity_insights",
            "data_context": {
                "period": "Last 90 days",
                "total_tasks_completed": 0,
                "average_completion_time": None,
                "peak_productivity_day": None,
                "least_productive_day": None,
                "task_completion_trend": "no data",
                "top_categories": {},
                "streak_data": {"longest_streak": 0, "current_streak": 0},
            },
        },
        "expected": {
            "brief_type": "productivity_insights",
            "category": "adversarial",
            "expected_patterns": ["no productivity data available"],
            "expected_recommendations": ["Start tracking tasks to generate insights"],
            "what_good_brief_looks_like": "Notes no data. Does not invent insights. Recommends starting tracking.",
            "common_failure_modes": ["invents_insights", "generic_advice"],
            "acceptable_variation": "Should note no data. May suggest different tracking methods.",
            "notes": "No productivity data. Should not invent insights.",
        },
    },
    {
        "id": "020",
        "input": {
            "brief_type": "productivity_insights",
            "data_context": {
                "period": "Last 90 days",
                "total_tasks_completed": 200,
                "average_completion_time": "1.5 days",
                "peak_productivity_day": "Wednesday",
                "least_productive_day": "Monday",
                "task_completion_trend": "stable",
                "top_categories": {"Work": 50, "Personal": 30, "Health": 20},
                "streak_data": {"longest_streak": 21, "current_streak": 12},
            },
        },
        "expected": {
            "brief_type": "productivity_insights",
            "category": "normal",
            "expected_patterns": ["high completion volume (200 tasks)", "fast average completion (1.5 days)", "strong current streak (12 days)", "balanced category distribution"],
            "expected_recommendations": ["Maintain current productivity habits", "Use Wednesday for most important work", "Consider leveraging 12-day streak momentum"],
            "what_good_brief_looks_like": "Positive review highlighting strong metrics. Notes streak and fast completion. Forward-looking.",
            "common_failure_modes": ["misses_streak_data", "misses_fast_completion", "generic_praise"],
            "acceptable_variation": "May phrase positively. Should highlight streak and completion speed.",
            "notes": "Strong 90-day performance. High volume, fast completion, long streak.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-nb/eval-lab/tasks/narrative-brief-quality"

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
        f.write(f'[task]\nname = "narrative-brief-case-{cid}"\ndescription = "{case["expected"]["what_good_brief_looks_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: brief_type={case['expected']['brief_type']}, category={case['expected']['category']}")

print(f"\nGenerated {len(CASES)} cases")
