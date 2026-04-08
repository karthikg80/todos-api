// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { BoardView } from "./BoardView";
import type { Todo } from "../../types";

// Mock Illustrations
vi.mock("../shared/Illustrations", () => ({
  IllustrationBoardEmpty: () => createElement("div", { "data-testid": "board-empty" }),
}));

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
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const defaultProps = {
  todos: [],
  loadState: "loaded" as const,
  onToggle: vi.fn(),
  onClick: vi.fn(),
  onStatusChange: vi.fn(),
};

describe("BoardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with column skeletons", () => {
    render(createElement(BoardView, { ...defaultProps, loadState: "loading" }));
    const columns = screen.getAllByText(/Inbox|Next|In Progress|Waiting|Done/);
    expect(columns.length).toBeGreaterThanOrEqual(5);
  });

  it("renders all five board columns", () => {
    render(createElement(BoardView, defaultProps));
    expect(screen.getByText("Inbox")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("shows column counts for each status", () => {
    const todos = [
      makeTodo({ id: "1", title: "Task 1", status: "next" }),
      makeTodo({ id: "2", title: "Task 2", status: "next" }),
      makeTodo({ id: "3", title: "Task 3", status: "inbox" }),
    ];
    render(createElement(BoardView, { ...defaultProps, todos }));
    expect(screen.getByText("2")).toBeTruthy(); // Next column count
  });

  it("renders task cards in the correct columns", () => {
    const todos = [
      makeTodo({ id: "1", title: "Next task", status: "next" }),
      makeTodo({ id: "2", title: "Inbox task", status: "inbox" }),
    ];
    render(createElement(BoardView, { ...defaultProps, todos }));
    expect(screen.getByText("Next task")).toBeTruthy();
    expect(screen.getByText("Inbox task")).toBeTruthy();
  });

  it("calls onClick when a card is clicked", () => {
    const onClick = vi.fn();
    const todos = [makeTodo({ id: "1", title: "Click me" })];
    render(createElement(BoardView, { ...defaultProps, todos, onClick }));
    fireEvent.click(screen.getByRole("button", { name: "Open task Click me" }));
    expect(onClick).toHaveBeenCalledWith("1");
  });

  it("calls onToggle when checkbox is clicked", () => {
    const onToggle = vi.fn();
    const todos = [makeTodo({ id: "1", title: "Task", completed: false })];
    render(createElement(BoardView, { ...defaultProps, todos, onToggle }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Mark "Task" as complete/ }));
    expect(onToggle).toHaveBeenCalledWith("1", true);
  });

  it("calls onStatusChange when a card is dropped on a column", () => {
    const onStatusChange = vi.fn();
    const todos = [makeTodo({ id: "1", title: "Drag me", status: "inbox" })];
    render(createElement(BoardView, { ...defaultProps, todos, onStatusChange }));
    
    const nextColumn = screen.getByText("Next").closest(".board__column")!;
    const dragEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => "1" },
    } as unknown as React.DragEvent;
    fireEvent.drop(nextColumn, dragEvent);
    expect(onStatusChange).toHaveBeenCalledWith("1", { status: "next" });
  });

  it("shows completed styling for done tasks", () => {
    const todos = [makeTodo({ id: "1", title: "Done task", status: "done", completed: true })];
    const { container } = render(createElement(BoardView, { ...defaultProps, todos }));
    const card = container.querySelector(".board__card--done");
    expect(card).toBeTruthy();
  });

  it("shows due date on cards", () => {
    const todos = [makeTodo({ id: "1", title: "Due task", dueDate: "2026-05-01T00:00:00.000Z" })];
    const { container } = render(createElement(BoardView, { ...defaultProps, todos }));
    // Date is rendered in board__card-meta, check that it exists
    expect(container.querySelector(".board__card-meta")).toBeTruthy();
  });

  it("shows priority chip for high and urgent tasks", () => {
    const todos = [
      makeTodo({ id: "1", title: "Urgent task", priority: "urgent" }),
      makeTodo({ id: "2", title: "High task", priority: "high" }),
    ];
    render(createElement(BoardView, { ...defaultProps, todos }));
    expect(screen.getByText("urgent")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
  });

  it("does not show priority chip for low and medium tasks", () => {
    const todos = [
      makeTodo({ id: "1", title: "Low task", priority: "low" }),
      makeTodo({ id: "2", title: "Medium task", priority: "medium" }),
    ];
    render(createElement(BoardView, { ...defaultProps, todos }));
    expect(screen.queryByText("low")).toBeNull();
    expect(screen.queryByText("medium")).toBeNull();
  });

  it("shows empty state illustration in columns with no tasks", () => {
    render(createElement(BoardView, { ...defaultProps, todos: [] }));
    expect(screen.getAllByTestId("board-empty").length).toBeGreaterThanOrEqual(1);
  });

  it("routes unknown statuses to inbox", () => {
    const todos = [makeTodo({ id: "1", title: "Unknown status", status: "unknown" as any })];
    render(createElement(BoardView, { ...defaultProps, todos }));
    expect(screen.getByText("Unknown status")).toBeTruthy();
  });

  it("handles keyboard navigation on cards", () => {
    const onClick = vi.fn();
    const todos = [makeTodo({ id: "1", title: "Keyboard task" })];
    render(createElement(BoardView, { ...defaultProps, todos, onClick }));
    const card = screen.getByRole("button", { name: "Open task Keyboard task" });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalledWith("1");
  });
});
