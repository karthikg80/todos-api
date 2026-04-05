#!/usr/bin/env python3
"""Generate Decision Assist benchmark cases.

20 cases across 5 surfaces:
- home_focus (4): AI focus suggestions for home screen
- today_plan (4): Daily plan generation
- todo_bound (4): Task-bound suggestions
- on_create (4): Suggestions when creating new tasks
- task_drawer (4): Task drawer AI suggestions

Categories: normal, noisy, ambiguous, adversarial
"""
import json
import os

CASES = [
    # ── Home Focus (4 cases) ───────────────────────────────────────────────
    {
        "id": "001",
        "input": {
            "user_context": {"days_active": 30, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Review Q4 budget", "priority": "high", "due_date": "2026-04-05", "is_overdue": True},
                {"title": "Schedule team lunch", "priority": "low", "due_date": "2026-04-10"},
            ],
            "surface_type": "home_focus",
            "recent_activity": ["completed: Send client proposal", "created: Review Q4 budget"],
        },
        "expected": {
            "surface": "home_focus",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Review Q4 budget", "description": "Overdue high-priority task", "priority": "high"},
            ],
            "what_good_suggestions_look_like": "Suggests the overdue high-priority task first. 1-2 suggestions max for home focus.",
            "common_failure_modes": ["suggests_completed_tasks", "too_many_suggestions", "irrelevant_suggestions"],
            "acceptable_variation": "May suggest budget review with slightly different wording. Should not suggest completed tasks.",
            "notes": "User has one overdue high-priority task. Should be the primary suggestion.",
        },
    },
    {
        "id": "002",
        "input": {
            "user_context": {"days_active": 5, "plan_tier": "free", "daily_suggestion_limit": 2},
            "task_state": [
                {"title": "Buy groceries", "priority": "medium", "due_date": "2026-04-06"},
                {"title": "Call dentist", "priority": "low", "due_date": "2026-04-08"},
                {"title": "Read book", "priority": "low", "due_date": None},
            ],
            "surface_type": "home_focus",
            "recent_activity": ["created: Buy groceries", "created: Call dentist"],
        },
        "expected": {
            "surface": "home_focus",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Buy groceries", "description": "Due tomorrow", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests the most urgent upcoming task. 1 suggestion for new user.",
            "common_failure_modes": ["too_many_suggestions", "suggests_low_priority", "free_tier_violation"],
            "acceptable_variation": "May suggest either groceries or dentist. Should not exceed free tier limit.",
            "notes": "New user on free tier. Should get 1-2 suggestions max, prioritizing urgency.",
        },
    },
    {
        "id": "003",
        "input": {
            "user_context": {"days_active": 60, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Prepare board presentation", "priority": "high", "due_date": "2026-04-07", "project": "Work"},
                {"title": "Update project roadmap", "priority": "medium", "due_date": "2026-04-08", "project": "Work"},
                {"title": "Review design mockups", "priority": "medium", "due_date": "2026-04-06", "project": "Design"},
            ],
            "surface_type": "home_focus",
            "recent_activity": ["completed: Send weekly report", "updated: Prepare board presentation"],
        },
        "expected": {
            "surface": "home_focus",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Review design mockups", "description": "Due soon, medium priority", "priority": "medium"},
                {"title": "Prepare board presentation", "description": "High priority, due in 2 days", "priority": "high"},
            ],
            "what_good_suggestions_look_like": "Suggests upcoming deadlines in priority order. 2-3 suggestions for active user.",
            "common_failure_modes": ["wrong_priority_order", "too_many_suggestions", "misses_urgent_items"],
            "acceptable_variation": "May suggest any 2-3 of the 3 tasks. Order should reflect urgency.",
            "notes": "Active user with multiple upcoming deadlines. Should surface most urgent items.",
        },
    },
    {
        "id": "004",
        "input": {
            "user_context": {"days_active": 90, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [],
            "surface_type": "home_focus",
            "recent_activity": ["completed: Finish quarterly report", "completed: Send tax documents"],
        },
        "expected": {
            "surface": "home_focus",
            "category": "adversarial",
            "expected_suggestions": [],
            "what_good_suggestions_look_like": "No suggestions when task list is empty and recent activity shows completion.",
            "common_failure_modes": ["invents_tasks", "suggests_completed_tasks", "generic_suggestions"],
            "acceptable_variation": "Should return empty list. No tasks to suggest.",
            "notes": "User has no tasks and just completed everything. Should not invent suggestions.",
        },
    },

    # ── Today Plan (4 cases) ───────────────────────────────────────────────
    {
        "id": "005",
        "input": {
            "user_context": {"days_active": 45, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Client meeting at 2pm", "priority": "high", "due_date": "2026-04-05", "time": "14:00"},
                {"title": "Prepare meeting notes", "priority": "medium", "due_date": "2026-04-05"},
                {"title": "Follow up on proposal", "priority": "medium", "due_date": "2026-04-05"},
                {"title": "Update CRM", "priority": "low", "due_date": "2026-04-05"},
            ],
            "surface_type": "today_plan",
            "recent_activity": ["viewed: Client meeting at 2pm"],
        },
        "expected": {
            "surface": "today_plan",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Client meeting at 2pm", "description": "Scheduled today at 2pm", "priority": "high"},
                {"title": "Prepare meeting notes", "description": "Before client meeting", "priority": "medium"},
                {"title": "Follow up on proposal", "description": "Due today", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests 3-4 tasks due today, prioritizing scheduled events first.",
            "common_failure_modes": ["misses_scheduled_events", "wrong_order", "too_few_suggestions"],
            "acceptable_variation": "May suggest 3-4 of the 4 tasks. Scheduled event should be first.",
            "notes": "User has 4 tasks due today including a scheduled meeting. Should prioritize the meeting.",
        },
    },
    {
        "id": "006",
        "input": {
            "user_context": {"days_active": 10, "plan_tier": "free", "daily_suggestion_limit": 2},
            "task_state": [
                {"title": "Submit expense report", "priority": "high", "due_date": "2026-04-05", "is_overdue": True},
                {"title": "Book flight for conference", "priority": "high", "due_date": "2026-04-05"},
                {"title": "Reply to team emails", "priority": "medium", "due_date": "2026-04-05"},
            ],
            "surface_type": "today_plan",
            "recent_activity": ["created: Submit expense report"],
        },
        "expected": {
            "surface": "today_plan",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Submit expense report", "description": "Overdue high priority", "priority": "high"},
                {"title": "Book flight for conference", "description": "Due today", "priority": "high"},
            ],
            "what_good_suggestions_look_like": "Suggests 2 high-priority items for free tier user. Overdue first.",
            "common_failure_modes": ["exceeds_free_tier_limit", "misses_overdue", "suggests_medium_priority"],
            "acceptable_variation": "Should suggest exactly 2 items. Overdue expense report should be first.",
            "notes": "Free tier user with 3 tasks due today. Should limit to 2 suggestions, prioritizing high priority.",
        },
    },
    {
        "id": "007",
        "input": {
            "user_context": {"days_active": 120, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Deploy v2.0 to production", "priority": "high", "due_date": "2026-04-05", "project": "Release"},
                {"title": "Run final test suite", "priority": "high", "due_date": "2026-04-05", "project": "Release", "depends_on": []},
                {"title": "Update release notes", "priority": "medium", "due_date": "2026-04-05", "project": "Release"},
                {"title": "Notify stakeholders", "priority": "medium", "due_date": "2026-04-05", "project": "Release"},
            ],
            "surface_type": "today_plan",
            "recent_activity": ["completed: Run final test suite", "updated: Deploy v2.0 to production"],
        },
        "expected": {
            "surface": "today_plan",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Deploy v2.0 to production", "description": "High priority release task", "priority": "high"},
                {"title": "Update release notes", "description": "Before deployment", "priority": "medium"},
                {"title": "Notify stakeholders", "description": "After deployment", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests release-related tasks in logical order. 3-4 suggestions.",
            "common_failure_modes": ["wrong_dependency_order", "misses_release_context", "too_many_suggestions"],
            "acceptable_variation": "May suggest 3-4 of the 4 tasks. Should respect dependency order.",
            "notes": "Release day with multiple related tasks. Should suggest in dependency-aware order.",
        },
    },
    {
        "id": "008",
        "input": {
            "user_context": {"days_active": 3, "plan_tier": "free", "daily_suggestion_limit": 2},
            "task_state": [
                {"title": "Figure out what to do", "priority": "medium", "due_date": None},
                {"title": "Maybe do something", "priority": "low", "due_date": None},
            ],
            "surface_type": "today_plan",
            "recent_activity": [],
        },
        "expected": {
            "surface": "today_plan",
            "category": "adversarial",
            "expected_suggestions": [],
            "what_good_suggestions_look_like": "No suggestions when tasks are vague and have no deadlines.",
            "common_failure_modes": ["suggests_vague_tasks", "invents_specific_tasks", "generic_advice"],
            "acceptable_variation": "Should return empty or minimal suggestions. Tasks are too vague to prioritize.",
            "notes": "New user with vague tasks and no deadlines. Should not suggest vague tasks.",
        },
    },

    # ── Todo-Bound (4 cases) ───────────────────────────────────────────────
    {
        "id": "009",
        "input": {
            "user_context": {"days_active": 60, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Write blog post", "priority": "medium", "due_date": "2026-04-10", "project": "Content"},
                {"title": "Research SEO keywords", "priority": "medium", "due_date": "2026-04-08", "project": "Content"},
            ],
            "surface_type": "todo_bound",
            "recent_activity": ["viewed: Write blog post"],
        },
        "expected": {
            "surface": "todo_bound",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Research SEO keywords", "description": "Due sooner, prerequisite for blog post", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests 1-2 related tasks. SEO keywords is prerequisite and due sooner.",
            "common_failure_modes": ["suggests_unrelated_tasks", "wrong_prerequisite_order", "too_many_suggestions"],
            "acceptable_variation": "May suggest SEO keywords or blog post. SEO keywords should be first if both suggested.",
            "notes": "User viewing a blog post task. Should suggest related prerequisite task first.",
        },
    },
    {
        "id": "010",
        "input": {
            "user_context": {"days_active": 30, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Plan vacation itinerary", "priority": "low", "due_date": "2026-05-01"},
                {"title": "Book hotel", "priority": "medium", "due_date": "2026-04-15"},
                {"title": "Request time off", "priority": "high", "due_date": "2026-04-07"},
            ],
            "surface_type": "todo_bound",
            "recent_activity": ["created: Plan vacation itinerary"],
        },
        "expected": {
            "surface": "todo_bound",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Request time off", "description": "Due soon, high priority", "priority": "high"},
            ],
            "what_good_suggestions_look_like": "Suggests the most urgent related task. 1 suggestion for todo-bound surface.",
            "common_failure_modes": ["suggests_low_priority_first", "too_many_suggestions", "misses_urgent_task"],
            "acceptable_variation": "Should suggest time off request as most urgent. May suggest hotel booking as second.",
            "notes": "User created a vacation task. Should suggest the urgent time off request first.",
        },
    },
    {
        "id": "011",
        "input": {
            "user_context": {"days_active": 90, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Fix login bug", "priority": "high", "due_date": "2026-04-05", "is_overdue": True, "project": "Engineering"},
                {"title": "Write unit tests", "priority": "medium", "due_date": "2026-04-06", "project": "Engineering"},
                {"title": "Update API docs", "priority": "low", "due_date": "2026-04-10", "project": "Engineering"},
            ],
            "surface_type": "todo_bound",
            "recent_activity": ["viewed: Fix login bug"],
        },
        "expected": {
            "surface": "todo_bound",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Fix login bug", "description": "Overdue high-priority bug", "priority": "high"},
            ],
            "what_good_suggestions_look_like": "Suggests the overdue bug fix. 1 suggestion for todo-bound.",
            "common_failure_modes": ["suggests_lower_priority", "misses_overdue", "too_many_suggestions"],
            "acceptable_variation": "Should suggest the overdue bug fix. May suggest unit tests as second.",
            "notes": "User viewing an overdue bug. Should prioritize the overdue high-priority task.",
        },
    },
    {
        "id": "012",
        "input": {
            "user_context": {"days_active": 15, "plan_tier": "free", "daily_suggestion_limit": 2},
            "task_state": [
                {"title": "Learn Python", "priority": "low", "due_date": None},
            ],
            "surface_type": "todo_bound",
            "recent_activity": [],
        },
        "expected": {
            "surface": "todo_bound",
            "category": "adversarial",
            "expected_suggestions": [],
            "what_good_suggestions_look_like": "No suggestions when only task is vague with no deadline.",
            "common_failure_modes": ["invents_subtasks", "suggests_generic_learning_tasks", "overly_specific"],
            "acceptable_variation": "Should return empty list. Single vague task with no deadline.",
            "notes": "Single vague task with no deadline. Should not invent subtasks or suggestions.",
        },
    },

    # ── On Create (4 cases) ────────────────────────────────────────────────
    {
        "id": "013",
        "input": {
            "user_context": {"days_active": 45, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Prepare client proposal", "priority": "high", "due_date": "2026-04-08", "project": "Sales"},
                {"title": "Gather requirements", "priority": "medium", "due_date": "2026-04-06", "project": "Sales"},
            ],
            "surface_type": "on_create",
            "recent_activity": ["creating: Send follow-up email"],
        },
        "expected": {
            "surface": "on_create",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Gather requirements", "description": "Due sooner, related to Sales project", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests 1 related task that might be a prerequisite. On-create surface should be minimal.",
            "common_failure_modes": ["too_many_suggestions", "unrelated_suggestions", "distracting_during_creation"],
            "acceptable_variation": "May suggest gather requirements or client proposal. Should be 1 suggestion max.",
            "notes": "User creating a new task. Should suggest 1 related task, not distract from creation.",
        },
    },
    {
        "id": "014",
        "input": {
            "user_context": {"days_active": 60, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Deploy to staging", "priority": "high", "due_date": "2026-04-05", "project": "Release"},
                {"title": "Run integration tests", "priority": "high", "due_date": "2026-04-05", "project": "Release"},
            ],
            "surface_type": "on_create",
            "recent_activity": ["creating: Deploy to production"],
        },
        "expected": {
            "surface": "on_create",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Deploy to staging", "description": "Prerequisite for production deploy", "priority": "high"},
            ],
            "what_good_suggestions_look_like": "Suggests the prerequisite task (staging before production). 1 suggestion.",
            "common_failure_modes": ["misses_prerequisite", "suggests_unrelated_tasks", "too_many_suggestions"],
            "acceptable_variation": "Should suggest staging deployment as prerequisite. May suggest integration tests.",
            "notes": "User creating production deploy task. Should suggest staging deployment first.",
        },
    },
    {
        "id": "015",
        "input": {
            "user_context": {"days_active": 10, "plan_tier": "free", "daily_suggestion_limit": 2},
            "task_state": [
                {"title": "Buy birthday gift", "priority": "medium", "due_date": "2026-04-10"},
            ],
            "surface_type": "on_create",
            "recent_activity": ["creating: Plan birthday party"],
        },
        "expected": {
            "surface": "on_create",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Buy birthday gift", "description": "Related to birthday party", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests the related existing task. 1 suggestion for on-create.",
            "common_failure_modes": ["invents_new_tasks", "too_many_suggestions", "unrelated_suggestions"],
            "acceptable_variation": "Should suggest the existing birthday gift task. Should not invent new tasks.",
            "notes": "User creating a party planning task. Should suggest the existing related gift task.",
        },
    },
    {
        "id": "016",
        "input": {
            "user_context": {"days_active": 5, "plan_tier": "free", "daily_suggestion_limit": 2},
            "task_state": [],
            "surface_type": "on_create",
            "recent_activity": ["creating: Learn to code"],
        },
        "expected": {
            "surface": "on_create",
            "category": "adversarial",
            "expected_suggestions": [],
            "what_good_suggestions_look_like": "No suggestions when no existing tasks and user is creating a vague task.",
            "common_failure_modes": ["invents_learning_tasks", "suggests_generic_tasks", "overly_prescriptive"],
            "acceptable_variation": "Should return empty list. No existing tasks to suggest.",
            "notes": "New user with no tasks creating a vague learning task. Should not suggest anything.",
        },
    },

    # ── Task Drawer (4 cases) ──────────────────────────────────────────────
    {
        "id": "017",
        "input": {
            "user_context": {"days_active": 60, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Complete tax filing", "priority": "high", "due_date": "2026-04-15", "is_overdue": False},
                {"title": "Gather tax documents", "priority": "high", "due_date": "2026-04-08", "project": "Finance"},
                {"title": "Schedule accountant meeting", "priority": "medium", "due_date": "2026-04-07"},
            ],
            "surface_type": "task_drawer",
            "recent_activity": ["viewed: Complete tax filing"],
        },
        "expected": {
            "surface": "task_drawer",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Gather tax documents", "description": "Prerequisite for tax filing", "priority": "high"},
                {"title": "Schedule accountant meeting", "description": "Due soon", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests prerequisite and related tasks. 2-3 suggestions for task drawer.",
            "common_failure_modes": ["misses_prerequisites", "too_many_suggestions", "unrelated_suggestions"],
            "acceptable_variation": "Should suggest gather documents first. May suggest accountant meeting.",
            "notes": "User viewing tax filing task. Should suggest prerequisite document gathering.",
        },
    },
    {
        "id": "018",
        "input": {
            "user_context": {"days_active": 30, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Submit grant application", "priority": "high", "due_date": "2026-04-05", "is_overdue": True},
                {"title": "Collect recommendation letters", "priority": "medium", "due_date": "2026-04-03", "is_overdue": True},
            ],
            "surface_type": "task_drawer",
            "recent_activity": ["viewed: Submit grant application"],
        },
        "expected": {
            "surface": "task_drawer",
            "category": "normal",
            "expected_suggestions": [
                {"title": "Collect recommendation letters", "description": "Overdue prerequisite", "priority": "medium"},
            ],
            "what_good_suggestions_look_like": "Suggests overdue prerequisite task. 1-2 suggestions.",
            "common_failure_modes": ["misses_overdue_prerequisite", "wrong_order", "too_many_suggestions"],
            "acceptable_variation": "Should suggest recommendation letters as overdue prerequisite.",
            "notes": "User viewing an overdue task with an overdue prerequisite. Should surface the prerequisite.",
        },
    },
    {
        "id": "019",
        "input": {
            "user_context": {"days_active": 90, "plan_tier": "pro", "daily_suggestion_limit": 5},
            "task_state": [
                {"title": "Write quarterly report", "priority": "medium", "due_date": "2026-04-10", "project": "Management"},
                {"title": "Collect team metrics", "priority": "medium", "due_date": "2026-04-08", "project": "Management"},
                {"title": "Review last quarter results", "priority": "low", "due_date": "2026-04-07", "project": "Management"},
            ],
            "surface_type": "task_drawer",
            "recent_activity": ["viewed: Write quarterly report"],
        },
        "expected": {
            "surface": "task_drawer",
            "category": "noisy",
            "expected_suggestions": [
                {"title": "Collect team metrics", "description": "Due sooner, needed for report", "priority": "medium"},
                {"title": "Review last quarter results", "description": "Reference for report", "priority": "low"},
            ],
            "what_good_suggestions_look_like": "Suggests related tasks in due-date order. 2-3 suggestions.",
            "common_failure_modes": ["wrong_order", "misses_related_tasks", "too_many_suggestions"],
            "acceptable_variation": "Should suggest collect metrics first. May suggest review results.",
            "notes": "User viewing a report task with related subtasks. Should suggest prerequisites.",
        },
    },
    {
        "id": "020",
        "input": {
            "user_context": {"days_active": 3, "plan_tier": "free", "daily_suggestion_limit": 2},
            "task_state": [
                {"title": "Do something important", "priority": "high", "due_date": None},
            ],
            "surface_type": "task_drawer",
            "recent_activity": [],
        },
        "expected": {
            "surface": "task_drawer",
            "category": "adversarial",
            "expected_suggestions": [],
            "what_good_suggestions_look_like": "No suggestions when only task is vague with no deadline.",
            "common_failure_modes": ["invents_specific_tasks", "suggests_generic_tasks", "overly_specific"],
            "acceptable_variation": "Should return empty list. Single vague task.",
            "notes": "New user with one vague task. Should not invent suggestions.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-da/eval-lab/tasks/decision-assist-quality"

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
        f.write(f'[task]\nname = "decision-assist-case-{cid}"\ndescription = "{case["expected"]["what_good_suggestions_look_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: surface={case['expected']['surface']}, category={case['expected']['category']}")

print(f"\nGenerated {len(CASES)} cases")
