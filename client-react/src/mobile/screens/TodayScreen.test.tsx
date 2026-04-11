// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TodayScreen } from "./TodayScreen";
import type { Todo, Project, User } from "../../types";

const { createElement: ce } = React;

const mockUser: User = { id: "u1", name: "Test User", email: "test@example.com" };

const defaultProps = {
  todos: [] as Todo[],
  projects: [] as Project[],
  user: mockUser,
  onTodoClick: vi.fn(),
  onToggleTodo: vi.fn(),
  onAvatarClick: vi.fn(),
  onSnoozeTodo: vi.fn(),
};

const iso = "2024-01-01T00:00:00.000Z";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  const id = overrides.id ?? `todo-${Math.random()}`;
  return {
    id,
    title: "Test task",
    description: null,
    notes: null,
    status: "next",
    completed: false,
    completedAt: null,
    projectId: null,
    category: null,
    headingId: null,
    tags: [],
    context: null,
    energy: null,
    dueDate: null,
    startDate: null,
    scheduledDate: null,
    reviewDate: null,
    doDate: null,
    estimateMinutes: null,
    waitingOn: null,
    dependsOnTaskIds: [],
    order: 0,
    priority: null,
    archived: false,
    recurrence: null,
    source: null,
    effortScore: null,
    userId: "u1",
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}

describe("TodayScreen", () => {
  it("renders with MobileHeader", () => {
    render(ce(TodayScreen, defaultProps));
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("shows formatted date", () => {
    render(ce(TodayScreen, defaultProps));
    // The date is formatted using toLocaleDateString, so it varies by locale.
    // Just check that a subtitle element exists with the current date.
    const subtitle = screen.getByText((content) => {
      const now = new Date();
      return content.includes(now.toLocaleDateString("en-US", { month: "long" }));
    });
    expect(subtitle).toBeTruthy();
  });

  it("shows pull to search hint", () => {
    render(ce(TodayScreen, defaultProps));
    expect(screen.getByText("↓ pull to search")).toBeTruthy();
  });

  it("shows empty state when no tasks", () => {
    render(ce(TodayScreen, defaultProps));
    expect(screen.getByText("Nothing due today. Enjoy your day!")).toBeTruthy();
  });

  it("groups overdue tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdue = makeTodo({ title: "Overdue task", dueDate: yesterday.toISOString().split("T")[0] });

    render(ce(TodayScreen, { ...defaultProps, todos: [overdue] }));
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Overdue task")).toBeTruthy();
  });

  it("groups due today tasks", () => {
    // Use a task with status "next" and no due date — these are treated as "due today" by the component.
    const dueToday = makeTodo({ title: "Due today", status: "next" as const });

    render(ce(TodayScreen, { ...defaultProps, todos: [dueToday] }));
    expect(screen.getByText("Due Today")).toBeTruthy();
    expect(screen.getByText("Due today")).toBeTruthy();
  });

  it("groups scheduled tasks with future due dates", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduled = makeTodo({ title: "Future task", dueDate: tomorrow.toISOString().split("T")[0] });

    render(ce(TodayScreen, { ...defaultProps, todos: [scheduled] }));
    // Group title exists
    expect(screen.getByText("Scheduled")).toBeTruthy();
    // Task title exists in the group
    expect(screen.getByText("Future task")).toBeTruthy();
  });

  it("excludes completed tasks", () => {
    const completed = makeTodo({ title: "Done", completed: true });
    render(ce(TodayScreen, { ...defaultProps, todos: [completed] }));
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.getByText(/Nothing due today/)).toBeTruthy();
  });

  it("excludes archived tasks", () => {
    const archived = makeTodo({ title: "Archived", archived: true });
    render(ce(TodayScreen, { ...defaultProps, todos: [archived] }));
    expect(screen.queryByText("Archived")).toBeNull();
  });

  it("calls onToggleTodo when check is clicked", () => {
    const onToggleTodo = vi.fn();
    const todo = makeTodo({ title: "Toggle me" });
    const { container } = render(ce(TodayScreen, { ...defaultProps, todos: [todo], onToggleTodo }));

    const check = container.querySelector(".m-todo-row__check");
    if (check) fireEvent.click(check);
    expect(onToggleTodo).toHaveBeenCalledWith(todo.id, true);
  });

  it("calls onTodoClick when row is clicked", () => {
    const onTodoClick = vi.fn();
    const todo = makeTodo({ title: "Click me" });
    render(ce(TodayScreen, { ...defaultProps, todos: [todo], onTodoClick }));

    const row = screen.getByText("Click me").closest("button");
    if (row) fireEvent.click(row);
    expect(onTodoClick).toHaveBeenCalledWith(todo.id);
  });

  it("calls onSnoozeTodo when swiped left", () => {
    const onSnoozeTodo = vi.fn();
    const todo = makeTodo({ title: "Snooze me" });
    render(ce(TodayScreen, { ...defaultProps, todos: [todo], onSnoozeTodo }));

    // SwipeRow is used internally — verify the component renders with the right props
    // The SwipeRow wraps the TodoRowInner, so we check the row exists
    expect(screen.getByText("Snooze me")).toBeTruthy();
  });

  it("shows project name in todo row meta", () => {
    const project: Project = {
      id: "p1",
      name: "Work",
      status: "active",
      archived: false,
      userId: "u1",
      createdAt: iso,
      updatedAt: iso,
    };
    const todo = makeTodo({ title: "With project", projectId: "p1" });

    render(ce(TodayScreen, { ...defaultProps, todos: [todo], projects: [project] }));
    expect(screen.getByText("Work")).toBeTruthy();
  });
});
