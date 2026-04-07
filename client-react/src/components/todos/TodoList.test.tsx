// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodoList } from "./TodoList";
import type { Todo } from "../../types";

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
  subtasks: overrides.subtasks ?? undefined,
  userId: overrides.userId ?? "user-1",
  createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
});

const defaultProps = {
  loadState: "loaded" as const,
  errorMessage: "",
  activeTodoId: null,
  isBulkMode: false,
  selectedIds: new Set<string>(),
  onToggle: vi.fn(),
  onClick: vi.fn(),
  onKebab: vi.fn(),
  onRetry: vi.fn(),
  onSelect: vi.fn(),
  onInlineEdit: vi.fn(),
};

describe("TodoList", () => {
  it("renders loading skeleton when loadState is 'loading'", () => {
    const { container } = render(createElement(TodoList, { ...defaultProps, todos: [], loadState: "loading" }));
    const skeleton = container.querySelector(".loading-skeleton");
    expect(skeleton).toBeTruthy();
    expect(container.querySelectorAll(".loading-skeleton__row").length).toBe(5);
  });

  it("renders error state with retry button when loadState is 'error'", () => {
    render(
      createElement(TodoList, {
        ...defaultProps,
        todos: [],
        loadState: "error",
        errorMessage: "Network failed",
      }),
    );
    expect(screen.getByText("Network failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("renders empty state illustration when loaded with no todos", () => {
    render(createElement(TodoList, { ...defaultProps, todos: [], loadState: "loaded" }));
    expect(screen.getByText("No tasks yet. Add one above!")).toBeTruthy();
  });

  it("renders todo rows for each todo", () => {
    const todos = [makeTodo({ id: "1", title: "Task one" }), makeTodo({ id: "2", title: "Task two" })];
    render(createElement(TodoList, { ...defaultProps, todos, loadState: "loaded" }));

    expect(screen.getByText("Task one")).toBeTruthy();
    expect(screen.getByText("Task two")).toBeTruthy();
  });

  it("calls onToggle when completion checkbox is clicked", () => {
    const onToggle = vi.fn();
    const todos = [makeTodo({ id: "1", title: "Task", completed: false })];
    render(
      createElement(TodoList, { ...defaultProps, todos, loadState: "loaded", onToggle }),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Mark "Task" as complete/ }));
    expect(onToggle).toHaveBeenCalledWith("1", true);
  });

  it("calls onClick when row is clicked (non-bulk mode)", () => {
    const onClick = vi.fn();
    const todos = [makeTodo({ id: "1", title: "Task" })];
    render(
      createElement(TodoList, { ...defaultProps, todos, loadState: "loaded", onClick }),
    );

    fireEvent.click(screen.getByText("Task"));
    expect(onClick).toHaveBeenCalledWith("1");
  });

  it("calls onSelect when row is clicked in bulk mode", () => {
    const onSelect = vi.fn();
    const todos = [makeTodo({ id: "1", title: "Task" })];
    render(
      createElement(TodoList, {
        ...defaultProps,
        todos,
        loadState: "loaded",
        isBulkMode: true,
        onSelect,
      }),
    );

    fireEvent.click(screen.getByLabelText("Select task Task"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("shows completed class on completed todos", () => {
    const todos = [makeTodo({ id: "1", title: "Done task", completed: true })];
    render(createElement(TodoList, { ...defaultProps, todos, loadState: "loaded" }));

    const row = screen.getByText("Done task").closest(".todo-item");
    expect(row).toHaveClass("completed");
    expect(row).toHaveClass("todo-item--completed");
  });
});
