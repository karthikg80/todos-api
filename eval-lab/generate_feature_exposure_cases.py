#!/usr/bin/env python3
"""Generate feature exposure benchmark cases."""
import json
import os

# Feature catalog shared across cases
FEATURE_CATALOG = {
    "core": ["quick_add", "task_list", "basic_search", "due_dates"],
    "intermediate": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities"],
    "advanced": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
    "power": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
}

CASES = [
    # ── New-user simplicity ────────────────────────────────────────────────
    {
        "id": "001",
        "input": {
            "user_context": {
                "days_active": 3,
                "tasks_created": 5,
                "projects_created": 0,
                "due_dates_used": 0,
                "recurring_tasks_used": 0,
                "planning_sessions": 0,
                "features_used": ["quick_add", "task_list"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "new-user-simplicity",
            "expected_user_segment": "beginner",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates"],
            "expected_hidden_features": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try setting a due date for your first task"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Only core features enabled. No intermediate or advanced features. One gentle nudge toward due dates.",
            "common_failure_modes": ["enables intermediate features too early", "overwhelming nudge bundle", "hides core features"],
            "acceptable_variation": "May enable due_dates early as a growth nudge. Should not enable any intermediate features.",
            "notes": "First-week user with minimal activity. Should get only core features.",
        },
    },
    {
        "id": "002",
        "input": {
            "user_context": {
                "days_active": 7,
                "tasks_created": 15,
                "projects_created": 1,
                "due_dates_used": 3,
                "recurring_tasks_used": 0,
                "planning_sessions": 0,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "new-user-simplicity",
            "expected_user_segment": "beginner",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects"],
            "expected_hidden_features": ["recurring_tasks", "tags", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try creating your first project to organize tasks"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Core features plus projects (just created one). Still no intermediate features.",
            "common_failure_modes": ["enables recurring tasks too early", "enables daily_plan prematurely"],
            "acceptable_variation": "May enable projects since user just created one. Should not enable recurring tasks yet.",
            "notes": "End of first week, created first project. Still beginner but showing engagement.",
        },
    },
    {
        "id": "003",
        "input": {
            "user_context": {
                "days_active": 2,
                "tasks_created": 2,
                "projects_created": 0,
                "due_dates_used": 0,
                "recurring_tasks_used": 0,
                "planning_sessions": 0,
                "features_used": ["quick_add"],
                "last_active": "2026-04-03",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "new-user-simplicity",
            "expected_user_segment": "beginner",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search"],
            "expected_hidden_features": ["due_dates", "recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try adding a due date to your first task"],
            "advanced_features": FEATURE_CATALOG["intermediate"] + FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Minimal feature set. Only quick_add and task_list. One gentle nudge.",
            "common_failure_modes": ["enables due_dates too early", "overwhelming feature bundle"],
            "acceptable_variation": "May enable due_dates as a nudge target. Should not enable projects yet.",
            "notes": "Very new user, minimal activity. Should get minimal features.",
        },
    },
    {
        "id": "004",
        "input": {
            "user_context": {
                "days_active": 10,
                "tasks_created": 25,
                "projects_created": 2,
                "due_dates_used": 8,
                "recurring_tasks_used": 0,
                "planning_sessions": 0,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "new-user-simplicity",
            "expected_user_segment": "beginner",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags"],
            "expected_hidden_features": ["recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try using tags to categorize your tasks"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Core features plus tags (emerging behavior). Still no intermediate planning features.",
            "common_failure_modes": ["enables daily_plan prematurely", "enables recurring_tasks too early"],
            "acceptable_variation": "May enable tags since user is organizing. Should not enable planning features yet.",
            "notes": "10 days active, using projects and due dates. Transitioning to intermediate but not there yet.",
        },
    },

    # ── Emerging intermediate user ─────────────────────────────────────────
    {
        "id": "005",
        "input": {
            "user_context": {
                "days_active": 30,
                "tasks_created": 80,
                "projects_created": 4,
                "due_dates_used": 45,
                "recurring_tasks_used": 5,
                "planning_sessions": 3,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "emerging-intermediate",
            "expected_user_segment": "intermediate",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities"],
            "expected_hidden_features": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try weekly planning to review your projects"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "All intermediate features enabled. Advanced features still hidden. Nudge toward weekly planning.",
            "common_failure_modes": ["enables dependencies too early", "hides daily_plan from active user", "enables automation_rules prematurely"],
            "acceptable_variation": "May enable weekly_planning as a nudge target. Should not enable dependencies yet.",
            "notes": "30 days active, using intermediate features regularly. Ready for full intermediate set.",
        },
    },
    {
        "id": "006",
        "input": {
            "user_context": {
                "days_active": 21,
                "tasks_created": 50,
                "projects_created": 3,
                "due_dates_used": 30,
                "recurring_tasks_used": 2,
                "planning_sessions": 1,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "daily_plan"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "emerging-intermediate",
            "expected_user_segment": "intermediate",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities"],
            "expected_hidden_features": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try setting effort estimates for better planning"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Intermediate features enabled. Advanced still hidden. Nudge toward effort estimates.",
            "common_failure_modes": ["enables goals too early", "hides recurring_tasks from user who uses them"],
            "acceptable_variation": "May enable effort_estimates as a nudge. Should not enable goals yet.",
            "notes": "21 days active, transitioning to intermediate. Uses daily planning.",
        },
    },
    {
        "id": "007",
        "input": {
            "user_context": {
                "days_active": 45,
                "tasks_created": 120,
                "projects_created": 6,
                "due_dates_used": 80,
                "recurring_tasks_used": 10,
                "planning_sessions": 8,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "emerging-intermediate",
            "expected_user_segment": "intermediate",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities"],
            "expected_hidden_features": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Ready for weekly planning? Review your projects weekly"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Full intermediate set. Nudge toward advanced features (weekly planning).",
            "common_failure_modes": ["enables automation_rules prematurely", "hides smart_priorities from power user"],
            "acceptable_variation": "May enable weekly_planning as transition to advanced. Should not enable automation yet.",
            "notes": "45 days active, heavy intermediate usage. Ready for advanced nudge.",
        },
    },
    {
        "id": "008",
        "input": {
            "user_context": {
                "days_active": 14,
                "tasks_created": 30,
                "projects_created": 2,
                "due_dates_used": 15,
                "recurring_tasks_used": 1,
                "planning_sessions": 1,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "daily_plan"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "emerging-intermediate",
            "expected_user_segment": "intermediate",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities"],
            "expected_hidden_features": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try using recurring tasks for regular activities"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Intermediate features enabled. Nudge toward recurring tasks.",
            "common_failure_modes": ["enables dependencies too early", "hides daily_plan"],
            "acceptable_variation": "May enable recurring_tasks since user just tried it. Should not enable dependencies.",
            "notes": "14 days active, starting to use intermediate features. Early intermediate.",
        },
    },

    # ── Power-user unlock ──────────────────────────────────────────────────
    {
        "id": "009",
        "input": {
            "user_context": {
                "days_active": 90,
                "tasks_created": 500,
                "projects_created": 15,
                "due_dates_used": 400,
                "recurring_tasks_used": 30,
                "planning_sessions": 40,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "weekly_planning", "custom_views"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "power-user-unlock",
            "expected_user_segment": "advanced",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
            "expected_hidden_features": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try automation rules to save time on repetitive tasks"],
            "advanced_features": FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "All advanced features enabled. Power features still hidden. Nudge toward automation.",
            "common_failure_modes": ["hides dependencies from advanced user", "enables agentic_planning prematurely"],
            "acceptable_variation": "May enable automation_rules since user is ready. Should not enable agentic_planning yet.",
            "notes": "90 days active, heavy usage across all intermediate features. Ready for advanced.",
        },
    },
    {
        "id": "010",
        "input": {
            "user_context": {
                "days_active": 180,
                "tasks_created": 1200,
                "projects_created": 30,
                "due_dates_used": 1000,
                "recurring_tasks_used": 80,
                "planning_sessions": 100,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "power-user-unlock",
            "expected_user_segment": "power",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_hidden_features": [],
            "expected_nudges": [],
            "advanced_features": [],
            "what_good_exposure_looks_like": "All features enabled. No hidden features. No nudges needed.",
            "common_failure_modes": ["hides agentic_planning from power user", "hides api_access"],
            "acceptable_variation": "All features should be enabled for power users. No features hidden.",
            "notes": "180 days active, power user across all features. Ready for everything.",
        },
    },
    {
        "id": "011",
        "input": {
            "user_context": {
                "days_active": 60,
                "tasks_created": 200,
                "projects_created": 8,
                "due_dates_used": 150,
                "recurring_tasks_used": 15,
                "planning_sessions": 15,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "power-user-unlock",
            "expected_user_segment": "advanced",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
            "expected_hidden_features": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try bulk edits to manage multiple tasks at once"],
            "advanced_features": FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Advanced features enabled. Power features hidden. Nudge toward bulk edits.",
            "common_failure_modes": ["enables agentic_planning prematurely", "hides goals from advanced user"],
            "acceptable_variation": "May enable bulk_edits since user is ready. Should not enable agentic_planning.",
            "notes": "60 days active, using advanced features. Not quite power user yet.",
        },
    },
    {
        "id": "012",
        "input": {
            "user_context": {
                "days_active": 120,
                "tasks_created": 800,
                "projects_created": 20,
                "due_dates_used": 700,
                "recurring_tasks_used": 50,
                "planning_sessions": 60,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "power-user-unlock",
            "expected_user_segment": "power",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_hidden_features": [],
            "expected_nudges": [],
            "advanced_features": [],
            "what_good_exposure_looks_like": "All features enabled. Power user with agentic_planning usage.",
            "common_failure_modes": ["hides api_access from power user", "hides custom_automations"],
            "acceptable_variation": "All features should be enabled. No features hidden.",
            "notes": "120 days active, using agentic_planning. Power user.",
        },
    },

    # ── Misclassification resilience ───────────────────────────────────────
    {
        "id": "013",
        "input": {
            "user_context": {
                "days_active": 5,
                "tasks_created": 50,
                "projects_created": 5,
                "due_dates_used": 40,
                "recurring_tasks_used": 10,
                "planning_sessions": 3,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "misclassification",
            "expected_user_segment": "beginner",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects"],
            "expected_hidden_features": ["recurring_tasks", "tags", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["You're moving fast! Try organizing tasks into projects"],
            "advanced_features": FEATURE_CATALOG["intermediate"] + FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Despite high activity, only 5 days active. Should classify as beginner and expose conservatively.",
            "common_failure_modes": ["classifies as intermediate based on activity volume", "enables recurring_tasks too early"],
            "acceptable_variation": "May enable projects since user created some. Should not enable intermediate features.",
            "notes": "High activity but only 5 days. Classifier should prioritize recency over volume.",
        },
    },
    {
        "id": "014",
        "input": {
            "user_context": {
                "days_active": 60,
                "tasks_created": 10,
                "projects_created": 0,
                "due_dates_used": 2,
                "recurring_tasks_used": 0,
                "planning_sessions": 0,
                "features_used": ["quick_add", "task_list"],
                "last_active": "2026-03-01",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "misclassification",
            "expected_user_segment": "beginner",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates"],
            "expected_hidden_features": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Welcome back! Try setting a due date for your next task"],
            "advanced_features": FEATURE_CATALOG["intermediate"] + FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Despite 60 days registered, low activity and inactive for a month. Should classify as beginner.",
            "common_failure_modes": ["classifies as intermediate based on account age", "enables projects prematurely"],
            "acceptable_variation": "May enable due_dates as re-engagement nudge. Should not enable intermediate features.",
            "notes": "60 days registered but inactive for a month. Low activity. Should be beginner.",
        },
    },
    {
        "id": "015",
        "input": {
            "user_context": {
                "days_active": 30,
                "tasks_created": 100,
                "projects_created": 5,
                "due_dates_used": 80,
                "recurring_tasks_used": 20,
                "planning_sessions": 10,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "misclassification",
            "expected_user_segment": "intermediate",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities"],
            "expected_hidden_features": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Ready for weekly planning? Review your projects weekly"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Conflicting signals: high activity but no advanced feature usage. Should classify as intermediate.",
            "common_failure_modes": ["classifies as advanced based on volume", "hides daily_plan from active user"],
            "acceptable_variation": "May enable smart_priorities. Should not enable dependencies yet.",
            "notes": "High activity but no advanced features. Should be intermediate, not advanced.",
        },
    },
    {
        "id": "016",
        "input": {
            "user_context": {
                "days_active": 15,
                "tasks_created": 20,
                "projects_created": 1,
                "due_dates_used": 5,
                "recurring_tasks_used": 0,
                "planning_sessions": 0,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
        },
        "expected": {
            "category": "misclassification",
            "expected_user_segment": "beginner",
            "confidence": 0.6,
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects"],
            "expected_hidden_features": ["recurring_tasks", "tags", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try setting due dates for better planning"],
            "advanced_features": FEATURE_CATALOG["intermediate"] + FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Low confidence classification. Should choose safer exposure policy.",
            "common_failure_modes": ["overconfident classification", "enables intermediate features prematurely"],
            "acceptable_variation": "May enable projects. Should not enable intermediate features.",
            "notes": "Ambiguous signals. Classifier should have low confidence and choose safer policy.",
        },
    },

    # ── Planning-mode routing ──────────────────────────────────────────────
    {
        "id": "017",
        "input": {
            "user_context": {
                "days_active": 7,
                "tasks_created": 10,
                "projects_created": 0,
                "due_dates_used": 2,
                "recurring_tasks_used": 0,
                "planning_sessions": 0,
                "features_used": ["quick_add", "task_list", "basic_search"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
            "planning_context": {
                "available_modes": ["lightweight_daily", "urgency_triage", "goal_aware_weekly", "automation_bulk"],
            },
        },
        "expected": {
            "category": "planning-routing",
            "expected_user_segment": "beginner",
            "expected_planning_mode": "lightweight_daily",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates"],
            "expected_hidden_features": ["recurring_tasks", "projects", "tags", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try our daily plan to organize your day"],
            "advanced_features": FEATURE_CATALOG["intermediate"] + FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Routed to lightweight_daily planning mode. Core features only.",
            "common_failure_modes": ["routes to urgency_triage for beginner", "routes to goal_aware_weekly prematurely"],
            "acceptable_variation": "May enable due_dates. Should route to lightweight_daily.",
            "notes": "Beginner user should get lightweight daily planning mode.",
        },
    },
    {
        "id": "018",
        "input": {
            "user_context": {
                "days_active": 45,
                "tasks_created": 150,
                "projects_created": 5,
                "due_dates_used": 120,
                "recurring_tasks_used": 10,
                "planning_sessions": 10,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "daily_plan", "smart_priorities"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
            "planning_context": {
                "available_modes": ["lightweight_daily", "urgency_triage", "goal_aware_weekly", "automation_bulk"],
            },
        },
        "expected": {
            "category": "planning-routing",
            "expected_user_segment": "intermediate",
            "expected_planning_mode": "goal_aware_weekly",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities"],
            "expected_hidden_features": ["dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try weekly planning to review your projects"],
            "advanced_features": FEATURE_CATALOG["advanced"] + FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Routed to goal_aware_weekly planning mode. Intermediate features enabled.",
            "common_failure_modes": ["routes to lightweight_daily for intermediate user", "routes to automation_bulk prematurely"],
            "acceptable_variation": "May enable effort_estimates. Should route to goal_aware_weekly.",
            "notes": "Intermediate user should get goal-aware weekly planning mode.",
        },
    },
    {
        "id": "019",
        "input": {
            "user_context": {
                "days_active": 120,
                "tasks_created": 600,
                "projects_created": 20,
                "due_dates_used": 500,
                "recurring_tasks_used": 50,
                "planning_sessions": 50,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
            "planning_context": {
                "available_modes": ["lightweight_daily", "urgency_triage", "goal_aware_weekly", "automation_bulk"],
            },
        },
        "expected": {
            "category": "planning-routing",
            "expected_user_segment": "advanced",
            "expected_planning_mode": "automation_bulk",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views"],
            "expected_hidden_features": ["agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_nudges": ["Try automation rules to save time on repetitive tasks"],
            "advanced_features": FEATURE_CATALOG["power"],
            "what_good_exposure_looks_like": "Routed to automation_bulk planning mode. Advanced features enabled.",
            "common_failure_modes": ["routes to goal_aware_weekly for advanced user", "hides bulk_edits"],
            "acceptable_variation": "May enable automation_rules. Should route to automation_bulk.",
            "notes": "Advanced user should get automation/bulk planning mode.",
        },
    },
    {
        "id": "020",
        "input": {
            "user_context": {
                "days_active": 200,
                "tasks_created": 1500,
                "projects_created": 40,
                "due_dates_used": 1200,
                "recurring_tasks_used": 100,
                "planning_sessions": 150,
                "features_used": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph"],
                "last_active": "2026-04-04",
            },
            "feature_catalog": FEATURE_CATALOG,
            "planning_context": {
                "available_modes": ["lightweight_daily", "urgency_triage", "goal_aware_weekly", "automation_bulk"],
            },
        },
        "expected": {
            "category": "planning-routing",
            "expected_user_segment": "power",
            "expected_planning_mode": "automation_bulk",
            "expected_enabled_features": ["quick_add", "task_list", "basic_search", "due_dates", "projects", "tags", "recurring_tasks", "effort_estimates", "daily_plan", "smart_priorities", "dependencies", "goals", "automation_rules", "bulk_edits", "weekly_planning", "custom_views", "agentic_planning", "dependency_graph", "batch_workflows", "api_access", "custom_automations"],
            "expected_hidden_features": [],
            "expected_nudges": [],
            "advanced_features": [],
            "what_good_exposure_looks_like": "Routed to automation_bulk planning mode. All features enabled.",
            "common_failure_modes": ["hides api_access from power user", "routes to lightweight_daily"],
            "acceptable_variation": "All features should be enabled. Should route to automation_bulk.",
            "notes": "Power user should get full automation/bulk planning mode with all features.",
        },
    },
]

base = "/private/tmp/todos-api-eval-lab-feat/eval-lab/tasks/feature-exposure-quality"

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
        f.write(f'[task]\nname = "feature-exposure-case-{cid}"\ndescription = "{case["expected"]["what_good_exposure_looks_like"][:80]}"\n\n[scoring]\nweight = 1.0\n')

    print(f"Created case-{cid}: category={case['expected']['category']}, segment={case['expected']['expected_user_segment']}")

print(f"\nGenerated {len(CASES)} cases")
