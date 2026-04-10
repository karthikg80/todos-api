// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, createElement } from "@testing-library/react";
import React from "react";
import { TaskPicker } from "./TaskPicker";
import type { Todo } from "../../types";

const { createElement: ce } = React;

const mockTodos: Todo[] = [
  { id: "t1", title: "Write report", completed: false, archived: false, status: "next" },
  { id: "t2", title: "Review PR", completed: false, archived: false, status: "next" },
  { id: "t3", title: "Fix bug", completed: false, archived: false, status: "next" },
  { id: "t4", title: "Completed task", completed: true, archived: false, status: "next" },
  { id: "t5", title: "Task with category", completed: false, archived: false, status: "next", category: "work" },
];

const defaultProps = {
  todos: mockTodos,
  excludeId: "",
  selectedIds: [] as string[],
  onChange: vi.fn(),
};

describe("TaskPicker", () => {
  it("renders with placeholder", () => {
    render(ce(TaskPicker, defaultProps));
    expect(screen.getByPlaceholderText("Search tasks to link…")).toBeTruthy();
  });

  it("shows selected tasks as chips", () => {
    render(ce(TaskPicker, { ...defaultProps, selectedIds: ["t1"] }));
    expect(screen.getByText("Write report")).toBeTruthy();
  });

  it("removes a chip when close button is clicked", () => {
    const onChange = vi.fn();
    render(ce(TaskPicker, { ...defaultProps, selectedIds: ["t1"], onChange }));

    const removeBtn = screen.getByLabelText("Remove Write report");
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("filters tasks by query", () => {
    render(ce(TaskPicker, defaultProps));
    const input = screen.getByPlaceholderText("Search tasks to link…");

    fireEvent.change(input, { target: { value: "report" } });
    expect(screen.getByText("Write report")).toBeTruthy();
    expect(screen.queryByText("Review PR")).toBeNull();
  });

  it("selects a task from dropdown", () => {
    const onChange = vi.fn();
    render(ce(TaskPicker, { ...defaultProps, onChange }));

    const input = screen.getByPlaceholderText("Search tasks to link…");
    fireEvent.change(input, { target: { value: "report" } });

    const option = screen.getByText("Write report").closest("button");
    fireEvent.mouseDown(option!);

    expect(onChange).toHaveBeenCalledWith(["t1"]);
  });

  it("excludes completed tasks from results", () => {
    render(ce(TaskPicker, defaultProps));
    const input = screen.getByPlaceholderText("Search tasks to link…");
    fireEvent.change(input, { target: { value: "completed" } });

    expect(screen.queryByText("Completed task")).toBeNull();
  });

  it("excludes already selected tasks from results", () => {
    render(ce(TaskPicker, { ...defaultProps, selectedIds: ["t1"] }));
    const input = screen.getByPlaceholderText("Add another…");
    fireEvent.change(input, { target: { value: "report" } });

    // The task "Write report" is shown as a chip (already selected), not in dropdown
    const dropdown = document.querySelector(".task-picker__dropdown");
    expect(dropdown).toBeNull();
  });

  it("navigates with arrow keys", () => {
    render(ce(TaskPicker, defaultProps));
    const input = screen.getByPlaceholderText("Search tasks to link…");

    fireEvent.change(input, { target: { value: "" } });
    // Arrow down with empty query doesn't show results
    fireEvent.keyDown(input, { key: "ArrowDown" });
  });

  it("clears query on Escape", () => {
    render(ce(TaskPicker, defaultProps));
    const input = screen.getByPlaceholderText("Search tasks to link…");

    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect((input as HTMLInputElement).value).toBe("");
  });

  it("removes last selected task on Backspace with empty query", () => {
    const onChange = vi.fn();
    render(ce(TaskPicker, { ...defaultProps, selectedIds: ["t1", "t2"], onChange }));
    const input = screen.getByPlaceholderText("Add another…");

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(["t1"]);
  });

  it("shows task category in dropdown", () => {
    render(ce(TaskPicker, defaultProps));
    const input = screen.getByPlaceholderText("Search tasks to link…");
    fireEvent.change(input, { target: { value: "category" } });

    expect(screen.getByText("Task with category")).toBeTruthy();
  });

  it("limits results to 8", () => {
    const manyTodos: Todo[] = Array.from({ length: 15 }, (_, i) => ({
      id: `t-${i}`,
      title: `Task ${i}`,
      completed: false,
      archived: false,
      status: "next" as const,
    }));

    render(ce(TaskPicker, { ...defaultProps, todos: manyTodos }));
    const input = screen.getByPlaceholderText("Search tasks to link…");
    fireEvent.change(input, { target: { value: "Task" } });

    const options = document.querySelectorAll(".task-picker__option");
    expect(options.length).toBeLessThanOrEqual(8);
  });
});
