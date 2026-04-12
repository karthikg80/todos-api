// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startOfToday,
  formatProjectDate,
  isOverdue,
  daysUntil,
  buildSectionGroups,
  estimateTaskEffort,
  getTaskNextReason,
  pickTopTasks,
  classifyProjectOverview,
  COMPLEXITY_LABELS,
  COMPLEXITY_STYLES,
  getEmptyStateGuidance,
} from "./projectWorkspaceModels";
import type { Todo, Heading, Project } from "../../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Test task",
    description: null,
    notes: overrides.notes ?? null,
    status: overrides.status ?? "next",
    completed: overrides.completed ?? false,
    completedAt: null,
    projectId: overrides.projectId ?? "p1",
    category: null,
    headingId: overrides.headingId ?? null,
    tags: [],
    context: null,
    energy: null,
    dueDate: overrides.dueDate ?? null,
    startDate: null,
    scheduledDate: null,
    reviewDate: null,
    doDate: null,
    estimateMinutes: overrides.estimateMinutes ?? null,
    waitingOn: null,
    dependsOnTaskIds: overrides.dependsOnTaskIds ?? [],
    order: 0,
    priority: overrides.priority ?? null,
    archived: false,
    firstStep: null,
    emotionalState: null,
    effortScore: null,
    source: null,
    recurrence: { type: "none" },
    subtasks: overrides.subtasks ?? [],
    userId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeHeading(overrides: Partial<Heading> = {}): Heading {
  return {
    id: overrides.id ?? "h1",
    name: overrides.name ?? "Section",
    projectId: overrides.projectId ?? "p1",
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Test Project",
    description: null,
    goal: null,
    status: "active",
    priority: null,
    area: null,
    areaId: null,
    targetDate: overrides.targetDate ?? null,
    archived: false,
    userId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("projectWorkspaceModels", () => {
  describe("COMPLEXITY_LABELS", () => {
    it("maps each mode to a label", () => {
      expect(COMPLEXITY_LABELS.simple).toBe("Simple project");
      expect(COMPLEXITY_LABELS.guided).toBe("Structured project");
      expect(COMPLEXITY_LABELS.rich).toBe("Complex project");
    });
  });

  describe("COMPLEXITY_STYLES", () => {
    it("defines styles for each mode", () => {
      expect(COMPLEXITY_STYLES.simple).toHaveProperty("background");
      expect(COMPLEXITY_STYLES.simple).toHaveProperty("border");
      expect(COMPLEXITY_STYLES.simple).toHaveProperty("color");
      expect(COMPLEXITY_STYLES.rich).toHaveProperty("background");
    });
  });

  describe("startOfToday", () => {
    it("returns midnight of the given date", () => {
      const input = new Date("2026-04-10T15:30:00.000Z");
      const result = startOfToday(input);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it("uses current time when no argument given", () => {
      const result = startOfToday();
      expect(result.getHours()).toBe(0);
    });
  });

  describe("formatProjectDate", () => {
    it("returns null for empty input", () => {
      expect(formatProjectDate(null)).toBeNull();
      expect(formatProjectDate(undefined)).toBeNull();
    });

    it("formats a date with short month and day", () => {
      const result = formatProjectDate("2026-04-10T12:00:00.000Z");
      expect(result).toMatch(/\w+ \d+/);
    });
  });

  describe("isOverdue", () => {
    it("returns false for tasks without due date", () => {
      expect(isOverdue(makeTodo())).toBe(false);
    });

    it("returns false for completed tasks", () => {
      const today = new Date().toISOString();
      expect(isOverdue(makeTodo({ completed: true, dueDate: today }))).toBe(false);
    });

    it("returns true for past due date", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isOverdue(makeTodo({ dueDate: yesterday.toISOString() }), new Date())).toBe(true);
    });

    it("returns false for future due date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isOverdue(makeTodo({ dueDate: tomorrow.toISOString() }), new Date())).toBe(false);
    });
  });

  describe("daysUntil", () => {
    it("returns null for empty date", () => {
      expect(daysUntil(null)).toBeNull();
    });

    it("returns 0 for today", () => {
      const today = new Date();
      expect(daysUntil(today.toISOString(), today)).toBe(0);
    });

    it("returns positive for future dates", () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + 5);
      expect(daysUntil(future.toISOString(), today)).toBe(5);
    });

    it("returns negative for past dates", () => {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 3);
      expect(daysUntil(past.toISOString(), today)).toBe(-3);
    });
  });

  describe("buildSectionGroups", () => {
    it("groups tasks by heading and adds Backlog for unplaced", () => {
      const todos = [
        makeTodo({ id: "t1", headingId: "h1" }),
        makeTodo({ id: "t2", headingId: "h1" }),
        makeTodo({ id: "t3", headingId: "h2" }),
        makeTodo({ id: "t4", headingId: null }),
      ];
      const headings = [makeHeading({ id: "h1", name: "Phase 1" }), makeHeading({ id: "h2", name: "Phase 2" })];
      const groups = buildSectionGroups(todos, headings);
      expect(groups).toHaveLength(3); // Backlog, Phase 1, Phase 2
      expect(groups[0].label).toBe("Backlog");
      expect(groups[0].todos).toHaveLength(1);
      expect(groups[1].label).toBe("Phase 1");
      expect(groups[2].label).toBe("Phase 2");
    });

    it("puts unplaced tasks in Backlog", () => {
      const todos = [
        makeTodo({ id: "t1", headingId: null }),
        makeTodo({ id: "t2", headingId: "h1" }),
      ];
      const headings = [makeHeading({ id: "h1", name: "Phase 1" })];
      const groups = buildSectionGroups(todos, headings);
      expect(groups[0].label).toBe("Backlog");
      expect(groups[0].todos).toHaveLength(1);
    });

    it("includes Backlog even when no headings exist", () => {
      const todos = [makeTodo({ id: "t1", headingId: null })];
      const groups = buildSectionGroups(todos, []);
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe("Backlog");
    });

    it("includes Backlog when there are headings but also unplaced tasks", () => {
      const todos = [
        makeTodo({ id: "t1", headingId: null }),
        makeTodo({ id: "t2", headingId: "h1" }),
      ];
      const headings = [makeHeading({ id: "h1", name: "Phase 1" })];
      const groups = buildSectionGroups(todos, headings);
      expect(groups.some((g) => g.label === "Backlog")).toBe(true);
    });

    it("omits Backlog when all tasks have headings and headings exist", () => {
      const todos = [makeTodo({ id: "t1", headingId: "h1" })];
      const headings = [makeHeading({ id: "h1", name: "Phase 1" })];
      const groups = buildSectionGroups(todos, headings);
      // Backlog is only added when there are unplaced tasks OR no heading groups
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe("Phase 1");
    });
  });

  describe("estimateTaskEffort", () => {
    it("returns Quick win for basic task", () => {
      const result = estimateTaskEffort(makeTodo());
      expect(result.label).toBe("Quick win");
      expect(result.minutes).toBe(5);
    });

    it("adjusts for urgent priority", () => {
      const result = estimateTaskEffort(makeTodo({ priority: "urgent" }));
      expect(result.label).toBe("Short"); // 5 * 1.5 = 7.5 -> rounds to 10
    });

    it("adjusts for high priority", () => {
      const result = estimateTaskEffort(makeTodo({ priority: "high" }));
      expect(result.label).toBe("Quick win"); // 5 * 1.2 = 6 -> rounds to 5
    });

    it("adjusts for long notes", () => {
      const result = estimateTaskEffort(makeTodo({ notes: "x".repeat(250) }));
      expect(result.label).toBe("Short"); // 5 + 5 = 10
    });

    it("adjusts for subtasks", () => {
      const result = estimateTaskEffort(makeTodo({
        subtasks: [
          { id: "s1", title: "Sub 1", completed: false, order: 0, todoId: "t1", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
          { id: "s2", title: "Sub 2", completed: false, order: 1, todoId: "t1", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        ],
      }));
      // 5 + 2*3 = 11 -> rounds to 10
      expect(result.label).toBe("Short");
    });

    it("handles null todo", () => {
      const result = estimateTaskEffort(null as any);
      expect(result).toEqual({ minutes: 0, label: "Unknown" });
    });

    it("returns Extended for very long tasks", () => {
      const subtasks = Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`, title: `Sub ${i}`, completed: false, order: i, todoId: "t1", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      }));
      const result = estimateTaskEffort(makeTodo({ subtasks, priority: "urgent", notes: "x".repeat(300) }));
      // 5 + 20*3 = 65, *1.5 = 97.5, +5 = 102.5 -> rounds to 105
      expect(result.label).toBe("Extended");
    });
  });

  describe("getTaskNextReason", () => {
    it("returns next in queue for basic task", () => {
      expect(getTaskNextReason(makeTodo(), [])).toBe("next in queue");
    });

    it("returns urgent priority for urgent tasks", () => {
      expect(getTaskNextReason(makeTodo({ priority: "urgent" }), [])).toBe("urgent priority");
    });

    it("returns due soon for tasks due today", () => {
      const today = new Date();
      expect(getTaskNextReason(makeTodo({ dueDate: today.toISOString() }), [])).toBe("due soon");
    });

    it("returns due in N days for tasks due in 2 days", () => {
      const today = new Date();
      // Use start of today + 2 days to avoid timezone edge cases
      const in2days = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
      expect(getTaskNextReason(makeTodo({ dueDate: in2days.toISOString() }), [])).toBe("due in 2 days");
    });

    it("returns unblocks N tasks for blocking tasks", () => {
      const task = makeTodo({ id: "t1" });
      const blocked = makeTodo({ id: "t2", dependsOnTaskIds: ["t1"] });
      expect(getTaskNextReason(task, [blocked])).toBe("unblocks 1 other task");
    });

    it("returns next in queue when no reasons apply", () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      expect(getTaskNextReason(makeTodo({ dueDate: future.toISOString() }), [])).toBe("next in queue");
    });
  });

  describe("pickTopTasks", () => {
    it("returns empty array for empty input", () => {
      expect(pickTopTasks([])).toEqual([]);
    });

    it("excludes completed tasks", () => {
      const todos = [makeTodo({ id: "t1", completed: true })];
      expect(pickTopTasks(todos)).toEqual([]);
    });

    it("prioritizes overdue tasks", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todos = [
        makeTodo({ id: "t1", title: "Future", dueDate: tomorrow.toISOString() }),
        makeTodo({ id: "t2", title: "Overdue", dueDate: yesterday.toISOString() }),
      ];
      const top = pickTopTasks(todos);
      expect(top[0].title).toBe("Overdue");
    });

    it("prioritizes in_progress over next", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Next", status: "next" }),
        makeTodo({ id: "t2", title: "In Progress", status: "in_progress" }),
      ];
      const top = pickTopTasks(todos);
      expect(top[0].title).toBe("In Progress");
    });

    it("limits to 4 tasks", () => {
      const todos = Array.from({ length: 10 }, (_, i) => makeTodo({ id: `t${i}`, title: `Task ${i}` }));
      expect(pickTopTasks(todos)).toHaveLength(4);
    });
  });

  describe("classifyProjectOverview", () => {
    it("returns simple for empty project", () => {
      const profile = classifyProjectOverview([], []);
      expect(profile.mode).toBe("simple");
      expect(profile.totalTasks).toBe(0);
      expect(profile.showStarter).toBe(true);
    });

    it("returns simple for small project", () => {
      const todos = [makeTodo({ id: "t1" }), makeTodo({ id: "t2" })];
      const profile = classifyProjectOverview(todos, []);
      expect(profile.mode).toBe("simple");
    });

    it("returns rich for large project", () => {
      const todos = Array.from({ length: 15 }, (_, i) => makeTodo({ id: `t${i}` }));
      const headings = [makeHeading({ id: "h1" }), makeHeading({ id: "h2" }), makeHeading({ id: "h3" })];
      const profile = classifyProjectOverview(todos, headings);
      expect(profile.mode).toBe("rich");
    });

    it("returns guided for medium project", () => {
      const todos = Array.from({ length: 8 }, (_, i) => makeTodo({ id: `t${i}` }));
      const headings = [makeHeading({ id: "h1" }), makeHeading({ id: "h2" })];
      const profile = classifyProjectOverview(todos, headings);
      expect(profile.mode).toBe("guided");
    });

    it("counts overdue tasks", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const todos = [makeTodo({ id: "t1", dueDate: yesterday.toISOString() })];
      const profile = classifyProjectOverview(todos, [], new Date());
      expect(profile.overdueTasks).toBe(1);
    });

    it("counts waiting tasks", () => {
      const todos = [makeTodo({ id: "t1", status: "waiting" })];
      const profile = classifyProjectOverview(todos, []);
      expect(profile.waitingTasks).toBe(1);
    });

    it("counts unplaced tasks", () => {
      const todos = [makeTodo({ id: "t1", headingId: null })];
      const headings = [makeHeading({ id: "h1" })];
      const profile = classifyProjectOverview(todos, headings);
      expect(profile.unplacedTasks).toBe(1);
    });

    it("counts sections with tasks", () => {
      const todos = [makeTodo({ id: "t1", headingId: "h1" })];
      const headings = [makeHeading({ id: "h1" }), makeHeading({ id: "h2" })];
      const profile = classifyProjectOverview(todos, headings);
      expect(profile.sectionsWithTasks).toBe(1);
    });
  });

  describe("getEmptyStateGuidance", () => {
    it("returns starter guidance for empty project", () => {
      const profile = classifyProjectOverview([], []);
      const project = makeProject({ name: "My Project" });
      const guidance = getEmptyStateGuidance(profile, project);
      expect(guidance.title).toContain("concrete step");
      expect(guidance.showAdd).toBe(true);
    });

    it("returns lightweight guidance for simple project", () => {
      const todos = [makeTodo({ id: "t1" })];
      const profile = classifyProjectOverview(todos, []);
      const project = makeProject();
      const guidance = getEmptyStateGuidance(profile, project);
      expect(guidance.title).toContain("lightweight");
    });
  });
});
