// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TaskFullPage } from "./TaskFullPage";
import type { Todo, Project } from "../../types";

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: "todo-1",
  title: "Test task",
  description: overrides.description ?? null,
  notes: overrides.notes ?? null,
  status: overrides.status ?? "next",
  completed: overrides.completed ?? false,
  completedAt: overrides.completedAt ?? null,
  projectId: overrides.projectId ?? null,
  category: overrides.category ?? null,
  headingId: overrides.headingId ?? null,
  tags: overrides.tags ?? [],
  context: overrides.context ?? null,
  energy: overrides.energy ?? null,
  dueDate: overrides.dueDate ?? null,
  startDate: overrides.startDate ?? null,
  scheduledDate: overrides.scheduledDate ?? null,
  reviewDate: overrides.reviewDate ?? null,
  doDate: overrides.doDate ?? null,
  estimateMinutes: overrides.estimateMinutes ?? null,
  waitingOn: overrides.waitingOn ?? null,
  dependsOnTaskIds: overrides.dependsOnTaskIds ?? [],
  order: overrides.order ?? 0,
  priority: overrides.priority ?? null,
  archived: overrides.archived ?? false,
  firstStep: overrides.firstStep ?? null,
  emotionalState: overrides.emotionalState ?? null,
  effortScore: overrides.effortScore ?? null,
  source: overrides.source ?? null,
  recurrence: overrides.recurrence ?? null,
  subtasks: overrides.subtasks ?? undefined,
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const defaultTodo = makeTodo();
const defaultProjects: Project[] = [
  { id: "p1", name: "Work", status: "active", archived: false, userId: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const defaultProps = {
  todo: defaultTodo,
  projects: defaultProjects,
  onSave: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn(),
  onBack: vi.fn(),
};

describe("TaskFullPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title input", () => {
    render(createElement(TaskFullPage, defaultProps));
    expect(screen.getByPlaceholderText("Task title")).toBeTruthy();
    expect(screen.getByPlaceholderText("Task title")).toHaveValue("Test task");
  });

  it("renders the description textarea", () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ description: "A description" }),
    }));
    expect(screen.getByPlaceholderText("What needs to be done?")).toBeTruthy();
    expect(screen.getByPlaceholderText("What needs to be done?")).toHaveValue("A description");
  });

  it("renders the first step input", () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ firstStep: "Open the door" }),
    }));
    expect(screen.getByPlaceholderText("What's the very first action?")).toBeTruthy();
    expect(screen.getByPlaceholderText("What's the very first action?")).toHaveValue("Open the door");
  });

  it("renders the notes textarea", () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ notes: "Private notes" }),
    }));
    expect(screen.getByPlaceholderText("Private notes, links, context…")).toBeTruthy();
    expect(screen.getByPlaceholderText("Private notes, links, context…")).toHaveValue("Private notes");
  });

  it("calls onBack when back button is clicked", () => {
    render(createElement(TaskFullPage, defaultProps));
    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it("calls onDelete when delete button is clicked", () => {
    render(createElement(TaskFullPage, defaultProps));
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    expect(defaultProps.onDelete).toHaveBeenCalledWith("todo-1");
  });

  it("saves title when blurred with changes", async () => {
    render(createElement(TaskFullPage, defaultProps));
    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.change(titleInput, { target: { value: "New title" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("todo-1", { title: "New title" });
    });
  });

  it("does not save title when blurred without changes", () => {
    render(createElement(TaskFullPage, defaultProps));
    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.blur(titleInput);
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("does not save title when blurred with only whitespace", () => {
    render(createElement(TaskFullPage, defaultProps));
    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.change(titleInput, { target: { value: "   " } });
    fireEvent.blur(titleInput);
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("saves description when blurred with changes", async () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ description: "Old description" }),
    }));
    const textarea = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.change(textarea, { target: { value: "New description" } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("todo-1", { description: "New description" });
    });
  });

  it("saves firstStep when blurred with changes", async () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ firstStep: "Old step" }),
    }));
    const input = screen.getByPlaceholderText("What's the very first action?");
    fireEvent.change(input, { target: { value: "New step" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("todo-1", { firstStep: "New step" });
    });
  });

  it("saves notes when blurred with changes", async () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ notes: "Old notes" }),
    }));
    const textarea = screen.getByPlaceholderText("Private notes, links, context…");
    fireEvent.change(textarea, { target: { value: "New notes" } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("todo-1", { notes: "New notes" });
    });
  });

  it("shows saving status while save is in progress", async () => {
    let resolveSave: () => void;
    const savePromise = new Promise<void>((r) => {
      resolveSave = r;
    });
    const onSave = vi.fn().mockReturnValue(savePromise);
    render(createElement(TaskFullPage, { ...defaultProps, onSave }));

    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.change(titleInput, { target: { value: "New title" } });
    fireEvent.blur(titleInput);

    expect(screen.getByText("Saving…")).toBeTruthy();

    resolveSave!();
    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeTruthy();
    });
  });

  it("shows error status when save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Network error"));
    render(createElement(TaskFullPage, { ...defaultProps, onSave }));

    const titleInput = screen.getByPlaceholderText("Task title");
    fireEvent.change(titleInput, { target: { value: "New title" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(screen.getByText("Error saving")).toBeTruthy();
    });
  });

  it("renders recurrence section", () => {
    render(createElement(TaskFullPage, defaultProps));
    expect(screen.getByText("Recurrence")).toBeTruthy();
    expect(screen.getByLabelText("Repeat")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Never", selected: true })).toBeTruthy();
  });

  it("shows interval input when recurrence type is not none", () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ recurrence: { type: "weekly", interval: 2 } }),
    }));
    expect(screen.getByLabelText("Every")).toBeTruthy();
    expect(screen.getByRole("spinbutton")).toHaveValue(2);
  });

  it("hides interval input when recurrence type is none", () => {
    render(createElement(TaskFullPage, defaultProps));
    expect(screen.queryByLabelText("Every")).toBeNull();
  });

  it("saves recurrence when type changes", async () => {
    render(createElement(TaskFullPage, defaultProps));
    const select = screen.getByLabelText("Repeat");
    fireEvent.change(select, { target: { value: "daily" } });

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("todo-1", {
        recurrence: { type: "daily", interval: 1 },
      });
    });
  });

  it("saves recurrence when interval changes", async () => {
    render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ recurrence: { type: "weekly", interval: 2 } }),
    }));
    const input = screen.getByLabelText("Every");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("todo-1", {
        recurrence: { type: "weekly", interval: 3 },
      });
    });
  });

  it("renders dependencies section when present", () => {
    const { container } = render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ dependsOnTaskIds: ["dep-123456789", "dep-987654321"] }),
    }));
    expect(screen.getByText("Dependencies")).toBeTruthy();
    // Check that the deps container has chip elements
    const depsSection = container.querySelector(".todo-drawer__deps");
    expect(depsSection).toBeTruthy();
    expect(depsSection!.querySelectorAll(".todo-chip").length).toBe(2);
  });

  it("does not render dependencies section when empty", () => {
    render(createElement(TaskFullPage, defaultProps));
    expect(screen.queryByText("Dependencies")).toBeNull();
  });

  it("shows relative created time", () => {
    render(createElement(TaskFullPage, defaultProps));
    expect(screen.getByText(/Created/)).toBeTruthy();
  });

  it("syncs recurrence state when todo prop changes", () => {
    const { rerender, container } = render(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ recurrence: { type: "none", interval: 1 } }),
    }));

    const repeatSelect = container.querySelector("#fp-recurrenceType") as HTMLSelectElement;
    expect(repeatSelect.value).toBe("none");

    rerender(createElement(TaskFullPage, {
      ...defaultProps,
      todo: makeTodo({ recurrence: { type: "monthly", interval: 3 } }),
    }));

    expect(repeatSelect.value).toBe("monthly");
    const intervalInput = container.querySelector("#fp-recurrenceInterval") as HTMLInputElement;
    expect(intervalInput).toBeTruthy();
    expect(intervalInput.value).toBe("3");
  });

  it("renders section titles for sidebar fields", () => {
    render(createElement(TaskFullPage, defaultProps));
    // Should have status & priority section
    expect(screen.getByText("Status & Priority")).toBeTruthy();
  });
});
