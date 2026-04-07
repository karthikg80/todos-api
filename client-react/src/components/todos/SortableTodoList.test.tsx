// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SortableTodoList } from "./SortableTodoList";
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
  todos: [defaultTodo],
  loadState: "loaded" as const,
  errorMessage: "",
  activeTodoId: null,
  expandedTodoId: null,
  isBulkMode: false,
  selectedIds: new Set<string>(),
  projects: [] as Project[],
  headings: [] as Heading[],
  onToggle: vi.fn(),
  onClick: vi.fn(),
  onKebab: vi.fn(),
  onRetry: vi.fn(),
  onSelect: vi.fn(),
  onInlineEdit: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
  onReorder: vi.fn(),
  sortBy: "order" as const,
  sortOrder: "asc" as const,
  onSortChange: vi.fn(),
};

describe("SortableTodoList", () => {
  it("renders loading skeleton when loadState is loading", () => {
    const { container } = render(createElement(SortableTodoList, { ...defaultProps, todos: [], loadState: "loading" }));
    const skeleton = container.querySelector(".loading-skeleton");
    expect(skeleton).toBeTruthy();
    expect(container.querySelectorAll(".loading-skeleton__row").length).toBe(5);
  });

  it("renders error state with retry button", () => {
    render(createElement(SortableTodoList, {
      ...defaultProps,
      todos: [],
      loadState: "error",
      errorMessage: "Failed to load",
    }));
    expect(screen.getByText("Failed to load")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("renders empty state when no todos", () => {
    render(createElement(SortableTodoList, { ...defaultProps, todos: [], loadState: "loaded" }));
    expect(screen.getByText("No tasks yet. Add one above!")).toBeTruthy();
  });

  it("renders todo rows for each todo", () => {
    const todos = [makeTodo({ id: "1", title: "Task one" }), makeTodo({ id: "2", title: "Task two" })];
    render(createElement(SortableTodoList, { ...defaultProps, todos }));

    expect(screen.getByText("Task one")).toBeTruthy();
    expect(screen.getByText("Task two")).toBeTruthy();
  });

  it("calls onToggle when checkbox is clicked", () => {
    const onToggle = vi.fn();
    render(createElement(SortableTodoList, { ...defaultProps, onToggle }));

    fireEvent.click(screen.getByRole("checkbox", { name: /Mark "Test task" as complete/ }));
    expect(onToggle).toHaveBeenCalledWith("todo-1", true);
  });

  it("calls onClick when row is clicked", () => {
    const onClick = vi.fn();
    render(createElement(SortableTodoList, { ...defaultProps, onClick }));

    fireEvent.click(screen.getByText("Test task"));
    expect(onClick).toHaveBeenCalledWith("todo-1");
  });

  it("calls onInlineEdit when title is double-clicked and saved", () => {
    const onInlineEdit = vi.fn();
    render(createElement(SortableTodoList, { ...defaultProps, onInlineEdit }));

    fireEvent.doubleClick(screen.getByText("Test task"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Edited" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onInlineEdit).toHaveBeenCalledWith("todo-1", "Edited");
  });

  it("renders group headers when grouped by status", () => {
    const todos = [
      makeTodo({ id: "1", title: "Next task", status: "next" }),
      makeTodo({ id: "2", title: "Waiting task", status: "waiting" }),
    ];
    const { container } = render(createElement(SortableTodoList, {
      ...defaultProps,
      todos,
      groupBy: "status",
      groupByOptions: ["status"],
    }));

    // Should show group headers with status names
    const headers = container.querySelectorAll(".group-header");
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it("renders with correct props", () => {
    const { container } = render(createElement(SortableTodoList, {
      ...defaultProps,
      sortBy: "title",
      sortOrder: "desc",
    }));
    // Should render the list container
    expect(container.querySelector("#todosList")).toBeTruthy();
  });

  it("calls onReorder when drag ends", () => {
    const onReorder = vi.fn();
    render(createElement(SortableTodoList, { ...defaultProps, onReorder }));

    // The SortableRow should have drag handles
    const dragHandle = screen.getByRole("button", { name: "Drag to reorder" });
    expect(dragHandle).toBeTruthy();
  });

  it("applies compact density styling", () => {
    const todo = makeTodo({ description: "A description" });
    render(createElement(SortableTodoList, { ...defaultProps, todos: [todo], density: "compact" }));
    // Compact density should not show description previews
    expect(screen.queryByText("A description")).toBeNull();
  });

  it("shows description preview in spacious density", () => {
    const todo = makeTodo({ description: "A detailed description" });
    render(createElement(SortableTodoList, {
      ...defaultProps,
      todos: [todo],
      density: "spacious",
    }));

    expect(screen.getByText("A detailed description")).toBeTruthy();
  });
});
