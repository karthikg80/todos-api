// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  normalizeWeeklyReviewResponse,
  type ReviewData,
} from "./weeklyReviewModels";

describe("weeklyReviewModels", () => {
  describe("normalizeWeeklyReviewResponse", () => {
    it("returns empty data for null payload", () => {
      const result = normalizeWeeklyReviewResponse(null);
      expect(result.summary).toBeNull();
      expect(result.findings).toEqual([]);
      expect(result.actions).toEqual([]);
      expect(result.rolloverGroups).toEqual([]);
      expect(result.anchorSuggestions).toEqual([]);
      expect(result.behaviorAdjustment).toBe("");
      expect(result.reflectionSummary).toBe("");
    });

    it("returns empty data for undefined payload", () => {
      const result = normalizeWeeklyReviewResponse(undefined);
      expect(result.summary).toBeNull();
      expect(result.findings).toEqual([]);
    });

    it("returns empty data for empty object", () => {
      const result = normalizeWeeklyReviewResponse({});
      expect(result.summary).toBeNull();
    });

    it("extracts summary from nested data.review structure", () => {
      const payload = {
        data: {
          review: {
            summary: {
              projectsWithoutNextAction: 3,
              staleTasks: 5,
              waitingTasks: 2,
              upcomingTasks: 8,
            },
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.summary).toEqual({
        projectsWithoutNextAction: 3,
        staleTasks: 5,
        waitingTasks: 2,
        upcomingTasks: 8,
      });
    });

    it("defaults summary numbers to 0 for non-numeric values", () => {
      const payload = {
        data: {
          review: {
            summary: {
              projectsWithoutNextAction: "three",
              staleTasks: null,
              waitingTasks: undefined,
              upcomingTasks: false,
            },
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.summary).toEqual({
        projectsWithoutNextAction: 0,
        staleTasks: 0,
        waitingTasks: 0,
        upcomingTasks: 0,
      });
    });

    it("extracts findings from nested structure", () => {
      const payload = {
        data: {
          review: {
            findings: [
              { type: "blocked", taskTitle: "Task A", reason: "Waiting on X" },
              { type: "stale", projectName: "Project B", reason: "No activity" },
            ],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0]).toEqual({
        type: "blocked",
        taskTitle: "Task A",
        reason: "Waiting on X",
      });
      // Falls back to projectName when taskTitle is missing
      expect(result.findings[1].taskTitle).toBe("Project B");
    });

    it("extracts recommendedActions when present", () => {
      const payload = {
        data: {
          review: {
            recommendedActions: [
              { type: "reschedule", title: "Reschedule meeting", reason: "Conflict" },
            ],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
        type: "reschedule",
        title: "Reschedule meeting",
        reason: "Conflict",
      });
    });

    it("falls back to appliedActions when recommendedActions is empty", () => {
      const payload = {
        data: {
          review: {
            recommendedActions: [],
            appliedActions: [
              { type: "archive", title: "Old task", reason: "Done" },
            ],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].title).toBe("Old task");
    });

    it("falls back to legacy actions when both recommended and applied are empty", () => {
      const payload = {
        data: {
          review: {
            recommendedActions: [],
            appliedActions: [],
            actions: [{ type: "create", title: "Legacy task", reason: "Legacy" }],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].title).toBe("Legacy task");
    });

    it("extracts rolloverGroups with tasks", () => {
      const payload = {
        data: {
          review: {
            rolloverGroups: [
              {
                label: "Overdue",
                tasks: [{ title: "Task 1" }, { title: "Task 2" }],
              },
            ],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.rolloverGroups).toHaveLength(1);
      expect(result.rolloverGroups[0].label).toBe("Overdue");
      expect(result.rolloverGroups[0].tasks).toHaveLength(2);
      expect(result.rolloverGroups[0].tasks[0].title).toBe("Task 1");
    });

    it("falls back to items key when tasks key is missing in rollover groups", () => {
      const payload = {
        data: {
          review: {
            rolloverGroups: [
              {
                key: "Stale",
                items: [{ title: "Item 1" }],
              },
            ],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.rolloverGroups[0].label).toBe("Stale");
      expect(result.rolloverGroups[0].tasks[0].title).toBe("Item 1");
    });

    it("defaults rollover group label to Group when missing", () => {
      const payload = {
        data: {
          review: {
            rolloverGroups: [{ tasks: [{ title: "Task" }] }],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.rolloverGroups[0].label).toBe("Group");
    });

    it("extracts anchorSuggestions", () => {
      const payload = {
        data: {
          review: {
            anchorSuggestions: [
              { title: "Focus on X", reason: "High impact" },
            ],
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.anchorSuggestions).toHaveLength(1);
      expect(result.anchorSuggestions[0]).toEqual({
        title: "Focus on X",
        reason: "High impact",
      });
    });

    it("extracts behaviorAdjustment and reflectionSummary", () => {
      const payload = {
        data: {
          review: {
            behaviorAdjustment: "Take more breaks",
            reflectionSummary: "Good week overall",
          },
        },
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.behaviorAdjustment).toBe("Take more breaks");
      expect(result.reflectionSummary).toBe("Good week overall");
    });

    it("handles flat object structure without data.review nesting", () => {
      const payload = {
        summary: { projectsWithoutNextAction: 1, staleTasks: 2, waitingTasks: 0, upcomingTasks: 3 },
        findings: [{ type: "test", title: "Flat finding", reason: "Test" }],
      };
      const result = normalizeWeeklyReviewResponse(payload);
      expect(result.summary?.projectsWithoutNextAction).toBe(1);
      expect(result.findings).toHaveLength(1);
    });
  });
});
