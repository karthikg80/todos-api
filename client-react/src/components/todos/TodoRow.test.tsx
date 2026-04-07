// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodoRow } from "./TodoRow";
import type { Todo, Project, Heading } from "../../types";

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: overrides.id ?? "todo-1",
  title: overrides.title ?? "Test task",
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
  subtasks: overrides.subtasks ?? null,
  userId: overrides.userId ?? "user-1",
  createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
});

const defaultTodo = makeTodo();

const defaultProps = {
  todo: defaultTodo,
  isActive: false,
  isExpanded: false,
  isBulkMode: false,
  isSelected: false,
  density: "normal" as const,
  projects: [] as Project[],
  headings: [] as Heading[],
  onToggle: vi.fn(),
  onClick: vi.fn(),
  onKebab: vi.fn(),
  onSelect: vi.fn(),
  onInlineEdit: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
};

describe("TodoRow", () => {
  it("renders the todo title", () => {
    render(createElement(TodoRow, { ...defaultProps, todo: makeTodo({ title: "My Task" }) }));
    expect(screen.getByText("My Task")).toBeTruthy();
  });

  it("renders completion checkbox when not in bulk mode", () => {
    render(createElement(TodoRow, { ...defaultProps }));
    const checkbox = screen.getByRole("checkbox", { name: /Mark "Test task" as complete/ });
    expect(checkbox).toBeTruthy();
    expect(checkbox).not.toBeChecked();
  });

  it("renders selection checkbox when in bulk mode", () => {
    render(createElement(TodoRow, { ...defaultProps, isBulkMode: true }));
    const checkbox = screen.getByRole("checkbox", { name: /Select/ });
    expect(checkbox).toBeTruthy();
    expect(checkbox).not.toBeChecked();
  });

  it("calls onToggle when checkbox is clicked", () => {
    const onToggle = vi.fn();
    render(createElement(TodoRow, { ...defaultProps, onToggle }));

    fireEvent.click(screen.getByRole("checkbox", { name: /Mark "Test task" as complete/ }));
    expect(onToggle).toHaveBeenCalledWith("todo-1", true);
  });

  it("calls onClick when row is clicked (non-bulk mode)", () => {
    const onClick = vi.fn();
    render(createElement(TodoRow, { ...defaultProps, onClick }));

    fireEvent.click(screen.getByText("Test task"));
    expect(onClick).toHaveBeenCalledWith("todo-1");
  });

  it("calls onSelect when row is clicked in bulk mode", () => {
    const onSelect = vi.fn();
    render(createElement(TodoRow, { ...defaultProps, isBulkMode: true, onSelect }));

    fireEvent.click(screen.getByLabelText("Select task Test task"));
    expect(onSelect).toHaveBeenCalledWith("todo-1");
  });

  it("renders kebab menu button", () => {
    render(createElement(TodoRow, { ...defaultProps }));
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
  });

  it("calls onToggle when checkbox is clicked in non-bulk mode", () => {
    const onToggle = vi.fn();
    render(createElement(TodoRow, { ...defaultProps, onToggle }));

    fireEvent.click(screen.getByRole("checkbox", { name: /Mark "Test task" as complete/ }));
    expect(onToggle).toHaveBeenCalledWith("todo-1", true);
  });

  it("calls onInlineEdit when title is double-clicked and edited", () => {
    const onInlineEdit = vi.fn();
    render(createElement(TodoRow, { ...defaultProps, onInlineEdit }));

    // Double-click to enter edit mode
    fireEvent.doubleClick(screen.getByText("Test task"));

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Edited task" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onInlineEdit).toHaveBeenCalledWith("todo-1", "Edited task");
  });

  it("cancels edit on Escape key", () => {
    render(createElement(TodoRow, { ...defaultProps }));

    fireEvent.doubleClick(screen.getByText("Test task"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Edited task" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Should show original title again
    expect(screen.getByText("Test task")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders completed styling when todo is completed", () => {
    render(createElement(TodoRow, { ...defaultProps, todo: makeTodo({ completed: true }) }));

    const title = screen.getByText("Test task");
    expect(title).toHaveClass("todo-title--completed");
  });

  it("shows inline lifecycle actions when onLifecycleAction is provided", () => {
    const onLifecycleAction = vi.fn();
    render(createElement(TodoRow, { ...defaultProps, onLifecycleAction }));

    // Should show snooze and cancel buttons on hover
    expect(screen.getByTitle("Snooze → Tomorrow")).toBeTruthy();
    expect(screen.getByTitle("Cancel task")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Cancel task"));
    expect(onLifecycleAction).toHaveBeenCalledWith("todo-1", "cancel");
  });

  it("shows reopen button for cancelled tasks", () => {
    const onLifecycleAction = vi.fn();
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ status: "cancelled" }),
        onLifecycleAction,
      }),
    );

    expect(screen.getByTitle("Reopen task")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Reopen task"));
    expect(onLifecycleAction).toHaveBeenCalledWith("todo-1", "reopen");
  });

  it("shows archive button for completed tasks", () => {
    const onLifecycleAction = vi.fn();
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ completed: true }),
        onLifecycleAction,
      }),
    );

    expect(screen.getByTitle("Archive")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Archive"));
    expect(onLifecycleAction).toHaveBeenCalledWith("todo-1", "archive");
  });

  it("does not show snooze for completed tasks", () => {
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ completed: true }),
        onLifecycleAction: vi.fn(),
      }),
    );

    expect(screen.queryByTitle("Snooze → Tomorrow")).toBeNull();
  });

  it("shows overdue class when due date is in the past", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ dueDate: yesterday.toISOString() }),
      }),
    );

    const row = screen.getByText("Test task").closest(".todo-item");
    expect(row).toHaveClass("todo-item--overdue");
  });

  it("shows description preview in spacious density", () => {
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ description: "A detailed description" }),
        density: "spacious",
      }),
    );

    expect(screen.getByText("A detailed description")).toBeTruthy();
  });

  it("truncates long descriptions in spacious density", () => {
    const longDesc = "A".repeat(150);
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ description: longDesc }),
        density: "spacious",
      }),
    );

    expect(screen.getByText(/A{120}\.\.\./)).toBeTruthy();
  });

  it("shows subtask progress bar in spacious density", () => {
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({
          subtasks: [
            { id: "s1", title: "Step 1", completed: true },
            { id: "s2", title: "Step 2", completed: false },
          ],
        }),
        density: "spacious",
      }),
    );

    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("shows notes indicator in spacious density", () => {
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ notes: "Some notes" }),
        density: "spacious",
      }),
    );

    expect(screen.getByText("Has notes")).toBeTruthy();
  });

  it("calls onTagClick when a tag chip is clicked", () => {
    const onTagClick = vi.fn();
    render(
      createElement(TodoRow, {
        ...defaultProps,
        todo: makeTodo({ tags: ["work", "urgent"] }),
        onTagClick,
      }),
    );

    const chips = screen.getAllByText(/#work|#urgent/);
    if (chips.length > 0) {
      fireEvent.click(chips[0]);
      expect(onTagClick).toHaveBeenCalled();
    }
  });
});
