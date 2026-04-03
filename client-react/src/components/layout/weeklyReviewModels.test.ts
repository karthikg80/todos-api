import { describe, expect, it } from "vitest";
import { normalizeWeeklyReviewResponse } from "./weeklyReviewModels";

describe("weeklyReviewModels", () => {
  it("unwraps the agent response envelope and prefers recommended actions", () => {
    const result = normalizeWeeklyReviewResponse({
      ok: true,
      data: {
        review: {
          summary: { staleTasks: 3, waitingTasks: 1, upcomingTasks: 2 },
          findings: [
            { type: "stale_task", projectName: "Admin", reason: "No updates" },
          ],
          recommendedActions: [
            { type: "ensure_next_action", title: "Add next step", reason: "Project stalled" },
          ],
          rolloverGroups: [{ key: "stale", items: [{ title: "Follow up vendor" }] }],
          anchorSuggestions: [{ title: "Ship onboarding", reason: "Highest leverage" }],
          behaviorAdjustment: "Reduce parallel work",
          reflectionSummary: "You spread effort too thin.",
        },
      },
    });

    expect(result.summary?.staleTasks).toBe(3);
    expect(result.findings[0]).toEqual({
      type: "stale_task",
      taskTitle: "Admin",
      reason: "No updates",
    });
    expect(result.actions[0]?.title).toBe("Add next step");
    expect(result.rolloverGroups[0]).toEqual({
      label: "stale",
      tasks: [{ title: "Follow up vendor" }],
    });
  });

  it("falls back to applied actions for apply responses", () => {
    const result = normalizeWeeklyReviewResponse({
      data: {
        review: {
          appliedActions: [
            { type: "archive_task", title: "Clean old task", reason: "Completed automatically" },
          ],
        },
      },
    });

    expect(result.actions).toEqual([
      {
        type: "archive_task",
        title: "Clean old task",
        reason: "Completed automatically",
      },
    ]);
  });
});
