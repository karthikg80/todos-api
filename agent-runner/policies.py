"""
Safe-apply policy for the autonomous agent runner.

Only actions in SAFE_AUTO_APPLY_ACTIONS will ever be auto-applied when
AUTO_APPLY=true. All other recommendations are logged as suggestions.

Keep this allowlist tight. When in doubt, leave it out.
"""

# These are the recommended-action type strings emitted by weekly_review and
# plan_today. They map to specific agent write calls in the job handlers.
SAFE_AUTO_APPLY_ACTIONS: frozenset[str] = frozenset(
    [
        # Create a missing next action for a truly empty active project.
        "create_next_action",
        # Create a follow-up task for a waiting item that has no pending follow-up.
        "follow_up_waiting_task",
        # Compute user insights — read-heavy, writes only to user_insights table.
        "compute_insights",
    ]
)

# These action types are explicitly blocked regardless of any configuration.
# They are listed here for documentation clarity; the allowlist check is
# sufficient protection, but explicit block is defence-in-depth.
NEVER_AUTO_APPLY_ACTIONS: frozenset[str] = frozenset(
    [
        "archive_task",
        "archive_project",
        "delete_task",
        "delete_project",
        "complete_task",
        "rename_project",
        "bulk_reprioritize",
        "merge_tasks",
        "move_task",
    ]
)


def is_safe_to_apply(action_type: str) -> bool:
    """Return True only if action_type is in the explicit safe allowlist."""
    if action_type in NEVER_AUTO_APPLY_ACTIONS:
        return False
    return action_type in SAFE_AUTO_APPLY_ACTIONS


def describe_policy() -> dict:
    return {
        "safeAutoApply": sorted(SAFE_AUTO_APPLY_ACTIONS),
        "neverAutoApply": sorted(NEVER_AUTO_APPLY_ACTIONS),
    }
